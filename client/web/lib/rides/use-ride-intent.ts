"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  getRideIntentSummary,
  toggleRideIntent,
  type RideIntentSummary,
} from "./queries";

export function useRideIntent(commandId: string | null, userId: string | null) {
  const [summary, setSummary] = useState<RideIntentSummary>({
    count: 0,
    myReserved: false,
  });

  const refresh = useCallback(async () => {
    if (!commandId) {
      setSummary({ count: 0, myReserved: false });
      return;
    }
    const next = await getRideIntentSummary(commandId, userId);
    setSummary(next);
  }, [commandId, userId]);

  useEffect(() => {
    // 外部 (Supabase) との同期。setState は async fetch の結果を反映するもの
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!commandId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`ride-intents-${commandId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ride_intents",
          filter: `command_id=eq.${commandId}`,
        },
        () => {
          void refresh();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [commandId, refresh]);

  const toggle = useCallback(async () => {
    if (!commandId || !userId) return false;
    const wasReserved = summary.myReserved;
    setSummary((prev) => ({
      count: prev.count + (wasReserved ? -1 : 1),
      myReserved: !wasReserved,
    }));
    const ok = await toggleRideIntent(commandId, userId, !wasReserved);
    if (!ok) void refresh();
    return ok;
  }, [commandId, userId, summary.myReserved, refresh]);

  return { summary, toggle, refresh };
}
