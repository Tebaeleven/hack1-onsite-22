import { createClient } from "@/lib/supabase/client";
import type { ReactionKey } from "@/lib/bus-stop-demo/types";

export type RequestReactionSummary = {
  // kind ごとの合計件数（ログ追記型なので「押された回数」）
  counts: Record<ReactionKey, number>;
  // ログインユーザーが押した回数（kind は問わず合計）
  myCount: number;
  // ユニークな応援者の userId 集合（重複排除のため Set）
  supporterIds: Set<string>;
};

type RequestReactionRow = {
  id?: string;
  request_id: string;
  user_id: string;
  kind: ReactionKey;
};

export function emptyRequestReactionSummary(): RequestReactionSummary {
  return {
    counts: { wantToGo: 0, helpful: 0, cheer: 0 },
    myCount: 0,
    supporterIds: new Set(),
  };
}

// 申請に紐づく request_reactions を集計
export async function listRequestReactions(
  requestIds: string[],
  currentUserId: string | null
): Promise<Record<string, RequestReactionSummary>> {
  if (requestIds.length === 0) return {};
  const supabase = createClient();
  const { data, error } = await supabase
    .from("request_reactions")
    .select("request_id, user_id, kind")
    .in("request_id", requestIds);
  if (error) {
    console.error("[reactions] list", error.message);
    return {};
  }
  const map: Record<string, RequestReactionSummary> = {};
  for (const row of (data ?? []) as RequestReactionRow[]) {
    const bucket = (map[row.request_id] ??= emptyRequestReactionSummary());
    bucket.counts[row.kind] = (bucket.counts[row.kind] ?? 0) + 1;
    bucket.supporterIds.add(row.user_id);
    if (currentUserId && row.user_id === currentUserId) {
      bucket.myCount += 1;
    }
  }
  return map;
}

// 1ユーザーが何度でも押せる: 都度 insert（UNIQUE 制約なし）
export async function addRequestReaction(
  requestId: string,
  userId: string,
  kind: ReactionKey
): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from("request_reactions")
    .insert({ request_id: requestId, user_id: userId, kind });
  if (error) {
    console.error("[reactions] add", error.message);
    return false;
  }
  return true;
}

// 自分が応援した申請 ID を取得（マイページ用）
export async function listMyReactedRequestIds(
  userId: string
): Promise<string[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("request_reactions")
    .select("request_id")
    .eq("user_id", userId);
  if (error) {
    console.error("[reactions] listMine", error.message);
    return [];
  }
  const set = new Set<string>();
  for (const row of (data ?? []) as { request_id: string }[]) {
    set.add(row.request_id);
  }
  return Array.from(set);
}
