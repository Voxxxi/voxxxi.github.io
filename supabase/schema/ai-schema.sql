create table voxi_private.ai_limits(day date not null,bucket text not null,calls integer not null default 0,last_at timestamptz not null default now(),primary key(day,bucket));
alter table voxi_private.ai_limits enable row level security;
revoke all on voxi_private.ai_limits from public,anon,authenticated;
create function voxi_private.ai_claim_internal(person uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare today date:=(now() at time zone 'UTC')::date; bucket_name text:=coalesce(person::text,'monitor');g integer;n integer;last_call timestamptz;
begin
 perform pg_advisory_xact_lock(82104621);
 select calls into g from voxi_private.ai_limits where day=today and bucket='global';
 select calls,last_at into n,last_call from voxi_private.ai_limits where day=today and bucket=bucket_name;
 if coalesce(g,0)>=100 or coalesce(n,0)>=(case when person is null then 10 else 20 end) or last_call>now()-interval '3 seconds' then return false;end if;
 insert into voxi_private.ai_limits values(today,'global',1,now()) on conflict(day,bucket) do update set calls=ai_limits.calls+1,last_at=excluded.last_at;
 insert into voxi_private.ai_limits values(today,bucket_name,1,now()) on conflict(day,bucket) do update set calls=ai_limits.calls+1,last_at=excluded.last_at;
 delete from voxi_private.ai_limits where day<today-7;
 return true;
end $$;
revoke all on function voxi_private.ai_claim_internal(uuid) from public,anon,authenticated;
create function voxi_private.ai_claim() returns boolean language plpgsql security definer set search_path='' as $$
begin
 if not voxi_private.session_active() then raise exception 'Войдите заново' using errcode='42501';end if;
 return voxi_private.ai_claim_internal(auth.uid());
end $$;
create function public.voxi_ai_claim() returns boolean language sql security invoker set search_path='' as $$ select voxi_private.ai_claim(); $$;
revoke all on function voxi_private.ai_claim(),public.voxi_ai_claim() from public,anon;
grant execute on function voxi_private.ai_claim(),public.voxi_ai_claim() to authenticated;
create function public.voxi_ai_monitor_claim() returns boolean language sql security invoker set search_path='' as $$ select voxi_private.ai_claim_internal(null); $$;
revoke all on function public.voxi_ai_monitor_claim() from public,anon,authenticated;
grant execute on function public.voxi_ai_monitor_claim(),voxi_private.ai_claim_internal(uuid) to service_role;

create table public.voxi_ai_replies(message_id uuid primary key references public.voxi_chat_messages(id) on delete cascade,body text not null check(length(body) between 1 and 1800),kind text not null check(kind in ('ai','reference')),created_at timestamptz not null default now());
alter table public.voxi_ai_replies enable row level security;
revoke all on public.voxi_ai_replies from public,anon,authenticated;
grant select on public.voxi_ai_replies to authenticated;
grant all on public.voxi_ai_replies to service_role;
create policy ai_replies_read on public.voxi_ai_replies for select to authenticated using((select voxi_private.session_active()));

create table voxi_private.health_runs(id bigint generated always as identity primary key,checked_at timestamptz not null default now(),ok boolean not null,fingerprint text not null,facts jsonb not null,explanation text);
alter table voxi_private.health_runs enable row level security;
revoke all on voxi_private.health_runs from public,anon,authenticated;
create function voxi_private.monitor_facts() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('missing_tracks',(select count(*) from public.voxi_tracks t where deleted_at is null and (expires_at is null or expires_at>now()) and not voxi_private.track_object_exists(t.storage_provider,t.storage_path,t.file_size,t.user_id)),
 'pending_deletions',(select count(*) from public.voxi_tracks where deleted_at is not null or expires_at<=now()),
 'unknown_sizes',(select count(*) from storage.objects where coalesce(metadata->>'size','') !~ '^[0-9]+$'),
 'storage_bytes',(select coalesce(sum(case when metadata->>'size' ~ '^[0-9]+$' then (metadata->>'size')::numeric else 0 end),0) from storage.objects));
$$;
create function public.voxi_monitor_facts() returns jsonb language sql stable security invoker set search_path='' as $$ select voxi_private.monitor_facts(); $$;
create function voxi_private.health_save(p_ok boolean,p_fingerprint text,p_facts jsonb,p_explanation text) returns void language plpgsql security definer set search_path='' as $$
begin
 insert into voxi_private.health_runs(ok,fingerprint,facts,explanation) values(p_ok,left(p_fingerprint,200),p_facts,left(p_explanation,1800));
 delete from voxi_private.health_runs where id not in(select id from voxi_private.health_runs order by id desc limit 2000);
end $$;
create function public.voxi_health_save(p_ok boolean,p_fingerprint text,p_facts jsonb,p_explanation text) returns void language sql security invoker set search_path='' as $$ select voxi_private.health_save(p_ok,p_fingerprint,p_facts,p_explanation); $$;
create function voxi_private.health_latest() returns jsonb language sql stable security definer set search_path='' as $$ select to_jsonb(r) from (select checked_at,ok,fingerprint,facts,explanation from voxi_private.health_runs order by id desc limit 1)r; $$;
create function public.voxi_health_latest_service() returns jsonb language sql stable security invoker set search_path='' as $$ select voxi_private.health_latest(); $$;
revoke all on function voxi_private.monitor_facts(),public.voxi_monitor_facts(),voxi_private.health_save(boolean,text,jsonb,text),public.voxi_health_save(boolean,text,jsonb,text),voxi_private.health_latest(),public.voxi_health_latest_service() from public,anon,authenticated;
grant execute on function voxi_private.monitor_facts(),public.voxi_monitor_facts(),voxi_private.health_save(boolean,text,jsonb,text),public.voxi_health_save(boolean,text,jsonb,text),voxi_private.health_latest(),public.voxi_health_latest_service() to service_role;
create function voxi_private.health_owner() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not voxi_private.has_role(array['owner']) then raise exception 'Only owner' using errcode='42501';end if;
 return voxi_private.health_latest();
end $$;
create function public.voxi_health_owner() returns jsonb language sql stable security invoker set search_path='' as $$ select voxi_private.health_owner(); $$;
revoke all on function voxi_private.health_owner(),public.voxi_health_owner() from public,anon;
grant execute on function voxi_private.health_owner(),public.voxi_health_owner() to authenticated;
