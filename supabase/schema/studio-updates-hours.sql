create or replace function voxi_private.studio_updates() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('announcements',coalesce((select jsonb_agg(to_jsonb(n)) from(
 select id,title_ru,body_ru,title_kk,body_kk,action,ends_at from public.voxi_announcements
 where published and starts_at<=now() and ends_at>now() order by created_at desc,id limit 5)n),'[]'::jsonb),
 'slots',coalesce((select jsonb_agg(to_jsonb(s)) from(
 select s.booking_date,s.booking_time,coalesce((voxi_private.slot_offer(s.booking_date,s.booking_time)->>'percent')::int,0) discount_percent
 from public.voxi_schedule_slots s where s.is_open and extract(minute from s.booking_time)=0 and extract(second from s.booking_time)=0 and (s.booking_date+s.booking_time)>(now() at time zone 'Asia/Oral')
 and s.booking_date<=(now() at time zone 'Asia/Oral')::date+60
 and not exists(select 1 from public.voxi_bookings b where b.booking_date=s.booking_date and b.booking_time=s.booking_time and b.status is distinct from 'Отменено')
 order by s.booking_date,s.booking_time limit 12)s),'[]'::jsonb));
$$;