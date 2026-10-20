-- A booking earns its quoted total once all its linked songs are delivered.
create index if not exists voxi_tracks_delivery_booking on public.voxi_tracks(booking_id) where deleted_at is null;

create function voxi_private.delivered_track_count(booking bigint) returns integer
language sql stable security invoker set search_path='' as $$
 select count(*)::integer from public.voxi_tracks t join public.voxi_bookings b on b.id=t.booking_id and b.user_id=t.user_id
 join storage.objects o on o.bucket_id='voxi-tracks' and o.name=t.storage_path and o.metadata->>'size'=t.file_size::text
 where t.booking_id=booking and t.deleted_at is null and (t.expires_at is null or t.expires_at>now());
$$;
revoke all on function voxi_private.delivered_track_count(bigint) from public,anon,authenticated;

create function voxi_private.account_track_delivery() returns trigger
language plpgsql security definer set search_path='' as $$
declare b public.voxi_bookings;
begin
 if tg_op='UPDATE' and old.booking_id is not null and new.booking_id is distinct from old.booking_id then raise exception 'Песню нельзя перенести в другую заявку. Загрузите отдельный файл для нужной заявки.';end if;
 if new.booking_id is null then return new;end if;
 if not voxi_private.has_role(array['owner','admin']) then raise exception 'Only studio administrators may deliver tracks' using errcode='42501';end if;
 select * into b from public.voxi_bookings where id=new.booking_id for update;
 if not found or b.user_id is distinct from new.user_id then raise exception 'Заявка принадлежит другому клиенту. Выберите правильную заявку.';end if;
 if b.status='Отменено' then raise exception 'Заявка отменена. Выберите другую заявку.';end if;
 if not exists(select 1 from storage.objects o where o.bucket_id='voxi-tracks' and o.name=new.storage_path and o.metadata->>'size'=new.file_size::text) then raise exception 'Файл ещё не загружен полностью. Обновите список перед повтором.';end if;
 if exists(select 1 from voxi_private.payments where booking_id=b.id) then return new;end if;
 if b.song_count is null or b.song_count<1 or b.song_count>100 or b.price is null or b.price<0 or b.price>100000000 then raise exception 'Проверьте количество песен и сумму заявки.';end if;
 if voxi_private.delivered_track_count(b.id)>=b.song_count then
  insert into voxi_private.payments(booking_id,client_name,booking_date,booking_time,song_titles,song_count,quoted_amount,amount,paid_on,created_by)
  values(b.id,b.client_name,b.booking_date,b.booking_time,b.song_titles,b.song_count,b.price,b.price,(now() at time zone 'Asia/Oral')::date,auth.uid());
  update public.voxi_bookings set status='Готово' where id=b.id;
 end if;
 return new;
end $$;
revoke all on function voxi_private.account_track_delivery() from public,anon,authenticated;
create trigger voxi_account_track_delivery after insert or update of booking_id,user_id,storage_path,file_size on public.voxi_tracks for each row execute function voxi_private.account_track_delivery();

-- Disable the superseded manual-payment API, including old cached pages.
revoke all on function public.voxi_record_payment(bigint,integer,date),public.voxi_void_payment(uuid),voxi_private.record_payment(bigint,integer,date),voxi_private.void_payment(uuid) from authenticated;

create function voxi_private.client_delivery_orders(client uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not voxi_private.has_role(array['owner','admin']) then raise exception 'Only studio administrators may view delivery orders' using errcode='42501';end if;
 select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) into result from (
  select b.id,b.booking_date,b.booking_time,b.song_count,b.song_titles,b.price,b.status,
   voxi_private.delivered_track_count(b.id) as uploaded_count,exists(select 1 from voxi_private.payments p where p.booking_id=b.id) as accounted
  from public.voxi_bookings b where b.user_id=client and b.status<>'Отменено'
  order by exists(select 1 from voxi_private.payments p where p.booking_id=b.id),b.booking_date desc,b.id desc limit 100
 ) r;
 return result;
end $$;
revoke all on function voxi_private.client_delivery_orders(uuid) from public,anon;
grant execute on function voxi_private.client_delivery_orders(uuid) to authenticated;
create function public.voxi_client_delivery_orders(p_user uuid) returns jsonb language sql stable security invoker set search_path='' as $$ select voxi_private.client_delivery_orders(p_user); $$;
revoke all on function public.voxi_client_delivery_orders(uuid) from public,anon;
grant execute on function public.voxi_client_delivery_orders(uuid) to authenticated;

create or replace function voxi_private.income_month(selected_month date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare start_day date; end_day date; result jsonb;
begin
 if not voxi_private.has_role(array['owner']) then raise exception 'Only the owner may view income' using errcode='42501';end if;
 if selected_month is null or selected_month<date '2020-01-01' or selected_month>date '2100-01-01' then raise exception 'Выберите месяц.';end if;
 start_day:=date_trunc('month',selected_month)::date;end_day:=(start_day+interval '1 month')::date;
 with paid as (select * from voxi_private.payments where voided_at is null and paid_on>=start_day and paid_on<end_day),
 unfinished as (select b.id,b.client_name,b.booking_date,b.booking_time,b.song_titles,b.song_count,b.price,b.status,voxi_private.delivered_track_count(b.id) as uploaded_count from public.voxi_bookings b
  where b.booking_date>=start_day and b.booking_date<end_day and b.status<>'Отменено' and not exists(select 1 from voxi_private.payments p where p.booking_id=b.id)),
 rows as (select id,booking_id,client_name,booking_date,booking_time,song_titles,song_count,quoted_amount,amount,paid_on from paid order by paid_on desc,created_at desc limit 200),
 pending_rows as (select * from unfinished order by booking_date,booking_time,id limit 200)
 select jsonb_build_object('amount',coalesce((select sum(amount) from paid),0),'paidCount',(select count(*) from paid),'songCount',coalesce((select sum(song_count) from paid),0),
 'payments',coalesce((select jsonb_agg(to_jsonb(r)) from rows r),'[]'::jsonb),'pending',coalesce((select jsonb_agg(to_jsonb(r)) from pending_rows r),'[]'::jsonb),'pendingCount',(select count(*) from unfinished),
 'pendingAmount',coalesce((select sum(price) from unfinished),0)) into result;
 return result;
end $$;
