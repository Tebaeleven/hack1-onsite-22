# みんなで動かすバス停ロボット

地方の交通課題を、「固定されたバス停を増やす」のではなく、「需要に応じて移動するバス停ロボット」で解決するハッカソン作品。

住民・学生・高齢者・企業・イベント主催者がアプリから「ここに来てほしい」を申請・応援し、その指令でバス停ロボットが自律的に移動する。

## 構成

| ディレクトリ | 内容 |
|---|---|
| `client/web/` | モバイル/Web 向けアプリ (Next.js 16 + Supabase SSR + shadcn/ui) |
| `server/supabase/` | Supabase ローカル開発スタック設定とマイグレーション |
| `CLAUDE.md` | プロダクト仕様書 |

## 必要環境

- Node.js 20 以上
- Docker (Supabase ローカルスタック用)
- [Supabase CLI](https://supabase.com/docs/guides/cli)

## セットアップ

### 1. Supabase ローカルスタックを起動

```bash
cd server
supabase start
```

初回は Docker イメージ pull で数分かかる。起動後、`supabase status` で表示される
`API URL`, `publishable key`, `service_role key` を控える。

### 2. クライアントの環境変数を設定

```bash
cd client/web
cp .env.local.example .env.local
# .env.local の値を supabase status の出力で埋める
```

### 3. 依存インストール & 起動

```bash
npm install
npm run dev
```

[http://localhost:3000](http://localhost:3000) を開く。

## デモ画面

- `/login`, `/signup`: 認証フォーム
- `/demo/items`: items テーブルへの CRUD (RLS で自分のレコードのみ操作可)
- `/demo/files`: Supabase Storage への公開・非公開アップロード

## セキュリティ上の注意

- `.env.local` には service_role キーが入るため**絶対にコミットしない**（`.gitignore` で除外済み）。
- 本番デプロイ時は `auth/callback` の redirect 元と signUp の `emailRedirectTo` を
  ヘッダ依存ではなく `NEXT_PUBLIC_SITE_URL` などの env で固定するのが望ましい。
- Supabase の publishable key (旧 anon key) はブラウザに出して問題ない。
  service_role key はサーバ専用、`lib/supabase/admin.ts` 経由でのみ使用する。

## ライセンス

未定 (All rights reserved)。
