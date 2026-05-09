import { ImageResponse } from "next/og";
import { createAdminClient } from "@/lib/supabase/admin";
import { defaultMapDefinition, getLocation } from "@/lib/bus-stop-demo/data";
import type { DemoState, MoveRequest } from "@/lib/bus-stop-demo/types";

export const alt = "みんなで動かすバス停ロボット";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

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

export default async function OgImage({
  params,
}: {
  params: { id: string };
}) {
  const request = await fetchRequest(params.id);
  const title = request?.title ?? "みんなで動かすバス停ロボット";
  const destLabel = request
    ? getLocation(request.destinationId, defaultMapDefinition).name
    : "地域の声で動く";
  const status = request?.status === "adopted" ? "採択中" : "候補";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#dff8f2",
          padding: 64,
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
            marginBottom: 32,
          }}
        >
          <div
            style={{
              fontSize: 96,
              width: 120,
              height: 120,
              borderRadius: 32,
              background: "#58cc02",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            🚌
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ color: "#3a7d00", fontSize: 28, fontWeight: 900 }}>
              みんなで動かす
            </div>
            <div
              style={{ color: "#25302b", fontSize: 64, fontWeight: 900 }}
            >
              バス停ロボット
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              padding: "8px 24px",
              background: status === "採択中" ? "#58cc02" : "#1cb0f6",
              color: "white",
              borderRadius: 999,
              fontSize: 24,
              fontWeight: 900,
            }}
          >
            {status}
          </div>
          <div
            style={{
              padding: "8px 24px",
              background: "#ff9600",
              color: "white",
              borderRadius: 999,
              fontSize: 24,
              fontWeight: 900,
            }}
          >
            {destLabel}
          </div>
        </div>

        <div
          style={{
            fontSize: 56,
            fontWeight: 900,
            color: "#25302b",
            lineHeight: 1.2,
            display: "flex",
            flexWrap: "wrap",
          }}
        >
          {title}
        </div>

        <div
          style={{
            marginTop: "auto",
            color: "#53635a",
            fontSize: 28,
            fontWeight: 900,
          }}
        >
          地域の声でバス停が動く #バス停ロボット
        </div>
      </div>
    ),
    { ...size }
  );
}
