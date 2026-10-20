begin;
create temporary table day_test_actor as select gen_random_uuid() id,gen_random_uuid() sid;
insert into auth.users(id,email,raw_user_meta_data) select id,'day-test-'||id||'@example.invalid','{}'::jsonb from day_test_actor;
insert into auth.sessions(id,user_id,created_at,updated_at) select sid,id,now(),now() from day_test_actor;
insert into public.voxi_profiles(user_id,full_name,phone) select id,'Rollback Client','+70000000000' from day_test_actor on conflict(user_id) do update set full_name=excluded.full_name,phone=excluded.phone;
insert into public.voxi_schedule_slots(booking_date,booking_time,is_open) values('2098-12-26','13:00',true),('2098-12-26','15:00',true);
create temporary table day_test_booking as
 with b as(insert into public.voxi_bookings(client_name,phone,booking_date,booking_time,people_count,song_count,song_titles,price,status,user_id)
 values('Rollback','+70000000000','2098-12-26','13:00',1,1,'[]',5000,'Запланировано',(select id from day_test_actor)) returning id) select id from b;
insert into public.voxi_schedule_days values('2098-12-26',true);
grant select on day_test_actor,day_test_booking to authenticated;
set local role anon;
do $$begin if not (select is_closed from public.voxi_schedule_days where booking_date='2098-12-26') then raise exception 'Public day flag missing';end if;end $$;
reset role;
set local role authenticated;
do $$declare a record;begin
 select * into a from day_test_actor;perform set_config('request.jwt.claims',jsonb_build_object('sub',a.id,'role','authenticated','session_id',a.sid)::text,true);
 if exists(select 1 from public.voxi_schedule_slots where booking_date='2098-12-26' and is_open) then raise exception 'Closed day hours visible to client';end if;
 begin insert into public.voxi_schedule_days values('2098-12-25',true);raise exception 'Client changed day';exception when insufficient_privilege then null;end;
 update public.voxi_schedule_days set is_closed=false where booking_date='2098-12-26';
 if not (select is_closed from public.voxi_schedule_days where booking_date='2098-12-26') then raise exception 'Client reopened day';end if;
 begin insert into public.voxi_bookings(client_name,phone,booking_date,booking_time,people_count,song_count,song_titles,price,status,user_id)
 values('Rollback','+70000000000','2098-12-26','15:00',1,1,'[{"title":"Test","people":1,"price":5000}]',5000,'Запланировано',a.id);
 raise exception 'Closed day booking accepted';exception when raise_exception then if sqlerrm<>'Studio is closed on this day' then raise;end if;end;
end $$;
reset role;
select set_config('request.jwt.claims','{}',true);
update public.voxi_bookings set status='В процессе' where id=(select id from day_test_booking);
do $$begin if (select status from public.voxi_bookings where id=(select id from day_test_booking))<>'В процессе' then raise exception 'Existing booking was lost';end if;end $$;
insert into public.voxi_staff(user_id,role) select id,'admin' from day_test_actor;
set local role authenticated;
do $$declare a record;begin
 select * into a from day_test_actor;perform set_config('request.jwt.claims',jsonb_build_object('sub',a.id,'role','authenticated','session_id',a.sid)::text,true);
 update public.voxi_schedule_days set is_closed=false where booking_date='2098-12-26';
 if (select is_closed from public.voxi_schedule_days where booking_date='2098-12-26') then raise exception 'Staff could not reopen day';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a.id,'role','authenticated','session_id',gen_random_uuid())::text,true);
 update public.voxi_schedule_days set is_closed=true where booking_date='2098-12-26';
 if (select is_closed from public.voxi_schedule_days where booking_date='2098-12-26') then raise exception 'Revoked session changed day';end if;
end $$;
reset role;
select set_config('request.jwt.claims','{}',true);
do $$begin if not(select is_open from public.voxi_schedule_slots where booking_date='2098-12-26' and booking_time='15:00') then raise exception 'Original hours lost';end if;end $$;
rollback;
select 'PASS: public closed-day flag, client RLS and booking rejection, retained appointments and hours, staff reopening, revoked-session denial; all fixtures rolled back' verification;
