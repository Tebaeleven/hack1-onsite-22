import { createClient } from "@/lib/supabase/client";
import {
  TILE_KINDS,
  TILE_KIND_LABEL,
  TILE_KIND_TO_CODE,
} from "@/lib/bus-stop-demo/data";
import type { TileKind } from "@/lib/bus-stop-demo/types";
import type {
  TileKindDef,
  TileKindPatch,
  TileKindWriteInput,
} from "./types";

// Supabase 行 (snake_case) → TileKindDef (camelCase) 変換。
export function tileRowToDef(row: {
  kind: string;
  code: string;
  label: string;
  bg_color: string;
  emoji: string;
  is_building: boolean;
  is_builtin: boolean;
  sort_order: number;
  updated_at: string;
}): TileKindDef {
  return {
    kind: row.kind,
    code: row.code,
    label: row.label,
    bgColor: row.bg_color,
    emoji: row.emoji,
    isBuilding: row.is_building,
    isBuiltin: row.is_builtin,
    sortOrder: row.sort_order,
    updatedAt: row.updated_at,
  };
}

const builtinBgByKind: Record<TileKind, string> = {
  grass: "#78c95e",
  road: "#9fb0b8",
  intersection: "#97aab4",
  house: "#80ce62",
  shop: "#d8b85c",
  company: "#87d6e7",
  hospital: "#f8aeba",
  school: "#c3a7f6",
  station: "#95d8f6",
  park: "#86d968",
  tree: "#6fbe55",
  busStop: "#fff2b8",
};

const builtinEmojiByKind: Record<TileKind, string> = {
  grass: "",
  road: "",
  intersection: "✚",
  house: "🏠",
  shop: "🏪",
  company: "🏢",
  hospital: "🏥",
  school: "🎓",
  station: "🚉",
  park: "🎪",
  tree: "🌳",
  busStop: "🚌",
};

const builtinIsBuilding: Record<TileKind, boolean> = {
  grass: false,
  road: false,
  intersection: false,
  house: true,
  shop: true,
  company: true,
  hospital: true,
  school: true,
  station: true,
  park: false,
  tree: false,
  busStop: false,
};

const builtinSortOrder: Record<TileKind, number> = {
  grass: 10,
  road: 20,
  intersection: 30,
  house: 110,
  shop: 120,
  company: 130,
  hospital: 140,
  school: 150,
  station: 160,
  park: 200,
  tree: 210,
  busStop: 220,
};

// DB 未到達 / 接続失敗時のフォールバック (組み込み 12 種)。
export function getBuiltinTileKinds(): TileKindDef[] {
  return TILE_KINDS.map((kind) => ({
    kind,
    code: TILE_KIND_TO_CODE[kind],
    label: TILE_KIND_LABEL[kind],
    bgColor: builtinBgByKind[kind],
    emoji: builtinEmojiByKind[kind],
    isBuilding: builtinIsBuilding[kind],
    isBuiltin: true,
    sortOrder: builtinSortOrder[kind],
    updatedAt: "1970-01-01T00:00:00.000Z",
  }));
}

export async function listTileKinds(): Promise<TileKindDef[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tile_kinds")
    .select(
      "kind, code, label, bg_color, emoji, is_building, is_builtin, sort_order, updated_at"
    )
    .order("sort_order", { ascending: true })
    .order("kind", { ascending: true });

  if (error) {
    console.error(
      "[tile_kinds] listTileKinds",
      error.message,
      error.code,
      error.details
    );
    return getBuiltinTileKinds();
  }
  if (!data || data.length === 0) return getBuiltinTileKinds();
  return data.map(tileRowToDef);
}

export async function createTileKind(input: TileKindWriteInput): Promise<TileKindDef> {
  const response = await fetch("/api/tile-kinds", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `createTileKind failed: ${response.status}`);
  }
  return (await response.json()) as TileKindDef;
}

export async function updateTileKind(
  kind: string,
  patch: TileKindPatch
): Promise<TileKindDef> {
  const response = await fetch(`/api/tile-kinds/${encodeURIComponent(kind)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `updateTileKind failed: ${response.status}`);
  }
  return (await response.json()) as TileKindDef;
}

export async function deleteTileKind(kind: string): Promise<void> {
  const response = await fetch(`/api/tile-kinds/${encodeURIComponent(kind)}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `deleteTileKind failed: ${response.status}`);
  }
}
