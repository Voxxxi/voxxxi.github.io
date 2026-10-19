alter table public.voxi_tracks add column if not exists expires_at timestamptz;
alter table public.voxi_tracks add column if not exists deleted_at timestamptz;
create index if not exists voxi_tracks_expiry on public.voxi_tracks(expires_at) where expires_at is not null;
alter policy "VOXi client reads own tracks" on public.voxi_tracks using (user_id=(select auth.uid()) and (select voxi_private.session_active()) and deleted_at is null and (expires_at is null or expires_at>now()));
alter policy "VOXi client read own tracks" on storage.objects using (bucket_id='voxi-tracks' and (storage.foldername(name))[1]=(select auth.uid())::text and (select voxi_private.session_active()) and exists(select 1 from public.voxi_tracks t where t.storage_path=objects.name and t.user_id=(select auth.uid()) and t.deleted_at is null and (t.expires_at is null or t.expires_at>now())));
create table public.voxi_track_audit(id bigint generated always as identity primary key,track_id uuid not null,user_id uuid not null,actor_id uuid,action text not null check(action in ('delete','expire','retention')),created_at timestamptz not null default now());
alter table public.voxi_track_audit enable row level security;
revoke all on public.voxi_track_audit from anon,authenticated;
grant all on public.voxi_track_audit to service_role;
grant usage,select on sequence public.voxi_track_audit_id_seq to service_role;
create or replace function voxi_private.track_retention(p_track uuid,p_user uuid,p_expires timestamptz) returns void language plpgsql security definer set search_path='' as $$
declare t public.voxi_tracks;
begin
 if not voxi_private.has_role(array['owner','admin']) then raise exception 'Недостаточно прав'; end if;
 if p_expires is not null and (p_expires<=now() or p_expires>now()+interval '10 years') then raise exception 'Выберите будущую дату не дальше 10 лет'; end if;
 select * into t from public.voxi_tracks where id=p_track and user_id=p_user for update;
 if not found or t.deleted_at is not null then raise exception 'Песня удалена или не найдена'; end if;
 update public.voxi_tracks set expires_at=p_expires where id=t.id;
 insert into public.voxi_track_audit(track_id,user_id,actor_id,action) values(t.id,t.user_id,auth.uid(),'retention');
end $$;
revoke all on function voxi_private.track_retention(uuid,uuid,timestamptz) from public,anon;
grant execute on function voxi_private.track_retention(uuid,uuid,timestamptz) to authenticated;
create or replace function public.voxi_track_retention(p_track uuid,p_user uuid,p_expires timestamptz) returns void language sql security invoker set search_path='' as $$select voxi_private.track_retention(p_track,p_user,p_expires)$$;
revoke all on function public.voxi_track_retention(uuid,uuid,timestamptz) from public,anon;
grant execute on function public.voxi_track_retention(uuid,uuid,timestamptz) to authenticated;
