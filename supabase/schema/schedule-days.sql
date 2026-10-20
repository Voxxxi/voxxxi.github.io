-- A separate day flag preserves existing appointments and previously opened hours.
create table public.voxi_schedule_days(
 booking_date date primary key check(isfinite(booking_date)),
 is_closed boolean not null default false
);
alter table public.voxi_schedule_days enable row level security;
revoke all on public.voxi_schedule_days from anon,authenticated;
grant select on public.voxi_schedule_days to anon,authenticated;
grant insert,update on public.voxi_schedule_days to authenticated;
create policy public_day_status on public.voxi_schedule_days for select to anon,authenticated using(true);
create policy staff_day_insert on public.voxi_schedule_days for insert to authenticated with check((select voxi_private.has_role(array['owner','admin','helper'])));
create policy staff_day_update on public.voxi_schedule_days for update to authenticated using((select voxi_private.has_role(array['owner','admin','helper']))) with check((select voxi_private.has_role(array['owner','admin','helper'])));

create function voxi_private.lock_schedule_day() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 perform pg_advisory_xact_lock(73021,(new.booking_date-date '2000-01-01')::integer);
 return new;
end $$;
revoke all on function voxi_private.lock_schedule_day() from public,anon,authenticated;
create trigger lock_schedule_day before insert or update on public.voxi_schedule_days for each row execute function voxi_private.lock_schedule_day();

create function voxi_private.reject_closed_day_booking() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.status='Отменено' then return new;end if;
 if tg_op='UPDATE' then
  if new.booking_date is not distinct from old.booking_date and new.booking_time is not distinct from old.booking_time and old.status is distinct from 'Отменено' then return new;end if;
 end if;
 if new.booking_date is not null then
  perform pg_advisory_xact_lock(73021,(new.booking_date-date '2000-01-01')::integer);
  if exists(select 1 from public.voxi_schedule_days where booking_date=new.booking_date and is_closed) then
   raise exception 'Studio is closed on this day';
  end if;
 end if;
 return new;
end $$;
revoke all on function voxi_private.reject_closed_day_booking() from public,anon,authenticated;
create trigger voxi_closed_day_guard before insert or update of booking_date,booking_time,status on public.voxi_bookings for each row execute function voxi_private.reject_closed_day_booking();

alter policy voxi_schedule_client_select on public.voxi_schedule_slots using(is_open=true and not exists(select 1 from public.voxi_schedule_days d where d.booking_date=voxi_schedule_slots.booking_date and d.is_closed));

create or replace function voxi_private.studio_updates() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('announcements',coalesce((select jsonb_agg(to_jsonb(n)) from(
 select id,title_ru,body_ru,title_kk,body_kk,action,ends_at from public.voxi_announcements
 where published and starts_at<=now() and ends_at>now() order by created_at desc,id limit 5)n),'[]'::jsonb),
 'slots',coalesce((select jsonb_agg(to_jsonb(s)) from(
 select s.booking_date,s.booking_time,coalesce((voxi_private.slot_offer(s.booking_date,s.booking_time)->>'percent')::int,0) discount_percent
 from public.voxi_schedule_slots s where s.is_open and extract(minute from s.booking_time)=0 and extract(second from s.booking_time)=0 and (s.booking_date+s.booking_time)>(now() at time zone 'Asia/Oral')
 and s.booking_date<=(now() at time zone 'Asia/Oral')::date+60
 and not exists(select 1 from public.voxi_schedule_days d where d.booking_date=s.booking_date and d.is_closed)
 and not exists(select 1 from public.voxi_bookings b where b.booking_date=s.booking_date and b.booking_time=s.booking_time and b.status is distinct from 'Отменено')
 order by s.booking_date,s.booking_time limit 12)s),'[]'::jsonb));
$$;
