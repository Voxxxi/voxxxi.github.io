create or replace function voxi_private.admin_directory(search_text text,page_number integer,filter_name text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; q text:=left(trim(coalesce(search_text,'')),120); digits text:=regexp_replace(q,'[^0-9]','','g');
begin
 if not voxi_private.has_role(array['owner','admin']) then raise exception 'Only VOXi administrators may view clients' using errcode='42501'; end if;
 if page_number is null or page_number<1 or page_number>100000 then raise exception 'Invalid page'; end if;
 if filter_name is null or filter_name not in ('all','complete','incomplete','staff','suspended') then raise exception 'Invalid filter'; end if;
 with matches as (
  select u.id as user_id,coalesce(p.full_name,'') as full_name,coalesce(p.phone,'') as phone,coalesce(u.email,'') as email,
   coalesce(s.role,'client') as role,u.created_at,u.banned_until,
   (trim(coalesce(p.full_name,'')) ~ '\S+\s+\S+' and trim(coalesce(p.phone,''))<>'') as profile_complete
  from auth.users u left join public.voxi_profiles p on p.user_id=u.id left join public.voxi_staff s on s.user_id=u.id
  where coalesce(s.role,'client')<>'owner' and (q='' or strpos(lower(coalesce(p.full_name,'')),lower(q))>0 or strpos(lower(coalesce(u.email,'')),lower(q))>0 or strpos(u.id::text,lower(q))>0
   or (digits<>'' and regexp_replace(q,'[^[:alpha:]]','','g')='' and strpos(regexp_replace(coalesce(p.phone,''),'[^0-9]','','g'),digits)>0))
 ), filtered as (
  select * from matches where filter_name='all' or (filter_name='complete' and profile_complete) or (filter_name='incomplete' and not profile_complete)
   or (filter_name='staff' and role<>'client') or (filter_name='suspended' and banned_until>now())
 ), page_rows as (select * from filtered order by created_at desc,user_id limit 30 offset (page_number-1)*30)
 select jsonb_build_object('users',coalesce((select jsonb_agg(to_jsonb(r)) from page_rows r),'[]'::jsonb),'total',(select count(*) from filtered),'page',page_number,'pageSize',30,
  'counts',(select jsonb_build_object('all',count(*),'complete',count(*) filter(where profile_complete),'incomplete',count(*) filter(where not profile_complete),'staff',count(*) filter(where role<>'client'),'suspended',count(*) filter(where banned_until>now())) from matches),
  'canManage',voxi_private.has_role(array['owner'])) into result;
 return result;
end $$;
revoke all on function voxi_private.admin_directory(text,integer,text) from public,anon;
grant execute on function voxi_private.admin_directory(text,integer,text) to authenticated;
create or replace function public.voxi_admin_directory(p_search text default '',p_page integer default 1,p_filter text default 'all')
returns jsonb language sql stable security invoker set search_path='' as $$ select voxi_private.admin_directory(p_search,p_page,p_filter); $$;
revoke all on function public.voxi_admin_directory(text,integer,text) from public,anon;
grant execute on function public.voxi_admin_directory(text,integer,text) to authenticated;
