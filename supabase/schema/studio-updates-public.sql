-- Anonymous visitors have no USAGE on the private schema. Keep it that way.
-- Fixed-output readers live in a separate, unexposed schema with narrow grants.
create schema if not exists voxi_public_api;
revoke all on schema voxi_public_api from public;
grant usage on schema voxi_public_api to anon,authenticated;
create or replace function voxi_public_api.studio_updates() returns jsonb
language sql stable security definer set search_path='' as $$select voxi_private.studio_updates();$$;
create or replace function voxi_public_api.slot_offer(p_date date,p_time time) returns jsonb
language sql stable security definer set search_path='' as $$select voxi_private.slot_offer(p_date,p_time);$$;
revoke all on function voxi_public_api.studio_updates(),voxi_public_api.slot_offer(date,time) from public;
grant execute on function voxi_public_api.studio_updates(),voxi_public_api.slot_offer(date,time) to anon,authenticated;
create or replace function public.voxi_studio_updates() returns jsonb
language sql stable security invoker set search_path='' as $$select voxi_public_api.studio_updates();$$;
create or replace function public.voxi_slot_offer(p_date date,p_time time) returns jsonb
language sql stable security invoker set search_path='' as $$select voxi_public_api.slot_offer(p_date,p_time);$$;
revoke all on function public.voxi_studio_updates(),public.voxi_slot_offer(date,time) from public;
grant execute on function public.voxi_studio_updates(),public.voxi_slot_offer(date,time) to anon,authenticated;
revoke execute on function voxi_private.studio_updates(),voxi_private.slot_offer(date,time) from anon;
