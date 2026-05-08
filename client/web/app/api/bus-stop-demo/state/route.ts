import { NextResponse } from "next/server";
import { createInitialDemoState } from "@/lib/bus-stop-demo/data";
import type { DemoState } from "@/lib/bus-stop-demo/types";

export const dynamic = "force-dynamic";

type DemoStateStore = {
  state?: DemoState;
};

const store = globalThis as typeof globalThis & {
  __busStopDemo?: DemoStateStore;
};

function getStore() {
  store.__busStopDemo ??= {};
  store.__busStopDemo.state ??= createInitialDemoState();
  return store.__busStopDemo;
}

export async function GET() {
  return NextResponse.json(getStore().state);
}

export async function POST(request: Request) {
  const incoming = (await request.json()) as DemoState;

  if (!incoming || typeof incoming !== "object" || !incoming.updatedAt) {
    return NextResponse.json(
      { error: "Invalid demo state payload" },
      { status: 400 }
    );
  }

  const current = getStore().state;
  if (!current || incoming.updatedAt >= current.updatedAt) {
    getStore().state = incoming;
  }

  return NextResponse.json(getStore().state);
}
