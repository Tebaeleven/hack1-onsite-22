import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapRowToDefinition } from "@/lib/bus-stop-demo/data";
import type { MapFeature } from "@/lib/bus-stop-demo/types";
import type { Database, Json } from "@/types/database";

type MapsUpdate = Database["public"]["Tables"]["maps"]["Update"];

export const dynamic = "force-dynamic";

const SELECT_COLUMNS =
  "id, slug, name, rows, cols, grid, features, is_default, updated_at";

type UpdateMapPayload = {
  name?: string;
  rows?: number;
  cols?: number;
  grid?: string[];
  features?: MapFeature[];
  isDefault?: boolean;
};

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("maps")
    .select(SELECT_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(mapRowToDefinition(data));
}

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const payload = (await request.json()) as UpdateMapPayload;

  const update: MapsUpdate = {};
  if (payload.name !== undefined) update.name = payload.name;
  if (payload.rows !== undefined) update.rows = payload.rows;
  if (payload.cols !== undefined) update.cols = payload.cols;
  if (payload.grid !== undefined) update.grid = payload.grid;
  if (payload.features !== undefined) update.features = payload.features as Json;
  if (payload.isDefault !== undefined) update.is_default = payload.isDefault;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "更新項目がありません" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("maps")
    .update(update)
    .eq("id", id)
    .select(SELECT_COLUMNS)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "update failed" },
      { status: 500 }
    );
  }
  return NextResponse.json(mapRowToDefinition(data));
}

export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const supabase = createAdminClient();

  // デフォルトマップは削除不可
  const { data: target } = await supabase
    .from("maps")
    .select("is_default")
    .eq("id", id)
    .maybeSingle();
  if (target?.is_default) {
    return NextResponse.json(
      { error: "デフォルトマップは削除できません" },
      { status: 400 }
    );
  }

  const { error } = await supabase.from("maps").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
