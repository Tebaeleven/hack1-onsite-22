-- comments を「申請」だけでなく「イベント」など他対象にも紐づけられるよう拡張
-- + 編集機能のために updated_at 列とトリガを追加
-- 適用方法: `supabase db push`

-- 1. target_kind 列追加 (既存行は default 'request' で埋まる)
alter table public.comments
  add column if not exists target_kind text not null default 'request';

do $$
begin
  alter table public.comments
    add constraint comments_target_kind_check
    check (target_kind in ('request', 'event'));
exception when duplicate_object then null;
end$$;

-- 2. updated_at 列追加 (既存行は default now() で埋まる)
alter table public.comments
  add column if not exists updated_at timestamptz not null default now();

-- 3. インデックス: 既存の (request_id, created_at desc) は残しつつ、
--    target_kind 込みの複合検索用を追加
create index if not exists comments_target_idx
  on public.comments(target_kind, request_id, created_at desc);

-- 4. updated_at 自動更新トリガ (set_updated_at は init.sql:39 で定義済み)
drop trigger if exists comments_set_updated_at on public.comments;
create trigger comments_set_updated_at
  before update on public.comments
  for each row execute function public.set_updated_at();
