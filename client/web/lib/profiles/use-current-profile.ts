"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getProfile, upsertProfile, type ProfileUpdate } from "./queries";
import type { Profile } from "./types";

export type CurrentProfileState = {
  loaded: boolean;
  userId: string | null;
  profile: Profile | null;
  refresh: () => Promise<void>;
  update: (patch: ProfileUpdate) => Promise<Profile | null>;
};

// 現在ログイン中のユーザーと profile を取得する。
// 未ログイン時は userId/profile が null。
export function useCurrentProfile(): CurrentProfileState {
  const [loaded, setLoaded] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const fetchAll = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    const uid = data.user?.id ?? null;
    setUserId(uid);
    if (!uid) {
      setProfile(null);
      setLoaded(true);
      return;
    }
    const p = await getProfile(uid);
    setProfile(p);
    setLoaded(true);
  }, []);

  useEffect(() => {
    // 認証状態の同期は外部システム連携なので setState を含むのは想定どおり
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchAll();
    const supabase = createClient();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void fetchAll();
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, [fetchAll]);

  const update = useCallback(
    async (patch: ProfileUpdate) => {
      if (!userId) return null;
      const next = await upsertProfile(userId, patch);
      if (next) setProfile(next);
      return next;
    },
    [userId]
  );

  return { loaded, userId, profile, refresh: fetchAll, update };
}
