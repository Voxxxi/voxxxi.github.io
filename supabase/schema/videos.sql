create table public.voxi_videos (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete restrict,
 client_request_id uuid not null,
 title text not null check(char_length(btrim(title)) between 1 and 120),
 description text not null default '' check(char_length(description)<=600),
 display_name text not null check(char_length(display_name) between 1 and 80),
 storage_path text not null unique,
 file_name text not null check(char_length(file_name) between 1 and 255),
 file_size bigint not null check(file_size between 1 and 52428800),
 mime_type text not null check(mime_type in ('video/mp4','video/quicktime')),
 status text not null default 'uploading' check(status in ('uploading','pending','approved','rejected','error')),
 duration_seconds double precision check(duration_seconds>0 and duration_seconds<=300),
 consent_at timestamptz not null default now(),
 created_at timestamptz not null default now(),
 upload_expires_at timestamptz not null default (now()+interval '2 hours'),
 uploaded_at timestamptz,
 reviewed_at timestamptz,
 reviewed_by uuid,
 review_reason text not null default '' check(char_length(review_reason)<=500),
 unique(user_id,client_request_id),
 check(storage_path like user_id::text||'/%'),
 check(status not in ('pending','approved') or (duration_seconds is not null and uploaded_at is not null))
);
create index voxi_videos_user_created on public.voxi_videos(user_id,created_at desc);
create index voxi_videos_pending on public.voxi_videos(created_at) where status='pending';
create index voxi_videos_approved on public.voxi_videos(created_at desc) where status='approved';
alter table public.voxi_videos enable row level security;
revoke all on public.voxi_videos from anon,authenticated;
grant select on public.voxi_videos to authenticated;
grant all on public.voxi_videos to service_role;
create policy "video_owner_or_moderator_read" on public.voxi_videos for select to authenticated using (
 (user_id=(select auth.uid()) and (select voxi_private.session_active()))
 or (select voxi_private.has_role(array['owner','admin','helper']))
);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('voxi-videos','voxi-videos',false,52428800,array['video/mp4','video/quicktime']);
-- Clients cannot INSERT/UPDATE/DELETE objects. A server-validated captcha grants
-- an upload token for exactly one new object, with upsert disabled.
create policy "video_private_preview" on storage.objects for select to authenticated using (
 bucket_id='voxi-videos' and (
 (select voxi_private.has_role(array['owner','admin','helper']))
 or ((select voxi_private.session_active()) and exists (
  select 1 from public.voxi_videos v where v.storage_path=name and v.user_id=(select auth.uid())
  and v.status in ('pending','approved','rejected')
 ))
 )
);

create table public.voxi_video_notifications (
 id uuid primary key default gen_random_uuid(),
 video_id uuid not null unique references public.voxi_videos(id) on delete cascade,
 created_at timestamptz not null default now(),
 read_at timestamptz
);
alter table public.voxi_video_notifications enable row level security;
revoke all on public.voxi_video_notifications from anon,authenticated;
grant select on public.voxi_video_notifications to authenticated;
grant all on public.voxi_video_notifications to service_role;
create policy "video_notifications_staff_read" on public.voxi_video_notifications for select to authenticated using ((select voxi_private.has_role(array['owner','admin','helper'])));

