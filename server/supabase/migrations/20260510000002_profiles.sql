-- ユーザープロフィール (Phase 0)
-- 適用方法: `supabase db push`（リモート）/ `supabase db reset`（ローカル）

create type public.profile_role as enum (
  'resident',   -- 一般住民
  'student',    -- 学生
  'senior',     -- 高齢者
  'business',   -- 企業
  'organizer',  -- イベント主催者
  'gov'         -- 行政・運営
);

create table if not exists public.profiles (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  role        public.profile_role not null default 'resident',
  display_name text not null default '',
  avatar_url  text,
  home_grid   jsonb,                                 -- { row, col } または null
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles(role);

alter table public.profiles enable row level security;

-- 全員 read 可（コメント表示等で必要）
drop policy if exists "profiles_read_all" on public.profiles;
create policy "profiles_read_all" on public.profiles
  for select to anon, authenticated using (true);

-- 自分の行のみ insert/update 可
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- updated_at 自動更新
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- auth.users に行が作られたら profiles も自動 insert
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_display_name text;
  v_avatar_url   text;
begin
  v_display_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'name', ''),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'preferred_username', ''),
    split_part(coalesce(new.email, ''), '@', 1),
    ''
  );
  v_avatar_url := nullif(new.raw_user_meta_data ->> 'avatar_url', '');

  insert into public.profiles (user_id, display_name, avatar_url)
  values (new.id, v_display_name, v_avatar_url)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
