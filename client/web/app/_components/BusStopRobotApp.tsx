"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  BotIcon,
  Building2Icon,
  BusIcon,
  CheckCircle2Icon,
  LayoutGridIcon,
  MapIcon,
  MegaphoneIcon,
  MessageCircleIcon,
  PartyPopperIcon,
  PlusIcon,
  RotateCcwIcon,
  SearchIcon,
  ShieldIcon,
  SparklesIcon,
  Trash2Icon,
  UserIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  REQUEST_SUPPORT_THRESHOLD,
  defaultMapDefinition,
  findRoadRoute,
  getLocation,
  getMapFeature,
  getMapLocations,
  getScenario,
  getTileKind,
  gridKey,
} from "@/lib/bus-stop-demo/data";
import {
  addReaction,
  addRequest,
  getRequestSupportTotal,
  issueCommand,
  removeRequest,
  resetDemoState,
  selectDestination,
  switchScenario,
} from "@/lib/bus-stop-demo/state";
import type {
  GridPoint,
  MapDefinition,
  MoveCommand,
  MoveRequest,
  ReactionKey,
  RequestType,
  RobotStatus,
  ScenarioId,
  TileKind,
} from "@/lib/bus-stop-demo/types";
import { useSyncedDemoState } from "@/lib/bus-stop-demo/use-synced-demo-state";
import { getDefaultMap, listMaps } from "@/lib/maps/queries";
import { useTileKinds } from "@/lib/tiles/use-tile-kinds";
import { cn } from "@/lib/utils";
import { MapManager } from "./MapManager";

type AppTab = "map" | "events" | "requests" | "impact" | "profile" | "maps";
type UserPresetId = "resident" | "senior" | "business" | "admin";
type TileDirections = {
  up: boolean;
  right: boolean;
  down: boolean;
  left: boolean;
};

type UserPreset = {
  id: UserPresetId;
  label: string;
  icon: ReactNode;
  scenarioId: ScenarioId;
  requestType: RequestType;
  defaultReason: string;
  defaultAudience: string;
  defaultNote: string;
};

const statusLabel: Record<RobotStatus, string> = {
  idle: "待機中",
  moving: "移動中",
  arrived: "到着",
  guiding: "案内中",
};

type BottomTab = { id: AppTab; label: string; icon: ReactNode };

const baseBottomTabs: BottomTab[] = [
  { id: "map", label: "マップ", icon: <MapIcon /> },
  { id: "events", label: "イベント", icon: <SearchIcon /> },
  { id: "requests", label: "申請", icon: <MessageCircleIcon /> },
  { id: "impact", label: "効果", icon: <SparklesIcon /> },
  { id: "profile", label: "プロフィール", icon: <UserIcon /> },
];

const adminMapsTab: BottomTab = {
  id: "maps",
  label: "マップ管理",
  icon: <LayoutGridIcon />,
};

const userPresets: UserPreset[] = [
  {
    id: "resident",
    label: "一般人",
    icon: "👤",
    scenarioId: "shopping",
    requestType: "citizen",
    defaultReason: "買い物に行きたい",
    defaultAudience: "買い物客",
    defaultNote: "買い物や地域イベントに行きやすい場所へ来てほしいです。",
  },
  {
    id: "senior",
    label: "高齢者",
    icon: "🧓",
    scenarioId: "medical",
    requestType: "citizen",
    defaultReason: "病院に行きたい",
    defaultAudience: "高齢者",
    defaultNote: "歩く距離を短くして、安心して移動できるようにしたいです。",
  },
  {
    id: "business",
    label: "企業",
    icon: <Building2Icon className="size-5" />,
    scenarioId: "business",
    requestType: "business",
    defaultReason: "採用イベントに人を呼びたい",
    defaultAudience: "企業イベント参加者",
    defaultNote: "参加者が駅から迷わず来られるようにしたいです。",
  },
  {
    id: "admin",
    label: "管理者",
    icon: <ShieldIcon className="size-5" />,
    scenarioId: "shopping",
    requestType: "citizen",
    defaultReason: "地域の声を確認したい",
    defaultAudience: "運営",
    defaultNote: "マップを切り替えて、デモシナリオを管理します。",
  },
];

const userPresetById = Object.fromEntries(
  userPresets.map((preset) => [preset.id, preset])
) as Record<UserPresetId, UserPreset>;

function optionOrFirst(options: string[], preferred: string) {
  return options.includes(preferred) ? preferred : options[0] ?? "";
}

function useMapDefinitions(activeMapId: string | null) {
  const [maps, setMaps] = useState<MapDefinition[]>([]);
  const [defaultMap, setDefaultMap] = useState<MapDefinition>(defaultMapDefinition);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [list, def] = await Promise.all([listMaps(), getDefaultMap()]);
      setMaps(list);
      setDefaultMap(def);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const currentMap =
    (activeMapId ? maps.find((m) => m.id === activeMapId) : null) ?? defaultMap;

  return { maps, currentMap, loaded, refresh };
}

