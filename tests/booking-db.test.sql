begin;
create temporary table booking_audit_actor as select gen_random_uuid() id,gen_random_uuid() sid;
insert into auth.users(id,email,raw_user_meta_data) select id,'rollback-'||id||'@example.invalid','{}'::jsonb from booking_audit_actor;
insert into auth.sessions(id,user_id,created_at,updated_at) select sid,id,now(),now() from booking_audit_actor;
insert into public.voxi_profiles(user_id,full_name,phone) select id,'Rollback Client','+70000000000' from booking_audit_actor on conflict(user_id) do update set full_name=excluded.full_name,phone=excluded.phone;
create temporary table booking_audit_ids(kind text,id bigint);
insert into public.voxi_schedule_slots(booking_date,booking_time,is_open) values ('2098-12-30','03:17',true),('2098-12-29','13:00',true);
with b as(insert into public.voxi_bookings(client_name,phone,booking_date,booking_time,people_count,song_count,song_titles,price,status,user_id) values ('Rollback audit','+70000000000','2098-12-30','03:17',1,1,'[]',5000,'Запланировано',(select id from booking_audit_actor)) returning id) insert into booking_audit_ids select 'first',id from b;
grant select on booking_audit_actor,booking_audit_ids to authenticated;
set local role authenticated;
do $$declare a record;b bigint;r jsonb;begin
 select * into strict a from booking_audit_actor;select id into b from booking_audit_ids where kind='first';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a.id,'role','authenticated','session_id',gen_random_uuid())::text,true);
 begin perform public.voxi_cancel_booking(b);raise exception 'Revoked session accepted';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a.id,'role','authenticated','session_id',a.sid)::text,true);
 begin perform public.voxi_cancel_booking(-1);raise exception 'Foreign booking accepted';exception when raise_exception then if sqlerrm<>'Booking unavailable' then raise;end if;end;
 
begin insert into public.voxi_bookings(client_name,phone,booking_date,booking_time,people_count,song_count,song_titles,price,status,user_id) values('Test','+70000000000','2098-12-29','13:00',1,1,'[{"title":"Test","people":1,"price":5000}]',1,'Запланировано',a.id);raise exception 'Tampered quote accepted';exception when raise_exception then if sqlerrm<>'Price does not match the studio tariff' then raise;end if;end;
insert into public.voxi_bookings(client_name,phone,booking_date,booking_time,people_count,song_count,song_titles,price,status,user_id) values('Test','+70000000000','2098-12-29','13:00',3,2,'[{"title":"First","people":1,"price":5000},{"title":"Second","people":2,"price":6000}]',11000,'Запланировано',a.id);
begin insert into public.voxi_bookings(client_name,phone,booking_date,booking_time,people_count,song_count,song_titles,price,status,user_id) values('Test','+70000000000','2098-12-29','13:00',1,1,'[{"title":"Test","people":1,"price":5000}]',5000,'Запланировано',a.id);raise exception 'Double booking accepted';exception when insufficient_privilege or unique_violation then null;end;
begin insert into public.voxi_bookings(client_name,phone,booking_date,booking_time,people_count,song_count,song_titles,price,status,user_id) values('Test','+70000000000','2020-01-01','13:00',1,1,'[{"title":"Test","people":1,"price":5000}]',5000,'Запланировано',a.id);raise exception 'Past booking accepted';exception when raise_exception then if sqlerrm<>'Choose a future appointment' then raise;end if;end;

 r:=public.voxi_cancel_booking(b);if r->>'status'<>'Отменено' then raise exception 'Cancellation failed';end if;
 if public.voxi_cancel_booking(b)<>r then raise exception 'Cancellation not idempotent';end if;
 begin update public.voxi_bookings set price=1 where id=b;exception when insufficient_privilege then null;end;
 if (select price from public.voxi_bookings where id=b)<>5000 then raise exception 'Client can edit price';end if;
 if has_function_privilege('anon','public.voxi_cancel_booking(bigint)','execute') then raise exception 'Anonymous cancellation grant';end if;
end $$;
reset role;
select set_config('request.jwt.claims','{}',true);
do $$begin if not (select is_open from public.voxi_schedule_slots where booking_date='2098-12-30' and booking_time='03:17') then raise exception 'Cancelled slot not released';end if;end $$;
with b as(insert into public.voxi_bookings(client_name,phone,booking_date,booking_time,people_count,song_count,song_titles,price,status,user_id) values ('Rollback second','+70000000000','2098-12-30','03:17',1,1,'[]',5000,'Запланировано',(select id from booking_audit_actor)) returning id) insert into booking_audit_ids select 'second',id from b;
update public.voxi_bookings set status='Отменено' where id=(select id from booking_audit_ids where kind='first');
do $$begin if (select is_open from public.voxi_schedule_slots where booking_date='2098-12-30' and booking_time='03:17') then raise exception 'Updating cancelled history reopened occupied slot';end if;end $$;
update public.voxi_bookings set status='Готово' where id=(select id from booking_audit_ids where kind='second');
set local role authenticated;
do $$declare a record;begin
 select * into a from booking_audit_actor;perform set_config('request.jwt.claims',jsonb_build_object('sub',a.id,'role','authenticated','session_id',a.sid)::text,true);
 begin perform public.voxi_cancel_booking((select id from booking_audit_ids where kind='second'));raise exception 'Completed booking cancelled';exception when raise_exception then if sqlerrm<>'Contact the studio to change this booking' then raise;end if;end;
end $$;
reset role;
select set_config('request.jwt.claims','{}',true);
rollback;
select 'PASS: own future cancellation, revoked session, idempotency, immutable price, completed booking protection and occupied-slot preservation; all fixtures rolled back' verification;