create table public.voxi_video_likes (
 video_id uuid not null references public.voxi_videos(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(video_id,user_id)
);
create index voxi_video_likes_user on public.voxi_video_likes(user_id);
alter table public.voxi_video_likes enable row level security;
revoke all on public.voxi_video_likes from anon,authenticated;
grant select,insert,delete on public.voxi_video_likes to authenticated;
grant all on public.voxi_video_likes to service_role;
create function voxi_private.video_approved(video uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and voxi_private.session_active() and exists(select 1 from public.voxi_videos v where v.id=video and v.status='approved');
$$;
revoke all on function voxi_private.video_approved(uuid) from public,anon;
grant execute on function voxi_private.video_approved(uuid) to authenticated;
create policy "video_likes_self_read" on public.voxi_video_likes for select to authenticated using (user_id=(select auth.uid()) and (select voxi_private.session_active()));
create policy "video_likes_self_add" on public.voxi_video_likes for insert to authenticated with check (user_id=(select auth.uid()) and voxi_private.video_approved(video_id));
create policy "video_likes_self_remove" on public.voxi_video_likes for delete to authenticated using (user_id=(select auth.uid()) and (select voxi_private.session_active()));

create function public.voxi_active_session() returns boolean
language sql stable security invoker set search_path='' as $$ select voxi_private.session_active(); $$;
revoke all on function public.voxi_active_session() from public,anon;
grant execute on function public.voxi_active_session() to authenticated;

create function public.voxi_begin_video(p_user uuid,p_request uuid,p_title text,p_description text,p_name text,p_filename text,p_size bigint,p_mime text,p_extension text)
returns public.voxi_videos language plpgsql security invoker set search_path='' as $$
declare result public.voxi_videos; video_id uuid:=gen_random_uuid();
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 select * into result from public.voxi_videos where user_id=p_user and client_request_id=p_request;
 if found then return result; end if;
 if p_extension not in ('mp4','mov') then raise exception 'Unsupported video'; end if;
 if (select count(*) from public.voxi_videos where user_id=p_user and created_at>=now()-interval '1 day')>=5 then
  raise exception 'В сутки можно загрузить не более 5 видео. Попробуйте позже.';
 end if;
 if (select count(*) from public.voxi_videos where user_id=p_user and (status='pending' or (status='uploading' and upload_expires_at>now())))>=3 then
  raise exception 'У вас уже 3 видео в загрузке или на проверке. Дождитесь проверки.';
 end if;
 insert into public.voxi_videos(id,user_id,client_request_id,title,description,display_name,storage_path,file_name,file_size,mime_type)
 values(video_id,p_user,p_request,p_title,p_description,p_name,p_user::text||'/'||video_id::text||'.'||p_extension,p_filename,p_size,p_mime)
 returning * into result;
 return result;
end $$;
revoke all on function public.voxi_begin_video(uuid,uuid,text,text,text,text,bigint,text,text) from public,anon,authenticated;
grant execute on function public.voxi_begin_video(uuid,uuid,text,text,text,text,bigint,text,text) to service_role;

create function public.voxi_complete_video(p_user uuid,p_video uuid,p_duration double precision)
returns text language plpgsql security invoker set search_path='' as $$
declare v public.voxi_videos;
begin
 select * into v from public.voxi_videos where id=p_video and user_id=p_user for update;
 if not found then raise exception 'Видео не найдено'; end if;
 if v.status in ('pending','approved','rejected') then return v.status; end if;
 if v.status<>'uploading' or v.upload_expires_at<now() then raise exception 'Срок загрузки истёк'; end if;
 update public.voxi_videos set status='pending',duration_seconds=p_duration,uploaded_at=now() where id=v.id;
 insert into public.voxi_video_notifications(video_id) values(v.id) on conflict(video_id) do nothing;
 return 'pending';
end $$;
revoke all on function public.voxi_complete_video(uuid,uuid,double precision) from public,anon,authenticated;
grant execute on function public.voxi_complete_video(uuid,uuid,double precision) to service_role;

create function voxi_private.review_video(video uuid,decision text,reason text) returns text
language plpgsql security definer set search_path='' as $$
begin
 if not voxi_private.has_role(array['owner','admin','helper']) then raise exception 'Только модератор может публиковать видео' using errcode='42501'; end if;
 if decision not in ('approved','rejected') then raise exception 'Неверное решение'; end if;
 if decision='rejected' and char_length(btrim(coalesce(reason,''))) not between 1 and 500 then raise exception 'Укажите причину отклонения'; end if;
 update public.voxi_videos set status=decision,review_reason=case when decision='rejected' then btrim(reason) else '' end,
 reviewed_at=now(),reviewed_by=auth.uid()
 where id=video and status in ('pending','approved','rejected') and duration_seconds is not null;
 if not found then raise exception 'Видео не готово к проверке или уже удалено'; end if;
 update public.voxi_video_notifications set read_at=now() where video_id=video;
 return decision;
end $$;
revoke all on function voxi_private.review_video(uuid,text,text) from public,anon;
grant execute on function voxi_private.review_video(uuid,text,text) to authenticated;
create function public.voxi_review_video(p_video uuid,p_decision text,p_reason text default '') returns text
language sql security invoker set search_path='' as $$ select voxi_private.review_video(p_video,p_decision,p_reason); $$;
revoke all on function public.voxi_review_video(uuid,text,text) from public,anon;
grant execute on function public.voxi_review_video(uuid,text,text) to authenticated;

create function public.voxi_video_feed() returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) from (
  select v.id,v.title,v.description,v.display_name,v.storage_path,
  (select count(*) from public.voxi_video_likes l where l.video_id=v.id) as likes
  from public.voxi_videos v where v.status='approved' order by random() limit 12
 ) r;
$$;
revoke all on function public.voxi_video_feed() from public,anon,authenticated;
grant execute on function public.voxi_video_feed() to service_role;