create table voxi_private.track_notifications(
 track_id uuid primary key references public.voxi_tracks(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),read_at timestamptz
);
create index track_notifications_user on voxi_private.track_notifications(user_id,created_at desc);
alter table voxi_private.track_notifications enable row level security;
revoke all on voxi_private.track_notifications from public,anon,authenticated;

create function voxi_private.notify_track_ready() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.deleted_at is null and (new.expires_at is null or new.expires_at>now()) and voxi_private.track_object_exists(new.storage_provider,new.storage_path,new.file_size,new.user_id) then
  insert into voxi_private.track_notifications(track_id,user_id,created_at) values(new.id,new.user_id,new.created_at) on conflict do nothing;
 end if;
 return new;
end $$;
revoke all on function voxi_private.notify_track_ready() from public,anon,authenticated;
create trigger voxi_notify_track_ready after insert on public.voxi_tracks for each row execute function voxi_private.notify_track_ready();
-- Existing files form a read history, not a batch of new alerts.
insert into voxi_private.track_notifications(track_id,user_id,created_at,read_at)
 select id,user_id,created_at,now() from public.voxi_tracks t where deleted_at is null and (expires_at is null or expires_at>now()) and voxi_private.track_object_exists(t.storage_provider,t.storage_path,t.file_size,t.user_id) on conflict do nothing;

create function voxi_private.ready_notifications() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not voxi_private.session_active() then raise insufficient_privilege;end if;
 with available as(select n.track_id,n.created_at,n.read_at,t.song_title,t.expires_at from voxi_private.track_notifications n join public.voxi_tracks t on t.id=n.track_id and t.user_id=n.user_id
 where n.user_id=auth.uid() and t.deleted_at is null and (t.expires_at is null or t.expires_at>now()) and voxi_private.track_object_exists(t.storage_provider,t.storage_path,t.file_size,t.user_id)),
 recent as(select * from available order by (read_at is not null),created_at desc,track_id limit 50)
 select jsonb_build_object('unread_count',(select count(*) from available where read_at is null),'items',coalesce((select jsonb_agg(to_jsonb(r) order by (r.read_at is not null),r.created_at desc,r.track_id) from recent r),'[]'::jsonb)) into result;
 return result;
