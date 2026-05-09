"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  addRequestReaction,
  emptyRequestReactionSummary,
  listRequestReactions,
  type RequestReactionSummary,
} from "./queries";
import type { ReactionKey } from "@/lib/bus-stop-demo/types";

type SummaryMap = Record<string, RequestReactionSummary>;

// 申請 ID リストに対する request_reactions 集計を維持し、Realtime で更新する
export function useRequestReactions(
  requestIds: string[],
  currentUserId: string | null
) {
  const [summaries, setSummaries] = useState<SummaryMap>({});
  const idsKey = requestIds.slice().sort().join("|");
  const idsRef = useRef<string[]>([]);

  useEffect(() => {
    idsRef.current = requestIds;
  }, [requestIds]);

  const refresh = useCallback(async () => {
    const list = idsRef.current;
    const next = await listRequestReactions(list, currentUserId);
    setSummaries(next);
  }, [currentUserId]);

  // ID リスト変更時 / ユーザー変更時に再フェッチ
  useEffect(() => {
    void refresh();
  }, [idsKey, currentUserId, refresh]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("request-reactions-stream")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "request_reactions",
        },
        () => {
          void refresh();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refresh]);

  // 1人が何度でも押せる: 押すたびに +1 行追加
  const add = useCallback(
    async (requestId: string, kind: ReactionKey) => {
      if (!currentUserId) return false;
      // 楽観更新（成功前提でカウントを 1 増やす）
      setSummaries((prev) => {
        const bucket = prev[requestId] ?? emptyRequestReactionSummary();
        const counts = { ...bucket.counts };
        counts[kind] = (counts[kind] ?? 0) + 1;
        const supporterIds = new Set(bucket.supporterIds);
        supporterIds.add(currentUserId);
        return {
          ...prev,
          [requestId]: {
            counts,
            myCount: bucket.myCount + 1,
            supporterIds,
          },
        };
      });
      const ok = await addRequestReaction(requestId, currentUserId, kind);
      if (!ok) void refresh();
      return ok;
    },
    [currentUserId, refresh]
  );

  return { summaries, refresh, add };
}
