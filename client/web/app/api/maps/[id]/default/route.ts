import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// 部分インデックス maps_only_one_default のため、
// 「他をfalseにしてから対象をtrue」の順で更新する必要がある。
export async function POST(
  _request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const supabase = createAdminClient();

  const { error: clearError } = await supabase
    .from("maps")
    .update({ is_default: false })
    .eq("is_default", true)
    .neq("id", id);
  if (clearError) {
    return NextResponse.json({ error: clearError.message }, { status: 500 });
  }

  const { error } = await supabase
    .from("maps")
    .update({ is_default: true })
    .eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