export function BusStopRobotApp() {
  const { state, updateState } = useSyncedDemoState();
  const { maps, currentMap, refresh: refreshMaps } = useMapDefinitions(
    state.activeMapId
  );
  const { tileKinds, refresh: refreshTileKinds } = useTileKinds();
  const [activeTab, setActiveTab] = useState<AppTab>("map");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [profileSetupOpen, setProfileSetupOpen] = useState(true);
  const [requestType, setRequestType] = useState<RequestType>("citizen");
  const [userPresetId, setUserPresetId] = useState<UserPresetId>("senior");
  const [hasSelectedDestination, setHasSelectedDestination] = useState(false);
  const selectedPreset = userPresetById[userPresetId];
  const scenario = getScenario(state.scenarioId);
  const selectedLocation = getLocation(state.selectedDestinationId, currentMap);
  const currentLocation = getLocation(state.currentLocationId, currentMap);
  const bottomTabs = useMemo<BottomTab[]>(
    () => (userPresetId === "admin" ? [...baseBottomTabs, adminMapsTab] : baseBottomTabs),
    [userPresetId]
  );
  const scenarioRequests = useMemo(
    () =>
      state.requests
        .filter((request) => request.scenarioId === state.scenarioId)
        .sort(
          (a, b) =>
            Number(b.status === "adopted") - Number(a.status === "adopted")
        ),
    [state.requests, state.scenarioId]
  );
  const activeRequest =
    scenarioRequests.find((request) => request.status === "adopted") ??
    scenarioRequests[0];

  const totalSupport = scenarioRequests.reduce(
    (total, request) =>
      total +
      request.reactions.wantToGo +
      request.reactions.helpful +
      request.reactions.cheer,
    0
  );

  const openRequestDialog = () => {
    setRequestType(selectedPreset.requestType);
    setDialogOpen(true);
  };

  const handleDestinationSelect = (locationId: string, nextTab: AppTab = "map") => {
    updateState((current) => selectDestination(current, locationId));
    setHasSelectedDestination(true);
    setActiveTab(nextTab);
  };

  const handleReact = (requestId: string, reaction: ReactionKey) => {
    let triggered = false;
    let triggeredRequest: MoveRequest | null = null;
    updateState((current) => {
      const before = current.requests.find((item) => item.id === requestId);
      if (!before) return current;
      const beforeTotal = getRequestSupportTotal(before);
      const reacted = addReaction(current, requestId, reaction);
      if (beforeTotal >= REQUEST_SUPPORT_THRESHOLD) return reacted;
      const after = reacted.requests.find((item) => item.id === requestId);
      if (!after) return reacted;
      const afterTotal = getRequestSupportTotal(after);
      if (afterTotal < REQUEST_SUPPORT_THRESHOLD) return reacted;
      triggered = true;
      triggeredRequest = after;
      const switched =
        after.scenarioId === reacted.scenarioId
          ? reacted
          : switchScenario(reacted, after.scenarioId);
      return issueCommand(switched, requestId, currentMap);
    });

    if (triggered && triggeredRequest) {
      const destination = getLocation(
        (triggeredRequest as MoveRequest).destinationId,
        currentMap
      );
      toast.success("応援が目標に到達しました", {
        description: `${destination.name}へバス停ロボットが向かいます。`,
      });
      setActiveTab("impact");
    }
  };

  const handleRemoveRequest = (requestId: string) => {
    const target = state.requests.find((item) => item.id === requestId);
    const confirmed =
      typeof window !== "undefined"
        ? window.confirm(
            `この申請を削除しますか？\n${target?.title ?? ""}`.trim()
          )
        : true;
    if (!confirmed) return;
    updateState((current) => removeRequest(current, requestId));
    toast.success("申請を削除しました");
  };

  const handleActivateMap = (mapId: string) => {
    updateState((current) => ({
      ...current,
      activeMapId: mapId,
      updatedAt: new Date().toISOString(),
    }));
    toast.success("マップを切り替えました");
  };

  const handlePresetChange = (presetId: UserPresetId, nextTab: AppTab = "map") => {
    const preset = userPresetById[presetId];
    setUserPresetId(presetId);
    setRequestType(preset.requestType);
    updateState((current) => switchScenario(current, preset.scenarioId));
    setHasSelectedDestination(false);
    setActiveTab(nextTab);
  };

  // 管理者から他プロファイルに切り替えたとき、マップ管理タブに居たらマップへ戻す
  useEffect(() => {
    if (userPresetId !== "admin" && activeTab === "maps") {
      setActiveTab("map");
    }
  }, [userPresetId, activeTab]);

  const handleInitialPresetSelect = (presetId: UserPresetId) => {
    handlePresetChange(presetId, "map");
    setHasSelectedDestination(false);
    setProfileSetupOpen(false);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const destinationId = String(
      formData.get("destinationId") ?? state.selectedDestinationId
    );
    const destination = getLocation(destinationId, currentMap);

    updateState((current) =>
      addRequest(
        current,
        {
          requestType,
          title: String(formData.get("title") ?? ""),
          destinationId,
          desiredTime: String(formData.get("desiredTime") ?? ""),
          reason: String(formData.get("reason") ?? scenario.reasonOptions[0]),
          audience: String(formData.get("audience") ?? scenario.audienceOptions[0]),
          note: String(formData.get("note") ?? ""),
          eventName: String(formData.get("eventName") ?? ""),
          expectedPeople: String(formData.get("expectedPeople") ?? ""),
          sponsored: formData.get("sponsored") === "on",
        },
        currentMap
      )
    );

    setDialogOpen(false);
    setHasSelectedDestination(false);
    setActiveTab("requests");
    toast.success("申請を追加しました", {
      description: `${destination.name}への申請に応援が${REQUEST_SUPPORT_THRESHOLD}件集まると指令になります。`,
    });
  };

  return (
    <main className="flex h-svh overflow-hidden bg-[#dff8f2] px-3 pb-[calc(5.75rem+env(safe-area-inset-bottom))] pt-2 text-[#25302b] sm:px-5 sm:pt-3">
      <div
        className={cn(
          "mx-auto flex min-h-0 w-full max-w-[520px] flex-1 flex-col gap-3",
          activeTab === "map" ? "overflow-hidden" : "overflow-y-auto"
        )}
      >
        <header className="flex items-center justify-between gap-3 rounded-[1.5rem] border-4 border-[#313131] bg-white px-4 py-3 shadow-[0_6px_0_#313131]">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#58cc02] text-white shadow-[0_4px_0_#2f8d12]">
              <BusIcon />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black text-[#58a700]">
                みんなで動かす
              </p>
              <h1 className="truncate text-xl font-black leading-tight">
                バス停ロボット
              </h1>
            </div>
          </div>
          <Button
            asChild
            className="h-11 shrink-0 rounded-2xl bg-[#1cb0f6] px-3 text-sm font-black text-white shadow-[0_4px_0_#0b82bd] hover:bg-[#1899d6]"
          >
            <Link href="/robot">
              <BotIcon data-icon="inline-start" />
              3D
            </Link>
          </Button>
        </header>

        {state.activeCommand && activeTab !== "impact" ? (
          <CommandNotice command={state.activeCommand} map={currentMap} />
        ) : null}

        {activeTab === "map" ? (
          <MapTab
            map={currentMap}
            currentLocationId={state.currentLocationId}
            selectedDestinationId={state.selectedDestinationId}
            adoptedRequest={activeRequest}
            activeCommand={state.activeCommand}
            hasSelectedDestination={hasSelectedDestination}
            onSelect={(locationId) => handleDestinationSelect(locationId)}
            onCall={openRequestDialog}
          />
        ) : null}

        {activeTab === "events" ? <EventsTab map={currentMap} /> : null}

        {activeTab === "requests" ? (
          <RequestsTab
            requests={state.requests}
            map={currentMap}
            onReaction={handleReact}
            onReset={() =>
              updateState(resetDemoState(state.scenarioId, state.activeMapId))
            }
            isAdmin={userPresetId === "admin"}
            onRemove={handleRemoveRequest}
          />
        ) : null}

        {activeTab === "impact" ? (
          <ImpactTab
            currentLocation={currentLocation.name}
            selectedLocation={selectedLocation.name}
            activeCommand={state.activeCommand}
            activeRequest={activeRequest}
            robotStatus={state.robotStatus}
            totalSupport={totalSupport}
          />
        ) : null}

        {activeTab === "profile" ? (
          <ProfileTab
            selectedPresetId={userPresetId}
            onPresetChange={(presetId) => handlePresetChange(presetId, "profile")}
          />
        ) : null}

        {activeTab === "maps" && userPresetId === "admin" ? (
          <MapManager
            maps={maps}
            activeMapId={state.activeMapId ?? currentMap.id}
            onActivate={handleActivateMap}
            onChanged={refreshMaps}
            tileKinds={tileKinds}
            onTileKindsChanged={refreshTileKinds}
          />
        ) : null}
      </div>

      <BottomTabBar tabs={bottomTabs} activeTab={activeTab} onChange={setActiveTab} />

      <RequestDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        requestType={requestType}
        scenario={scenario}
        selectedLocation={selectedLocation}
        selectedPreset={selectedPreset}
        onSubmit={handleSubmit}
      />

      <ProfileSetupDialog
        open={profileSetupOpen}
        selectedPresetId={userPresetId}
        onSelect={handleInitialPresetSelect}
      />
    </main>
  );
}

function UserPresetSelector({
  selectedPresetId,
  onChange,
  title = "だれとして使いますか？",
}: {
  selectedPresetId: UserPresetId;
  onChange: (presetId: UserPresetId) => void;
  title?: string;
}) {
  return (
    <section className="rounded-[1.5rem] border-4 border-[#313131] bg-white p-3">
      <p className="mb-2 text-sm font-black text-[#58a700]">
        {title}
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {userPresets.map((preset) => {
          const active = preset.id === selectedPresetId;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onChange(preset.id)}
              className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl border-[3px] px-2 text-xs font-black transition ${
                active
                  ? "border-[#313131] bg-[#58cc02] text-white shadow-[0_4px_0_#2f8d12]"
                  : "border-[#d8e0dc] bg-white text-[#53635a]"
              }`}
            >
              <span className="grid size-6 place-items-center text-lg [&_svg]:size-5">
                {preset.icon}
              </span>
              {preset.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function CommandNotice({
  command,
  map,
}: {
  command: MoveCommand;
  map: MapDefinition;
}) {
  return (
    <Alert className="rounded-[1.25rem] border-4 border-[#58cc02] bg-[#e8ffd9] p-3 text-[#25302b] shadow-[0_4px_0_#2f8d12]">
      <MegaphoneIcon />
      <AlertDescription className="text-sm font-black">
        移動指令を発行しました。{getLocation(command.fromLocationId, map).shortName}
        から{getLocation(command.toLocationId, map).shortName}へ向かいます。
      </AlertDescription>
    </Alert>
  );
}

function MapTab({
  map,
  currentLocationId,
  selectedDestinationId,
  adoptedRequest,
  activeCommand,
  hasSelectedDestination,
  onSelect,
  onCall,
}: {
  map: MapDefinition;
  currentLocationId: string;
  selectedDestinationId: string;
  adoptedRequest?: MoveRequest;
  activeCommand: MoveCommand | null;
  hasSelectedDestination: boolean;
  onSelect: (locationId: string) => void;
  onCall: () => void;
}) {
  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.25rem] border-2 border-[#b8c7c9] bg-white">
        <DemoMap
          map={map}
          currentLocationId={currentLocationId}
          selectedDestinationId={selectedDestinationId}
          adoptedRequest={adoptedRequest}
          activeCommand={activeCommand}
          hasSelectedDestination={hasSelectedDestination}
          onSelect={onSelect}
          onCall={onCall}
        />
      </section>
    </section>
  );
}

type EventDefinition = {
  id: string;
  category: string;
  icon: string;
  title: string;
  date: string;
  locationId: string;
  organizer: string;
  summary: string;
  robot: string;
  scheduledMove: string;
  route: string;
};

const eventDefinitions: EventDefinition[] = [
  {
    id: "market-fair",
    category: "地域",
    icon: "🎪",
    title: "週末まちなかマルシェ",
    date: "土曜 11:00-16:00",
    locationId: "market",
    organizer: "商店街",
    summary: "飲食店と手作り市が集まる週末イベントです。",
    robot: "バス停ロボット A",
    scheduledMove: "土曜 10:30 出発予定",
    route: "みんな駅前 → 商店街マルシェ",
  },
  {
    id: "company-session",
    category: "企業",
    icon: "🏢",
    title: "ローカルテック社 会社説明会",
    date: "金曜 13:00-15:00",
    locationId: "company",
    organizer: "ローカルテック社",
    summary: "地元企業の採用説明会。駅からのアクセス改善が必要です。",
    robot: "バス停ロボット B",
    scheduledMove: "金曜 12:30 出発予定",
    route: "みんな駅前 → ローカルテック社",
  },
  {
    id: "clinic-morning",
    category: "医療",
    icon: "🏥",
    title: "中央クリニック 午前診療サポート",
    date: "明日 9:00-11:30",
    locationId: "hospital",
    organizer: "中央クリニック",
    summary: "高齢者の通院時間に合わせて、病院前に停留所を寄せます。",
    robot: "バス停ロボット A",
    scheduledMove: "明日 8:30 出発予定",
    route: "みんな駅前 → 中央クリニック",
  },
  {
    id: "campus-meetup",
    category: "学校",
    icon: "🎓",
    title: "青空キャンパス 交流イベント",
    date: "今日 16:30-18:00",
    locationId: "school",
    organizer: "青空キャンパス",
    summary: "学生イベントと地域交流会の集合場所を作ります。",
    robot: "バス停ロボット C",
    scheduledMove: "今日 16:00 出発予定",
    route: "みんな駅前 → 青空キャンパス",
  },
  {
    id: "shopping-day",
    category: "地域",
    icon: "🛒",
    title: "買い物サポートデー",
    date: "水曜 10:00-12:00",
    locationId: "supermarket",
    organizer: "まちのスーパー",
    summary: "荷物が多い買い物帰りを支援する生活便です。",
    robot: "バス停ロボット A",
    scheduledMove: "水曜 9:30 出発予定",
    route: "みんな駅前 → まちのスーパー",
  },
];

const eventCategories = ["すべて", "地域", "企業", "医療", "学校"] as const;

function EventsTab({ map }: { map: MapDefinition }) {
  const [activeCategory, setActiveCategory] =
    useState<(typeof eventCategories)[number]>("すべて");
  const [detailsEventId, setDetailsEventId] = useState<string | null>(null);
  const filteredEvents =
    activeCategory === "すべて"
      ? eventDefinitions
      : eventDefinitions.filter((event) => event.category === activeCategory);
  const detailsEvent =
    eventDefinitions.find((event) => event.id === detailsEventId) ?? null;

  return (
    <section className="flex flex-col gap-4">
      <div className="rounded-[1.5rem] border-4 border-[#313131] bg-white p-4 shadow-[0_6px_0_#313131]">
        <h2 className="text-2xl font-black">イベント</h2>
        <p className="mt-1 text-xs font-bold text-[#53635a]">
          バス停ロボットの出発予定とイベント詳細を確認できます。
        </p>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {eventCategories.map((category) => {
            const active = activeCategory === category;
            return (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={`h-10 shrink-0 rounded-full border-2 px-4 text-sm font-black ${
                  active
                    ? "border-[#313131] bg-[#58cc02] text-white"
                    : "border-[#d8e0dc] bg-white text-[#53635a]"
                }`}
              >
                {category}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3">
        {filteredEvents.map((event) => {
          const destination = getLocation(event.locationId, map);
          return (
            <article
              key={event.id}
              className="flex flex-col gap-3 rounded-[1.25rem] border-[3px] border-[#313131] bg-white p-3 text-left"
            >
              <div className="flex items-start gap-3">
                <span
                  className="grid size-12 shrink-0 place-items-center rounded-2xl text-2xl text-white"
                  style={{ backgroundColor: destination.color }}
                >
                  {event.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="rounded-full bg-[#1cb0f6] text-white">
                      {event.category}
                    </Badge>
                    <span className="text-xs font-black text-[#53635a]">
                      {event.date}
                    </span>
                  </div>
                  <h3 className="mt-1 text-base font-black">{event.title}</h3>
                  <p className="line-clamp-2 text-xs font-bold text-[#53635a]">
                    {event.summary}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-2xl bg-[#fff8d8] px-3 py-2">
                <Badge className="rounded-full bg-[#ff9600] text-white">
                  移動予定
                </Badge>
                <span className="text-xs font-black text-[#53635a]">
                  {event.scheduledMove}
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDetailsEventId(event.id)}
                className="h-10 rounded-2xl text-xs font-black"
              >
                <SearchIcon data-icon="inline-start" />
                詳細
              </Button>
            </article>
          );
        })}
      </div>

      <EventDetailsDialog
        event={detailsEvent}
        map={map}
        onOpenChange={(open) => {
          if (!open) setDetailsEventId(null);
        }}
      />
    </section>
  );
}

function EventDetailsDialog({
  event,
  map,
  onOpenChange,
}: {
  event: EventDefinition | null;
  map: MapDefinition;
  onOpenChange: (open: boolean) => void;
}) {
  const open = event !== null;
  if (!event) {
    return <Dialog open={open} onOpenChange={onOpenChange} />;
  }

  const destination = getLocation(event.locationId, map);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-[2rem] border-4 border-[#313131] p-5 shadow-[0_8px_0_#313131] sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span
              className="grid size-12 shrink-0 place-items-center rounded-2xl text-2xl text-white"
              style={{ backgroundColor: destination.color }}
            >
              {event.icon}
            </span>
            <Badge className="rounded-full bg-[#1cb0f6] text-white">
              {event.category}
            </Badge>
          </div>
          <DialogTitle className="text-2xl font-black">
            {event.title}
          </DialogTitle>
          <DialogDescription className="text-base font-bold">
            {event.summary}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <RouteRow label="開催" value={event.date} />
          <RouteRow label="主催" value={event.organizer} />
          <RouteRow label="ロボット" value={event.robot} />
          <RouteRow label="移動" value={event.route} />
        </div>

        <section className="rounded-[1.25rem] border-[3px] border-[#313131] bg-[#fff8d8] p-3">
          <Badge className="rounded-full bg-[#ff9600] text-white">
            移動予定
          </Badge>
          <p className="mt-2 text-base font-black">{event.scheduledMove}</p>
          <p className="mt-1 text-xs font-bold text-[#53635a]">
            指令は申請タブで応援が集まったときに発行されます。
          </p>
        </section>
      </DialogContent>
    </Dialog>
  );
}

const requesterLabelByScenario: Record<ScenarioId, string> = {
  medical: "高齢者",
  shopping: "一般人",
  student: "学生",
  business: "企業",
};

const requestFilters = [
  { id: "all", label: "すべて" },
  { id: "citizen", label: "高齢者・一般人" },
  { id: "business", label: "企業" },
  { id: "adopted", label: "達成済み" },
] as const;

type RequestFilterId = (typeof requestFilters)[number]["id"];

function isRequestAchieved(request: MoveRequest) {
  return (
    request.status === "adopted" ||
    getRequestSupportTotal(request) >= REQUEST_SUPPORT_THRESHOLD
  );
}

function RequestsTab({
  requests,
  map,
  onReaction,
  onReset,
  isAdmin,
  onRemove,
}: {
  requests: MoveRequest[];
  map: MapDefinition;
  onReaction: (requestId: string, reaction: ReactionKey) => void;
  onReset: () => void;
  isAdmin: boolean;
  onRemove: (requestId: string) => void;
}) {
  const [filter, setFilter] = useState<RequestFilterId>("all");
  const [detailsRequestId, setDetailsRequestId] = useState<string | null>(null);
  const adoptedCount = requests.filter(isRequestAchieved).length;
  const filteredRequests = (() => {
    if (filter === "adopted") {
      return requests.filter(isRequestAchieved);
    }
    const ongoing = requests.filter((request) => !isRequestAchieved(request));
    if (filter === "citizen") {
      return ongoing.filter((request) => request.requestType === "citizen");
    }
    if (filter === "business") {
      return ongoing.filter((request) => request.requestType === "business");
    }
    return ongoing;
  })();
  const detailsRequest =
    requests.find((request) => request.id === detailsRequestId) ?? null;

  return (
    <section className="rounded-[1.5rem] border-4 border-[#313131] bg-white p-4 shadow-[0_6px_0_#313131]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black text-[#58a700]">みんなの申請</p>
          <h2 className="text-2xl font-black">応援で動かす</h2>
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-10 rounded-2xl"
          onClick={onReset}
        >
          <RotateCcwIcon data-icon="inline-start" />
          リセット
        </Button>
      </div>
      <p className="mt-2 text-sm font-bold text-[#53635a]">
        応援が{REQUEST_SUPPORT_THRESHOLD}
        件集まると、自動でバス停ロボットに指令が出ます。
      </p>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {requestFilters.map((option) => {
          const active = filter === option.id;
          const label =
            option.id === "adopted"
              ? `${option.label} (${adoptedCount})`
              : option.label;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setFilter(option.id)}
              className={`h-10 shrink-0 rounded-full border-2 px-4 text-sm font-black ${
                active
                  ? "border-[#313131] bg-[#58cc02] text-white"
                  : "border-[#d8e0dc] bg-white text-[#53635a]"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex flex-col gap-3">
        {filteredRequests.length > 0 ? (
          filteredRequests.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              map={map}
              onReaction={(reaction) => onReaction(request.id, reaction)}
              onShowDetails={() => setDetailsRequestId(request.id)}
              isAdmin={isAdmin}
              onRemove={() => onRemove(request.id)}
            />
          ))
        ) : (
          <EmptyPanel text="該当する申請はありません。" />
        )}
      </div>
      <RequestDetailsDialog
        request={detailsRequest}
        map={map}
        onOpenChange={(open) => {
          if (!open) setDetailsRequestId(null);
        }}
      />
    </section>
  );
}

function ImpactTab({
  currentLocation,
  selectedLocation,
  activeCommand,
  activeRequest,
  robotStatus,
  totalSupport,
}: {
  currentLocation: string;
  selectedLocation: string;
  activeCommand: MoveCommand | null;
  activeRequest?: MoveRequest;
  robotStatus: RobotStatus;
  totalSupport: number;
}) {
  const impact = activeCommand?.impact ?? activeRequest?.impact ?? [];
  const beforeAfter = activeCommand?.beforeAfter ?? activeRequest?.beforeAfter ?? [];

  return (
    <section className="flex flex-col gap-4">
      <section className="rounded-[1.5rem] border-4 border-[#313131] bg-[#8be7ff] p-4 shadow-[0_6px_0_#313131]">
        <Badge className="rounded-full bg-[#ff9600] text-white">
          統計と効果
        </Badge>
        <h2 className="mt-2 text-2xl font-black">
          この移動で変わること
        </h2>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <ImpactMetric label="状態" value={statusLabel[robotStatus]} />
          <ImpactMetric label="応援" value={`${totalSupport}件`} />
          <ImpactMetric
            label={activeRequest?.beforeAfter[0]?.label ?? "効果"}
            value={activeRequest?.beforeAfter[0]?.after ?? "待機中"}
          />
        </div>
      </section>

      <CommandPanel
        currentLocation={currentLocation}
        selectedLocation={selectedLocation}
        request={activeRequest}
        robotStatus={robotStatus}
      />

      <section className="rounded-[1.5rem] border-4 border-[#313131] bg-[#fff2b8] p-4 shadow-[0_6px_0_#313131]">
        <p className="text-xs font-black text-[#9c6500]">地域効果</p>
        <h2 className="text-xl font-black">この移動で助かること</h2>
        <div className="mt-3 grid gap-2">
          {impact.length > 0 ? (
            impact.map((item) => (
              <div
                key={item}
                className="rounded-2xl bg-white px-3 py-2 text-sm font-black"
              >
                {item}
              </div>
            ))
          ) : (
            <EmptyPanel text="申請を発行すると地域効果が表示されます。" />
          )}
        </div>
      </section>

      <section className="rounded-[1.5rem] border-4 border-[#313131] bg-white p-4 shadow-[0_6px_0_#313131]">
        <p className="text-xs font-black text-[#58a700]">Before / After</p>
        <h2 className="text-xl font-black">効果の見える化</h2>
        <div className="mt-3 grid gap-2">
          {beforeAfter.length > 0 ? (
            beforeAfter.map((metric) => (
              <div key={metric.label} className="rounded-2xl bg-[#f3f7f2] p-3">
                <p className="text-xs font-black text-[#53635a]">
                  {metric.label}
                </p>
                <p className="mt-1 text-lg font-black">
                  <span className="text-[#ff4b4b]">{metric.before}</span>
                  <span className="px-2 text-[#53635a]">→</span>
                  <span className="text-[#58cc02]">{metric.after}</span>
                </p>
              </div>
            ))
          ) : (
            <EmptyPanel text="指令が出ると比較指標が入ります。" />
          )}
        </div>
      </section>
    </section>
  );
}

function ImpactMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white px-3 py-2">
      <p className="truncate text-[10px] font-black text-[#58a700]">{label}</p>
      <p className="mt-1 truncate text-sm font-black">{value}</p>
    </div>
  );
}

