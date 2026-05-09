# Googleアカウント連携 機能ロードマップ

## Context

現状の「みんなで動かすバス停ロボット」MVPは、4プリセット（一般人/高齢者/企業/管理者）がフロントメモリのみ、認証はEmail/Password実装済み・Googleログイン未、リアクションは3種カウンタ・コメントなし・個人追跡なし。

Googleアカウントで個人/企業がログインできるようになった前提で、CLAUDE.md の仕様（住民/学生/高齢者/企業/イベント主催者/行政の6者、移動申請+応援+地域インパクトのコアドメイン）を活かす機能アイデアを15案出した。これをハッカソンMVPに組み込む前提で **優先順位付け + フェーズ分けロードマップ** にする。

---

## 現状の前提（コードから確認済み）

- 認証: `client/web/app/(auth)/actions.ts` — Email/Password のみ
- ユーザー区分: `client/web/app/_components/BusStopRobotApp.tsx:126-167` — 4プリセット、DB 永続化なし
- 申請モデル: `client/web/lib/bus-stop-demo/types.ts:91-107` — `reactions` は単純カウンタ、申請者 ID なし
- 状態同期: `demo_states` の単一 JSON ドキュメントを Supabase Realtime で配信。書き込みは Route Handler 経由 service_role
- DBスキーマ: `users` 拡張プロフィール / `comments` / `reactions` / `follows` テーブルなし

→ 認証連携機能は「demo_states 外の専用テーブル + RLS」で扱う必要があり、現アーキテクチャに **新しいデータレイヤを増やす** 判断になる。

---

## 評価基準

各案を以下4軸で評価し、ハッカソンでの優先度を決める：

- **規模 S/M/L**: 実装ボリューム（S=半日, M=1〜2日, L=3日以上）
- **インパクト ★1〜3**: 審査員に伝わる差分の大きさ
- **依存**: 先に必要な案

---

## アイデア一覧（評価表）

| ID | 名前 | 規模 | ★ | 依存 | 評価コメント |
|---|---|:-:|:-:|---|---|
| **F0-A** | Google OAuth導入 | S | ★ | — | 全機能の前提。Supabase Auth に `signInWithOAuth({provider:'google'})` 1行追加レベル。 |
| **F0-B** | profiles テーブル新設 | S | ★ | F0-A | user_id, role, display_name, avatar_url, home_grid。RLSは self-write/all-read。 |
| **A-1** | ユーザータイプ自己申告（6種） | S | ★★★ | F0-B | コメント/申請に「学生」「高齢者」バッジが付くだけで地域の声感が劇的UP。低コスト高効果。 |
| **A-2** | 居住エリア登録 | M | ★★ | F0-B | 申請時の出発地自動入力 + パーソナライズ。MapEditor の grid pick UI 流用可。 |
| **A-3** | 法人プロフィール+認証バッジ | M | ★★ | F0-B | organizations テーブル + ドメイン認証。デモでは「公式バッジ」表示まででも十分映える。 |
| **B-1** | コメント機能 ★ユーザー要望 | M | ★★★ | F0-A | comments テーブル + 申請詳細にスレッド表示。SNSっぽさの中核。 |
| **B-2** | コメントへのリアクション ★ユーザー要望 | S | ★★ | B-1 | comment_reactions テーブル。「同じ！」「がんばれ」のクイック反応で温度感UP。 |
| **B-3** | リアクションの個別追跡化 | M | ★★ | F0-A | request_reactions テーブル + UNIQUE制約で1人1票化。「あなたを含む23人」表示。 |
| **B-4** | フォロー機能 | M | ★ | F0-B | 主催者/企業フォロー + 通知。ハッカソンでは通知UIが重く、優先度低め。 |
| **B-5** | 「あなたの応援が動かした」レポート | S | ★★ | B-3 | マイページに集計表示。B-3さえあれば軽実装でデモ映え。 |
| **C-1** | 「私も乗ります」予約機能 | M | ★★ | F0-A | ride_intents テーブル。需要の確定感UP。指令成立後のフローも要設計。 |
| **C-2** | 出発地ピン自動利用 | S | ★★ | A-2 | A-2の上に乗る形で「徒歩○分→○分」の自動BeforeAfter。既存BeforeAfterMetric流用。 |
| **C-3** | イベント主催者向け集客フロー | L | ★★ | A-3 | events テーブル + 申請フォーム分岐。スコープ大、ハッカソンでは形だけ作るのが現実的。 |
| **C-4** | 採択申請のシェア（OGP） | S | ★ | — | Next.js opengraph-image で動的OGP生成。アカウント不要なので前後どこでも入れられる。 |
| **C-5** | ゲーミフィケーション（ポイント） | L | ★ | B-3,C-1 | point_events テーブル + ランキング。施策設計が重く、デモ尺で説明しきれない。優先度低。 |
| **D-1** | 行政公式アカウント+お知らせ | L | ★ | A-3 | 行政アカウント分岐 + 通知。ハッカソン尺だと「企業/イベント」と差別化しにくい。 |
| **D-2** | 需要ヒートマップ | M | ★★★ | B-3 | 申請集中度の地図描画。「地域需要の可視化」を視覚的に伝えられ、行政向け事業性ストーリーが描ける。 |
| **D-3** | 採択ロジックの透明化 | S | ★★ | B-3,C-1 | 「応援○人・予約○人」表示。指令結果画面の説得力UP。 |

