-- Storage バケット + RLS ポリシー
-- 公開バケット 'public-assets' と認証必須バケット 'user-files' を作る

-- 公開バケット (誰でも GET 可能)
insert into storage.buckets (id, name, public)
  values ('public-assets', 'public-assets', true)
  on conflict (id) do nothing;

-- 認証必須バケット (RLS で制御)
insert into storage.buckets (id, name, public)
  values ('user-files', 'user-files', false)
  on conflict (id) do nothing;

-- ============================================================
-- public-assets: 認証ユーザーのみ書き込み可、読み取りは誰でも (anon/authenticated)
-- ============================================================
drop policy if exists "public_assets_authenticated_insert" on storage.objects;
create policy "public_assets_authenticated_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'public-assets');

-- list / select は anon にも開放 (public バケットなので)
drop policy if exists "public_assets_authenticated_select" on storage.objects;
drop policy if exists "public_assets_select_all" on storage.objects;
create policy "public_assets_select_all" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'public-assets');

drop policy if exists "public_assets_authenticated_update" on storage.objects;
create policy "public_assets_authenticated_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'public-assets')
  with check (bucket_id = 'public-assets');

drop policy if exists "public_assets_authenticated_delete" on storage.objects;
create policy "public_assets_authenticated_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'public-assets');

-- ============================================================
-- user-files: 自分の uid フォルダ以下のみ操作可
-- upsert を機能させるため SELECT/INSERT/UPDATE/DELETE すべて必要
-- ============================================================
drop policy if exists "user_files_select_own" on storage.objects;
create policy "user_files_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'user-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "user_files_insert_own" on storage.objects;
create policy "user_files_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'user-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "user_files_update_own" on storage.objects;
create policy "user_files_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'user-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'user-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "user_files_delete_own" on storage.objects;
create policy "user_files_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'user-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
