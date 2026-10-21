create table public.voxi_ai_knowledge (
 id uuid primary key default gen_random_uuid(),
 question text not null check(char_length(btrim(question)) between 2 and 250),
 answer text not null check(char_length(btrim(answer)) between 1 and 1000),
 language text not null default 'ru' check(language in ('ru','kk')),
 active boolean not null default true,
 created_at timestamptz not null default now()
);
alter table public.voxi_ai_knowledge enable row level security;
revoke all on public.voxi_ai_knowledge from anon, authenticated;
grant select,insert,update on public.voxi_ai_knowledge to authenticated;
grant all on public.voxi_ai_knowledge to service_role;
create policy owner_knowledge_read on public.voxi_ai_knowledge for select to authenticated using ((select voxi_private.has_role(array['owner'])));
create policy owner_knowledge_insert on public.voxi_ai_knowledge for insert to authenticated with check ((select voxi_private.has_role(array['owner'])));
create policy owner_knowledge_update on public.voxi_ai_knowledge for update to authenticated using ((select voxi_private.has_role(array['owner']))) with check ((select voxi_private.has_role(array['owner'])));
