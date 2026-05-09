"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { createInitialDemoState } from "./data";
import type { DemoState } from "./types";

const STORAGE_KEY = "bus-stop-robot-demo-state";
const CHANNEL_NAME = "bus-stop-robot-demo";
const API_PATH = "/api/bus-stop-demo/state";
const REALTIME_CHANNEL = "demo-states";
const SINGLETON_ID = "singleton";
const FALLBACK_INTERVAL_MS = 5000;

type DemoStateUpdater = DemoState | ((state: DemoState) => DemoState);

function isNewer(incoming: DemoState, current: DemoState) {
  return incoming.updatedAt > current.updatedAt;
}

function isDemoState(value: unknown): value is DemoState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { updatedAt?: unknown };
  return typeof candidate.updatedAt === "string" && candidate.updatedAt.length > 0;
}

function readStoredState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DemoState) : null;
  } catch {
    return null;
  }
}

export function useSyncedDemoState() {
  const [state, setState] = useState<DemoState>(() => ({
    ...createInitialDemoState(),
    updatedAt: "1970-01-01T00:00:00.000Z",
  }));
  const channelRef = useRef<BroadcastChannel | null>(null);
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  if (supabaseRef.current === null && typeof window !== "undefined") {
    supabaseRef.current = createClient();
  }

  const applyIncoming = useCallback((incoming: DemoState | null | unknown) => {
    if (!isDemoState(incoming)) return;
    setState((current) => (isNewer(incoming, current) ? incoming : current));
  }, []);

  const publish = useCallback((next: DemoState) => {
    if (typeof window === "undefined") return;

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    channelRef.current?.postMessage(next);

    void fetch(API_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    }).catch(() => {
      // 展示中はローカル同期を優先し、APIの一時失敗ではUIを止めない。
    });
  }, []);

  const updateState = useCallback(
    (updater: DemoStateUpdater) => {
      setState((current) => {
        const next =
          typeof updater === "function" ? updater(current) : updater;
        publish(next);
        return next;
      });
    },
    [publish]
  );

  // 同一ブラウザ内の即時同期 (BroadcastChannel + storage event + localStorage 復元)
  useEffect(() => {
    channelRef.current = new BroadcastChannel(CHANNEL_NAME);
    channelRef.current.onmessage = (event: MessageEvent<DemoState>) => {
      applyIncoming(event.data);
    };

    const stored = readStoredState();
    window.setTimeout(() => applyIncoming(stored), 0);

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      try {
        applyIncoming(JSON.parse(event.newValue) as DemoState);
      } catch {
        // 壊れたローカル状態は無視する。
      }
    };

    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("storage", handleStorage);
      channelRef.current?.close();
      channelRef.current = null;
    };
  }, [applyIncoming]);

  // Supabase Realtime 購読 + 初回 SELECT + 切断時フォールバック
  useEffect(() => {
    const supabase = supabaseRef.current;
    if (!supabase) return;

    let cancelled = false;
    let channel: RealtimeChannel | null = null;
    let fallbackTimer: number | null = null;

    const fetchSnapshot = async () => {
      try {
        const { data, error } = await supabase
          .from("demo_states")
          .select("state")
          .eq("id", SINGLETON_ID)
          .maybeSingle();
        if (error || cancelled) return;
        applyIncoming(data?.state);
      } catch {
        // ネットワーク失敗は黙殺し、次の機会に取り戻す
      }
    };

    const stopFallback = () => {
      if (fallbackTimer !== null) {
        window.clearInterval(fallbackTimer);
        fallbackTimer = null;
      }
    };

    const startFallback = () => {
      if (fallbackTimer !== null) return;
      fallbackTimer = window.setInterval(fetchSnapshot, FALLBACK_INTERVAL_MS);
    };

    void fetchSnapshot();

    channel = supabase
      .channel(REALTIME_CHANNEL)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "demo_states",
          filter: `id=eq.${SINGLETON_ID}`,
        },
        (payload) => {
          const next = (payload.new as { state?: unknown } | null)?.state;
          applyIncoming(next);
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          stopFallback();
        } else if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          startFallback();
        }
      });

    const handleOnline = () => {
      void fetchSnapshot();
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void fetchSnapshot();
      }
    };

    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      stopFallback();
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibility);
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [applyIncoming]);

  return { state, updateState };
}
