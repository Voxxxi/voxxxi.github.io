-- Income records are private bookkeeping marks, never payment transactions.
create table voxi_private.payments (
 id uuid primary key default gen_random_uuid(),booking_id bigint not null,client_name text not null,
 booking_date date not null,booking_time time not null,song_titles text,song_count integer not null,
 quoted_amount integer not null,amount integer not null check(amount between 0 and 100000000),paid_on date not null,
 created_by uuid not null,created_at timestamptz not null default now(),voided_at timestamptz,voided_by uuid,
 check((voided_at is null)=(voided_by is null))
);
create unique index voxi_payment_one_active_booking on voxi_private.payments(booking_id) where voided_at is null;
create index voxi_payment_month on voxi_private.payments(paid_on,id) where voided_at is null;
alter table voxi_private.payments enable row level security;
revoke all on table voxi_private.payments from public,anon,authenticated;

create function voxi_private.record_payment(booking bigint,received integer,received_on date) returns uuid
language plpgsql security definer set search_path='' as $$
declare b public.voxi_bookings; payment_id uuid;
begin
 if not voxi_private.has_role(array['owner']) then raise exception 'Only the owner may record income' using errcode='42501';end if;
 if received is null or received<0 or received>100000000 then raise exception 'Укажите корректную сумму.';end if;
 if received_on is null or received_on>(now() at time zone 'Asia/Oral')::date or received_on<date '2020-01-01' then raise exception 'Укажите дату уже полученной оплаты.';end if;
 select * into b from public.voxi_bookings where id=booking for update;
 if not found then raise exception 'Запись не найдена. Обновите список.';end if;
 if b.status='Отменено' then raise exception 'Для отменённой записи нельзя отмечать новую оплату.';end if;
 if exists(select 1 from voxi_private.payments where booking_id=booking and voided_at is null) then raise exception 'Оплата этой записи уже отмечена.';end if;
 insert into voxi_private.payments(booking_id,client_name,booking_date,booking_time,song_titles,song_count,quoted_amount,amount,paid_on,created_by)
 values(b.id,b.client_name,b.booking_date,b.booking_time,b.song_titles,b.song_count,b.price,received,received_on,auth.uid()) returning id into payment_id;
 return payment_id;
end $$;
create function voxi_private.void_payment(payment uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not voxi_private.has_role(array['owner']) then raise exception 'Only the owner may correct income' using errcode='42501';end if;
 update voxi_private.payments set voided_at=now(),voided_by=auth.uid() where id=payment and voided_at is null;
 if not found then raise exception 'Отметка уже отменена. Обновите список.';end if;
end $$;
create function voxi_private.income_month(selected_month date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare start_day date; end_day date; result jsonb;
begin
 if not voxi_private.has_role(array['owner']) then raise exception 'Only the owner may view income' using errcode='42501';end if;
 if selected_month is null or selected_month<date '2020-01-01' or selected_month>date '2100-01-01' then raise exception 'Выберите месяц.';end if;
 start_day:=date_trunc('month',selected_month)::date;end_day:=(start_day+interval '1 month')::date;
 with paid as (select * from voxi_private.payments where voided_at is null and paid_on>=start_day and paid_on<end_day),
 unpaid as (select b.id,b.client_name,b.booking_date,b.booking_time,b.song_titles,b.song_count,b.price,b.status from public.voxi_bookings b
  where b.booking_date>=start_day and b.booking_date<end_day and b.status<>'Отменено'
  and not exists(select 1 from voxi_private.payments p where p.booking_id=b.id and p.voided_at is null)),
 rows as (select id,booking_id,client_name,booking_date,booking_time,song_titles,song_count,quoted_amount,amount,paid_on from paid order by paid_on desc,created_at desc limit 200),
 pending_rows as (select * from unpaid order by booking_date,booking_time,id limit 200)
 select jsonb_build_object('amount',coalesce((select sum(amount) from paid),0),'paidCount',(select count(*) from paid),'songCount',coalesce((select sum(song_count) from paid),0),
 'payments',coalesce((select jsonb_agg(to_jsonb(r)) from rows r),'[]'::jsonb),'pending',coalesce((select jsonb_agg(to_jsonb(r)) from pending_rows r),'[]'::jsonb),'pendingCount',(select count(*) from unpaid),
 'pendingAmount',coalesce((select sum(price) from unpaid),0)) into result;
 return result;
end $$;
revoke all on function voxi_private.record_payment(bigint,integer,date),voxi_private.void_payment(uuid),voxi_private.income_month(date) from public,anon;
grant execute on function voxi_private.record_payment(bigint,integer,date),voxi_private.void_payment(uuid),voxi_private.income_month(date) to authenticated;
create function public.voxi_record_payment(p_booking bigint,p_amount integer,p_paid_on date) returns uuid language sql security invoker set search_path='' as $$ select voxi_private.record_payment(p_booking,p_amount,p_paid_on); $$;
create function public.voxi_void_payment(p_payment uuid) returns void language sql security invoker set search_path='' as $$ select voxi_private.void_payment(p_payment); $$;
create function public.voxi_income_month(p_month date) returns jsonb language sql stable security invoker set search_path='' as $$ select voxi_private.income_month(p_month); $$;
revoke all on function public.voxi_record_payment(bigint,integer,date),public.voxi_void_payment(uuid),public.voxi_income_month(date) from public,anon;
grant execute on function public.voxi_record_payment(bigint,integer,date),public.voxi_void_payment(uuid),public.voxi_income_month(date) to authenticated;
