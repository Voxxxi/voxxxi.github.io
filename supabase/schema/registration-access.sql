-- Profile format validation and private listening access. No identity verification.
create or replace function voxi_private.valid_name_part(value text) returns boolean
language plpgsql immutable set search_path='' as $$
declare word text; part text:=btrim(regexp_replace(coalesce(value,''),'[[:space:]]+',' ','g'));
begin
 if char_length(part)<2 or char_length(part)>75 or part !~ '^[[:alpha:]]+([ ''’\-][[:alpha:]]+)*$' then return false;end if;
 foreach word in array regexp_split_to_array(lower(part),'[ ''’\-]+') loop
  if word ~ '(.)\1{3}' or word=any(array['qwerty','asdfgh','zxcvbn','йцукен','фывапр','ячсмит']) then return false;end if;
  if char_length(word)>=5 and word !~ '[aeiouyàáâãäåæèéêëìíîïòóôõöøùúûüýÿāăąēĕėęěĩīĭįıōŏőœũūŭůűųаәеёиіоөұүуыэюя]' then return false;end if;
 end loop;
 return true;
end $$;
create or replace function voxi_private.kz_phone(value text) returns text
language plpgsql immutable set search_path='' as $$
declare digits text;raw text:=btrim(coalesce(value,''));
begin
 if raw !~ '^\+?[0-9[:space:]().-]+$' then return null;end if;
 digits:=regexp_replace(raw,'[^0-9]','','g');
 if length(digits)=10 then digits:='7'||digits;end if;
 if length(digits)=11 and left(digits,1)='8' then digits:='7'||substr(digits,2);end if;
 if digits !~ '^7(700|701|702|705|706|707|708|747|771|775|776|777|778)[0-9]{7}$' then return null;end if;
 return '+'||digits;
end $$;
create or replace function voxi_private.valid_profile(name text,phone text) returns boolean
language plpgsql immutable set search_path='' as $$
declare parts text[];part text;clean text:=btrim(regexp_replace(coalesce(name,''),'[[:space:]]+',' ','g'));
begin
 if char_length(clean)>150 or voxi_private.kz_phone(phone) is null then return false;end if;
 parts:=string_to_array(clean,' ');if cardinality(parts)<2 then return false;end if;
 foreach part in array parts loop if not voxi_private.valid_name_part(part) then return false;end if;end loop;
 return true;
end $$;
revoke all on function voxi_private.valid_name_part(text),voxi_private.kz_phone(text),voxi_private.valid_profile(text,text) from public,anon;
grant execute on function voxi_private.valid_name_part(text),voxi_private.kz_phone(text),voxi_private.valid_profile(text,text) to authenticated;

create or replace function voxi_private.validate_profile_write() returns trigger
language plpgsql set search_path='' as $$
begin
 new.full_name:=normalize(btrim(regexp_replace(coalesce(new.full_name,''),'[[:space:]]+',' ','g')),NFC);
 if not voxi_private.valid_profile(new.full_name,new.phone) then
  raise exception 'VOXI_INVALID_PROFILE' using errcode='23514';
 end if;
 new.phone:=voxi_private.kz_phone(new.phone);
 return new;
end $$;
revoke all on function voxi_private.validate_profile_write() from public,anon,authenticated;
create trigger voxi_validate_profile before insert or update of full_name,phone on public.voxi_profiles
for each row execute function voxi_private.validate_profile_write();

create or replace function voxi_private.listening_allowed() returns boolean
language sql stable security definer set search_path='' as $$
 select voxi_private.session_active() and (
 voxi_private.has_role(array['owner','admin','helper']) or exists(
 select 1 from public.voxi_profiles p join voxi_private.privacy_consents c using(user_id)
 where p.user_id=auth.uid() and c.version='2026-10-20' and voxi_private.valid_profile(p.full_name,p.phone)));
$$;
revoke all on function voxi_private.listening_allowed() from public,anon;
grant execute on function voxi_private.listening_allowed() to authenticated;
create or replace function public.voxi_listening_allowed() returns boolean language sql stable security invoker set search_path='' as $$ select voxi_private.listening_allowed(); $$;
revoke all on function public.voxi_listening_allowed() from public,anon;
grant execute on function public.voxi_listening_allowed() to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('voxi-portfolio','voxi-portfolio',false,31457280,array['audio/mpeg','audio/mp3','audio/mp4','audio/ogg','audio/wav','audio/x-wav','audio/flac'])
on conflict(id) do nothing;
create table voxi_private.portfolio_tracks(
 id uuid primary key default gen_random_uuid(),title text not null check(length(btrim(title)) between 1 and 200),
 storage_path text not null unique,enabled boolean not null default true,created_at timestamptz not null default now()
);
alter table voxi_private.portfolio_tracks enable row level security;
revoke all on voxi_private.portfolio_tracks from public,anon,authenticated;
create or replace function voxi_private.portfolio_object_allowed(path text) returns boolean
language sql stable security definer set search_path='' as $$
 select voxi_private.listening_allowed() and exists(select 1 from voxi_private.portfolio_tracks t where t.storage_path=path and t.enabled);
