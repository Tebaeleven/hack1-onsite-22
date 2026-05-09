-- ロボット移動履歴 (指令発行毎の移動記録)
-- 適用方法: `supabase db push`

create table if not exists public.command_logs (
  id              uuid primary key default gen_random_uuid(),
  command_id      text not null,
  request_id      text not null,
  scenario_id     text,
  from_location_id text not null,
  to_location_id  text not null,
  distance        integer not null check (distance >= 0),
  created_at      timestamptz not null default now()
);

create index if not exists command_logs_created_at_idx
  on public.command_logs(created_at desc);
create index if not exists command_logs_scenario_idx
  on public.command_logs(scenario_id);

alter table public.command_logs enable row level security;

drop policy if exists "command_logs_read_all" on public.command_logs;
create policy "command_logs_read_all" on public.command_logs
  for select to anon, authenticated using (true);

-- デモ運用なので未ログインからも記録できるようにする (展示卓の demo state と整合)
drop policy if exists "command_logs_insert_all" on public.command_logs;
create policy "command_logs_insert_all" on public.command_logs
  for insert to anon, authenticated with check (true);

-- Realtime publication
do $$
begin
  alter publication supabase_realtime add table public.command_logs;
exception when duplicate_object then null;
end$$;
