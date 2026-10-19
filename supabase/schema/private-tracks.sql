alter table public.voxi_tracks add constraint voxi_tracks_user_id_fkey foreign key(user_id) references auth.users(id) on delete restrict;
alter table public.voxi_tracks add constraint voxi_track_owner_path check (storage_path like user_id::text||'/%');
alter table public.voxi_tracks add constraint voxi_track_size_limit check (file_size>0 and file_size<=52428800);
alter table public.voxi_tracks add constraint voxi_track_title_limit check (char_length(trim(song_title)) between 1 and 200);
alter table public.voxi_tracks add constraint voxi_track_filename_limit check (char_length(file_name) between 1 and 255);
update storage.buckets set public=false,file_size_limit=52428800,allowed_mime_types=array['audio/mpeg','audio/wav','audio/mp4','audio/ogg','audio/flac'] where id='voxi-tracks';
create index voxi_tracks_user_created on public.voxi_tracks(user_id,created_at desc);
create function voxi_private.session_active() returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from auth.sessions s where s.user_id=auth.uid() and s.id=nullif(auth.jwt()->>'session_id','')::uuid);
$$;
revoke all on function voxi_private.session_active() from public,anon;
grant execute on function voxi_private.session_active() to authenticated,service_role;
alter policy "VOXi client reads own tracks" on public.voxi_tracks using (user_id=(select auth.uid()) and (select voxi_private.session_active()));
alter policy "VOXi client read own tracks" on storage.objects using (bucket_id='voxi-tracks' and (storage.foldername(name))[1]=(select auth.uid())::text and (select voxi_private.session_active()));