---

## ロードマップ（4フェーズ）

### Phase 0: 認証基盤（前提・必須）
**目的**: 全機能の土台。これなしには何も始まらない。

- F0-A: Google OAuth導入
- F0-B: profiles テーブル新設

**完了条件**: ログインしたユーザーが profiles に紐づき、display_name と avatar_url が UI に出る。

---

### Phase 1: コア体験（ハッカソンMVPに必ず入れる）★最優先
**目的**: 「アカウントだからこそできるSNS的コア体験」を作る。ユーザー要望(B-1, B-2)直撃 + 「地域の声」感を最大化。

- **A-1**: ユーザータイプ自己申告（6種）
- **B-1**: コメント機能 ★ユーザー要望
- **B-3**: リアクションの個別追跡化
- **B-2**: コメントへのリアクション ★ユーザー要望

**完了条件**:
- 申請を開くとコメント欄があり、ロール付き（「学生」「高齢者」等）で投稿できる
- コメントに「同じ！」等のクイック反応が押せる
- 申請の応援は「あなたを含む◯人」と1人1票で表示される

---

### Phase 2: 体験の厚み
**目的**: 個人体験のパーソナライズと、デモのストーリー強化。

- **B-5**: 「あなたの応援が動かした」レポート
- **A-2 + C-2**: エリア登録 + 出発地ピン自動BeforeAfter（個人版インパクト表示）
- **D-3**: 採択ロジック透明化（指令結果画面に「応援◯人」表示）
- **C-4**: 採択申請のシェア（OGP）

**完了条件**: マイページとデモ画面で「自分の貢献」「採択理由」が見える。

---

### Phase 3: 事業性ストーリー
**目的**: 審査員に「事業として広がる」イメージを伝える。

- **D-2**: 需要ヒートマップ（B-3のデータを地図描画）
- **A-3**: 法人プロフィール+認証バッジ
- **C-1**: 「私も乗ります」予約機能

**完了条件**: 行政向けダッシュボード（ヒートマップ）と企業申請の差別化が見える。

---

### Phase 4: 後回し（ハッカソン外）
- **B-4**: フォロー機能（通知UIが重い）
- **C-3**: イベント主催者向け専用フロー（スコープ大）
- **C-5**: ゲーミフィケーション（施策設計重い）
- **D-1**: 行政公式アカウント（差別化しにくい）

---

## 必要なテーブル一覧（Phase 3 まで）

```sql
-- F0-B
profiles(user_id PK, role, display_name, avatar_url, home_grid jsonb?, created_at, updated_at)

-- B-1
comments(id PK, request_id, author_id, body, created_at)

-- B-2
comment_reactions(comment_id, user_id, kind, created_at, UNIQUE(comment_id,user_id,kind))

-- B-3
request_reactions(request_id, user_id, kind, created_at, UNIQUE(request_id,user_id,kind))

-- A-3
organizations(id PK, owner_id, name, kind, verified, created_at)

-- C-1
ride_intents(command_id, user_id, planned_time, created_at, UNIQUE(command_id,user_id))
```

各テーブルに RLS: `auth.uid() = author_id/user_id` で self-write、`true` で all-read。

---

## 関連ファイル（実装着手時の起点）

- 認証フロー: `client/web/app/(auth)/actions.ts`
- ユーザープリセット定義: `client/web/app/_components/BusStopRobotApp.tsx:126-167`
- 申請モデル/リアクション: `client/web/lib/bus-stop-demo/types.ts:91-107`
- 状態同期: `client/web/lib/bus-stop-demo/state.ts`, `use-synced-demo-state.ts`
- マイグレーション置き場: `server/supabase/migrations/`
- API ルートハンドラ参考: `client/web/app/api/bus-stop-demo/state/route.ts`
