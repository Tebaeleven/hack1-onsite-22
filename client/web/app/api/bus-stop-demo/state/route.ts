import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createInitialDemoState } from "@/lib/bus-stop-demo/data";
import type { DemoState } from "@/lib/bus-stop-demo/types";

export const dynamic = "force-dynamic";

const SINGLETON_ID = "singleton";

function isDemoState(value: unknown): value is DemoState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { updatedAt?: unknown };
  return typeof candidate.updatedAt === "string" && candidate.updatedAt.length > 0;
}

export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("demo_states")
    .select("state")
    .eq("id", SINGLETON_ID)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const stored = data?.state;
  if (isDemoState(stored)) {
    return NextResponse.json(stored);
  }
  // 初期行は '{}'::jsonb で入っているので、未publishの間は初期DemoStateを返す
  return NextResponse.json(createInitialDemoState());
}

export async function POST(request: Request) {
  const incoming = (await request.json()) as DemoState;

  if (!isDemoState(incoming)) {
    return NextResponse.json(
      { error: "Invalid demo state payload" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // サーバ側 LWW: 現在行の state.updatedAt より新しい場合のみ UPSERT
  const { data: current, error: selectError } = await supabase
    .from("demo_states")
    .select("state")
    .eq("id", SINGLETON_ID)
    .maybeSingle();

  if (selectError) {
    return NextResponse.json({ error: selectError.message }, { status: 500 });
  }

  const currentUpdatedAt = isDemoState(current?.state)
    ? current!.state.updatedAt
    : "";

  if (currentUpdatedAt && incoming.updatedAt <= currentUpdatedAt) {
    // 古い更新は無視（遅延配信パケットによる巻き戻し防止）
    const stored = isDemoState(current?.state) ? current!.state : incoming;
    return NextResponse.json(stored);
  }

  const { data, error } = await supabase
    .from("demo_states")
    .upsert(
      { id: SINGLETON_ID, state: incoming as never },
      { onConflict: "id" }
    )
    .select("state")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "upsert failed" },
      { status: 500 }
    );
  }

  return NextResponse.json(data.state);
}