function ProfileTab({
  selectedPresetId,
  onPresetChange,
}: {
  selectedPresetId: UserPresetId;
  onPresetChange: (presetId: UserPresetId) => void;
}) {
  return (
    <section className="flex flex-col gap-4">
      <UserPresetSelector
        selectedPresetId={selectedPresetId}
        onChange={onPresetChange}
        title="プロフィールを変更"
      />
    </section>
  );
}

function DemoMap({
  map,
  currentLocationId,
  selectedDestinationId,
  adoptedRequest,
  activeCommand,
  hasSelectedDestination,
  onSelect,
  onCall,
}: {
  map: MapDefinition;
  currentLocationId: string;
  selectedDestinationId: string;
  adoptedRequest?: MoveRequest;
  activeCommand: MoveCommand | null;
  hasSelectedDestination: boolean;
  onSelect: (locationId: string) => void;
  onCall: () => void;
}) {
  const mapLocations = useMemo(() => getMapLocations(map), [map]);
  const route = activeCommand
    ? findRoadRoute(activeCommand.fromLocationId, activeCommand.toLocationId, map)
    : findRoadRoute(currentLocationId, selectedDestinationId, map);
  const routeKeys = new Set(route.map(gridKey));
  const targetLocationId = activeCommand?.toLocationId ?? selectedDestinationId;
  const currentAccessKey = gridKey(getLocation(currentLocationId, map).roadAccess);
  const targetAccessKey = gridKey(getLocation(targetLocationId, map).roadAccess);
  const locationByGrid = new Map(
    mapLocations.map((location) => [gridKey(location.grid), location])
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#eef9fb] px-2 py-2">
      <div className="relative min-h-0 flex-1">
        <div
          className="absolute inset-0 grid overflow-hidden rounded-xl bg-[#78c95e] shadow-[inset_0_0_22px_rgba(38,93,42,0.28)]"
          style={{
            gridTemplateColumns: `repeat(${map.cols}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${map.rows}, minmax(0, 1fr))`,
          }}
        >
          {map.grid.flatMap((row, rowIndex) =>
            [...row].map((_, colIndex) => {
              const point: GridPoint = { row: rowIndex, col: colIndex };
              const key = gridKey(point);
              const kind = getTileKind(point, map.grid);
              const location = locationByGrid.get(key);
              const isRoute = routeKeys.has(key);
              const isCurrentRoad = key === currentAccessKey;
              const isTargetRoad = key === targetAccessKey;
              const roadDirections = isRoadKind(kind)
                ? getRoadDirections(point, map.grid)
                : null;
              const routeDirections = isRoute
                ? getRouteDirections(point, routeKeys)
                : null;

              return (
                <div
                  key={key}
                  className={cn(
                    "relative min-h-0 overflow-hidden",
                    tileClass(kind)
                  )}
                >
                  <TileSurface
                    kind={kind}
                    roadDirections={roadDirections}
                    routeDirections={routeDirections}
                  />
                  {isCurrentRoad ? (
                    <span className="absolute inset-1 z-10 grid place-items-center rounded-full bg-white text-[#1cb0f6] ring-2 ring-[#1cb0f6]">
                      <BusIcon className="size-5" />
                    </span>
                  ) : null}
                  {isTargetRoad && !isCurrentRoad ? (
                    <span className="absolute inset-1 z-10 rounded-full border-[3px] border-[#ff4b4b]" />
                  ) : null}
                  {!location ? <MapChip kind={kind} /> : null}
                  {location ? (
                    <LocationTileButton
                      locationId={location.id}
                      map={map}
                      isCurrent={location.id === currentLocationId}
                      isSelected={location.id === selectedDestinationId}
                      isAdopted={location.id === adoptedRequest?.destinationId}
                      onSelect={onSelect}
                    />
                  ) : null}
                </div>
              );
            })
          )}
        </div>
        <div className="absolute inset-x-3 bottom-3 z-30">
          <Button
            type="button"
            onClick={onCall}
            disabled={!hasSelectedDestination}
            className="h-16 w-full rounded-2xl border-2 border-white bg-[#58cc02] text-xl font-black text-white shadow-[0_6px_0_#2f8d12] hover:bg-[#4fb802]"
          >
            <PlusIcon data-icon="inline-start" />
            {hasSelectedDestination
              ? "バス停を動かす！"
              : "いきたい場所を選択してください"}
          </Button>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[10px] font-black text-[#53635a]">
        <span className="rounded-full bg-white px-2 py-1">黄: 走行ルート</span>
        <span className="rounded-full bg-white px-2 py-1">灰: 道路</span>
        <span className="rounded-full bg-white px-2 py-1">赤: 目的地</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {mapLocations.map((location) => (
          <span
            key={location.id}
            className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[10px] font-black text-[#25302b]"
          >
            <span aria-hidden="true">{location.icon}</span>
            {location.shortName}
          </span>
        ))}
      </div>
    </div>
  );
}

function tileClass(kind: TileKind) {
  switch (kind) {
    case "road":
      return "bg-[#9fb0b8]";
    case "intersection":
      return "bg-[#97aab4]";
    case "park":
      return "bg-[#86d968]";
    case "tree":
      return "bg-[#6fbe55]";
    case "house":
      return "bg-[#80ce62]";
    case "shop":
      return "bg-[#d8b85c]";
    case "company":
      return "bg-[#87d6e7]";
    case "hospital":
      return "bg-[#f8aeba]";
    case "school":
      return "bg-[#c3a7f6]";
    case "station":
    case "busStop":
      return "bg-[#95d8f6]";
    default:
      return "bg-[#78c95e]";
  }
}

function TileSurface({
  kind,
  roadDirections,
  routeDirections,
}: {
  kind: TileKind;
  roadDirections: TileDirections | null;
  routeDirections: TileDirections | null;
}) {
  const hasHorizontalRoad = Boolean(roadDirections?.left || roadDirections?.right);
  const hasVerticalRoad = Boolean(roadDirections?.up || roadDirections?.down);
  const hasHorizontalRoute = Boolean(routeDirections?.left || routeDirections?.right);
  const hasVerticalRoute = Boolean(routeDirections?.up || routeDirections?.down);

  return (
    <>
      {!isRoadKind(kind) ? (
        <span className="absolute inset-0 bg-[radial-gradient(circle_at_24%_28%,rgba(255,255,255,0.2)_0_1.5px,transparent_1.5px),radial-gradient(circle_at_76%_70%,rgba(49,118,48,0.22)_0_1.5px,transparent_1.5px)]" />
      ) : null}
      {kind === "road" || kind === "intersection" ? (
        <span className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.11)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.11)_50%,rgba(255,255,255,0.11)_75%,transparent_75%,transparent)] bg-[length:14px_14px]" />
      ) : null}
      {hasHorizontalRoad ? (
        <span className="absolute inset-x-1 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-white/45" />
      ) : null}
      {hasVerticalRoad ? (
        <span className="absolute inset-y-1 left-1/2 w-[3px] -translate-x-1/2 rounded-full bg-white/45" />
      ) : null}
      {hasHorizontalRoute ? (
        <span className="absolute inset-x-0 top-1/2 z-10 h-3 -translate-y-1/2 bg-[#ffd84d] shadow-[0_0_0_1px_rgba(143,101,0,0.15)]" />
      ) : null}
      {hasVerticalRoute ? (
        <span className="absolute inset-y-0 left-1/2 z-10 w-3 -translate-x-1/2 bg-[#ffd84d] shadow-[0_0_0_1px_rgba(143,101,0,0.15)]" />
      ) : null}
      {routeDirections ? (
        <span className="absolute left-1/2 top-1/2 z-10 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ffe983]" />
      ) : null}
    </>
  );
}

