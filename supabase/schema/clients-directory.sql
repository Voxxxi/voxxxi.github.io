create function voxi_private.admin_clients(search_text text, page_number integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; q text:=left(trim(coalesce(search_text,'')),120);
 digits text:=regexp_replace(q,'[^0-9]','','g');
begin
 if not voxi_private.has_role(array['owner','admin']) then
  raise exception 'Only VOXi administrators may view users' using errcode='42501';
 end if;
 if page_number<1 or page_number>100000 then raise exception 'Invalid page'; end if;
 with matches as (
  select u.id as user_id,coalesce(p.full_name,'') as full_name,
   coalesce(p.phone,'') as phone,coalesce(u.email,'') as email,
   coalesce(s.role,'client') as role,u.created_at
  from auth.users u left join public.voxi_profiles p on p.user_id=u.id
  left join public.voxi_staff s on s.user_id=u.id
  where p.user_id is not null and trim(coalesce(p.phone,''))<>'' and trim(coalesce(p.full_name,'')) ~ '[[:space:]]' and (q='' or strpos(lower(coalesce(p.full_name,'')),lower(q))>0
   or strpos(lower(coalesce(u.email,'')),lower(q))>0
   or strpos(u.id::text,lower(q))>0
   or (digits<>'' and regexp_replace(q,'[^[:alpha:]]','','g')='' and
       strpos(regexp_replace(coalesce(p.phone,''),'[^0-9]','','g'),digits)>0))
 ), page_rows as (
  select * from matches order by created_at desc,user_id limit 30 offset (page_number-1)*30
 ) select jsonb_build_object('users',coalesce((select jsonb_agg(to_jsonb(r)) from page_rows r),'[]'::jsonb),
 'total',(select count(*) from matches),'page',page_number,'pageSize',30,
 'canManage',voxi_private.has_role(array['owner'])) into result;
 return result;
end $$;
revoke all on function voxi_private.admin_clients(text,integer) from public, anon;
grant execute on function voxi_private.admin_clients(text,integer) to authenticated;
create function public.voxi_admin_clients(p_search text default '',p_page integer default 1)
returns jsonb language sql stable security invoker set search_path=''
as $$ select voxi_private.admin_clients(p_search,p_page); $$;
revoke all on function public.voxi_admin_clients(text,integer) from public,anon;
grant execute on function public.voxi_admin_clients(text,integer) to authenticated;

