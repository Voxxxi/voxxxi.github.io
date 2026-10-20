create table public.voxi_announcements(
 id uuid primary key default gen_random_uuid(),title_ru text not null check(length(trim(title_ru)) between 1 and 120),
 body_ru text not null check(length(trim(body_ru)) between 1 and 1500),title_kk text not null default '' check(length(title_kk)<=120),body_kk text not null default '' check(length(body_kk)<=1500),
 action text not null default 'booking' check(action in ('booking','contact','none')),
 starts_at timestamptz not null default now(),ends_at timestamptz not null,
 published boolean not null default false,created_at timestamptz not null default now(),
 check(ends_at>starts_at and isfinite(starts_at) and isfinite(ends_at))
);
create table public.voxi_slot_offers(
 id uuid primary key default gen_random_uuid(),booking_date date not null,booking_time time not null,
 percent smallint not null check(percent between 1 and 90),
 starts_at timestamptz not null default now(),ends_at timestamptz not null,
 active boolean not null default false,created_at timestamptz not null default now(),
 unique(booking_date,booking_time),check(ends_at>starts_at and isfinite(starts_at) and isfinite(ends_at))
);
alter table public.voxi_announcements enable row level security;
alter table public.voxi_slot_offers enable row level security;
revoke all on public.voxi_announcements,public.voxi_slot_offers from anon,authenticated;
grant select,insert,update on public.voxi_announcements,public.voxi_slot_offers to authenticated;
create policy owner_updates on public.voxi_announcements for all to authenticated using((select voxi_private.has_role(array['owner']))) with check((select voxi_private.has_role(array['owner'])));
create policy owner_offers on public.voxi_slot_offers for all to authenticated using((select voxi_private.has_role(array['owner']))) with check((select voxi_private.has_role(array['owner'])));
alter table public.voxi_bookings add column base_price integer,add column discount_percent smallint not null default 0 check(discount_percent between 0 and 90),add column discount_offer_id uuid;

create function voxi_private.slot_offer(day date,hour time) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce((select jsonb_build_object('id',o.id,'percent',o.percent) from public.voxi_slot_offers o
 where o.booking_date=day and o.booking_time=hour and o.active and o.starts_at<=now() and o.ends_at>now()
 and (day+hour)>(now() at time zone 'Asia/Oral')),'{"id":null,"percent":0}'::jsonb);
$$;
revoke all on function voxi_private.slot_offer(date,time) from public;
grant execute on function voxi_private.slot_offer(date,time) to anon,authenticated;
create function public.voxi_slot_offer(p_date date,p_time time) returns jsonb
language sql stable security invoker set search_path='' as $$select voxi_private.slot_offer(p_date,p_time);$$;
revoke all on function public.voxi_slot_offer(date,time) from public;
grant execute on function public.voxi_slot_offer(date,time) to anon,authenticated;

create function voxi_private.studio_updates() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('announcements',coalesce((select jsonb_agg(to_jsonb(n)) from(
 select id,title_ru,body_ru,title_kk,body_kk,action,ends_at from public.voxi_announcements
 where published and starts_at<=now() and ends_at>now() order by created_at desc,id limit 5)n),'[]'::jsonb),
 'slots',coalesce((select jsonb_agg(to_jsonb(s)) from(
 select s.booking_date,s.booking_time,coalesce((voxi_private.slot_offer(s.booking_date,s.booking_time)->>'percent')::int,0) discount_percent
 from public.voxi_schedule_slots s where s.is_open and (s.booking_date+s.booking_time)>(now() at time zone 'Asia/Oral')
 and s.booking_date<=(now() at time zone 'Asia/Oral')::date+60
 and not exists(select 1 from public.voxi_bookings b where b.booking_date=s.booking_date and b.booking_time=s.booking_time and b.status is distinct from 'Отменено')
 order by s.booking_date,s.booking_time limit 12)s),'[]'::jsonb));
$$;
revoke all on function voxi_private.studio_updates() from public;
grant execute on function voxi_private.studio_updates() to anon,authenticated;
create function public.voxi_studio_updates() returns jsonb language sql stable security invoker set search_path='' as $$select voxi_private.studio_updates();$$;
revoke all on function public.voxi_studio_updates() from public;
grant execute on function public.voxi_studio_updates() to anon,authenticated;

-- Quotes from the client must match the published per-song tariff.
-- Staff retain the ability to import historical records and agree custom prices.
create or replace function voxi_private.validate_client_booking()
returns trigger language plpgsql security definer set search_path='' as $$
declare songs jsonb;song jsonb;performers integer;total_people integer:=0;total_price integer:=0;cost integer;base_total integer:=0;offer jsonb;discount integer:=0;
begin
 if auth.uid() is null or voxi_private.has_role(array['owner','admin','helper']) then return new;end if;
 if not voxi_private.session_active() or new.user_id is distinct from auth.uid() then raise insufficient_privilege;end if;
 if not exists(select 1 from public.voxi_profiles where user_id=auth.uid() and length(trim(full_name))>2 and length(regexp_replace(phone,'[^0-9]','','g')) between 10 and 15) then raise exception 'Complete your profile first';end if;
 if new.status is distinct from 'Запланировано' or new.booking_date is null or new.booking_time is null or (new.booking_date+new.booking_time)<=(now() at time zone 'Asia/Oral') then raise exception 'Choose a future appointment';end if;
 if nullif(trim(new.client_name),'') is null or length(new.client_name)>150 or length(regexp_replace(coalesce(new.phone,''),'[^0-9]','','g')) not between 10 and 15 then raise exception 'Check name and phone';end if;
 if new.song_count is null or new.song_count not between 1 and 100 or length(coalesce(new.song_titles,''))>100000 then raise exception 'Check song list';end if;
 begin songs:=new.song_titles::jsonb;exception when others then raise exception 'Check song list';end;
 if jsonb_typeof(songs) is distinct from 'array' or jsonb_array_length(songs)<>new.song_count then raise exception 'Check song list';end if;
 select voxi_private.slot_offer(new.booking_date,new.booking_time) into offer;discount:=(offer->>'percent')::integer;
 for song in select value from jsonb_array_elements(songs) loop
  if jsonb_typeof(song) is distinct from 'object' or jsonb_typeof(song->'title') is distinct from 'string' or length(trim(song->>'title')) not between 1 and 300 or coalesce(song->>'people','')!~'^[0-9]{1,3}$' then raise exception 'Check song details';end if;
  performers:=(song->>'people')::integer;
  if performers not between 1 and 100 then raise exception 'Check performer count';end if;
  cost:=case performers when 1 then 5000 when 2 then 6000 when 3 then 7000 else performers*2000 end;
  base_total:=base_total+cost;cost:=floor(cost*(100-discount)/100.0)::integer;
  if coalesce(song->>'price','')<>cost::text then raise exception 'Price does not match the studio tariff';end if;
  total_people:=total_people+performers;total_price:=total_price+cost;
 end loop;
 if new.people_count is distinct from total_people or new.price is distinct from total_price then raise exception 'Price does not match the studio tariff';end if;
 new.base_price:=base_total;new.discount_percent:=discount;new.discount_offer_id:=(offer->>'id')::uuid;
 return new;
end $$;
revoke all on function voxi_private.validate_client_booking() from public,anon,authenticated;
