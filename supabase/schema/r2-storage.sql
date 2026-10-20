-- Private R2 objects are confirmed exclusively by the Edge service.
grant usage on schema voxi_private to service_role;
alter table public.voxi_tracks add column storage_provider text not null default 'supabase'
 check(storage_provider in ('supabase','r2'));
create table voxi_private.r2_uploads(
 id uuid primary key default gen_random_uuid(), actor uuid not null, user_id uuid not null,
 path text unique not null, bytes bigint not null check(bytes between 1 and 52428800),
 title text not null, file_name text not null, content_type text not null,
 booking_id bigint, song_slot integer, expires_at timestamptz,
 state text not null default 'reserved' check(state in ('reserved','uploading','stored','cleaning','removed')),
 created_at timestamptz not null default now(), verified_at timestamptz, track_id uuid,
 check(path like user_id::text||'/%')
);
alter table voxi_private.r2_uploads enable row level security;
revoke all on voxi_private.r2_uploads from public,anon,authenticated;
create table voxi_private.r2_inventory(singleton boolean primary key default true check(singleton),bytes bigint not null check(bytes>=0),checked_at timestamptz not null);
alter table voxi_private.r2_inventory enable row level security;
revoke all on voxi_private.r2_inventory from public,anon,authenticated;

create function voxi_private.r2_reserve(p_actor uuid,p_user uuid,p_bytes bigint,p_title text,p_name text,p_type text,p_booking bigint,p_slot integer,p_expires timestamptz,p_inventory bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare used bigint; pending bigint; item voxi_private.r2_uploads; ext text;
begin
 perform pg_advisory_xact_lock(82104620);
 if p_bytes is null or p_bytes<1 or p_bytes>52428800 or p_inventory is null or p_inventory<0 then raise exception 'Invalid size';end if;
 if p_title is null or length(trim(p_title)) not between 1 and 200 or p_name is null or length(p_name)>255 then raise exception 'Invalid title';end if;
 ext:=lower(substring(p_name from '\.([a-zA-Z0-9]+)$'));
 if ext is null or not(ext=any(array['mp3','wav','m4a','ogg','flac'])) or p_type is distinct from (case ext when 'mp3' then 'audio/mpeg' when 'wav' then 'audio/wav' when 'm4a' then 'audio/mp4' when 'ogg' then 'audio/ogg' when 'flac' then 'audio/flac' end) then raise exception 'Invalid audio';end if;
 if not exists(select 1 from auth.users where id=p_user) then raise exception 'Unknown client';end if;
 if p_expires is not null and p_expires<=now() then raise exception 'Invalid expiry';end if;
 if (p_booking is null)<>(p_slot is null) then raise exception 'Choose a song slot';end if;
 if p_booking is not null and not exists(select 1 from public.voxi_bookings where id=p_booking and user_id=p_user and status<>'Отменено' and p_slot between 1 and song_count) then raise exception 'Invalid booking';end if;
 -- No timed release: an ambiguous PUT may already occupy real storage.
 select coalesce(sum(bytes) filter(where state='stored'),0),coalesce(sum(bytes) filter(where state in ('reserved','uploading','cleaning')),0) into used,pending from voxi_private.r2_uploads;
 if greatest(used,p_inventory)+pending+p_bytes>9000000000 then raise exception 'R2: достигнут лимит 9 ГБ. Освободите место.';end if;
 if (select count(*) from voxi_private.r2_uploads where actor=p_actor and state in ('reserved','uploading'))>=3 then raise exception 'Завершите предыдущие загрузки или очистку.';end if;
 if (select count(*) from voxi_private.r2_uploads where actor=p_actor and created_at>now()-interval '1 hour')>=60 then raise exception 'Слишком много загрузок. Попробуйте позже.';end if;
 insert into voxi_private.r2_inventory values(true,p_inventory,now()) on conflict(singleton) do update set bytes=excluded.bytes,checked_at=excluded.checked_at;
 insert into voxi_private.r2_uploads(actor,user_id,path,bytes,title,file_name,content_type,booking_id,song_slot,expires_at)
 values(p_actor,p_user,p_user::text||'/'||gen_random_uuid()::text||'.'||ext,p_bytes,trim(p_title),p_name,p_type,p_booking,p_slot,p_expires) returning * into item;
 return to_jsonb(item);
end $$;

create function voxi_private.r2_claim(p_id uuid,p_actor uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare item voxi_private.r2_uploads;
begin
 update voxi_private.r2_uploads set state='uploading' where id=p_id and actor=p_actor and state='reserved' and created_at>now()-interval '30 minutes' returning * into item;
 if not found then raise exception 'Загрузка уже начата или истекла. Обновите список песен.';end if;
 return to_jsonb(item);
end $$;
create function voxi_private.r2_verify(p_id uuid,p_bytes bigint) returns void language plpgsql security definer set search_path='' as $$
begin
 update voxi_private.r2_uploads set state='stored',verified_at=now() where id=p_id and state='uploading' and bytes=p_bytes;
 if not found then raise exception 'Object verification failed';end if;
end $$;
create function voxi_private.r2_removed(p_path text) returns void language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(82104620);
 update voxi_private.r2_uploads set state='removed' where path=p_path;
end $$;

create function voxi_private.track_object_exists(provider text,path text,bytes bigint,recipient uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select case provider when 'supabase' then exists(select 1 from storage.objects where bucket_id='voxi-tracks' and name=path and metadata->>'size'=bytes::text)
 when 'r2' then exists(select 1 from voxi_private.r2_uploads where r2_uploads.path=track_object_exists.path and user_id=recipient and r2_uploads.bytes=track_object_exists.bytes and state='stored' and verified_at is not null) else false end;
$$;
revoke all on function voxi_private.track_object_exists(text,text,bigint,uuid) from public,anon,authenticated;

create function voxi_private.r2_finalize(p_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare item voxi_private.r2_uploads; tid uuid; next_number integer;
begin
 if not voxi_private.has_role(array['owner','admin']) then raise exception 'Forbidden' using errcode='42501';end if;
 select * into item from voxi_private.r2_uploads where id=p_id and actor=auth.uid() for update;
 if not found or item.state<>'stored' or item.verified_at is null then raise exception 'Upload not verified';end if;
 if item.track_id is not null then return item.track_id;end if;
 perform pg_advisory_xact_lock(hashtextextended(item.user_id::text,0));
 select coalesce(max(song_number),0)+1 into next_number from public.voxi_tracks where user_id=item.user_id;
 insert into public.voxi_tracks(user_id,song_number,song_title,storage_path,storage_provider,file_name,file_size,booking_id,booking_song_number,expires_at)
 values(item.user_id,next_number,item.title,item.path,'r2',item.file_name,item.bytes,item.booking_id,item.song_slot,item.expires_at) returning id into tid;
 update voxi_private.r2_uploads set track_id=tid where id=p_id;
 return tid;
end $$;
create function public.voxi_r2_finalize(p_id uuid) returns uuid language sql security invoker set search_path='' as $$ select voxi_private.r2_finalize(p_id); $$;
revoke all on function voxi_private.r2_finalize(uuid),public.voxi_r2_finalize(uuid) from public,anon;
grant execute on function voxi_private.r2_finalize(uuid),public.voxi_r2_finalize(uuid) to authenticated;

-- Service wrappers have no grants to browser roles.
create function public.voxi_r2_reserve(p_actor uuid,p_user uuid,p_bytes bigint,p_title text,p_name text,p_type text,p_booking bigint,p_slot integer,p_expires timestamptz,p_inventory bigint)
returns jsonb language sql security invoker set search_path='' as $$ select voxi_private.r2_reserve(p_actor,p_user,p_bytes,p_title,p_name,p_type,p_booking,p_slot,p_expires,p_inventory); $$;
create function public.voxi_r2_claim(p_id uuid,p_actor uuid) returns jsonb language sql security invoker set search_path='' as $$ select voxi_private.r2_claim(p_id,p_actor); $$;
create function public.voxi_r2_verify(p_id uuid,p_bytes bigint) returns void language sql security invoker set search_path='' as $$ select voxi_private.r2_verify(p_id,p_bytes); $$;
create function public.voxi_r2_removed(p_path text) returns void language sql security invoker set search_path='' as $$ select voxi_private.r2_removed(p_path); $$;
revoke all on function public.voxi_r2_reserve(uuid,uuid,bigint,text,text,text,bigint,integer,timestamptz,bigint),voxi_private.r2_reserve(uuid,uuid,bigint,text,text,text,bigint,integer,timestamptz,bigint),public.voxi_r2_claim(uuid,uuid),voxi_private.r2_claim(uuid,uuid),public.voxi_r2_verify(uuid,bigint),voxi_private.r2_verify(uuid,bigint),public.voxi_r2_removed(text),voxi_private.r2_removed(text) from public,anon,authenticated;
grant execute on function public.voxi_r2_reserve(uuid,uuid,bigint,text,text,text,bigint,integer,timestamptz,bigint),voxi_private.r2_reserve(uuid,uuid,bigint,text,text,text,bigint,integer,timestamptz,bigint),public.voxi_r2_claim(uuid,uuid),voxi_private.r2_claim(uuid,uuid),public.voxi_r2_verify(uuid,bigint),voxi_private.r2_verify(uuid,bigint),public.voxi_r2_removed(text),voxi_private.r2_removed(text) to service_role;

create function voxi_private.guard_track_provider() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and (new.storage_provider is distinct from old.storage_provider or new.storage_path is distinct from old.storage_path or new.user_id is distinct from old.user_id or new.file_size is distinct from old.file_size) then raise exception 'File identity is immutable';end if;
 if new.storage_provider='r2' and not voxi_private.track_object_exists('r2',new.storage_path,new.file_size,new.user_id) then raise exception 'R2 object not verified';end if;
 return new;
end $$;
revoke all on function voxi_private.guard_track_provider() from public,anon,authenticated;
create trigger voxi_guard_track_provider before insert or update on public.voxi_tracks for each row execute function voxi_private.guard_track_provider();

create or replace function voxi_private.delivered_track_count(booking bigint) returns integer
language sql stable security invoker set search_path='' as $$
 select count(distinct t.booking_song_number)::integer from public.voxi_tracks t join public.voxi_bookings b on b.id=t.booking_id and b.user_id=t.user_id

 where voxi_private.track_object_exists(t.storage_provider,t.storage_path,t.file_size,t.user_id) and t.booking_id=booking and t.booking_song_number between 1 and b.song_count and t.deleted_at is null and (t.expires_at is null or t.expires_at>now());
$$;
create or replace function voxi_private.account_track_delivery() returns trigger
language plpgsql security definer set search_path='' as $$
declare b public.voxi_bookings;
begin
 if tg_op='UPDATE' and old.booking_id is not null and (new.booking_id is distinct from old.booking_id or new.booking_song_number is distinct from old.booking_song_number) then raise exception 'Песню нельзя перенести в другую заявку или на другой номер. Загрузите отдельный файл.';end if;
 if new.booking_id is null then return new;end if;
 if not voxi_private.has_role(array['owner','admin']) then raise exception 'Only studio administrators may deliver tracks' using errcode='42501';end if;
 select * into b from public.voxi_bookings where id=new.booking_id for update;
 if not found or b.user_id is distinct from new.user_id then raise exception 'Заявка принадлежит другому клиенту. Выберите правильную заявку.';end if;
 if b.status='Отменено' then raise exception 'Заявка отменена. Выберите другую заявку.';end if;
 if b.song_count is null or b.song_count<1 or b.song_count>100 or b.price is null or b.price<0 or b.price>100000000 then raise exception 'Проверьте количество песен и сумму заявки.';end if;
 if new.booking_song_number is null or new.booking_song_number<1 or new.booking_song_number>b.song_count then raise exception 'Выберите номер песни из заявки.';end if;
 if not voxi_private.track_object_exists(new.storage_provider,new.storage_path,new.file_size,new.user_id) then raise exception 'Файл ещё не загружен полностью. Обновите список перед повтором.';end if;
 if exists(select 1 from voxi_private.payments where booking_id=b.id) then return new;end if;
 if voxi_private.delivered_track_count(b.id)>=b.song_count then
  insert into voxi_private.payments(booking_id,client_name,booking_date,booking_time,song_titles,song_count,quoted_amount,amount,paid_on,created_by)
  values(b.id,b.client_name,b.booking_date,b.booking_time,b.song_titles,b.song_count,b.price,b.price,(now() at time zone 'Asia/Oral')::date,auth.uid());
  update public.voxi_bookings set status='Готово' where id=b.id;
 end if;
 return new;
end $$;
drop trigger voxi_account_track_delivery on public.voxi_tracks;
create trigger voxi_account_track_delivery after insert or update of booking_id,booking_song_number,user_id,storage_path,storage_provider,file_size on public.voxi_tracks for each row execute function voxi_private.account_track_delivery();

create or replace function voxi_private.client_delivery_orders(client uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not voxi_private.has_role(array['owner','admin']) then raise exception 'Only studio administrators may view delivery orders' using errcode='42501';end if;
 select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) into result from (
  select b.id,b.booking_date,b.booking_time,b.song_count,b.song_titles,b.price,b.status,voxi_private.delivered_track_count(b.id) as uploaded_count,
   exists(select 1 from voxi_private.payments p where p.booking_id=b.id) as accounted,
   coalesce((select jsonb_agg(t.booking_song_number) from public.voxi_tracks t where voxi_private.track_object_exists(t.storage_provider,t.storage_path,t.file_size,t.user_id) and t.booking_id=b.id and t.user_id=b.user_id and t.deleted_at is null and (t.expires_at is null or t.expires_at>now())),'[]'::jsonb) as delivered_song_numbers
  from public.voxi_bookings b where b.user_id=client and b.status<>'Отменено'
  order by exists(select 1 from voxi_private.payments p where p.booking_id=b.id),b.booking_date desc,b.id desc limit 100
 ) r;
 return result;
end $$;

create function voxi_private.r2_pending_bytes() returns bigint language sql stable security definer set search_path='' as $$ select coalesce(sum(bytes),0)::bigint from voxi_private.r2_uploads where state in ('reserved','uploading','cleaning'); $$;
create function public.voxi_r2_pending_bytes() returns bigint language sql security invoker set search_path='' as $$ select voxi_private.r2_pending_bytes(); $$;
create function voxi_private.r2_abandoned() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 with selected as (select id from voxi_private.r2_uploads u where track_id is null and state<>'removed' and created_at<now()-interval '2 hours' and not exists(select 1 from public.voxi_tracks t where t.storage_provider='r2' and t.storage_path=u.path) order by created_at limit 30 for update skip locked), updated as (update voxi_private.r2_uploads set state='cleaning' where id in (select id from selected) returning path) select coalesce(jsonb_agg(path),'[]'::jsonb) into result from updated;
 return result;
end $$;
create function public.voxi_r2_abandoned() returns jsonb language sql security invoker set search_path='' as $$ select voxi_private.r2_abandoned(); $$;
revoke all on function public.voxi_r2_pending_bytes(),voxi_private.r2_pending_bytes(),public.voxi_r2_abandoned(),voxi_private.r2_abandoned() from public,anon,authenticated;
grant execute on function public.voxi_r2_pending_bytes(),voxi_private.r2_pending_bytes(),public.voxi_r2_abandoned(),voxi_private.r2_abandoned() to service_role;
create or replace function voxi_private.maintenance_snapshot() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not voxi_private.has_role(array['owner']) then raise exception 'Only the owner may view maintenance diagnostics' using errcode='42501';end if;
 with sizes as (
  select bucket_id,count(*) as objects,coalesce(sum(case when metadata->>'size' ~ '^[0-9]+$' then (metadata->>'size')::numeric else 0 end),0) as bytes,
   count(*) filter(where coalesce(metadata->>'size','') !~ '^[0-9]+$') as unknown_sizes
  from storage.objects group by bucket_id
 ) select jsonb_build_object('version',1,'checked_at',now(),'storage_bytes',coalesce((select sum(bytes) from sizes),0),
 'unknown_sizes',coalesce((select sum(unknown_sizes) from sizes),0),
 'buckets',coalesce((select jsonb_agg(jsonb_build_object('kind',case bucket_id when 'voxi-tracks' then 'songs' when 'voxi-videos' then 'videos' else 'other' end,'bytes',bytes,'objects',objects)) from sizes),'[]'::jsonb),
 'missing_tracks',(select count(*) from public.voxi_tracks t where t.deleted_at is null and (t.expires_at is null or t.expires_at>now()) and not voxi_private.track_object_exists(t.storage_provider,t.storage_path,t.file_size,t.user_id)),
 'pending_deletions',(select count(*) from public.voxi_tracks t where (t.deleted_at is not null or t.expires_at<=now()) and voxi_private.track_object_exists(t.storage_provider,t.storage_path,t.file_size,t.user_id)),
 'unlinked_objects',(select count(*) from storage.objects o where o.bucket_id='voxi-tracks' and not exists(select 1 from public.voxi_tracks t where t.storage_path=o.name)),
 'pending_videos',(select count(*) from public.voxi_videos where status='pending'),
 'unlinked_tracks',(select count(*) from public.voxi_tracks where booking_id is null and deleted_at is null and (expires_at is null or expires_at>now()))) into result;
 return result;
end $$;
