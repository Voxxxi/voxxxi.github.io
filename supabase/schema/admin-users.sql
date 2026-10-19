-- Reviewed against the live VOXi schema. Apply through Supabase migrations.
create schema if not exists voxi_private;
revoke all on schema voxi_private from public, anon;
grant usage on schema voxi_private to authenticated, service_role;

create table public.voxi_staff (
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null check (role in ('owner','admin','helper')),
 updated_at timestamptz not null default now()
);
create unique index voxi_single_owner on public.voxi_staff(role) where role='owner';
alter table public.voxi_staff enable row level security;
revoke all on public.voxi_staff from anon, authenticated;
grant select on public.voxi_staff to authenticated;
grant all on public.voxi_staff to service_role;
create policy "staff_read_self" on public.voxi_staff for select to authenticated
 using (user_id=(select auth.uid()));
insert into public.voxi_staff(user_id,role)
 select id,'owner' from auth.users where lower(email)='mops850@gmail.com';
do $$ begin
 if (select count(*) from public.voxi_staff where role='owner')<>1 then
  raise exception 'Expected exactly one existing VOXi owner';
 end if;
end $$;

create function voxi_private.has_role(wanted text[])
returns boolean language sql stable security definer set search_path=''
as $$ select auth.uid() is not null and exists (
 select 1 from public.voxi_staff s join auth.users u on u.id=s.user_id
 where s.user_id=auth.uid() and s.role=any(wanted)
); $$;
revoke all on function voxi_private.has_role(text[]) from public, anon;
grant execute on function voxi_private.has_role(text[]) to authenticated, service_role;

create function voxi_private.protect_owner() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if old.role='owner' then raise exception 'VOXi owner is protected'; end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
revoke all on function voxi_private.protect_owner() from public, anon, authenticated;
create trigger protect_voxi_owner before update or delete on public.voxi_staff
 for each row execute function voxi_private.protect_owner();

create table public.voxi_admin_audit (
 id uuid primary key default gen_random_uuid(),
 actor_id uuid not null, target_id uuid not null,
 action text not null check (action in ('delete_user','set_role')),
 details jsonb not null default '{}',
 status text not null default 'attempt' check(status in ('attempt','success','failed')),
 created_at timestamptz not null default now()
);
alter table public.voxi_admin_audit enable row level security;
revoke all on public.voxi_admin_audit from anon, authenticated;
grant all on public.voxi_admin_audit to service_role;

create function voxi_private.admin_users(search_text text, page_number integer)
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
  where q='' or strpos(lower(coalesce(p.full_name,'')),lower(q))>0
   or strpos(lower(coalesce(u.email,'')),lower(q))>0
   or strpos(u.id::text,lower(q))>0
   or (digits<>'' and regexp_replace(q,'[^[:alpha:]]','','g')='' and
       strpos(regexp_replace(coalesce(p.phone,''),'[^0-9]','','g'),digits)>0)
 ), page_rows as (
  select * from matches order by created_at desc,user_id limit 30 offset (page_number-1)*30
 ) select jsonb_build_object('users',coalesce((select jsonb_agg(to_jsonb(r)) from page_rows r),'[]'::jsonb),
 'total',(select count(*) from matches),'page',page_number,'pageSize',30,
 'canManage',voxi_private.has_role(array['owner'])) into result;
 return result;
end $$;
revoke all on function voxi_private.admin_users(text,integer) from public, anon;
grant execute on function voxi_private.admin_users(text,integer) to authenticated;
create function public.voxi_admin_users(p_search text default '',p_page integer default 1)
returns jsonb language sql stable security invoker set search_path=''
as $$ select voxi_private.admin_users(p_search,p_page); $$;
revoke all on function public.voxi_admin_users(text,integer) from public,anon;
grant execute on function public.voxi_admin_users(text,integer) to authenticated;

-- Replace the old email checks with fresh server-side staff roles.
alter policy voxi_admin_delete_all on public.voxi_bookings using ((select voxi_private.has_role(array['owner','admin','helper'])));
alter policy voxi_admin_select_all on public.voxi_bookings using ((select voxi_private.has_role(array['owner','admin','helper'])));
alter policy voxi_admin_update_all on public.voxi_bookings using ((select voxi_private.has_role(array['owner','admin','helper']))) with check ((select voxi_private.has_role(array['owner','admin','helper'])));
alter policy voxi_insert_own_or_admin on public.voxi_bookings with check (
 (user_id=(select auth.uid()) or (select voxi_private.has_role(array['owner','admin','helper'])))
 and exists(select 1 from public.voxi_schedule_slots s where s.booking_date=voxi_bookings.booking_date and s.booking_time=voxi_bookings.booking_time and s.is_open=true));
alter policy voxi_schedule_admin_delete on public.voxi_schedule_slots using ((select voxi_private.has_role(array['owner','admin','helper'])));
alter policy voxi_schedule_admin_select on public.voxi_schedule_slots using ((select voxi_private.has_role(array['owner','admin','helper'])));
alter policy voxi_schedule_admin_insert on public.voxi_schedule_slots with check ((select voxi_private.has_role(array['owner','admin','helper'])));
alter policy voxi_schedule_admin_update on public.voxi_schedule_slots using ((select voxi_private.has_role(array['owner','admin','helper']))) with check ((select voxi_private.has_role(array['owner','admin','helper'])));
alter policy "VOXi profiles read" on public.voxi_profiles using (user_id=(select auth.uid()) or (select voxi_private.has_role(array['owner','admin'])));
alter policy "VOXi admin manages tracks" on public.voxi_tracks using ((select voxi_private.has_role(array['owner','admin']))) with check ((select voxi_private.has_role(array['owner','admin'])));
alter policy "VOXi admin manage tracks" on storage.objects using (bucket_id='voxi-tracks' and (select voxi_private.has_role(array['owner','admin']))) with check (bucket_id='voxi-tracks' and (select voxi_private.has_role(array['owner','admin'])));

create or replace function voxi_private.has_role(wanted text[])
returns boolean language sql stable security definer set search_path=''
as $$ select auth.uid() is not null and exists (
 select 1 from public.voxi_staff s join auth.users u on u.id=s.user_id
 join auth.sessions se on se.user_id=u.id
 where s.user_id=auth.uid() and s.role=any(wanted)
 and se.id=nullif(auth.jwt()->>'session_id','')::uuid
); $$;
create function public.voxi_staff_session() returns text
language sql stable security invoker set search_path=''
as $$ select case
 when voxi_private.has_role(array['owner']) then 'owner'
 when voxi_private.has_role(array['admin']) then 'admin'
 when voxi_private.has_role(array['helper']) then 'helper'
 else null end; $$;
revoke all on function public.voxi_staff_session() from public,anon;
grant execute on function public.voxi_staff_session() to authenticated;

revoke execute on function public.rls_auto_enable() from public,anon,authenticated;
revoke execute on function public.voxi_queue_new_booking() from public,anon,authenticated;
revoke execute on function public.voxi_send_telegram_notification() from public,anon,authenticated;
revoke execute on function public.voxi_sync_schedule_slot() from public,anon,authenticated;
create policy audit_service_only on public.voxi_admin_audit for all to service_role using (true) with check (true);