function isRoadKind(kind: TileKind) {
  return kind === "road" || kind === "intersection";
}

function getRoadDirections(
  point: GridPoint,
  grid: readonly string[]
): TileDirections {
  return getNeighborDirections(point, (candidate) =>
    isRoadKind(getTileKind(candidate, grid))
  );
}

function getRouteDirections(point: GridPoint, routeKeys: Set<string>): TileDirections {
  return getNeighborDirections(point, (candidate) =>
    routeKeys.has(gridKey(candidate))
  );
}

function getNeighborDirections(
  point: GridPoint,
  includes: (candidate: GridPoint) => boolean
): TileDirections {
  const up = { row: point.row - 1, col: point.col };
  const right = { row: point.row, col: point.col + 1 };
  const down = { row: point.row + 1, col: point.col };
  const left = { row: point.row, col: point.col - 1 };

  return {
    up: includes(up),
    right: includes(right),
    down: includes(down),
    left: includes(left),
  };
}

function MapChip({ kind }: { kind: TileKind }) {
  if (kind === "road" || kind === "intersection" || kind === "grass") return null;
  if (kind === "tree") {
    return (
      <span className="absolute inset-0 grid place-items-center text-2xl leading-none drop-shadow-[0_2px_0_rgba(33,92,39,0.25)]">
        🌳
      </span>
    );
  }

  const chip = {
    house: "🏠",
    shop: "🏪",
    company: "🏢",
    hospital: "🏥",
    school: "🎓",
    station: "🚉",
    park: "🎪",
    busStop: "🚌",
  }[kind] ?? "■";

  return (
    <span className="absolute inset-0 grid place-items-center text-2xl leading-none drop-shadow-[0_2px_0_rgba(33,49,40,0.2)]">
      {chip}
    </span>
  );
}

