-- コメント + 個別追跡リアクション (Phase 1)
-- 適用方法: `supabase db push`

-- request_id は demo_states 内の MoveRequest.id と一致する text 値。
-- demo は singleton state で動くため外部キー制約は付けない（リクエスト削除時はアプリ側で arrange）

create table if not exists public.comments (
  id          uuid primary key default gen_random_uuid(),
  request_id  text not null,
  author_id   uuid not null references auth.users(id) on delete cascade,
  body        text not null check (length(body) between 1 and 800),
  created_at  timestamptz not null default now()
);

create index if not exists comments_request_id_idx on public.comments(request_id, created_at desc);
create index if not exists comments_author_id_idx on public.comments(author_id);

alter table public.comments enable row level security;

drop policy if exists "comments_read_all" on public.comments;
create policy "comments_read_all" on public.comments
  for select to anon, authenticated using (true);

drop policy if exists "comments_insert_own" on public.comments;
create policy "comments_insert_own" on public.comments
  for insert to authenticated with check (auth.uid() = author_id);

drop policy if exists "comments_update_own" on public.comments;
create policy "comments_update_own" on public.comments
  for update to authenticated
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

drop policy if exists "comments_delete_own" on public.comments;
create policy "comments_delete_own" on public.comments
  for delete to authenticated using (auth.uid() = author_id);


create table if not exists public.comment_reactions (
  comment_id  uuid not null references public.comments(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('same', 'cheer', 'thanks')),
  created_at  timestamptz not null default now(),
  primary key (comment_id, user_id, kind)
);

create index if not exists comment_reactions_comment_id_idx on public.comment_reactions(comment_id);

alter table public.comment_reactions enable row level security;

drop policy if exists "comment_reactions_read_all" on public.comment_reactions;
create policy "comment_reactions_read_all" on public.comment_reactions
  for select to anon, authenticated using (true);

drop policy if exists "comment_reactions_insert_own" on public.comment_reactions;
create policy "comment_reactions_insert_own" on public.comment_reactions
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "comment_reactions_delete_own" on public.comment_reactions;
create policy "comment_reactions_delete_own" on public.comment_reactions
  for delete to authenticated using (auth.uid() = user_id);


create table if not exists public.request_reactions (
  request_id  text not null,
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('wantToGo', 'helpful', 'cheer')),
  created_at  timestamptz not null default now(),
  primary key (request_id, user_id, kind)
);

create index if not exists request_reactions_request_id_idx on public.request_reactions(request_id);
create index if not exists request_reactions_user_id_idx on public.request_reactions(user_id);

alter table public.request_reactions enable row level security;

drop policy if exists "request_reactions_read_all" on public.request_reactions;
create policy "request_reactions_read_all" on public.request_reactions
  for select to anon, authenticated using (true);

drop policy if exists "request_reactions_insert_own" on public.request_reactions;
create policy "request_reactions_insert_own" on public.request_reactions
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "request_reactions_delete_own" on public.request_reactions;
create policy "request_reactions_delete_own" on public.request_reactions
  for delete to authenticated using (auth.uid() = user_id);


-- Realtime publication 登録（コメント・リアクションをリアルタイム配信）
do $$
begin
  alter publication supabase_realtime add table public.comments;
exception when duplicate_object then null;
end$$;

do $$
begin
  alter publication supabase_realtime add table public.comment_reactions;
exception when duplicate_object then null;
end$$;

do $$
begin
  alter publication supabase_realtime add table public.request_reactions;
exception when duplicate_object then null;
end$$;
