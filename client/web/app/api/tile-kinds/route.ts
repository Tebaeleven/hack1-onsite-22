import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { tileRowToDef } from "@/lib/tiles/queries";
import type { TileKindWriteInput } from "@/lib/tiles/types";

export const dynamic = "force-dynamic";

const SELECT_COLUMNS =
  "kind, code, label, bg_color, emoji, is_building, is_builtin, sort_order, updated_at";

const KIND_PATTERN = /^[a-z][a-zA-Z0-9_-]{0,31}$/;

function validateKind(kind: unknown): string | null {
  if (typeof kind !== "string") return "kind は文字列が必須です";
  if (!KIND_PATTERN.test(kind)) {
    return "kind は英小文字始まりの英数字 (1〜32 文字) にしてください";
  }
  return null;
}

function validateCode(code: unknown): string | null {
  if (typeof code !== "string") return "code は文字列が必須です";
  // 1 文字 (絵文字記号 + サロゲート対応も考慮し Array.from で長さ判定)
  if (Array.from(code).length !== 1) {
    return "code は 1 文字にしてください";
  }
  return null;
}

export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("tile_kinds")
    .select(SELECT_COLUMNS)
    .order("sort_order", { ascending: true })
    .order("kind", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json((data ?? []).map(tileRowToDef));
}

export async function POST(request: Request) {
  const payload = (await request.json()) as Partial<TileKindWriteInput>;

  const kindError = validateKind(payload.kind);
  if (kindError) return NextResponse.json({ error: kindError }, { status: 400 });
  const codeError = validateCode(payload.code);
  if (codeError) return NextResponse.json({ error: codeError }, { status: 400 });
  if (typeof payload.label !== "string" || !payload.label.trim()) {
    return NextResponse.json({ error: "label は必須です" }, { status: 400 });
  }
  if (typeof payload.bgColor !== "string" || !/^#[0-9a-fA-F]{6}$/.test(payload.bgColor)) {
    return NextResponse.json({ error: "bgColor は #RRGGBB 形式で指定してください" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // ビルトイン kind / code との衝突を拒否
  const { data: existing } = await supabase
    .from("tile_kinds")
    .select("kind, code")
    .or(`kind.eq.${payload.kind},code.eq.${payload.code}`);
  if (existing && existing.length > 0) {
    const conflict = existing[0];
    return NextResponse.json(
      {
        error:
          conflict.kind === payload.kind
            ? `kind "${payload.kind}" は既に存在します`
            : `code "${payload.code}" は既に使われています`,
      },
      { status: 409 }
    );
  }

  const { data, error } = await supabase
    .from("tile_kinds")
    .insert({
      kind: payload.kind!,
      code: payload.code!,
      label: payload.label.trim(),
      bg_color: payload.bgColor,
      emoji: payload.emoji ?? "",
      is_building: payload.isBuilding ?? false,
      is_builtin: false,
      sort_order: payload.sortOrder ?? 100,
    })
    .select(SELECT_COLUMNS)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "create failed" },
      { status: 500 }
    );
  }
  return NextResponse.json(tileRowToDef(data), { status: 201 });
}
