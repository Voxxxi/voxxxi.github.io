create table voxi_private.chat_limits (
 user_id uuid primary key references auth.users(id) on delete cascade,
 next_message_at timestamptz not null,
 window_start timestamptz not null,
 message_count integer not null
);
alter table voxi_private.chat_limits enable row level security;
revoke all on voxi_private.chat_limits from public,anon,authenticated;
grant all on voxi_private.chat_limits to service_role;
create policy chat_limits_service on voxi_private.chat_limits for all to service_role using(true) with check(true);

create table public.voxi_chat_messages (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 author_name text not null default '' check(char_length(author_name) between 1 and 80),
 body text not null check(char_length(btrim(body)) between 1 and 1000),
 created_at timestamptz not null default now()
);
create index voxi_chat_recent on public.voxi_chat_messages(created_at desc,id desc);
create index voxi_chat_user on public.voxi_chat_messages(user_id);
alter table public.voxi_chat_messages enable row level security;
revoke all on public.voxi_chat_messages from anon,authenticated;
grant select,insert,delete on public.voxi_chat_messages to authenticated;
grant all on public.voxi_chat_messages to service_role;
create policy "chat_signed_in_read" on public.voxi_chat_messages for select to authenticated using ((select voxi_private.session_active()));
create policy "chat_send_as_self" on public.voxi_chat_messages for insert to authenticated with check (user_id=(select auth.uid()) and (select voxi_private.session_active()));
create policy "chat_delete_self_or_moderator" on public.voxi_chat_messages for delete to authenticated using (
 ((select voxi_private.session_active()) and user_id=(select auth.uid())) or (select voxi_private.has_role(array['owner','admin','helper']))
);
create function voxi_private.prepare_chat_message() returns trigger
language plpgsql security definer set search_path='' as $$
declare person public.voxi_profiles; gate voxi_private.chat_limits; moment timestamptz:=clock_timestamp();
begin
 if auth.uid() is null or not voxi_private.session_active() or new.user_id<>auth.uid() then raise exception 'Войдите в аккаунт заново' using errcode='42501'; end if;
 select * into person from public.voxi_profiles where user_id=auth.uid();
 if not voxi_private.has_role(array['owner','admin','helper']) and (
  person.user_id is null or btrim(person.full_name)!~'[^[:space:]]+[[:space:]]+[^[:space:]]+'
  or person.phone!~'^\+[1-9][0-9]{9,14}$'
 ) then raise exception 'Сначала заполните имя, фамилию и телефон в профиле'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,1));
 select * into gate from voxi_private.chat_limits where user_id=auth.uid() for update;
 if found and gate.next_message_at>moment then raise exception 'Подождите 3 секунды перед следующим сообщением'; end if;
 if gate.window_start is null or gate.window_start<moment-interval '10 minutes' then gate.window_start:=moment;gate.message_count:=0; end if;
 if gate.message_count>=30 then raise exception 'Слишком много сообщений. Подождите несколько минут'; end if;
 insert into voxi_private.chat_limits(user_id,next_message_at,window_start,message_count)
 values(auth.uid(),moment+interval '3 seconds',gate.window_start,gate.message_count+1)
 on conflict(user_id) do update set next_message_at=excluded.next_message_at,window_start=excluded.window_start,message_count=excluded.message_count;
 new.id:=gen_random_uuid();new.created_at:=moment;new.body:=btrim(new.body);
 new.author_name:=left(coalesce(nullif(split_part(btrim(person.full_name),' ',1),''),'Команда VOXi'),80);
 return new;
end $$;
revoke all on function voxi_private.prepare_chat_message() from public,anon,authenticated;
create trigger voxi_chat_prepare before insert on public.voxi_chat_messages for each row execute function voxi_private.prepare_chat_message();

create table public.voxi_chat_reports (
 id uuid primary key default gen_random_uuid(),
 message_id uuid not null references public.voxi_chat_messages(id) on delete cascade,
 reporter_id uuid not null references auth.users(id) on delete cascade,
 reason text not null check(char_length(btrim(reason)) between 1 and 300),
 created_at timestamptz not null default now(),
 unique(message_id,reporter_id)
);
create index voxi_chat_reports_reporter on public.voxi_chat_reports(reporter_id);
alter table public.voxi_chat_reports enable row level security;
revoke all on public.voxi_chat_reports from anon,authenticated;
grant select,insert,delete on public.voxi_chat_reports to authenticated;
grant all on public.voxi_chat_reports to service_role;
create policy "chat_reports_add_self" on public.voxi_chat_reports for insert to authenticated with check (reporter_id=(select auth.uid()) and (select voxi_private.session_active()));
create policy "chat_reports_read_self_or_staff" on public.voxi_chat_reports for select to authenticated using (
 (reporter_id=(select auth.uid()) and (select voxi_private.session_active())) or (select voxi_private.has_role(array['owner','admin','helper']))
);
create policy "chat_reports_resolve_staff" on public.voxi_chat_reports for delete to authenticated using ((select voxi_private.has_role(array['owner','admin','helper'])));
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime' and not puballtables)
 and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='voxi_chat_messages') then
  execute 'alter publication supabase_realtime add table public.voxi_chat_messages';
 end if;
end $$;