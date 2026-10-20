-- All fixtures, payment marks and audit changes are rolled back.
begin;
create temporary table voxi_test_actors as
select u.id,coalesce(s.role,'client') as role,(select a.id from auth.sessions a where a.user_id=u.id order by a.created_at desc limit 1) as session_id
from auth.users u left join public.voxi_staff s on s.user_id=u.id;
grant select on voxi_test_actors to authenticated;
create temporary table voxi_test_booking as with b as (insert into public.voxi_bookings(client_name,phone,booking_date,booking_time,people_count,song_count,song_titles,price,status,user_id) values('VOXi rollback verification','+70000000000',current_date,'03:07',2,2,'[{"title":"Test A","people":1,"price":5000},{"title":"Test B","people":2,"price":6000}]',11000,'Готово',(select id from voxi_test_actors where role='client' and session_id is not null limit 1)) returning id) select * from b;
grant select on voxi_test_booking to authenticated;
set local role authenticated;
do $$
declare owner_user record; client_user record; result jsonb; k text; row jsonb; booking_id bigint; payment_id uuid; before_total numeric; after_total numeric;
begin
 select * into owner_user from voxi_test_actors where role='owner' and session_id is not null limit 1;
 select * into client_user from voxi_test_actors where role='client' and session_id is not null limit 1;
 if owner_user.id is null or client_user.id is null then raise exception 'Active owner and client sessions required for verification';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_user.id,'role','authenticated','session_id',owner_user.session_id)::text,true);
 foreach k in array array['all','complete','incomplete','staff','suspended'] loop
  result:=public.voxi_admin_directory('',1,k);
  if (result->>'total')::integer<>(result->'counts'->>k)::integer then raise exception 'Filter count mismatch: %',k;end if;
  for row in select * from jsonb_array_elements(result->'users') loop
   if k='complete' and not(row->>'profile_complete')::boolean or k='incomplete' and (row->>'profile_complete')::boolean or k='staff' and row->>'role'='client' then raise exception 'Wrong directory member';end if;
  end loop;
 end loop;
 before_total:=(public.voxi_income_month(current_date)->>'amount')::numeric;
 select id into booking_id from voxi_test_booking;
 payment_id:=public.voxi_record_payment(booking_id,10000,current_date);
 after_total:=(public.voxi_income_month(current_date)->>'amount')::numeric;
 if after_total<>before_total+10000 then raise exception 'Actual received amount was not counted';end if;
 begin perform public.voxi_record_payment(booking_id,10000,current_date);raise exception 'DUPLICATE WAS ACCEPTED';exception when raise_exception then if sqlerrm='DUPLICATE WAS ACCEPTED' then raise;end if;end;
 perform public.voxi_void_payment(payment_id);
 if (public.voxi_income_month(current_date)->>'amount')::numeric<>before_total then raise exception 'Voided payment remained in total';end if;
 begin perform public.voxi_record_payment(booking_id,-1,current_date);raise exception 'NEGATIVE WAS ACCEPTED';exception when raise_exception then if sqlerrm='NEGATIVE WAS ACCEPTED' then raise;end if;end;
 begin perform public.voxi_record_payment(booking_id,1,(now() at time zone 'Asia/Oral')::date+1);raise exception 'FUTURE WAS ACCEPTED';exception when raise_exception then if sqlerrm='FUTURE WAS ACCEPTED' then raise;end if;end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',client_user.id,'role','authenticated','session_id',client_user.session_id)::text,true);
 begin perform public.voxi_income_month(current_date);raise exception 'Client read income';exception when insufficient_privilege then null;end;
 begin perform public.voxi_record_payment(booking_id,10000,current_date);raise exception 'Client recorded income';exception when insufficient_privilege then null;end;
 begin perform public.voxi_void_payment(payment_id);raise exception 'Client voided income';exception when insufficient_privilege then null;end;
 begin perform public.voxi_admin_directory('',1,'all');raise exception 'Client read directory';exception when insufficient_privilege then null;end;
end $$;
reset role;
insert into public.voxi_staff(user_id,role) select id,'admin' from voxi_test_actors where role='client' and session_id is not null limit 1 on conflict(user_id) do update set role='admin';
set local role authenticated;
do $$ declare a record; begin
 select * into a from voxi_test_actors where role='client' and session_id is not null limit 1;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a.id,'role','authenticated','session_id',a.session_id)::text,true);
 perform public.voxi_admin_directory('',1,'staff');
 begin perform public.voxi_income_month(current_date);raise exception 'Admin read owner income';exception when insufficient_privilege then null;end;
end $$;
rollback;
