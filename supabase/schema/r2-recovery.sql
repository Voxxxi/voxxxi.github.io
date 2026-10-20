create function voxi_private.r2_pending(p_id uuid) returns text language plpgsql stable security definer set search_path='' as $$
declare result text;
begin
 if not voxi_private.has_role(array['owner','admin']) then raise exception 'Forbidden' using errcode='42501';end if;
 select state into result from voxi_private.r2_uploads where id=p_id and actor=auth.uid();
 return coalesce(result,'removed');
end $$;
create function public.voxi_r2_pending(p_id uuid) returns text language sql stable security invoker set search_path='' as $$ select voxi_private.r2_pending(p_id); $$;
revoke all on function voxi_private.r2_pending(uuid),public.voxi_r2_pending(uuid) from public,anon;
grant execute on function voxi_private.r2_pending(uuid),public.voxi_r2_pending(uuid) to authenticated;
