import { createClient } from "@/lib/supabase/client";
import type { ProfileRole } from "@/types/database";

// === ロボット移動履歴 ===

export type CommandLog = {
  id: string;
  commandId: string;
  requestId: string;
  scenarioId: string | null;
  fromLocationId: string;
  toLocationId: string;
  distance: number;
  createdAt: string;
};

export async function recordCommandLog(input: {
  commandId: string;
  requestId: string;
  scenarioId: string | null;
  fromLocationId: string;
  toLocationId: string;
  distance: number;
}): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("command_logs").insert({
    command_id: input.commandId,
    request_id: input.requestId,
    scenario_id: input.scenarioId,
    from_location_id: input.fromLocationId,
    to_location_id: input.toLocationId,
    distance: input.distance,
  });
  if (error) {
    console.error("[stats] recordCommandLog", error.message);
    return false;
  }
  return true;
}

export async function listCommandLogs(): Promise<CommandLog[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("command_logs")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[stats] listCommandLogs", error.message);
    return [];
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    commandId: row.command_id,
    requestId: row.request_id,
    scenarioId: row.scenario_id,
    fromLocationId: row.from_location_id,
    toLocationId: row.to_location_id,
    distance: row.distance,
    createdAt: row.created_at,
  }));
}

// === 応援(投票)集計 ===

export type ReactionAggregate = {
  totalCount: number;
  countsByKind: { wantToGo: number; helpful: number; cheer: number };
  uniqueSupporterIds: string[];
  countsByRequest: Record<string, number>;
  topSupporterUserIds: string[]; // 上位応援者
  countsByUser: Record<string, number>;
};

type ReactionRow = {
  request_id: string;
  user_id: string;
  kind: "wantToGo" | "helpful" | "cheer";
};

export async function loadReactionAggregate(): Promise<ReactionAggregate> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("request_reactions")
    .select("request_id, user_id, kind");
  if (error) {
    console.error("[stats] reactionAggregate", error.message);
    return {
      totalCount: 0,
      countsByKind: { wantToGo: 0, helpful: 0, cheer: 0 },
      uniqueSupporterIds: [],
      countsByRequest: {},
      topSupporterUserIds: [],
      countsByUser: {},
    };
  }
  const rows = (data ?? []) as ReactionRow[];
  const countsByKind = { wantToGo: 0, helpful: 0, cheer: 0 };
  const supporters = new Set<string>();
  const countsByRequest: Record<string, number> = {};
  const countsByUser: Record<string, number> = {};
  for (const row of rows) {
    countsByKind[row.kind] += 1;
    supporters.add(row.user_id);
    countsByRequest[row.request_id] = (countsByRequest[row.request_id] ?? 0) + 1;
    countsByUser[row.user_id] = (countsByUser[row.user_id] ?? 0) + 1;
  }
  const topSupporterUserIds = Object.entries(countsByUser)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => id);
  return {
    totalCount: rows.length,
    countsByKind,
    uniqueSupporterIds: Array.from(supporters),
    countsByRequest,
    topSupporterUserIds,
    countsByUser,
  };
}

// === ロール別の応援者数 ===

export async function loadSupportersByRole(
  userIds: string[]
): Promise<Record<ProfileRole, number>> {
  const empty: Record<ProfileRole, number> = {
    resident: 0,
    student: 0,
    senior: 0,
    business: 0,
    organizer: 0,
    gov: 0,
  };
  if (userIds.length === 0) return empty;
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, role")
    .in("user_id", userIds);
  if (error) {
    console.error("[stats] supportersByRole", error.message);
    return empty;
  }
  const result = { ...empty };
  for (const row of (data ?? []) as { user_id: string; role: ProfileRole }[]) {
    result[row.role] += 1;
  }
  return result;
}

// === コメント集計 ===

export type CommentAggregate = {
  total: number;
  byTargetKind: { request: number; event: number };
  byTargetId: Record<string, number>;
  byTargetKindAndId: Record<string, number>; // key: `${kind}:${id}`
};

export async function loadCommentAggregate(): Promise<CommentAggregate> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("comments")
    .select("request_id, target_kind");
  if (error) {
    console.error("[stats] commentAggregate", error.message);
    return {
      total: 0,
      byTargetKind: { request: 0, event: 0 },
      byTargetId: {},
      byTargetKindAndId: {},
    };
  }
  const rows = (data ?? []) as {
    request_id: string;
    target_kind: "request" | "event";
  }[];
  const byTargetKind = { request: 0, event: 0 };
  const byTargetId: Record<string, number> = {};
  const byTargetKindAndId: Record<string, number> = {};
  for (const row of rows) {
    byTargetKind[row.target_kind] += 1;
    byTargetId[row.request_id] = (byTargetId[row.request_id] ?? 0) + 1;
    const key = `${row.target_kind}:${row.request_id}`;
    byTargetKindAndId[key] = (byTargetKindAndId[key] ?? 0) + 1;
  }
  return {
    total: rows.length,
    byTargetKind,
    byTargetId,
    byTargetKindAndId,
  };
}

// === 乗車予約集計 ===

export async function loadRideIntentTotal(): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from("ride_intents")
    .select("*", { count: "exact", head: true });
  if (error) {
    console.error("[stats] rideIntentTotal", error.message);
    return 0;
  }
  return count ?? 0;
}
