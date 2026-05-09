-- タイル種類定義テーブル
-- マップエディタで使う「家・店・道路…」などの種類を DB 管理する。
-- 管理者が新しい建物種類 (例: 図書館) を追加できる。
-- 既存の grid (text[] の 1 文字コード) はこのテーブルの code を参照する想定 (FK は張らない)。

create table if not exists public.tile_kinds (
  kind         text primary key,
  code         text not null,
  label        text not null,
  bg_color     text not null,
  emoji        text not null default '',
  is_building  boolean not null default false,
  is_builtin   boolean not null default false,
  sort_order   int not null default 100,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index if not exists tile_kinds_code_uniq on public.tile_kinds(code);
create index if not exists tile_kinds_sort_idx on public.tile_kinds(sort_order, kind);

alter table public.tile_kinds enable row level security;

-- 認証なし運用 (デモ): anon と authenticated に read 開放
-- 書き込みは Route Handler 経由で service_role を使うので INSERT/UPDATE/DELETE policy は付けない
drop policy if exists "tile_kinds_read_all" on public.tile_kinds;
create policy "tile_kinds_read_all" on public.tile_kinds
  for select to anon, authenticated using (true);

-- 既存 set_updated_at() (init.sql) を再利用
drop trigger if exists tile_kinds_set_updated_at on public.tile_kinds;
create trigger tile_kinds_set_updated_at
  before update on public.tile_kinds
  for each row execute function public.set_updated_at();

-- ビルトイン 12 種をシード
insert into public.tile_kinds (kind, code, label, bg_color, emoji, is_building, is_builtin, sort_order)
values
  ('grass',        'g', '草地',    '#78c95e', '',   false, true, 10),
  ('road',         'r', '道路',    '#9fb0b8', '',   false, true, 20),
  ('intersection', '+', '交差点',  '#97aab4', '✚',  false, true, 30),
  ('house',        'h', '住宅',    '#80ce62', '🏠', true,  true, 110),
  ('shop',         's', '店舗',    '#d8b85c', '🏪', true,  true, 120),
  ('company',      'c', '会社',    '#87d6e7', '🏢', true,  true, 130),
  ('hospital',     'p', '病院',    '#f8aeba', '🏥', true,  true, 140),
  ('school',       'u', '学校',    '#c3a7f6', '🎓', true,  true, 150),
  ('station',      'a', '駅',      '#95d8f6', '🚉', true,  true, 160),
  ('park',         'e', '公園',    '#86d968', '🎪', false, true, 200),
  ('tree',         't', '樹木',    '#6fbe55', '🌳', false, true, 210),
  ('busStop',      'b', 'バス停',  '#fff2b8', '🚌', false, true, 220)
on conflict (kind) do nothing;
