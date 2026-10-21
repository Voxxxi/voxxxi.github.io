begin;
create temporary table registration_test_actors as
select 'owner'::text label,user_id id,gen_random_uuid() sid from public.voxi_staff where role='owner'
union all select label,gen_random_uuid(),gen_random_uuid() from unnest(array['client','empty','other']) label;
insert into auth.users(id,email,created_at,raw_user_meta_data)
select id,'registration-test-'||id||'@example.invalid',now(),'{}'::jsonb from registration_test_actors where label<>'owner';
insert into auth.sessions(id,user_id,created_at,updated_at) select sid,id,now(),now() from registration_test_actors;
grant select on registration_test_actors to authenticated;
create temporary table registration_test_objects as select gen_random_uuid() as id, 'registration-test-'||gen_random_uuid()||'.mp3' as path;
insert into voxi_private.portfolio_tracks(id,title,storage_path) select id,'Registration test',path from registration_test_objects;
insert into storage.objects(bucket_id,name) select 'voxi-portfolio',path from registration_test_objects;
grant select on registration_test_objects to anon,authenticated;
do $$begin
 if not voxi_private.valid_profile('Әлия Қожахметова','+7 (701) 234-56-78') or not voxi_private.valid_profile('Нұрсұлтан Әбдірахманұлы','8 777 234 56 78') or not voxi_private.valid_profile('Ali O’Neil','7072345678') then raise exception 'Real names rejected';end if;
 if voxi_private.valid_profile('123 ABC','+77012345678') or voxi_private.valid_profile('KGBKBK QWRTY','+77012345678') or voxi_private.valid_profile('Әлия Қожахметова','+79992345678') then raise exception 'Invalid profile accepted';end if;
 if exists(select 1 from storage.buckets where id='voxi-portfolio' and public) then raise exception 'Public bucket';end if;
end $$;
set local role anon;
do $$begin
 if exists(select 1 from storage.objects where bucket_id='voxi-portfolio') then raise exception 'Anonymous storage access';end if;
 begin perform public.voxi_portfolio_tracks();raise exception 'Anonymous playlist access';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role authenticated;
do $$declare a record;r jsonb;begin
 select * into a from registration_test_actors where label='client';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a.id,'role','authenticated','session_id',a.sid)::text,true);
 if public.voxi_listening_allowed() then raise exception 'Incomplete client allowed';end if;
 begin perform public.voxi_portfolio_tracks();raise exception 'Incomplete playlist';exception when insufficient_privilege then null;end;
 if exists(select 1 from storage.objects where bucket_id='voxi-portfolio') then raise exception 'Incomplete storage access';end if;
 begin insert into public.voxi_profiles(user_id,full_name,phone) values(a.id,'123 ABC','+77012345678');raise exception 'Direct invalid profile bypass';exception when check_violation then null;end;
 insert into public.voxi_profiles(user_id,full_name,phone) values(a.id,'Әлия Қожахметова','8 (701) 234-56-78');
 if public.voxi_listening_allowed() then raise exception 'Missing consent allowed';end if;
 perform public.voxi_accept_privacy('2026-10-20');
 -- Profile updates after consent count as completion once.
 update public.voxi_profiles set full_name='Әлия Қожахметова' where user_id=a.id;
 update public.voxi_profiles set full_name='Әлия Қожахметова' where user_id=a.id;
 if not public.voxi_listening_allowed() then raise exception 'Registered client denied';end if;
 r:=public.voxi_portfolio_tracks();
 if not exists(select 1 from jsonb_array_elements(r) x where x->>'title'='Registration test') then raise exception 'Playlist missing';end if;
 if not exists(select 1 from storage.objects where bucket_id='voxi-portfolio' and name=(select path from registration_test_objects)) then raise exception 'Registered storage denied';end if;
 begin perform public.voxi_registration_notifications();raise exception 'Client read owner notices';exception when insufficient_privilege then null;end;
 begin perform public.voxi_read_registration(a.id);raise exception 'Client marked owner notice';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a.id,'role','authenticated','session_id',gen_random_uuid())::text,true);
 if public.voxi_listening_allowed() then raise exception 'Revoked client allowed';end if;
 if exists(select 1 from storage.objects where bucket_id='voxi-portfolio') then raise exception 'Revoked storage';end if;
end $$;
reset role;
select set_config('request.jwt.claims','{}',true);
do $$begin
 if (select count(*) from voxi_private.registration_notifications where user_id=(select id from registration_test_actors where label='client'))<>1 then raise exception 'Notice missing or duplicated';end if;
 if (select phone from public.voxi_profiles where user_id=(select id from registration_test_actors where label='client'))<>'+77012345678' then raise exception 'Phone normalization';end if;
 if has_table_privilege('authenticated','voxi_private.registration_notifications','select') or has_table_privilege('anon','voxi_private.portfolio_tracks','select') then raise exception 'Private table grants';end if;
end $$;
set local role authenticated;
do $$declare a record;r jsonb;begin
 select * into a from registration_test_actors where label='owner';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a.id,'role','authenticated','session_id',a.sid)::text,true);
 r:=public.voxi_registration_notifications();
 if not exists(select 1 from jsonb_array_elements(r->'items') x where x->>'user_id'=(select id::text from registration_test_actors where label='client') and x->>'read_at' is null) then raise exception 'Owner missing new notice';end if;
 perform public.voxi_read_registration((select id from registration_test_actors where label='client'));
 r:=public.voxi_registration_notifications();
 if exists(select 1 from jsonb_array_elements(r->'items') x where x->>'user_id'=(select id::text from registration_test_actors where label='client') and x->>'read_at' is null) then raise exception 'Mark read failed';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a.id,'role','authenticated','session_id',gen_random_uuid())::text,true);
 begin perform public.voxi_registration_notifications();raise exception 'Revoked owner read notices';exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'Registration access tests passed; all fixtures will be rolled back' as result;
rollback;

