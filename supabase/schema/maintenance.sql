create function voxi_private.maintenance_snapshot() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not voxi_private.has_role(array['owner']) then raise exception 'Only the owner may view maintenance diagnostics' using errcode='42501';end if;
 with sizes as (
  select bucket_id,count(*) as objects,coalesce(sum(case when metadata->>'size' ~ '^[0-9]+$' then (metadata->>'size')::numeric else 0 end),0) as bytes,
   count(*) filter(where coalesce(metadata->>'size','') !~ '^[0-9]+$') as unknown_sizes
  from storage.objects group by bucket_id
 ) select jsonb_build_object('version',1,'checked_at',now(),'storage_bytes',coalesce((select sum(bytes) from sizes),0),
 'unknown_sizes',coalesce((select sum(unknown_sizes) from sizes),0),
 'buckets',coalesce((select jsonb_agg(jsonb_build_object('kind',case bucket_id when 'voxi-tracks' then 'songs' when 'voxi-videos' then 'videos' else 'other' end,'bytes',bytes,'objects',objects)) from sizes),'[]'::jsonb),
 'missing_tracks',(select count(*) from public.voxi_tracks t where t.deleted_at is null and (t.expires_at is null or t.expires_at>now()) and not exists(select 1 from storage.objects o where o.bucket_id='voxi-tracks' and o.name=t.storage_path)),
 'pending_deletions',(select count(*) from public.voxi_tracks t where (t.deleted_at is not null or t.expires_at<=now()) and exists(select 1 from storage.objects o where o.bucket_id='voxi-tracks' and o.name=t.storage_path)),
 'unlinked_objects',(select count(*) from storage.objects o where o.bucket_id='voxi-tracks' and not exists(select 1 from public.voxi_tracks t where t.storage_path=o.name)),
 'pending_videos',(select count(*) from public.voxi_videos where status='pending'),
 'unlinked_tracks',(select count(*) from public.voxi_tracks where booking_id is null and deleted_at is null and (expires_at is null or expires_at>now()))) into result;
 return result;
end $$;
revoke all on function voxi_private.maintenance_snapshot() from public,anon;
grant execute on function voxi_private.maintenance_snapshot() to authenticated;
create function public.voxi_maintenance_snapshot() returns jsonb language sql stable security invoker set search_path='' as $$ select voxi_private.maintenance_snapshot(); $$;
revoke all on function public.voxi_maintenance_snapshot() from public,anon;
grant execute on function public.voxi_maintenance_snapshot() to authenticated;
