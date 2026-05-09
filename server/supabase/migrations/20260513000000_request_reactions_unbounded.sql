-- request_reactions を「ログ追記型」に変更
-- 1ユーザーが同じ申請を何度でも応援できるようにする (PK を id にして UNIQUE 制約撤廃)
-- デモ運用なので既存データは drop で破棄

drop table if exists public.request_reactions cascade;

create table public.request_reactions (
  id          uuid primary key default gen_random_uuid(),
  request_id  text not null,
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('wantToGo', 'helpful', 'cheer')),
  created_at  timestamptz not null default now()
);

create index request_reactions_request_id_idx on public.request_reactions(request_id);
create index request_reactions_user_id_idx on public.request_reactions(user_id);

alter table public.request_reactions enable row level security;

drop policy if exists "request_reactions_read_all" on public.request_reactions;
create policy "request_reactions_read_all" on public.request_reactions
  for select to anon, authenticated using (true);

drop policy if exists "request_reactions_insert_own" on public.request_reactions;
create policy "request_reactions_insert_own" on public.request_reactions
  for insert to authenticated with check (auth.uid() = user_id);

-- delete は不要（取消なし仕様）が、自分のデータは消せるようにしておく
drop policy if exists "request_reactions_delete_own" on public.request_reactions;
create policy "request_reactions_delete_own" on public.request_reactions
  for delete to authenticated using (auth.uid() = user_id);

-- Realtime publication
do $$
begin
  alter publication supabase_realtime add table public.request_reactions;
exception when duplicate_object then null;
end$$;
