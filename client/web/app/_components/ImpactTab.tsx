"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Badge } from "@/components/ui/badge";
import { ALL_ROLES, ROLE_META } from "@/lib/profiles/types";
import { useStats } from "@/lib/stats/use-stats";
import { getLocation } from "@/lib/bus-stop-demo/data";
import type {
  MapDefinition,
  MoveRequest,
  RobotStatus,
  ScenarioId,
} from "@/lib/bus-stop-demo/types";
import { eventDefinitions } from "@/lib/events/data";

const SCENARIOS: { id: ScenarioId; label: string; emoji: string }[] = [
  { id: "medical", label: "医療", emoji: "🏥" },
  { id: "shopping", label: "買い物", emoji: "🛒" },
  { id: "student", label: "学生", emoji: "🎓" },
  { id: "business", label: "企業", emoji: "🏢" },
];

const robotStatusLabel: Record<RobotStatus, string> = {
  idle: "待機中",
  moving: "移動中",
  arrived: "到着",
  guiding: "案内中",
};

export function ImpactTab({
  map,
  allRequests,
  robotStatus,
}: {
  map: MapDefinition;
  allRequests: MoveRequest[];
  robotStatus: RobotStatus;
}) {
  const stats = useStats();

  // === KPI ===
  const totalRequests = allRequests.length;
  const adoptedRequests = allRequests.filter((r) => r.status === "adopted").length;
  const totalReactions = stats.reactions.totalCount;
  const uniqueSupporters = stats.reactions.uniqueSupporterIds.length;
  const totalDistance = stats.commandLogs.reduce((s, l) => s + l.distance, 0);
  const totalCommands = stats.commandLogs.length;

  // === Chart 1: 申請別の応援数 (上位10件、ベース + アカウント応援) ===
  const requestSupportData = useMemo(() => {
    return allRequests
      .map((r) => {
        const baseSupport =
          r.reactions.wantToGo + r.reactions.helpful + r.reactions.cheer;
        const accountSupport = stats.reactions.countsByRequest[r.id] ?? 0;
        const total = baseSupport + accountSupport;
        return {
          id: r.id,
          name: truncate(r.title, 14),
          base: baseSupport,
          account: accountSupport,
          total,
        };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [allRequests, stats.reactions.countsByRequest]);

  // === Chart 2: シナリオ別の申請数（候補 vs 採択） ===
  const scenarioData = useMemo(
    () =>
      SCENARIOS.map(({ id, label }) => {
        const subset = allRequests.filter((r) => r.scenarioId === id);
        const candidate = subset.filter((r) => r.status !== "adopted").length;
        const adopted = subset.filter((r) => r.status === "adopted").length;
        return { name: label, candidate, adopted };
      }),
    [allRequests]
  );

  // === Chart 3: 応援種別の内訳 (PieChart) ===
  const reactionKindData = [
    {
      name: "行きたい",
      value: stats.reactions.countsByKind.wantToGo,
      fill: "var(--chart-1)",
    },
    {
      name: "助かる",
      value: stats.reactions.countsByKind.helpful,
      fill: "var(--chart-2)",
    },
    {
      name: "応援する",
      value: stats.reactions.countsByKind.cheer,
      fill: "var(--chart-3)",
    },
  ];

  // === Chart 4: ロール別の応援者数 ===
  const roleData = useMemo(
    () =>
      ALL_ROLES.map((role) => ({
        name: ROLE_META[role].label,
        emoji: ROLE_META[role].emoji,
        count: stats.supportersByRole[role] ?? 0,
      })),
    [stats.supportersByRole]
  );

  // === Chart 5: 移動履歴 (BarChart 時系列、最新 12 件) ===
  const commandHistoryData = useMemo(() => {
    const recent = stats.commandLogs.slice(-12);
    return recent.map((log, idx) => {
      const fromName = safeLocationName(log.fromLocationId, map);
      const toName = safeLocationName(log.toLocationId, map);
      return {
        index: `#${stats.commandLogs.length - recent.length + idx + 1}`,
        distance: log.distance,
        from: fromName,
        to: toName,
        label: `${fromName} → ${toName}`,
      };
    });
  }, [stats.commandLogs, map]);

  // === Chart 6: 場所別の人気度 (合計応援を destinationId で集計) ===
  const destinationData = useMemo(() => {
    const buckets: Record<string, { name: string; count: number }> = {};
    for (const r of allRequests) {
      const dest = getLocation(r.destinationId, map);
      const baseSupport =
        r.reactions.wantToGo + r.reactions.helpful + r.reactions.cheer;
      const account = stats.reactions.countsByRequest[r.id] ?? 0;
      const key = dest.id;
      buckets[key] = buckets[key] ?? { name: dest.shortName, count: 0 };
      buckets[key].count += baseSupport + account;
    }
    return Object.values(buckets)
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [allRequests, map, stats.reactions.countsByRequest]);

  // === Chart 7: コメント数 (申請 vs イベント、上位対象) ===
  const commentData = useMemo(() => {
    const items: Array<{ name: string; kind: "request" | "event"; count: number }> = [];
    for (const r of allRequests) {
      const c = stats.comments.byTargetKindAndId[`request:${r.id}`] ?? 0;
      if (c > 0) items.push({ name: truncate(r.title, 12), kind: "request", count: c });
    }
    for (const e of eventDefinitions) {
      const c = stats.comments.byTargetKindAndId[`event:${e.id}`] ?? 0;
      if (c > 0) items.push({ name: truncate(e.title, 12), kind: "event", count: c });
    }
    return items.sort((a, b) => b.count - a.count).slice(0, 8);
  }, [allRequests, stats.comments.byTargetKindAndId]);

  return (
    <section className="flex flex-col gap-4">
      <header className="rounded-[1.5rem] border-4 border-[#313131] bg-white p-4 shadow-[0_6px_0_#313131]">
        <Badge className="rounded-full bg-[#ff9600] text-white">
          ダッシュボード
        </Badge>
        <h2 className="mt-2 text-2xl font-black">地域インパクト指標</h2>
        <p className="mt-1 text-xs font-bold text-[#53635a]">
          住民の声・申請・指令・コメント・乗車予約をまとめて見える化します。
          ロボット状態: <span className="text-[#3a7d00]">{robotStatusLabel[robotStatus]}</span>
        </p>
      </header>

      {/* KPI 6 タイル */}
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <KpiCard label="累計 申請件数" value={totalRequests} suffix="件" />
        <KpiCard label="採択済み" value={adoptedRequests} suffix="件" tone="green" />
        <KpiCard label="累計 応援投票" value={totalReactions} suffix="票" tone="blue" />
        <KpiCard
          label="ユニーク応援者"
          value={uniqueSupporters}
          suffix="人"
          tone="orange"
        />
        <KpiCard
          label="ロボット移動マス"
          value={totalDistance}
          suffix="マス"
          tone="purple"
        />
        <KpiCard label="指令発行" value={totalCommands} suffix="回" tone="red" />
      </section>

      {/* Chart 1 */}
      <ChartCard
        title="申請別の応援数 上位10件"
        description="ベース応援(申請プリセット)とアカウント応援(投票)の積み上げ。"
        empty={requestSupportData.length === 0}
      >
        <ChartContainer
          config={
            {
              base: { label: "ベース", color: "var(--chart-2)" },
              account: { label: "アカウント", color: "var(--chart-1)" },
            } satisfies ChartConfig
          }
          className="aspect-auto h-[260px] w-full"
        >
          <BarChart data={requestSupportData} layout="vertical" margin={{ left: 4 }}>
            <CartesianGrid horizontal={false} />
            <YAxis
              dataKey="name"
              type="category"
              tickLine={false}
              axisLine={false}
              width={110}
              tick={{ fontSize: 11 }}
            />
            <XAxis type="number" hide />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="base" stackId="a" fill="var(--color-base)" radius={[4, 0, 0, 4]} />
            <Bar
              dataKey="account"
              stackId="a"
              fill="var(--color-account)"
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ChartContainer>
      </ChartCard>

      {/* Chart 2 */}
      <ChartCard
        title="シナリオ別の申請件数"
        description="医療 / 買い物 / 学生 / 企業 ごとの候補と採択の比較。"
      >
        <ChartContainer
          config={
            {
              candidate: { label: "候補", color: "var(--chart-4)" },
              adopted: { label: "採択", color: "var(--chart-1)" },
            } satisfies ChartConfig
          }
          className="aspect-auto h-[240px] w-full"
        >
          <BarChart data={scenarioData}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="name" tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="candidate" stackId="b" fill="var(--color-candidate)" radius={[0, 0, 4, 4]} />
            <Bar dataKey="adopted" stackId="b" fill="var(--color-adopted)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </ChartCard>

      {/* Chart 3 + 4 を横並び (sm 以上) */}
      <div className="grid gap-4 sm:grid-cols-2">
        <ChartCard
          title="応援の種別内訳"
          description="アカウント応援だけを対象にした集計。"
          empty={totalReactions === 0}
        >
          <ChartContainer
            config={
              {
                value: { label: "件数" },
              } satisfies ChartConfig
            }
            className="aspect-square max-h-[240px] w-full"
          >
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent hideLabel />} />
              <Pie
                data={reactionKindData}
                dataKey="value"
                nameKey="name"
                innerRadius={50}
                outerRadius={90}
                paddingAngle={2}
              >
                {reactionKindData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.fill} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
          <ul className="mt-2 grid grid-cols-3 gap-1 text-center text-[10px] font-black">
            {reactionKindData.map((entry) => (
              <li key={entry.name} className="rounded-xl bg-[#f3f7f2] p-1.5">
                <span
                  className="mb-0.5 inline-block size-2 rounded-full"
                  style={{ backgroundColor: entry.fill }}
                />{" "}
                {entry.name} {entry.value}
              </li>
            ))}
          </ul>
        </ChartCard>

        <ChartCard
          title="ロール別の応援者"
          description="プロフィールのロール設定を集計。"
          empty={uniqueSupporters === 0}
        >
          <ChartContainer
            config={
              { count: { label: "応援者", color: "var(--chart-3)" } } satisfies ChartConfig
            }
            className="aspect-auto h-[240px] w-full"
          >
            <BarChart data={roleData}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="name"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10 }}
                interval={0}
              />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill="var(--color-count)" radius={4} />
            </BarChart>
          </ChartContainer>
        </ChartCard>
      </div>

      {/* Chart 5: 移動履歴 */}
      <ChartCard
        title="ロボットの移動履歴"
        description={`直近 ${commandHistoryData.length} 件の指令。X 軸は指令番号、Y 軸は移動マス数。`}
        empty={commandHistoryData.length === 0}
      >
        <ChartContainer
          config={
            { distance: { label: "マス数", color: "var(--chart-5)" } } satisfies ChartConfig
          }
          className="aspect-auto h-[240px] w-full"
        >
          <BarChart data={commandHistoryData}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="index"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10 }}
            />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(_label, items) => {
                    const item = items[0]?.payload as
                      | (typeof commandHistoryData)[number]
                      | undefined;
                    return item?.label ?? "";
                  }}
                />
              }
            />
            <Bar dataKey="distance" fill="var(--color-distance)" radius={4} />
          </BarChart>
        </ChartContainer>
      </ChartCard>

      {/* Chart 6: 場所別の人気度 */}
      <ChartCard
        title="目的地別の人気度"
        description="申請ベース応援+アカウント応援を destination ごとに合算。"
        empty={destinationData.length === 0}
      >
        <ChartContainer
          config={
            {
              count: { label: "応援合計", color: "var(--chart-1)" },
            } satisfies ChartConfig
          }
          className="aspect-auto h-[240px] w-full"
        >
          <BarChart data={destinationData} layout="vertical">
            <CartesianGrid horizontal={false} />
            <YAxis
              dataKey="name"
              type="category"
              tickLine={false}
              axisLine={false}
              width={90}
              tick={{ fontSize: 11 }}
            />
            <XAxis type="number" hide />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="count" fill="var(--color-count)" radius={4} />
          </BarChart>
        </ChartContainer>
      </ChartCard>

      {/* Chart 7: コメント数 */}
      <ChartCard
        title="コメントが集まっている対象"
        description="申請とイベントの両方を含む。多い順に上位 8 件。"
        empty={commentData.length === 0}
      >
        <ChartContainer
          config={
            {
              count: { label: "コメント数", color: "var(--chart-2)" },
            } satisfies ChartConfig
          }
          className="aspect-auto h-[240px] w-full"
        >
          <BarChart data={commentData} layout="vertical">
            <CartesianGrid horizontal={false} />
            <YAxis
              dataKey="name"
              type="category"
              tickLine={false}
              axisLine={false}
              width={100}
              tick={{ fontSize: 11 }}
            />
            <XAxis type="number" hide allowDecimals={false} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(_label, items) => {
                    const item = items[0]?.payload as
                      | (typeof commentData)[number]
                      | undefined;
                    return item ? `${item.kind === "event" ? "🎪 イベント" : "📋 申請"}` : "";
                  }}
                />
              }
            />
            <Bar dataKey="count" fill="var(--color-count)" radius={4} />
          </BarChart>
        </ChartContainer>
      </ChartCard>

      {/* Footer サマリ */}
      <section className="rounded-[1.5rem] border-4 border-[#313131] bg-[#fff8d8] p-4 shadow-[0_6px_0_#313131]">
        <Badge className="rounded-full bg-[#9c6500] text-white">サマリ</Badge>
        <h3 className="mt-2 text-lg font-black">この瞬間の地域</h3>
        <ul className="mt-2 grid gap-1 text-xs font-bold text-[#53635a]">
          <li>
            申請 <b>{totalRequests}</b> 件のうち <b className="text-[#3a7d00]">{adoptedRequests}</b> 件が採択され、ロボットが <b>{totalDistance}</b> マス動きました。
          </li>
          <li>
            <b>{uniqueSupporters}</b> 人が <b>{totalReactions}</b> 票投じ、コメントは申請に <b>{stats.comments.byTargetKind.request}</b> 件 / イベントに <b>{stats.comments.byTargetKind.event}</b> 件。
          </li>
          <li>
            乗車予約は累計 <b>{stats.rideIntentTotal}</b> 件です。
          </li>
        </ul>
      </section>
    </section>
  );
}

