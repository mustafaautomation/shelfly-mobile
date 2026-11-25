-- Shelfly mobile: one Expo push token per person and platform.
-- A person can read and write only their own rows. Sending pushes is a server job
-- (service role), so no other role can list tokens.

create table public.push_tokens (
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null,
  token text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, platform)
);

alter table public.push_tokens enable row level security;
alter table public.push_tokens force row level security;

grant select, insert, update, delete on public.push_tokens to authenticated;
grant all on public.push_tokens to service_role;

create policy push_tokens_select on public.push_tokens
for select to authenticated
using (user_id = (select auth.uid()));

create policy push_tokens_insert on public.push_tokens
for insert to authenticated
with check (user_id = (select auth.uid()));

create policy push_tokens_update on public.push_tokens
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy push_tokens_delete on public.push_tokens
for delete to authenticated
using (user_id = (select auth.uid()));
