import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapRowToDefinition } from "@/lib/bus-stop-demo/data";
import type { MapFeature } from "@/lib/bus-stop-demo/types";

export const dynamic = "force-dynamic";

const SELECT_COLUMNS =
  "id, slug, name, rows, cols, grid, features, is_default, updated_at";

type CreateMapPayload = {
  slug?: string;
  name?: string;
  rows?: number;
  cols?: number;
  grid?: string[];
  features?: MapFeature[];
  isDefault?: boolean;
};

function makeSlug(name: string) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${base || "map"}-${suffix}`;
}

export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("maps")
    .select(SELECT_COLUMNS)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json((data ?? []).map(mapRowToDefinition));
}

export async function POST(request: Request) {
  const payload = (await request.json()) as CreateMapPayload;

  if (
    !payload.name ||
    !Array.isArray(payload.grid) ||
    typeof payload.rows !== "number" ||
    typeof payload.cols !== "number"
  ) {
    return NextResponse.json(
      { error: "name, rows, cols, grid は必須です" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("maps")
    .insert({
      slug: payload.slug ?? makeSlug(payload.name),
      name: payload.name,
      rows: payload.rows,
      cols: payload.cols,
      grid: payload.grid,
      features: (payload.features ?? []) as never,
      is_default: payload.isDefault ?? false,
    })
    .select(SELECT_COLUMNS)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "create failed" },
      { status: 500 }
    );
  }

  return NextResponse.json(mapRowToDefinition(data), { status: 201 });
}
