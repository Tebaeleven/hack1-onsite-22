"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  listCommandLogs,
  loadCommentAggregate,
  loadReactionAggregate,
  loadRideIntentTotal,
  loadSupportersByRole,
  type CommandLog,
  type CommentAggregate,
  type ReactionAggregate,
} from "./queries";
import type { ProfileRole } from "@/types/database";

export type StatsSnapshot = {
  loaded: boolean;
  reactions: ReactionAggregate;
  supportersByRole: Record<ProfileRole, number>;
  commandLogs: CommandLog[];
  comments: CommentAggregate;
  rideIntentTotal: number;
};

const EMPTY_REACTIONS: ReactionAggregate = {
  totalCount: 0,
  countsByKind: { wantToGo: 0, helpful: 0, cheer: 0 },
  uniqueSupporterIds: [],
  countsByRequest: {},
  topSupporterUserIds: [],
  countsByUser: {},
};

const EMPTY_BY_ROLE: Record<ProfileRole, number> = {
  resident: 0,
  student: 0,
  senior: 0,
  business: 0,
  organizer: 0,
  gov: 0,
};

const EMPTY_COMMENTS: CommentAggregate = {
  total: 0,
  byTargetKind: { request: 0, event: 0 },
  byTargetId: {},
  byTargetKindAndId: {},
};

// 全集計データを取得し、関連テーブルの変更時に再フェッチする
export function useStats(): StatsSnapshot {
  const [loaded, setLoaded] = useState(false);
  const [reactions, setReactions] = useState<ReactionAggregate>(EMPTY_REACTIONS);
  const [supportersByRole, setSupportersByRole] =
    useState<Record<ProfileRole, number>>(EMPTY_BY_ROLE);
  const [commandLogs, setCommandLogs] = useState<CommandLog[]>([]);
  const [comments, setComments] = useState<CommentAggregate>(EMPTY_COMMENTS);
  const [rideIntentTotal, setRideIntentTotal] = useState(0);

  const refresh = useCallback(async () => {
    const [r, logs, c, rides] = await Promise.all([
      loadReactionAggregate(),
      listCommandLogs(),
      loadCommentAggregate(),
      loadRideIntentTotal(),
    ]);
    setReactions(r);
    setCommandLogs(logs);
    setComments(c);
    setRideIntentTotal(rides);
    const byRole = await loadSupportersByRole(r.uniqueSupporterIds);
    setSupportersByRole(byRole);
    setLoaded(true);
  }, []);

  useEffect(() => {
    // 外部 (Supabase) との同期
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  // 集計に影響する全テーブルを購読
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("stats-stream")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "request_reactions" },
        () => void refresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "command_logs" },
        () => void refresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "comments" },
        () => void refresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ride_intents" },
        () => void refresh()
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refresh]);

  return {
    loaded,
    reactions,
    supportersByRole,
    commandLogs,
    comments,
    rideIntentTotal,
  };
}
