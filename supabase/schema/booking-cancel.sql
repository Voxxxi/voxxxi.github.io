-- Client cancellation is a narrow API, never a general UPDATE permission.
create or replace function voxi_private.cancel_booking(wanted bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.voxi_bookings; begin
 if not voxi_private.session_active() then raise insufficient_privilege using message='Sign in again'; end if;
 select * into b from public.voxi_bookings where id=wanted and user_id=auth.uid() for update;
 if not found then raise exception 'Booking unavailable'; end if;
 if b.status='Отменено' then return jsonb_build_object('id',b.id,'status',b.status); end if;
 if b.status<>'Запланировано' or (b.booking_date+b.booking_time) <= (now() at time zone 'Asia/Oral') then
  raise exception 'Contact the studio to change this booking';
 end if;
 update public.voxi_bookings set status='Отменено' where id=b.id;
 return jsonb_build_object('id',b.id,'status','Отменено');
end $$;
revoke all on function voxi_private.cancel_booking(bigint) from public,anon;
grant execute on function voxi_private.cancel_booking(bigint) to authenticated;
create or replace function public.voxi_cancel_booking(booking_id bigint)
returns jsonb language sql security invoker set search_path='' as $$
 select voxi_private.cancel_booking(booking_id);
$$;
revoke all on function public.voxi_cancel_booking(bigint) from public,anon;
grant execute on function public.voxi_cancel_booking(bigint) to authenticated;

-- An old cancelled booking must not reopen a slot occupied by a newer booking.
create or replace function public.voxi_sync_schedule_slot()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op in ('DELETE','UPDATE') then
  update public.voxi_schedule_slots s set is_open=not exists(
   select 1 from public.voxi_bookings b where b.booking_date=s.booking_date
   and b.booking_time=s.booking_time and b.status is distinct from 'Отменено')
  where s.booking_date=old.booking_date and s.booking_time=old.booking_time;
 end if;
 if tg_op in ('INSERT','UPDATE') then
  update public.voxi_schedule_slots s set is_open=not exists(
   select 1 from public.voxi_bookings b where b.booking_date=s.booking_date
   and b.booking_time=s.booking_time and b.status is distinct from 'Отменено')
  where s.booking_date=new.booking_date and s.booking_time=new.booking_time;
 end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
revoke all on function public.voxi_sync_schedule_slot() from public,anon,authenticated;
