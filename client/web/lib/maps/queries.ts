import { createClient } from "@/lib/supabase/client";
import {
  defaultMapDefinition,
  mapRowToDefinition,
} from "@/lib/bus-stop-demo/data";
import type { MapDefinition, MapFeature } from "@/lib/bus-stop-demo/types";

// 読み取りはブラウザクライアント (anon) で直接 Supabase を叩く。
// 書き込みは Route Handler 経由で service_role を使う。

export async function listMaps(): Promise<MapDefinition[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("maps")
    .select("id, slug, name, rows, cols, grid, features, is_default, updated_at")
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[maps] listMaps", error.message, error.code, error.details);
    return [];
  }
  return (data ?? []).map(mapRowToDefinition);
}

export async function getMap(id: string): Promise<MapDefinition | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("maps")
    .select("id, slug, name, rows, cols, grid, features, is_default, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[maps] getMap", error.message, error.code, error.details);
    return null;
  }
  return data ? mapRowToDefinition(data) : null;
}

export async function getDefaultMap(): Promise<MapDefinition> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("maps")
    .select("id, slug, name, rows, cols, grid, features, is_default, updated_at")
    .eq("is_default", true)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      console.error(
        "[maps] getDefaultMap",
        error.message,
        error.code,
        error.details
      );
    }
    return defaultMapDefinition;
  }
  return mapRowToDefinition(data);
}

type MapWriteInput = {
  slug?: string;
  name: string;
  rows: number;
  cols: number;
  grid: string[];
  features: MapFeature[];
  isDefault?: boolean;
};

export async function createMap(input: MapWriteInput): Promise<MapDefinition> {
  const response = await fetch("/api/maps", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(`createMap failed: ${response.status}`);
  }
  return (await response.json()) as MapDefinition;
}

export async function updateMap(
  id: string,
  patch: Partial<MapWriteInput>
): Promise<MapDefinition> {
  const response = await fetch(`/api/maps/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!response.ok) {
    throw new Error(`updateMap failed: ${response.status}`);
  }
  return (await response.json()) as MapDefinition;
}

export async function deleteMap(id: string): Promise<void> {
  const response = await fetch(`/api/maps/${id}`, { method: "DELETE" });
  if (!response.ok) {
    throw new Error(`deleteMap failed: ${response.status}`);
  }
}

export async function setDefaultMap(id: string): Promise<void> {
  const response = await fetch(`/api/maps/${id}/default`, { method: "POST" });
  if (!response.ok) {
    throw new Error(`setDefaultMap failed: ${response.status}`);
  }
}
