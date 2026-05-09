-- DemoState 永続化 + Supabase Realtime publication 登録
-- 適用方法: `supabase db push`（リモート）/ `supabase db reset`（ローカル）

create table if not exists public.demo_states (
  id          text primary key,                -- 'singleton' 固定運用
  state       jsonb not null,
  updated_at  timestamptz not null default now()
);

alter table public.demo_states enable row level security;

-- 認証なし運用 (デモ): anon と authenticated に read 開放
-- 書き込みは Route Handler 経由で service_role を使うので INSERT/UPDATE/DELETE policy は付けない
drop policy if exists "demo_states_read_all" on public.demo_states;
create policy "demo_states_read_all" on public.demo_states
  for select to anon, authenticated using (true);

-- 既存 set_updated_at() (init.sql:39) を再利用
drop trigger if exists demo_states_set_updated_at on public.demo_states;
create trigger demo_states_set_updated_at
  before update on public.demo_states
  for each row execute function public.set_updated_at();

-- 初期行 (空 jsonb)。クライアント初回 publish で実データに置換される
insert into public.demo_states (id, state)
values ('singleton', '{}'::jsonb)
on conflict (id) do nothing;

-- Realtime publication 登録（忘れると postgres_changes が無音）
-- ALTER PUBLICATION の重複追加を冪等化
do $$
begin
  alter publication supabase_realtime add table public.demo_states;
exception when duplicate_object then null;
end$$;
