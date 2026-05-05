-- 汎用 items テーブル + RLS
-- 適用方法: Supabase Dashboard → SQL Editor で実行、もしくは `supabase db push`

create table if not exists public.items (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  content     text,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists items_user_id_idx on public.items(user_id);
create index if not exists items_created_at_idx on public.items(created_at desc);

alter table public.items enable row level security;

-- 自分のレコードのみ操作可
drop policy if exists "items_select_own" on public.items;
create policy "items_select_own" on public.items
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "items_insert_own" on public.items;
create policy "items_insert_own" on public.items
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "items_update_own" on public.items;
create policy "items_update_own" on public.items
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "items_delete_own" on public.items;
create policy "items_delete_own" on public.items
  for delete to authenticated using (auth.uid() = user_id);

-- updated_at 自動更新トリガ
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists items_set_updated_at on public.items;
create trigger items_set_updated_at
  before update on public.items
  for each row execute function public.set_updated_at();
