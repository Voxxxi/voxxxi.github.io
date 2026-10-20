-- Quotes from the client must match the published per-song tariff.
-- Staff retain the ability to import historical records and agree custom prices.
create or replace function voxi_private.validate_client_booking()
returns trigger language plpgsql security definer set search_path='' as $$
declare songs jsonb;song jsonb;performers integer;total_people integer:=0;total_price integer:=0;cost integer;
begin
 if auth.uid() is null or voxi_private.has_role(array['owner','admin','helper']) then return new;end if;
 if not voxi_private.session_active() or new.user_id is distinct from auth.uid() then raise insufficient_privilege;end if;
 if not exists(select 1 from public.voxi_profiles where user_id=auth.uid() and length(trim(full_name))>2 and length(regexp_replace(phone,'[^0-9]','','g')) between 10 and 15) then raise exception 'Complete your profile first';end if;
 if new.status is distinct from 'Запланировано' or new.booking_date is null or new.booking_time is null or (new.booking_date+new.booking_time)<=(now() at time zone 'Asia/Oral') then raise exception 'Choose a future appointment';end if;
 if nullif(trim(new.client_name),'') is null or length(new.client_name)>150 or length(regexp_replace(coalesce(new.phone,''),'[^0-9]','','g')) not between 10 and 15 then raise exception 'Check name and phone';end if;
 if new.song_count is null or new.song_count not between 1 and 100 or length(coalesce(new.song_titles,''))>100000 then raise exception 'Check song list';end if;
 begin songs:=new.song_titles::jsonb;exception when others then raise exception 'Check song list';end;
 if jsonb_typeof(songs) is distinct from 'array' or jsonb_array_length(songs)<>new.song_count then raise exception 'Check song list';end if;
 for song in select value from jsonb_array_elements(songs) loop
  if jsonb_typeof(song) is distinct from 'object' or jsonb_typeof(song->'title') is distinct from 'string' or length(trim(song->>'title')) not between 1 and 300 or coalesce(song->>'people','')!~'^[0-9]{1,3}$' then raise exception 'Check song details';end if;
  performers:=(song->>'people')::integer;
  if performers not between 1 and 100 then raise exception 'Check performer count';end if;
  cost:=case performers when 1 then 5000 when 2 then 6000 when 3 then 7000 else performers*2000 end;
  if coalesce(song->>'price','')<>cost::text then raise exception 'Price does not match the studio tariff';end if;
  total_people:=total_people+performers;total_price:=total_price+cost;
 end loop;
 if new.people_count is distinct from total_people or new.price is distinct from total_price then raise exception 'Price does not match the studio tariff';end if;
 return new;
end $$;
revoke all on function voxi_private.validate_client_booking() from public,anon,authenticated;
create trigger voxi_validate_client_booking before insert on public.voxi_bookings for each row execute function voxi_private.validate_client_booking();