function KpiCard({
  label,
  value,
  suffix,
  tone = "default",
}: {
  label: string;
  value: number;
  suffix: string;
  tone?: "default" | "green" | "blue" | "orange" | "purple" | "red";
}) {
  const accentClass =
    tone === "green"
      ? "text-[#3a7d00]"
      : tone === "blue"
      ? "text-[#1cb0f6]"
      : tone === "orange"
      ? "text-[#ff9600]"
      : tone === "purple"
      ? "text-[#9c6dff]"
      : tone === "red"
      ? "text-[#ff4b4b]"
      : "text-[#25302b]";
  return (
    <div className="rounded-2xl border-2 border-[#313131] bg-white p-3 shadow-[0_3px_0_#313131]">
      <p className="truncate text-[10px] font-black text-[#53635a]">{label}</p>
      <p className={`mt-1 text-2xl font-black tabular-nums ${accentClass}`}>
        {value}
        <span className="ml-0.5 text-xs">{suffix}</span>
      </p>
    </div>
  );
}

function ChartCard({
  title,
  description,
  empty = false,
  children,
}: {
  title: string;
  description?: string;
  empty?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[1.5rem] border-4 border-[#313131] bg-white p-4 shadow-[0_6px_0_#313131]">
      <h3 className="text-base font-black">{title}</h3>
      {description ? (
        <p className="mt-0.5 text-xs font-bold text-[#53635a]">{description}</p>
      ) : null}
      <div className="mt-3">
        {empty ? (
          <p className="rounded-2xl bg-[#f3f7f2] p-4 text-center text-xs font-bold text-[#53635a]">
            データがまだありません。
          </p>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

function safeLocationName(id: string, map: MapDefinition) {
  try {
    const loc = getLocation(id, map);
    return loc.shortName;
  } catch {
    return id;
  }
}

function truncate(s: string, max: number) {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}
