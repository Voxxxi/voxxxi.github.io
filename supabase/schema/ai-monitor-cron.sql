create function voxi_private.run_site_health() returns bigint language plpgsql security definer set search_path='' as $$
declare request_id bigint; secret text;
begin
 select decrypted_secret into secret from vault.decrypted_secrets where name='voxi_webhook_secret';
 if secret is null or length(secret)<20 then raise exception 'Monitor secret missing';end if;
 select net.http_post(url:='https://vnykpjarjvacwhxvkxrk.supabase.co/functions/v1/voxi-ai',headers:=jsonb_build_object('Content-Type','application/json','x-voxi-secret',secret),body:='{"action":"monitor"}'::jsonb,timeout_milliseconds:=90000) into request_id;
 return request_id;
end $$;
revoke all on function voxi_private.run_site_health() from public,anon,authenticated;
select cron.schedule('voxi-site-health','*/5 * * * *','select voxi_private.run_site_health();');
