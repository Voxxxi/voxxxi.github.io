create or replace function voxi_private.ready_notifications() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not voxi_private.session_active() then raise insufficient_privilege;end if;
 with available as(select n.track_id,n.created_at,n.read_at,t.song_title,t.expires_at from voxi_private.track_notifications n join public.voxi_tracks t on t.id=n.track_id and t.user_id=n.user_id
 where n.user_id=auth.uid() and t.deleted_at is null and (t.expires_at is null or t.expires_at>now()) and voxi_private.track_object_exists(t.storage_provider,t.storage_path,t.file_size,t.user_id)),
 recent as(select * from available order by (read_at is not null),created_at desc,track_id limit 50)
 select jsonb_build_object('unread_count',(select count(*) from available where read_at is null),'items',coalesce((select jsonb_agg(to_jsonb(r) order by (r.read_at is not null),r.created_at desc,r.track_id) from recent r),'[]'::jsonb)) into result;
 return result;
end $$;
