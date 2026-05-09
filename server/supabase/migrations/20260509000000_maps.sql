-- マップ定義テーブル + デフォルトマップシード
-- 適用方法: `supabase link --project-ref <ref>` 後に `supabase db push`

create table if not exists public.maps (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  rows        int  not null check (rows between 1 and 64),
  cols        int  not null check (cols between 1 and 64),
  grid        text[] not null,
  features    jsonb  not null default '[]'::jsonb,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- デフォルトマップは全体で1件のみ
create unique index if not exists maps_only_one_default
  on public.maps(is_default) where is_default;

create index if not exists maps_updated_at_idx on public.maps(updated_at desc);

alter table public.maps enable row level security;

-- 認証なし運用 (デモ): anon と authenticated に read 開放
-- 書き込みは Route Handler 経由で service_role を使うので INSERT/UPDATE/DELETE policy は付けない
drop policy if exists "maps_read_all" on public.maps;
create policy "maps_read_all" on public.maps
  for select to anon, authenticated using (true);

-- 既存 set_updated_at() (init.sql:39) を再利用
drop trigger if exists maps_set_updated_at on public.maps;
create trigger maps_set_updated_at
  before update on public.maps
  for each row execute function public.set_updated_at();

-- 既存 TOWN_GRID をデフォルトマップとしてシード
insert into public.maps (slug, name, rows, cols, grid, features, is_default)
values (
  'town-default',
  'みんなのまち',
  13,
  9,
  array[
    'ggggrgtgg',
    'ghhcrghhg',
    'ghhgrgtgg',
    'grrr+rrgg',
    'gppgrssgg',
    'gppgrmmeg',
    'rrrr+rrrr',
    'gguurggeg',
    'gtggrgtgg',
    'grrr+rrrg',
    'ghhgammsg',
    'ghhgrmmhg',
    'ghhgggtgg'
  ],
  '[
    {"id":"station","label":"みんな駅前","shortLabel":"駅前","kind":"station","tileKind":"station","grid":{"row":10,"col":4},"roadAccess":{"row":9,"col":4},"color":"#3B82F6","icon":"🚉","height":1.45,"description":"鉄道と路線バスの乗り換え拠点"},
    {"id":"hospital","label":"中央クリニック","shortLabel":"病院","kind":"hospital","tileKind":"hospital","grid":{"row":4,"col":1},"roadAccess":{"row":3,"col":1},"color":"#FB7185","icon":"🏥","height":1.35,"description":"午前中の通院需要が集中する医療拠点"},
    {"id":"supermarket","label":"まちのスーパー","shortLabel":"スーパー","kind":"shopping","tileKind":"shop","grid":{"row":4,"col":6},"roadAccess":{"row":3,"col":6},"color":"#F59E0B","icon":"🛒","height":1.25,"description":"買い物と荷物の持ち帰りを支える生活拠点"},
    {"id":"market","label":"商店街マルシェ","shortLabel":"商店街","kind":"event","tileKind":"shop","grid":{"row":10,"col":6},"roadAccess":{"row":9,"col":6},"color":"#22C55E","icon":"🎪","height":1.2,"description":"週末イベントと飲食店が集まるにぎわい拠点"},
    {"id":"school","label":"青空キャンパス","shortLabel":"学校","kind":"school","tileKind":"school","grid":{"row":7,"col":2},"roadAccess":{"row":6,"col":2},"color":"#A855F7","icon":"🎓","height":1.3,"description":"学生イベントや部活動の集合場所"},
    {"id":"company","label":"ローカルテック社","shortLabel":"企業","kind":"company","tileKind":"company","grid":{"row":1,"col":3},"roadAccess":{"row":3,"col":3},"color":"#06B6D4","icon":"🏢","height":1.8,"description":"地元企業説明会と採用イベントの会場"},
    {"id":"housing","label":"ひだまり団地","shortLabel":"団地","kind":"community","tileKind":"house","grid":{"row":11,"col":2},"roadAccess":{"row":9,"col":2},"color":"#84CC16","icon":"🏘️","height":1.05,"description":"高齢者世帯が多く、バス停まで距離がある住宅地"}
  ]'::jsonb,
  true
)
on conflict (slug) do nothing;
