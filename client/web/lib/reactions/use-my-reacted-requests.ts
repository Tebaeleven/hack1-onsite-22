"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { listMyReactedRequestIds } from "./queries";

// 自分が応援した申請 ID 集合を取得し、Realtime で更新する
export function useMyReactedRequestIds(userId: string | null) {
  const [ids, setIds] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    if (!userId) {
      setIds([]);
      return;
    }
    const next = await listMyReactedRequestIds(userId);
    setIds(next);
  }, [userId]);

  useEffect(() => {
    // 外部 (Supabase) との同期。setState は async fetch の結果を反映するもの
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`my-reactions-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "request_reactions",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void refresh();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refresh, userId]);

  return { ids, refresh };
}
