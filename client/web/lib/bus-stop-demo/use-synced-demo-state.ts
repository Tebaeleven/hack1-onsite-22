"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createInitialDemoState } from "./data";
import type { DemoState } from "./types";

const STORAGE_KEY = "bus-stop-robot-demo-state";
const CHANNEL_NAME = "bus-stop-robot-demo";
const API_PATH = "/api/bus-stop-demo/state";

type DemoStateUpdater = DemoState | ((state: DemoState) => DemoState);

function isNewer(incoming: DemoState, current: DemoState) {
  return incoming.updatedAt > current.updatedAt;
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

  const applyIncoming = useCallback((incoming: DemoState | null) => {
    if (!incoming?.updatedAt) return;
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

  useEffect(() => {
    let cancelled = false;

    const pull = async () => {
      try {
        const response = await fetch(API_PATH, { cache: "no-store" });
        if (!response.ok) return;
        const incoming = (await response.json()) as DemoState;
        if (!cancelled) applyIncoming(incoming);
      } catch {
        // オフライン展示でも同一ブラウザ内の同期は動く。
      }
    };

    void pull();
    const intervalId = window.setInterval(pull, 1500);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [applyIncoming]);

  return { state, updateState };
}
