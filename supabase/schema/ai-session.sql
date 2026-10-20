create function public.voxi_ai_session_active() returns boolean language sql stable security invoker set search_path='' as $$ select voxi_private.session_active(); $$;
revoke all on function public.voxi_ai_session_active() from public,anon;
grant execute on function public.voxi_ai_session_active() to authenticated;
