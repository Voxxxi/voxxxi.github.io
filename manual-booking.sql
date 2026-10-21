-- One transaction creates the slot and the external appointment; existing RLS stays in force.
create or replace function public.voxi_manual_booking(p_date date,p_time time,p_name text,p_phone text,p_title text default '',p_people integer default 1)
returns bigint language plpgsql security invoker set search_path='' as $$
declare result bigint; cost integer;
begin
 if auth.uid() is null or not voxi_private.session_active() or not voxi_private.has_role(array['owner','admin','helper']) then raise insufficient_privilege;end if;
 if p_date is null or p_time is null or p_date+p_time <= (now() at time zone 'Asia/Oral') or extract(minute from p_time)<>0 or extract(second from p_time)<>0 then raise exception 'Choose a future full hour';end if;
 if length(trim(coalesce(p_name,''))) not between 2 and 150 or length(regexp_replace(coalesce(p_phone,''),'[^0-9]','','g')) not between 10 and 15 or p_people is null or p_people not between 1 and 100 or length(coalesce(p_title,''))>300 then raise exception 'Check client details';end if;
 perform pg_advisory_xact_lock(73021,(p_date-date '2000-01-01')::integer);
 if exists(select 1 from public.voxi_schedule_days where booking_date=p_date and is_closed) then raise exception 'Studio is closed on this day';end if;
 if exists(select 1 from public.voxi_bookings where booking_date=p_date and status is distinct from 'Отменено' and abs(extract(epoch from booking_time-p_time))<3600) then raise exception 'This hour is already booked' using errcode='23505';end if;
 cost:=case p_people when 1 then 5000 when 2 then 6000 when 3 then 7000 else p_people*2000 end;
 insert into public.voxi_schedule_slots(booking_date,booking_time,is_open) values(p_date,p_time,true) on conflict(booking_date,booking_time) do update set is_open=true;
 insert into public.voxi_bookings(client_name,phone,booking_date,booking_time,people_count,song_count,song_titles,price,base_price,status,user_id)
 values(trim(p_name),trim(p_phone),p_date,p_time,p_people,1,jsonb_build_array(jsonb_build_object('title',coalesce(nullif(trim(p_title),''),'Запись через WhatsApp'),'people',p_people,'price',cost,'base_price',cost))::text,cost,cost,'Запланировано',null) returning id into result;
 return result;
end $$;
revoke all on function public.voxi_manual_booking(date,time,text,text,text,integer) from public,anon;
grant execute on function public.voxi_manual_booking(date,time,text,text,text,integer) to authenticated;
