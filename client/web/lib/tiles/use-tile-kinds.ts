"use client";

import { useCallback, useEffect, useState } from "react";
import { getBuiltinTileKinds, listTileKinds } from "./queries";
import type { TileKindDef } from "./types";

export function useTileKinds() {
  const [tileKinds, setTileKinds] = useState<TileKindDef[]>(() =>
    getBuiltinTileKinds()
  );
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const next = await listTileKinds();
      setTileKinds(next);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { tileKinds, loaded, refresh };
}
