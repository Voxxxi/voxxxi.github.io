begin;
create temporary table r2_test_actors as select u.id,coalesce(s.role,'client') role,(select id from auth.sessions a where a.user_id=u.id order by created_at desc limit 1) sid from auth.users u left join public.voxi_staff s on s.user_id=u.id;
create temporary table r2_test_booking as with b as(insert into public.voxi_bookings(client_name,phone,booking_date,booking_time,people_count,song_count,song_titles,price,status,user_id) values('R2 rollback verification','+70000000000',current_date,'03:08',2,2,'[]',10000,'Запланировано',(select id from r2_test_actors where role='client' and sid is not null limit 1)) returning id,user_id) select * from b;
create temporary table r2_test_items(n int,item jsonb);
insert into r2_test_items select n,public.voxi_r2_reserve((select id from r2_test_actors where role='owner' and sid is not null limit 1),(select user_id from r2_test_booking),4,'Test '||n,'test.mp3','audio/mpeg',(select id from r2_test_booking),n,null,0) from generate_series(1,2) n;
-- No real file is created: server confirmations below are transactional fixtures.
select public.voxi_r2_claim((item->>'id')::uuid,(item->>'actor')::uuid) from r2_test_items;
select public.voxi_r2_verify((item->>'id')::uuid,4) from r2_test_items;
do $$begin
 begin perform public.voxi_r2_reserve((select id from r2_test_actors where role='owner' and sid is not null limit 1),(select user_id from r2_test_booking),4,'Over quota','test.mp3','audio/mpeg',null,null,null,8999999999);raise exception 'Quota bypassed';exception when raise_exception then if sqlerrm not like 'R2:%' then raise;end if;end;
end $$;
grant select on r2_test_actors,r2_test_booking,r2_test_items to authenticated;
set local role authenticated;
do $$declare a record;c record;baseline numeric;first_id uuid;again uuid;r jsonb;begin
 select * into a from r2_test_actors where role='owner' and sid is not null limit 1;
 select * into c from r2_test_actors where role='client' and sid is not null limit 1;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a.id,'role','authenticated','session_id',a.sid)::text,true);
 baseline:=(public.voxi_income_month(current_date)->>'amount')::numeric;
 begin perform public.voxi_r2_verify(gen_random_uuid(),4);raise exception 'Client role can certify';exception when insufficient_privilege then null;end;
 begin insert into public.voxi_tracks(user_id,song_number,song_title,storage_path,storage_provider,file_name,file_size) values(c.id,900001,'Forged',c.id::text||'/'||gen_random_uuid()::text||'.mp3','r2','test.mp3',4);raise exception 'Forged proof accepted';exception when raise_exception then if sqlerrm<>'R2 object not verified' then raise;end if;end;
 first_id:=public.voxi_r2_finalize((select (item->>'id')::uuid from r2_test_items where n=1));
 again:=public.voxi_r2_finalize((select (item->>'id')::uuid from r2_test_items where n=1));
 if first_id<>again then raise exception 'Finalize not idempotent';end if;
 if (public.voxi_income_month(current_date)->>'amount')::numeric<>baseline then raise exception 'Premature income';end if;
 r:=public.voxi_client_delivery_orders(c.id);
 if not exists(select 1 from jsonb_array_elements(r) j where (j->>'id')::bigint=(select id from r2_test_booking) and (j->>'uploaded_count')::int=1 and j->'delivered_song_numbers'='[1]'::jsonb) then raise exception 'R2 progress incorrect';end if;
 perform public.voxi_r2_finalize((select (item->>'id')::uuid from r2_test_items where n=2));
 if (public.voxi_income_month(current_date)->>'amount')::numeric<>baseline+10000 then raise exception 'Income not booked';end if;
 if (select status from public.voxi_bookings where id=(select id from r2_test_booking))<>'Готово' then raise exception 'Not closed';end if;
 begin update public.voxi_tracks set storage_provider='supabase' where id=first_id;raise exception 'Provider changed';exception when raise_exception then if sqlerrm<>'File identity is immutable' then raise;end if;end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',c.id,'role','authenticated','session_id',c.sid)::text,true);
 begin perform public.voxi_r2_finalize((select (item->>'id')::uuid from r2_test_items where n=1));raise exception 'Client finalized';exception when insufficient_privilege then null;end;
 if not exists(select 1 from public.voxi_tracks where id=first_id) then raise exception 'Recipient cannot read own metadata';end if;
 if has_function_privilege('anon','public.voxi_r2_finalize(uuid)','execute') or has_function_privilege('authenticated','public.voxi_r2_reserve(uuid,uuid,bigint,text,text,text,bigint,integer,timestamptz,bigint)','execute') then raise exception 'Excess grant';end if;
end $$;
reset role;
rollback;
select 'PASS: quota, service-only proof, two-song revenue, idempotency, provider immutability and recipient isolation; all fixtures rolled back' verification;