end $$;
create function voxi_private.read_ready_notification(selected uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not voxi_private.session_active() then raise insufficient_privilege;end if;
 update voxi_private.track_notifications set read_at=coalesce(read_at,now()) where track_id=selected and user_id=auth.uid();
end $$;
revoke all on function voxi_private.ready_notifications(),voxi_private.read_ready_notification(uuid) from public,anon;
grant execute on function voxi_private.ready_notifications(),voxi_private.read_ready_notification(uuid) to authenticated;
create function public.voxi_ready_notifications() returns jsonb language sql stable security invoker set search_path='' as $$select voxi_private.ready_notifications();$$;
create function public.voxi_read_ready_notification(p_track uuid) returns void language sql security invoker set search_path='' as $$select voxi_private.read_ready_notification(p_track);$$;
revoke all on function public.voxi_ready_notifications(),public.voxi_read_ready_notification(uuid) from public,anon;
grant execute on function public.voxi_ready_notifications(),public.voxi_read_ready_notification(uuid) to authenticated;

create table voxi_private.privacy_consents(user_id uuid primary key references auth.users(id) on delete cascade,version text not null,accepted_at timestamptz not null default now());
alter table voxi_private.privacy_consents enable row level security;
revoke all on voxi_private.privacy_consents from public,anon,authenticated;
create function voxi_private.accept_privacy(selected text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not voxi_private.session_active() then raise insufficient_privilege;end if;
 if selected is distinct from '2026-10-20' then raise exception 'Refresh privacy policy';end if;
 insert into voxi_private.privacy_consents(user_id,version) values(auth.uid(),selected) on conflict(user_id) do update set version=excluded.version,accepted_at=now() where privacy_consents.version is distinct from excluded.version;
end $$;
revoke all on function voxi_private.accept_privacy(text) from public,anon;
grant execute on function voxi_private.accept_privacy(text) to authenticated;
create function public.voxi_accept_privacy(p_version text) returns void language sql security invoker set search_path='' as $$select voxi_private.accept_privacy(p_version);$$;
revoke all on function public.voxi_accept_privacy(text) from public,anon;
grant execute on function public.voxi_accept_privacy(text) to authenticated;

create table voxi_private.page_opens(day date primary key,opens bigint not null default 0 check(opens>=0));
alter table voxi_private.page_opens enable row level security;
revoke all on voxi_private.page_opens from public,anon,authenticated;
create function voxi_public_api.record_page_open() returns void language sql volatile security definer set search_path='' as $$
 insert into voxi_private.page_opens(day,opens) values((now() at time zone 'Asia/Oral')::date,1) on conflict(day) do update set opens=page_opens.opens+1;
$$;
revoke all on function voxi_public_api.record_page_open() from public;
grant execute on function voxi_public_api.record_page_open() to anon,authenticated;
create function public.voxi_record_page_open() returns void language sql volatile security invoker set search_path='' as $$select voxi_public_api.record_page_open();$$;
revoke all on function public.voxi_record_page_open() from public;
grant execute on function public.voxi_record_page_open() to anon,authenticated;

create function voxi_private.studio_statistics(selected_month date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare start_day date;end_day date;result jsonb;
begin
 if not voxi_private.has_role(array['owner']) then raise insufficient_privilege;end if;
 if selected_month is null or not isfinite(selected_month) or selected_month<date '2020-01-01' or selected_month>date '2100-01-01' then raise exception 'Choose a month';end if;
 start_day:=date_trunc('month',selected_month)::date;end_day:=(start_day+interval '1 month')::date;
 with clients as(select u.id,u.created_at from auth.users u where not exists(select 1 from public.voxi_staff s where s.user_id=u.id)),
 selected_bookings as(select b.* from public.voxi_bookings b where b.user_id in(select id from clients) and (b.created_at at time zone 'Asia/Oral')::date>=start_day and (b.created_at at time zone 'Asia/Oral')::date<end_day),
 repeat_clients as(select user_id from public.voxi_bookings where user_id in(select id from clients) and status<>'Отменено' and booking_date<end_day and booking_date<=(now() at time zone 'Asia/Oral')::date group by user_id having count(*)>=2),
 daily as(select d::date as "day",coalesce(v.opens,0) opens,(select count(*) from selected_bookings b where (b.created_at at time zone 'Asia/Oral')::date=d::date) bookings from generate_series(start_day::timestamp,(end_day-1)::timestamp,interval '1 day') d left join voxi_private.page_opens v on v.day=d::date)
 select jsonb_build_object('month',start_day,'clients_total',(select count(*) from clients),
 'new_clients',(select count(*) from clients where (created_at at time zone 'Asia/Oral')::date>=start_day and (created_at at time zone 'Asia/Oral')::date<end_day),
 'bookings_created',(select count(*) from selected_bookings),'cancelled_appointments',(select count(*) from public.voxi_bookings where booking_date>=start_day and booking_date<end_day and status='Отменено' and user_id in(select id from clients)),
 'returning_clients',(select count(*) from repeat_clients),
 'tracks_delivered',(select count(*) from public.voxi_tracks t where (created_at at time zone 'Asia/Oral')::date>=start_day and (created_at at time zone 'Asia/Oral')::date<end_day and user_id in(select id from clients)),
 'income',(select coalesce(sum(amount),0) from voxi_private.payments where paid_on>=start_day and paid_on<end_day and voided_at is null),
 'completed_orders',(select count(*) from voxi_private.payments where paid_on>=start_day and paid_on<end_day and voided_at is null),
 'opens',(select coalesce(sum(opens),0) from voxi_private.page_opens where day>=start_day and day<end_day),
 'daily',coalesce((select jsonb_agg(to_jsonb(d)) from daily d),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function voxi_private.studio_statistics(date) from public,anon;
grant execute on function voxi_private.studio_statistics(date) to authenticated;
create function public.voxi_studio_statistics(p_month date) returns jsonb language sql stable security invoker set search_path='' as $$select voxi_private.studio_statistics(p_month);$$;
revoke all on function public.voxi_studio_statistics(date) from public,anon;
grant execute on function public.voxi_studio_statistics(date) to authenticated;
