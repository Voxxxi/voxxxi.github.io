begin;
create temporary table service_actors as select 'owner'::text label,user_id id,gen_random_uuid() sid from public.voxi_staff where role='owner' union all select label,gen_random_uuid(),gen_random_uuid() from unnest(array['client','other']) label;
insert into auth.users(id,email,created_at,raw_user_meta_data) select id,'service-test-'||id||'@example.invalid','2097-12-31T20:30:00Z','{}'::jsonb from service_actors where label<>'owner';
insert into auth.sessions(id,user_id,created_at,updated_at) select sid,id,now(),now() from service_actors;
create temporary table service_tracks as select gen_random_uuid() id,(select id from service_actors where label=case when v.label='other' then 'other' else 'client' end) user_id,v.label from unnest(array['ready','expired','other','unverified']) as v(label);
insert into voxi_private.r2_uploads(actor,user_id,path,bytes,title,file_name,content_type,state,verified_at)
 select (select id from service_actors where label='owner'),user_id,user_id::text||'/'||id::text||'.wav',44,'Service test','service-test.wav','audio/wav','stored',now() from service_tracks where label<>'unverified';
insert into public.voxi_tracks(id,user_id,song_number,song_title,storage_path,storage_provider,file_name,file_size,expires_at)
 select id,user_id,row_number() over(partition by user_id order by label),'service-test-'||label,user_id::text||'/'||id::text||'.wav',case when label='unverified' then 'supabase' else 'r2' end,'service-test.wav',44,case when label='expired' then now()-interval '1 day' else null end from service_tracks;
insert into public.voxi_schedule_slots(booking_date,booking_time,is_open) values('2098-01-12','15:00',true);
insert into public.voxi_bookings(client_name,phone,booking_date,booking_time,people_count,song_count,song_titles,price,status,user_id,created_at)
 values('Rollback','+70000000000','2098-01-12','15:00',1,1,'[]',5000,'Запланировано',(select id from service_actors where label='client'),'2097-12-31T20:30:00Z');
grant select on service_actors,service_tracks to authenticated;
set local role anon;
select public.voxi_record_page_open();
reset role;
set local role authenticated;
do $$declare a record;result jsonb;begin
 select * into a from service_actors where label='client';perform set_config('request.jwt.claims',jsonb_build_object('sub',a.id,'role','authenticated','session_id',a.sid)::text,true);
 result:=public.voxi_ready_notifications();
 if result->>'unread_count'<>'1' or jsonb_array_length(result->'items')<>1 or result->'items'->0->>'song_title'<>'service-test-ready' then raise exception 'Notification privacy or readiness failure';end if;
 perform public.voxi_read_ready_notification((select id from service_tracks where label='other'));
 perform public.voxi_read_ready_notification((select id from service_tracks where label='ready'));
 if public.voxi_ready_notifications()->>'unread_count'<>'0' then raise exception 'Read notification failed';end if;
 perform public.voxi_read_ready_notification((select id from service_tracks where label='ready'));
 begin perform public.voxi_studio_statistics('2098-01-01');raise exception 'Client accessed statistics';exception when insufficient_privilege then null;end;
 begin perform public.voxi_accept_privacy('wrong');raise exception 'Unknown policy version accepted';exception when raise_exception then if sqlerrm<>'Refresh privacy policy' then raise;end if;end;
 perform public.voxi_accept_privacy('2026-10-20');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a.id,'role','authenticated','session_id',gen_random_uuid())::text,true);
 begin perform public.voxi_ready_notifications();raise exception 'Revoked session read notifications';exception when insufficient_privilege then null;end;
 begin perform public.voxi_accept_privacy('2026-10-20');raise exception 'Revoked consent accepted';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claims','{}',true);
do $$begin
 if(select count(*) from voxi_private.track_notifications where track_id in(select id from service_tracks))<>2 then raise exception 'Unverified or expired track emitted notification';end if;
 if(select read_at from voxi_private.track_notifications where track_id=(select id from service_tracks where label='other')) is not null then raise exception 'Foreign notification marked read';end if;
 if not exists(select 1 from voxi_private.privacy_consents where user_id=(select id from service_actors where label='client') and version='2026-10-20') then raise exception 'Consent missing';end if;
 if has_table_privilege('authenticated','voxi_private.track_notifications','select') or has_function_privilege('anon','public.voxi_ready_notifications()','execute') then raise exception 'Private data exposure';end if;
end $$;
set local role authenticated;
do $$declare a record;r jsonb;begin
 select * into a from service_actors where label='owner';perform set_config('request.jwt.claims',jsonb_build_object('sub',a.id,'role','authenticated','session_id',a.sid)::text,true);
 r:=public.voxi_studio_statistics('2098-01-01');if r->>'new_clients'<>'2' or r->>'bookings_created'<>'1' or jsonb_array_length(r->'daily')<>31 then raise exception 'Statistics month or staff exclusion failed: %',r;end if;
 if r->'daily'->0->>'bookings'<>'1' then raise exception 'Asia/Oral day boundary failed';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a.id,'role','authenticated','session_id',gen_random_uuid())::text,true);
 begin perform public.voxi_studio_statistics('2098-01-01');raise exception 'Revoked owner read statistics';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claims','{}',true);
create temporary table service_bulk_tracks as select gen_random_uuid() id,(select id from service_actors where label='client') user_id,gs number from generate_series(1,50) gs;
insert into voxi_private.r2_uploads(actor,user_id,path,bytes,title,file_name,content_type,state,verified_at)
 select (select id from service_actors where label='owner'),user_id,user_id::text||'/'||id::text||'.wav',44,'Bulk test','bulk-test.wav','audio/wav','stored',now() from service_bulk_tracks;
insert into public.voxi_tracks(id,user_id,song_number,song_title,storage_path,storage_provider,file_name,file_size,created_at)
 select id,user_id,100+number,'service-test-bulk',user_id::text||'/'||id::text||'.wav','r2','bulk-test.wav',44,now()+interval '1 second' from service_bulk_tracks;
update voxi_private.track_notifications set read_at=now() where track_id in(select id from service_bulk_tracks);
update voxi_private.track_notifications set read_at=null,created_at=now()-interval '1 day' where track_id=(select id from service_tracks where label='ready');
set local role authenticated;
do $$declare a record;r jsonb;begin
 select * into a from service_actors where label='client';perform set_config('request.jwt.claims',jsonb_build_object('sub',a.id,'role','authenticated','session_id',a.sid)::text,true);
 r:=public.voxi_ready_notifications();if r->>'unread_count'<>'1' or jsonb_array_length(r->'items')<>50 or r->'items'->0->>'track_id'<>(select id::text from service_tracks where label='ready') then raise exception 'Old unread message became unreachable beyond history limit';end if;
end $$;
reset role;
rollback;
select 'PASS: verified song notifications, read state, foreign isolation, expired/unverified exclusion, fresh sessions, versioned consent, anonymous aggregate counter, owner-only statistics and Asia/Oral boundaries; all fixtures rolled back' verification;