function LocationTileButton({
  locationId,
  map,
  isCurrent,
  isSelected,
  isAdopted,
  onSelect,
}: {
  locationId: string;
  map: MapDefinition;
  isCurrent: boolean;
  isSelected: boolean;
  isAdopted: boolean;
  onSelect: (locationId: string) => void;
}) {
  const location = getLocation(locationId, map);
  const feature = getMapFeature(locationId, map);

  return (
    <button
      type="button"
      onClick={() => onSelect(locationId)}
      className={`relative z-20 flex h-full w-full items-center justify-center transition ${
        isSelected
          ? "bg-[#fff3a6]/45 ring-[3px] ring-[#ffcf32]"
          : "bg-transparent hover:bg-white/20"
      }`}
      aria-label={`${location.name}を選択`}
      title={location.name}
    >
      <span
        className="grid size-10 max-h-[82%] max-w-[82%] place-items-center rounded-2xl text-2xl text-white shadow-[0_3px_0_rgba(0,0,0,0.18)]"
        style={{ backgroundColor: feature.color }}
      >
        {feature.icon}
      </span>
      {isCurrent ? (
        <span className="absolute left-0.5 top-0.5 rounded-full bg-[#1cb0f6] px-1 text-[8px] font-black text-white">
          現
        </span>
      ) : null}
      {isAdopted ? (
        <span className="absolute right-0.5 top-0.5 grid size-3.5 place-items-center rounded-full bg-[#ff4b4b] text-white">
          <CheckCircle2Icon className="size-3" />
        </span>
      ) : null}
    </button>
  );
}

