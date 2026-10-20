alter table public.voxi_tracks add column booking_song_number integer;
alter table public.voxi_tracks add constraint voxi_delivery_song_number check(booking_song_number is null or booking_song_number between 1 and 100);
create unique index voxi_delivery_one_active_song on public.voxi_tracks(booking_id,booking_song_number) where booking_id is not null and deleted_at is null;

create or replace function voxi_private.delivered_track_count(booking bigint) returns integer
language sql stable security invoker set search_path='' as $$
 select count(distinct t.booking_song_number)::integer from public.voxi_tracks t join public.voxi_bookings b on b.id=t.booking_id and b.user_id=t.user_id
 join storage.objects o on o.bucket_id='voxi-tracks' and o.name=t.storage_path and o.metadata->>'size'=t.file_size::text
 where t.booking_id=booking and t.booking_song_number between 1 and b.song_count and t.deleted_at is null and (t.expires_at is null or t.expires_at>now());
$$;
create or replace function voxi_private.account_track_delivery() returns trigger
language plpgsql security definer set search_path='' as $$
declare b public.voxi_bookings;
begin
 if tg_op='UPDATE' and old.booking_id is not null and (new.booking_id is distinct from old.booking_id or new.booking_song_number is distinct from old.booking_song_number) then raise exception 'Песню нельзя перенести в другую заявку или на другой номер. Загрузите отдельный файл.';end if;
 if new.booking_id is null then return new;end if;
 if not voxi_private.has_role(array['owner','admin']) then raise exception 'Only studio administrators may deliver tracks' using errcode='42501';end if;
 select * into b from public.voxi_bookings where id=new.booking_id for update;
 if not found or b.user_id is distinct from new.user_id then raise exception 'Заявка принадлежит другому клиенту. Выберите правильную заявку.';end if;
 if b.status='Отменено' then raise exception 'Заявка отменена. Выберите другую заявку.';end if;
 if b.song_count is null or b.song_count<1 or b.song_count>100 or b.price is null or b.price<0 or b.price>100000000 then raise exception 'Проверьте количество песен и сумму заявки.';end if;
 if new.booking_song_number is null or new.booking_song_number<1 or new.booking_song_number>b.song_count then raise exception 'Выберите номер песни из заявки.';end if;
 if not exists(select 1 from storage.objects o where o.bucket_id='voxi-tracks' and o.name=new.storage_path and o.metadata->>'size'=new.file_size::text) then raise exception 'Файл ещё не загружен полностью. Обновите список перед повтором.';end if;
 if exists(select 1 from voxi_private.payments where booking_id=b.id) then return new;end if;
 if voxi_private.delivered_track_count(b.id)>=b.song_count then
  insert into voxi_private.payments(booking_id,client_name,booking_date,booking_time,song_titles,song_count,quoted_amount,amount,paid_on,created_by)
  values(b.id,b.client_name,b.booking_date,b.booking_time,b.song_titles,b.song_count,b.price,b.price,(now() at time zone 'Asia/Oral')::date,auth.uid());
  update public.voxi_bookings set status='Готово' where id=b.id;
 end if;
 return new;
end $$;
drop trigger voxi_account_track_delivery on public.voxi_tracks;
create trigger voxi_account_track_delivery after insert or update of booking_id,booking_song_number,user_id,storage_path,file_size on public.voxi_tracks for each row execute function voxi_private.account_track_delivery();

create or replace function voxi_private.client_delivery_orders(client uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not voxi_private.has_role(array['owner','admin']) then raise exception 'Only studio administrators may view delivery orders' using errcode='42501';end if;
 select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) into result from (
  select b.id,b.booking_date,b.booking_time,b.song_count,b.song_titles,b.price,b.status,voxi_private.delivered_track_count(b.id) as uploaded_count,
   exists(select 1 from voxi_private.payments p where p.booking_id=b.id) as accounted,
   coalesce((select jsonb_agg(t.booking_song_number) from public.voxi_tracks t join storage.objects o on o.bucket_id='voxi-tracks' and o.name=t.storage_path and o.metadata->>'size'=t.file_size::text where t.booking_id=b.id and t.user_id=b.user_id and t.deleted_at is null and (t.expires_at is null or t.expires_at>now())),'[]'::jsonb) as delivered_song_numbers
  from public.voxi_bookings b where b.user_id=client and b.status<>'Отменено'
  order by exists(select 1 from voxi_private.payments p where p.booking_id=b.id),b.booking_date desc,b.id desc limit 100
 ) r;
 return result;
end $$;
