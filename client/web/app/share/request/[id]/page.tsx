import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { defaultMapDefinition, getLocation } from "@/lib/bus-stop-demo/data";
import type { DemoState, MoveRequest } from "@/lib/bus-stop-demo/types";

const SINGLETON_ID = "singleton";

function isDemoState(value: unknown): value is DemoState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { updatedAt?: unknown; requests?: unknown };
  return (
    typeof candidate.updatedAt === "string" &&
    Array.isArray(candidate.requests)
  );
}

async function fetchRequest(id: string): Promise<MoveRequest | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("demo_states")
    .select("state")
    .eq("id", SINGLETON_ID)
    .maybeSingle();
  if (error || !data || !isDemoState(data.state)) return null;
  return data.state.requests.find((r) => r.id === id) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const request = await fetchRequest(id);
  if (!request) {
    return { title: "申請が見つかりません" };
  }
  const dest = getLocation(request.destinationId, defaultMapDefinition);
  const title = `${request.title} | みんなで動かすバス停ロボット`;
  const description = `${dest.name}へバス停ロボットが向かいます。${request.aiReason}`;
  return {
    title,
    description,
    openGraph: { title, description, type: "article" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const request = await fetchRequest(id);
  if (!request) notFound();

  const dest = getLocation(request.destinationId, defaultMapDefinition);
  const isAdopted = request.status === "adopted";

  return (
    <main className="flex min-h-svh items-center justify-center bg-[#dff8f2] p-6">
      <article className="flex w-full max-w-md flex-col gap-4 rounded-[1.5rem] border-4 border-[#313131] bg-white p-6 shadow-[0_8px_0_#313131]">
        <header className="flex items-center gap-3">
          <span
            className="grid size-14 place-items-center rounded-2xl text-3xl text-white shadow-[0_4px_0_rgba(0,0,0,0.2)]"
            style={{ backgroundColor: dest.color }}
          >
            {dest.icon}
          </span>
          <div>
            <p className="text-xs font-black text-[#58a700]">
              みんなで動かすバス停ロボット
            </p>
            <h1 className="text-xl font-black leading-tight">{request.title}</h1>
          </div>
        </header>

        <p className="rounded-2xl bg-[#fff8d8] p-3 text-sm font-bold">
          {isAdopted
            ? `🎉 ${dest.name}への申請が採択されました！`
            : `${dest.name}への申請が応援を集めています。`}
        </p>

        <section className="rounded-2xl bg-[#f3f7f2] p-3">
          <p className="text-xs font-black text-[#53635a]">採択の理由</p>
          <p className="mt-1 text-sm font-bold">{request.aiReason}</p>
        </section>

        {request.beforeAfter.length > 0 ? (
          <section className="grid gap-2">
            {request.beforeAfter.map((m) => (
              <div key={m.label} className="rounded-2xl bg-[#e8ffd9] p-3">
                <p className="text-xs font-black text-[#3a7d00]">{m.label}</p>
                <p className="mt-1 text-base font-black">
                  <span className="text-[#ff4b4b]">{m.before}</span>
                  <span className="px-2 text-[#53635a]">→</span>
                  <span className="text-[#3a7d00]">{m.after}</span>
                </p>
              </div>
            ))}
          </section>
        ) : null}

        <Link
          href="/demo"
          className="grid h-12 place-items-center rounded-2xl bg-[#1cb0f6] text-sm font-black text-white shadow-[0_4px_0_#0b82bd]"
        >
          アプリで応援する
        </Link>
      </article>
    </main>
  );
}
