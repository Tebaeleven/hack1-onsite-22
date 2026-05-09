-- 法人プロフィール + 「私も乗ります」予約 (Phase 3)
-- 適用方法: `supabase db push`

create table if not exists public.organizations (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  name        text not null check (length(name) between 1 and 80),
  kind        text not null default 'business' check (kind in ('business', 'organizer', 'gov')),
  verified    boolean not null default false,
  created_at  timestamptz not null default now()
);

create unique index if not exists organizations_owner_id_unique on public.organizations(owner_id);
create index if not exists organizations_kind_idx on public.organizations(kind);

alter table public.organizations enable row level security;

drop policy if exists "organizations_read_all" on public.organizations;
create policy "organizations_read_all" on public.organizations
  for select to anon, authenticated using (true);

drop policy if exists "organizations_insert_own" on public.organizations;
create policy "organizations_insert_own" on public.organizations
  for insert to authenticated with check (auth.uid() = owner_id);

drop policy if exists "organizations_update_own" on public.organizations;
create policy "organizations_update_own" on public.organizations
  for update to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "organizations_delete_own" on public.organizations;
create policy "organizations_delete_own" on public.organizations
  for delete to authenticated using (auth.uid() = owner_id);


-- 「私も乗ります」予約: command_id は demo_states 内 MoveCommand.id
create table if not exists public.ride_intents (
  command_id    text not null,
  user_id       uuid not null references auth.users(id) on delete cascade,
  planned_time  timestamptz,
  created_at    timestamptz not null default now(),
  primary key (command_id, user_id)
);

create index if not exists ride_intents_command_id_idx on public.ride_intents(command_id);
create index if not exists ride_intents_user_id_idx on public.ride_intents(user_id);

alter table public.ride_intents enable row level security;

drop policy if exists "ride_intents_read_all" on public.ride_intents;
create policy "ride_intents_read_all" on public.ride_intents
  for select to anon, authenticated using (true);

drop policy if exists "ride_intents_insert_own" on public.ride_intents;
create policy "ride_intents_insert_own" on public.ride_intents
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "ride_intents_delete_own" on public.ride_intents;
create policy "ride_intents_delete_own" on public.ride_intents
  for delete to authenticated using (auth.uid() = user_id);

-- Realtime publication
do $$
begin
  alter publication supabase_realtime add table public.organizations;
exception when duplicate_object then null;
end$$;

do $$
begin
  alter publication supabase_realtime add table public.ride_intents;
exception when duplicate_object then null;
end$$;
