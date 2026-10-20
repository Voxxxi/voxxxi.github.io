-- Read-only checks under real roles. Temporary staff assignment is rolled back.
begin;
create temporary table voxi_diag_actors as select u.id,coalesce(s.role,'client') role,(select id from auth.sessions a where a.user_id=u.id order by created_at desc limit 1) sid from auth.users u left join public.voxi_staff s on s.user_id=u.id;
create temporary table voxi_diag_expected as select coalesce(sum(case when metadata->>'size' ~ '^[0-9]+$' then (metadata->>'size')::numeric else 0 end),0) bytes from storage.objects;
grant select on voxi_diag_actors,voxi_diag_expected to authenticated;
set local role authenticated;
do $$ declare a record;r jsonb;begin
select * into a from voxi_diag_actors where role='owner' and sid is not null limit 1;
if a.id is null then raise exception 'Owner session required';end if;
perform set_config('request.jwt.claims',jsonb_build_object('sub',a.id,'role','authenticated','session_id',a.sid)::text,true);
r:=public.voxi_maintenance_snapshot();
if (r->>'storage_bytes')::numeric<>(select bytes from voxi_diag_expected) then raise exception 'Storage size mismatch';end if;
if r::text ~ '(storage_path|file_name|email|phone|user_id|access_token)' then raise exception 'Private detail leaked';end if;
select * into a from voxi_diag_actors where role='client' and sid is not null limit 1;
if a.id is null then raise exception 'Client session required';end if;
perform set_config('request.jwt.claims',jsonb_build_object('sub',a.id,'role','authenticated','session_id',a.sid)::text,true);
begin perform public.voxi_maintenance_snapshot();raise exception 'Client read owner diagnostics';exception when insufficient_privilege then null;end;
end $$;
reset role;
insert into public.voxi_staff(user_id,role) select id,'admin' from voxi_diag_actors where role='client' and sid is not null limit 1 on conflict(user_id) do update set role='admin';
set local role authenticated;
do $$ declare a record;begin
select * into a from voxi_diag_actors where role='client' and sid is not null limit 1;
perform set_config('request.jwt.claims',jsonb_build_object('sub',a.id,'role','authenticated','session_id',a.sid)::text,true);
begin perform public.voxi_maintenance_snapshot();raise exception 'Admin read owner diagnostics';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$ begin if has_function_privilege('anon','public.voxi_maintenance_snapshot()','execute') then raise exception 'Anonymous API access';end if;end $$;
rollback;
select 'PASS: owner aggregates, exact metadata size, client/admin/anon denied, no personal data; changes rolled back' verification;