function CommandPanel({
  currentLocation,
  selectedLocation,
  request,
  robotStatus,
}: {
  currentLocation: string;
  selectedLocation: string;
  request?: MoveRequest;
  robotStatus: RobotStatus;
}) {
  return (
    <section className="rounded-[1.5rem] border-4 border-[#313131] bg-white p-4 shadow-[0_6px_0_#313131]">
      <div className="flex items-center gap-3">
        <div className="grid size-12 place-items-center rounded-2xl bg-[#ff4b4b] text-white shadow-[0_4px_0_#c73434]">
          <MegaphoneIcon />
        </div>
        <div>
          <p className="text-xs font-black text-[#ff4b4b]">指令パネル</p>
          <h2 className="text-xl font-black">{statusLabel[robotStatus]}</h2>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        <RouteRow label="出発" value={currentLocation} />
        <RouteRow label="到着" value={selectedLocation} />
        <RouteRow label="理由" value={request?.reason ?? "申請を選んでください"} />
        <RouteRow label="対象" value={request?.audience ?? "地域の利用者"} />
      </div>
    </section>
  );
}

function RouteRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#f3f7f2] px-3 py-2">
      <span className="text-sm font-black text-[#53635a]">{label}</span>
      <span className="text-right font-black">{value}</span>
    </div>
  );
}