$$;
revoke all on function voxi_private.portfolio_object_allowed(text) from public,anon;
grant execute on function voxi_private.portfolio_object_allowed(text) to authenticated;
create policy "VOXi registered portfolio listening" on storage.objects for select to authenticated
using(bucket_id='voxi-portfolio' and voxi_private.portfolio_object_allowed(name));
create or replace function voxi_private.portfolio_list() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not voxi_private.listening_allowed() then raise insufficient_privilege;end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'title',t.title,'path',t.storage_path) order by t.created_at,t.id)
 from voxi_private.portfolio_tracks t where t.enabled and exists(select 1 from storage.objects o where o.bucket_id='voxi-portfolio' and o.name=t.storage_path)),'[]'::jsonb);
end $$;
revoke all on function voxi_private.portfolio_list() from public,anon;
grant execute on function voxi_private.portfolio_list() to authenticated;
create or replace function public.voxi_portfolio_tracks() returns jsonb language sql stable security invoker set search_path='' as $$select voxi_private.portfolio_list();$$;
revoke all on function public.voxi_portfolio_tracks() from public,anon;
grant execute on function public.voxi_portfolio_tracks() to authenticated;

create table voxi_private.registration_notifications(
 user_id uuid primary key references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),read_at timestamptz
);
alter table voxi_private.registration_notifications enable row level security;
revoke all on voxi_private.registration_notifications from public,anon,authenticated;
-- Baseline existing profiles without generating new notifications.
insert into voxi_private.registration_notifications(user_id,created_at,read_at)
select user_id,coalesce(created_at,now()),now() from public.voxi_profiles;
create or replace function voxi_private.notify_registration() returns trigger language plpgsql security definer set search_path='' as $$
declare added uuid;endpoint text;secret text;
begin
 if voxi_private.valid_profile(new.full_name,new.phone)
 and exists(select 1 from voxi_private.privacy_consents c where c.user_id=new.user_id and c.version='2026-10-20')
 and not exists(select 1 from public.voxi_staff s where s.user_id=new.user_id) then
 insert into voxi_private.registration_notifications(user_id) values(new.user_id) on conflict do nothing returning user_id into added;
 if added is not null then
  select decrypted_secret into endpoint from vault.decrypted_secrets where name='voxi_telegram_function_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name='voxi_webhook_secret';
  if endpoint is not null and secret is not null then
   perform net.http_post(url:=endpoint,headers:=jsonb_build_object('Content-Type','application/json','x-voxi-secret',secret),body:=jsonb_build_object('event','registration'));
  end if;
 end if;
 end if;
 return new;
end $$;
revoke all on function voxi_private.notify_registration() from public,anon,authenticated;
create trigger voxi_new_registration after insert or update of full_name,phone on public.voxi_profiles
for each row execute function voxi_private.notify_registration();
create or replace function voxi_private.registration_notifications_list() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not voxi_private.has_role(array['owner']) then raise insufficient_privilege;end if;
 with recent as (
 select n.user_id,n.created_at,n.read_at,p.full_name from voxi_private.registration_notifications n
 join public.voxi_profiles p using(user_id) where not exists(select 1 from public.voxi_staff s where s.user_id=n.user_id)
 order by (n.read_at is not null),n.created_at desc,n.user_id limit 50)
 select jsonb_build_object('unread_count',(select count(*) from voxi_private.registration_notifications n
 where n.read_at is null and not exists(select 1 from public.voxi_staff s where s.user_id=n.user_id)),
 'items',coalesce((select jsonb_agg(to_jsonb(r) order by (r.read_at is not null),r.created_at desc,r.user_id) from recent r),'[]'::jsonb)) into result;
 return result;
end $$;
create or replace function voxi_private.read_registration(selected uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not voxi_private.has_role(array['owner']) then raise insufficient_privilege;end if;
 update voxi_private.registration_notifications set read_at=coalesce(read_at,now()) where user_id=selected;
end $$;
revoke all on function voxi_private.registration_notifications_list(),voxi_private.read_registration(uuid) from public,anon;
grant execute on function voxi_private.registration_notifications_list(),voxi_private.read_registration(uuid) to authenticated;
create or replace function public.voxi_registration_notifications() returns jsonb language sql stable security invoker set search_path='' as $$select voxi_private.registration_notifications_list();$$;
create or replace function public.voxi_read_registration(p_user uuid) returns void language sql security invoker set search_path='' as $$select voxi_private.read_registration(p_user);$$;
revoke all on function public.voxi_registration_notifications(),public.voxi_read_registration(uuid) from public,anon;
grant execute on function public.voxi_registration_notifications(),public.voxi_read_registration(uuid) to authenticated;

