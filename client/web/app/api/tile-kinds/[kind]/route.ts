import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { tileRowToDef } from "@/lib/tiles/queries";
import type { TileKindPatch } from "@/lib/tiles/types";
import type { Database } from "@/types/database";

type TileKindsUpdate = Database["public"]["Tables"]["tile_kinds"]["Update"];

export const dynamic = "force-dynamic";

const SELECT_COLUMNS =
  "kind, code, label, bg_color, emoji, is_building, is_builtin, sort_order, updated_at";

// 削除されたタイルが grid 内で使われていた場合、草地 (g) に置換する。
const FALLBACK_CODE = "g";

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ kind: string }> }
) {
  const { kind } = await ctx.params;
  const payload = (await request.json()) as TileKindPatch;

  const update: TileKindsUpdate = {};
  if (payload.label !== undefined) {
    if (!payload.label.trim()) {
      return NextResponse.json({ error: "label は空にできません" }, { status: 400 });
    }
    update.label = payload.label.trim();
  }
  if (payload.bgColor !== undefined) {
    if (!/^#[0-9a-fA-F]{6}$/.test(payload.bgColor)) {
      return NextResponse.json(
        { error: "bgColor は #RRGGBB 形式で指定してください" },
        { status: 400 }
      );
    }
    update.bg_color = payload.bgColor;
  }
  if (payload.emoji !== undefined) update.emoji = payload.emoji;
  if (payload.isBuilding !== undefined) update.is_building = payload.isBuilding;
  if (payload.sortOrder !== undefined) update.sort_order = payload.sortOrder;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "更新項目がありません" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("tile_kinds")
    .update(update)
    .eq("kind", kind)
    .select(SELECT_COLUMNS)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "update failed" },
      { status: 500 }
    );
  }
  return NextResponse.json(tileRowToDef(data));
}

export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ kind: string }> }
) {
  const { kind } = await ctx.params;
  const supabase = createAdminClient();

  const { data: target, error: fetchError } = await supabase
    .from("tile_kinds")
    .select("kind, code, is_builtin")
    .eq("kind", kind)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!target) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (target.is_builtin) {
    return NextResponse.json(
      { error: "ビルトインタイルは削除できません" },
      { status: 400 }
    );
  }

  // 参照中のマップを全件読み、grid 内の該当 code を草地に置換
  const { data: maps, error: mapsError } = await supabase
    .from("maps")
    .select("id, grid");
  if (mapsError) {
    return NextResponse.json({ error: mapsError.message }, { status: 500 });
  }

  for (const row of maps ?? []) {
    if (!row.grid.some((line) => line.includes(target.code))) continue;
    const nextGrid = row.grid.map((line) =>
      line.split("").map((ch) => (ch === target.code ? FALLBACK_CODE : ch)).join("")
    );
    const { error: updateError } = await supabase
      .from("maps")
      .update({ grid: nextGrid })
      .eq("id", row.id);
    if (updateError) {
      return NextResponse.json(
        { error: `マップ更新に失敗しました: ${updateError.message}` },
        { status: 500 }
      );
    }
  }

  const { error: deleteError } = await supabase
    .from("tile_kinds")
    .delete()
    .eq("kind", kind);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