function RequestDetailsDialog({
  request,
  map,
  onOpenChange,
}: {
  request: MoveRequest | null;
  map: MapDefinition;
  onOpenChange: (open: boolean) => void;
}) {
  const open = request !== null;
  if (!request) {
    return <Dialog open={open} onOpenChange={onOpenChange} />;
  }

  const destination = getLocation(request.destinationId, map);
  const requesterLabel =
    request.requestType === "business"
      ? "企業"
      : requesterLabelByScenario[request.scenarioId];
  const achieved = isRequestAchieved(request);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-[2rem] border-4 border-[#313131] p-5 shadow-[0_8px_0_#313131] sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span
              className="grid size-12 shrink-0 place-items-center rounded-2xl text-2xl text-white"
              style={{ backgroundColor: destination.color }}
            >
              {destination.icon}
            </span>
            <Badge className="rounded-full bg-[#ff9600] text-white">
              {requesterLabel}
            </Badge>
            <Badge
              className={
                achieved
                  ? "bg-[#58cc02] text-white"
                  : "bg-[#1cb0f6] text-white"
              }
            >
              {achieved ? "採択中" : "候補"}
            </Badge>
          </div>
          <DialogTitle className="text-2xl font-black">
            {request.title}
          </DialogTitle>
          <DialogDescription className="text-base font-bold">
            {request.note}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <RouteRow label="目的地" value={destination.shortName} />
          <RouteRow label="希望日時" value={request.desiredTime} />
          <RouteRow label="申請理由" value={request.reason} />
          <RouteRow label="対象者" value={request.audience} />
        </div>

        {request.impact.length > 0 && (
          <section className="rounded-[1.25rem] border-[3px] border-[#313131] bg-[#fff8d8] p-3">
            <Badge className="rounded-full bg-[#ff9600] text-white">
              想定インパクト
            </Badge>
            <ul className="mt-2 flex flex-col gap-1">
              {request.impact.map((line) => (
                <li
                  key={line}
                  className="text-sm font-black leading-snug text-[#313131]"
                >
                  ・{line}
                </li>
              ))}
            </ul>
          </section>
        )}

        {request.beforeAfter.length > 0 && (
          <section className="rounded-[1.25rem] border-[3px] border-[#313131] bg-[#f3f7f2] p-3">
            <Badge className="rounded-full bg-[#1cb0f6] text-white">
              Before / After
            </Badge>
            <div className="mt-2 flex flex-col gap-2">
              {request.beforeAfter.map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-2xl bg-white p-2"
                >
                  <p className="text-xs font-black text-[#53635a]">
                    {metric.label}
                  </p>
                  <div className="mt-1 grid grid-cols-2 gap-2 text-sm font-black">
                    <div className="rounded-xl bg-[#f0f4ef] px-2 py-1 text-[#53635a]">
                      <span className="block text-[10px]">Before</span>
                      {metric.before}
                    </div>
                    <div className="rounded-xl bg-[#e6f7d6] px-2 py-1 text-[#3a7d00]">
                      <span className="block text-[10px]">After</span>
                      {metric.after}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RequestCard({
  request,
  map,
  onReaction,
  onShowDetails,
  isAdmin,
  onRemove,
}: {
  request: MoveRequest;
  map: MapDefinition;
  onReaction: (reaction: ReactionKey) => void;
  onShowDetails: () => void;
  isAdmin: boolean;
  onRemove: () => void;
}) {
  const destination = getLocation(request.destinationId, map);
  const total = getRequestSupportTotal(request);
  const reached = total >= REQUEST_SUPPORT_THRESHOLD;
  const achieved = reached || request.status === "adopted";
  const ratio = Math.min(
    100,
    Math.round((total / REQUEST_SUPPORT_THRESHOLD) * 100)
  );
  const remaining = Math.max(0, REQUEST_SUPPORT_THRESHOLD - total);
  const requesterLabel =
    request.requestType === "business"
      ? "企業"
      : requesterLabelByScenario[request.scenarioId];

  return (
    <article className="rounded-[1.25rem] border-[3px] border-[#313131] bg-[#f9fbf7] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              className={
                achieved
                  ? "bg-[#58cc02] text-white"
                  : "bg-[#1cb0f6] text-white"
              }
            >
              {achieved ? "採択中" : "候補"}
            </Badge>
            <Badge className="rounded-full bg-[#ff9600] text-white">
              {requesterLabel}
            </Badge>
            <span className="text-xs font-black text-[#53635a]">
              {destination.shortName} / {request.desiredTime}
            </span>
          </div>
          <h3 className="mt-2 text-base font-black leading-snug">
            {request.title}
          </h3>
        </div>
        <div className="flex shrink-0 items-start gap-1">
          {isAdmin ? (
            <button
              type="button"
              onClick={onRemove}
              aria-label="この申請を削除"
              className="grid size-9 place-items-center rounded-xl border-2 border-[#e35d6a] bg-white text-[#e35d6a] transition active:scale-95"
            >
              <Trash2Icon className="size-4" />
            </button>
          ) : null}
          <div className="grid size-12 shrink-0 place-items-center rounded-full bg-white text-2xl">
            {destination.icon}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-1">
        <div className="flex items-center justify-between text-xs font-black text-[#53635a]">
          <span>応援</span>
          <span>
            {Math.min(total, REQUEST_SUPPORT_THRESHOLD)} /{" "}
            {REQUEST_SUPPORT_THRESHOLD}件
          </span>
        </div>
        <Progress
          value={ratio}
          className="h-2 bg-[#f0f4ef] [&>[data-slot=progress-indicator]]:bg-[#58cc02]"
        />
        <p className="text-xs font-bold text-[#53635a]">
          {reached
            ? "応援が目標に到達し、ロボットへ指令が出ました。"
            : `あと${remaining}件の応援で指令が出ます。`}
        </p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-12 rounded-2xl text-sm font-black"
          onClick={onShowDetails}
        >
          詳細
        </Button>
        <button
          type="button"
          onClick={() => onReaction("cheer")}
          disabled={reached}
          className="h-12 rounded-2xl border-2 border-[#313131] bg-[#58cc02] px-3 text-sm font-black text-white shadow-[0_3px_0_#313131] transition active:translate-y-0.5 active:shadow-none disabled:opacity-60 disabled:active:translate-y-0 disabled:active:shadow-[0_3px_0_#313131]"
        >
          応援する
          <span className="ml-2 text-xs">+1</span>
        </button>
      </div>
    </article>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return (
    <p className="rounded-2xl bg-[#f3f7f2] p-3 text-sm font-bold text-[#53635a]">
      {text}
    </p>
  );
}

function BottomTabBar({
  tabs,
  activeTab,
  onChange,
}: {
  tabs: BottomTab[];
  activeTab: AppTab;
  onChange: (tab: AppTab) => void;
}) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t-4 border-[#313131] bg-white/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur">
      <div
        className="mx-auto grid max-w-[520px] gap-1"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl text-[10px] font-black transition ${
              activeTab === tab.id
                ? "bg-[#58cc02] text-white shadow-[0_4px_0_#2f8d12]"
                : "bg-[#f3f7f2] text-[#53635a]"
            }`}
          >
            <span className="[&_svg]:size-5">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

function ProfileSetupDialog({
  open,
  selectedPresetId,
  onSelect,
}: {
  open: boolean;
  selectedPresetId: UserPresetId;
  onSelect: (presetId: UserPresetId) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={() => undefined}>
      <DialogContent className="rounded-[2rem] border-4 border-[#313131] p-5 shadow-[0_8px_0_#313131] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black">
            だれとして使いますか？
          </DialogTitle>
          <DialogDescription className="text-base font-bold">
            最初に利用者タイプを選ぶと、申請フォームが使いやすく切り替わります。
          </DialogDescription>
        </DialogHeader>
        <UserPresetSelector
          selectedPresetId={selectedPresetId}
          onChange={onSelect}
          title="利用者タイプ"
        />
      </DialogContent>
    </Dialog>
  );
}

function RequestDialog({
  open,
  onOpenChange,
  requestType,
  scenario,
  selectedLocation,
  selectedPreset,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestType: RequestType;
  scenario: ReturnType<typeof getScenario>;
  selectedLocation: ReturnType<typeof getLocation>;
  selectedPreset: UserPreset;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const isBusiness = requestType === "business";
  const defaultReason = optionOrFirst(
    scenario.reasonOptions,
    selectedPreset.defaultReason
  );
  const defaultAudience = optionOrFirst(
    scenario.audienceOptions,
    selectedPreset.defaultAudience
  );
  const defaultTitle = isBusiness
    ? `${selectedLocation.name}でイベント参加者を呼びたい`
    : `${selectedLocation.name}に来てほしい`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-[2rem] border-4 border-[#313131] p-5 shadow-[0_8px_0_#313131] sm:max-w-lg">
        <DialogHeader>
          <Badge className="w-fit rounded-full bg-[#58cc02] text-white">
            {selectedPreset.icon}
            {selectedPreset.label}
          </Badge>
          <DialogTitle className="text-2xl font-black">
            {isBusiness ? "企業・主催者として呼ぶ" : "ここにバス停を呼ぶ"}
          </DialogTitle>
          <DialogDescription className="text-base font-bold">
            目的、理由、対象者を選んで、{selectedLocation.shortName}へ呼ぶ申請を作ります。
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          <input type="hidden" name="destinationId" value={selectedLocation.id} />
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="title">行き先</FieldLabel>
              <Input
                id="title"
                name="title"
                defaultValue={defaultTitle}
                className="h-12 rounded-2xl text-base font-bold"
                required
              />
              <FieldDescription>
                地図で選んだ場所: {selectedLocation.description}
              </FieldDescription>
            </Field>

            {isBusiness ? (
              <>
                <Field>
                  <FieldLabel htmlFor="eventName">イベント名</FieldLabel>
                  <Input
                    id="eventName"
                    name="eventName"
                    defaultValue="地域イベント"
                    placeholder="会社説明会、マルシェ、採用イベントなど"
                    className="h-12 rounded-2xl text-base font-bold"
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="expectedPeople">想定参加者</FieldLabel>
                    <Input
                      id="expectedPeople"
                      name="expectedPeople"
                      defaultValue="30"
                      className="h-12 rounded-2xl text-base font-bold"
                    />
                  </Field>
                  <Field>
                    <FieldLabel
                      htmlFor="sponsored"
                      className="min-h-12 rounded-2xl border-2 border-[#d1d5db] bg-[#f9fbf7] p-3"
                    >
                      <input
                        id="sponsored"
                        name="sponsored"
                        type="checkbox"
                        className="size-5"
                      />
                      協賛あり
                    </FieldLabel>
                  </Field>
                </div>
              </>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="desiredTime">希望時間</FieldLabel>
                <Input
                  id="desiredTime"
                  name="desiredTime"
                  defaultValue={scenario.recommendedTime}
                  className="h-12 rounded-2xl text-base font-bold"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="audience">誰のため？</FieldLabel>
                <select
                  id="audience"
                  name="audience"
                  defaultValue={defaultAudience}
                  className="h-12 rounded-2xl border bg-background px-3 text-base font-bold"
                >
                  {scenario.audienceOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="reason">理由</FieldLabel>
              <select
                id="reason"
                name="reason"
                defaultValue={defaultReason}
                className="h-12 rounded-2xl border bg-background px-3 text-base font-bold"
              >
                {scenario.reasonOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>

            <Field>
              <FieldLabel htmlFor="note">ひとこと</FieldLabel>
              <Textarea
                id="note"
                name="note"
                rows={4}
                defaultValue={selectedPreset.defaultNote}
                className="rounded-2xl text-base font-bold"
              />
            </Field>
          </FieldGroup>

          <DialogFooter className="rounded-[1.5rem] bg-[#f3f7f2]">
            <Button
              type="submit"
              className="h-14 w-full rounded-2xl bg-[#58cc02] text-base font-black text-white shadow-[0_6px_0_#2f8d12] hover:bg-[#4fb802]"
            >
              <PartyPopperIcon data-icon="inline-start" />
              移動指令を発行する
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
