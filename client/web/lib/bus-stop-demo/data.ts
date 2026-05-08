import type {
  BusStopLocation,
  DemoScenario,
  DemoState,
  GridPoint,
  MapFeature,
  MoveRequest,
  ScenarioId,
  TileKind,
} from "./types";

export const TOWN_ROWS = 13;
export const TOWN_COLS = 9;
export const TILE_SIZE = 1.35;

export const TOWN_GRID = [
  "ggggrgtgg",
  "ghhcrghhg",
  "ghhgrgtgg",
  "grrr+rrgg",
  "gppgrssgg",
  "gppgrmmeg",
  "rrrr+rrrr",
  "gguurggeg",
  "gtggrgtgg",
  "grrr+rrrg",
  "ghhgammsg",
  "ghhgrmmhg",
  "ghhgggtgg",
] as const;

const tileKindByCode: Record<string, TileKind> = {
  g: "grass",
  r: "road",
  "+": "intersection",
  h: "house",
  s: "shop",
  c: "company",
  p: "hospital",
  u: "school",
  a: "station",
  e: "park",
  m: "shop",
  t: "tree",
  b: "busStop",
};

export function getTileKind(point: GridPoint): TileKind {
  const code = TOWN_GRID[point.row]?.[point.col] ?? "g";
  return tileKindByCode[code] ?? "grass";
}

export function isRoadTile(point: GridPoint) {
  const kind = getTileKind(point);
  return kind === "road" || kind === "intersection";
}

export function gridKey(point: GridPoint) {
  return `${point.row}:${point.col}`;
}

export function sameGridPoint(a: GridPoint, b: GridPoint) {
  return a.row === b.row && a.col === b.col;
}

export function gridToMapPercent(point: GridPoint) {
  return {
    x: ((point.col + 0.5) / TOWN_COLS) * 100,
    y: ((point.row + 0.5) / TOWN_ROWS) * 100,
  };
}

export function gridToWorld(point: GridPoint) {
  return {
    x: (point.col - (TOWN_COLS - 1) / 2) * TILE_SIZE,
    z: (point.row - (TOWN_ROWS - 1) / 2) * TILE_SIZE,
  };
}

export const mapFeatures: MapFeature[] = [
  {
    id: "station",
    label: "みんな駅前",
    shortLabel: "駅前",
    kind: "station",
    tileKind: "station",
    grid: { row: 10, col: 4 },
    roadAccess: { row: 9, col: 4 },
    color: "#3B82F6",
    icon: "🚉",
    height: 1.45,
  },
  {
    id: "hospital",
    label: "中央クリニック",
    shortLabel: "病院",
    kind: "hospital",
    tileKind: "hospital",
    grid: { row: 4, col: 1 },
    roadAccess: { row: 3, col: 1 },
    color: "#FB7185",
    icon: "🏥",
    height: 1.35,
  },
  {
    id: "supermarket",
    label: "まちのスーパー",
    shortLabel: "スーパー",
    kind: "shopping",
    tileKind: "shop",
    grid: { row: 4, col: 6 },
    roadAccess: { row: 3, col: 6 },
    color: "#F59E0B",
    icon: "🛒",
    height: 1.25,
  },
  {
    id: "market",
    label: "商店街マルシェ",
    shortLabel: "商店街",
    kind: "event",
    tileKind: "shop",
    grid: { row: 10, col: 6 },
    roadAccess: { row: 9, col: 6 },
    color: "#22C55E",
    icon: "🎪",
    height: 1.2,
  },
  {
    id: "school",
    label: "青空キャンパス",
    shortLabel: "学校",
    kind: "school",
    tileKind: "school",
    grid: { row: 7, col: 2 },
    roadAccess: { row: 6, col: 2 },
    color: "#A855F7",
    icon: "🎓",
    height: 1.3,
  },
  {
    id: "company",
    label: "ローカルテック社",
    shortLabel: "企業",
    kind: "company",
    tileKind: "company",
    grid: { row: 1, col: 3 },
    roadAccess: { row: 3, col: 3 },
    color: "#06B6D4",
    icon: "🏢",
    height: 1.8,
  },
  {
    id: "housing",
    label: "ひだまり団地",
    shortLabel: "団地",
    kind: "community",
    tileKind: "house",
    grid: { row: 11, col: 2 },
    roadAccess: { row: 9, col: 2 },
    color: "#84CC16",
    icon: "🏘️",
    height: 1.05,
  },
];

const descriptions: Record<string, string> = {
  station: "鉄道と路線バスの乗り換え拠点",
  hospital: "午前中の通院需要が集中する医療拠点",
  supermarket: "買い物と荷物の持ち帰りを支える生活拠点",
  market: "週末イベントと飲食店が集まるにぎわい拠点",
  school: "学生イベントや部活動の集合場所",
  company: "地元企業説明会と採用イベントの会場",
  housing: "高齢者世帯が多く、バス停まで距離がある住宅地",
};

export const locations: BusStopLocation[] = mapFeatures.map((feature) => ({
  id: feature.id,
  name: feature.label,
  shortName: feature.shortLabel,
  kind: feature.kind,
  grid: feature.grid,
  roadAccess: feature.roadAccess,
  map: gridToMapPercent(feature.grid),
  world: gridToWorld(feature.roadAccess),
  color: feature.color,
  icon: feature.icon,
  description: descriptions[feature.id],
}));

export const scenarios: DemoScenario[] = [
  {
    id: "medical",
    tabLabel: "通院",
    title: "高齢者の通院支援",
    subtitle: "病院の受付時間に合わせて、団地近くへバス停を呼びます。",
    mascotLine: "午前の通院を短く、安心に。",
    scoreLabel: "徒歩短縮",
    primaryDestinationId: "hospital",
    recommendedTime: "明日 9:00",
    reasonOptions: [
      "病院に行きたい",
      "高齢者の移動を助けたい",
      "雨の日の徒歩を短くしたい",
    ],
    audienceOptions: ["高齢者", "家族の付き添い", "通院する住民"],
    regionInfo: [
      {
        title: "午前診療が混み合います",
        category: "病院",
        locationId: "hospital",
        description: "9時台に診療予約が集中。団地から徒歩12分かかります。",
      },
      {
        title: "ひだまり団地から声が集まっています",
        category: "住民",
        locationId: "housing",
        description: "応援数が多く、複数世帯が同じ時間帯を希望しています。",
      },
    ],
    defaultRequest: {
      requestType: "citizen",
      title: "中央クリニック前に来てほしい",
      destinationId: "hospital",
      desiredTime: "明日 9:00",
      reason: "病院に行きたい",
      audience: "高齢者",
      note: "団地から歩く距離が長いので、受付時間に合わせたいです。",
      reactions: { wantToGo: 6, helpful: 18, cheer: 11 },
      impact: ["高齢者の徒歩距離を短縮", "通院付き添いの負担を軽減", "午前診療への遅刻を減らす"],
      beforeAfter: [
        { label: "最寄りまで徒歩", before: "12分", after: "4分" },
        { label: "通院しやすい世帯", before: "18世帯", after: "46世帯" },
      ],
      aiReason: "病院予約が多い9時台と、団地からの応援数が重なっています。",
    },
  },
  {
    id: "shopping",
    tabLabel: "買物",
    title: "商店街イベント集客",
    subtitle: "マルシェ開催日に、駅前から商店街へ人の流れを作ります。",
    mascotLine: "地域のお店に行きやすくします。",
    scoreLabel: "来場増",
    primaryDestinationId: "market",
    recommendedTime: "土曜 11:00",
    reasonOptions: [
      "イベントに行きたい",
      "買い物に行きたい",
      "商店街を応援したい",
    ],
    audienceOptions: ["親子連れ", "買い物客", "観光客"],
    regionInfo: [
      {
        title: "週末マルシェ開催",
        category: "イベント",
        locationId: "market",
        description: "地元飲食店と手作り市が11時から始まります。",
      },
      {
        title: "荷物が多い帰り道を支援",
        category: "買い物",
        locationId: "supermarket",
        description: "買い物後の徒歩負担を減らせます。",
      },
    ],
    defaultRequest: {
      requestType: "citizen",
      title: "商店街マルシェ入口に来てほしい",
      destinationId: "market",
      desiredTime: "土曜 11:00",
      reason: "イベントに行きたい",
      audience: "親子連れ",
      note: "駅から少し遠いので、子ども連れでも行きやすくしたいです。",
      reactions: { wantToGo: 23, helpful: 12, cheer: 19 },
      impact: ["商店街イベントの参加者増", "駅前からの回遊性向上", "買い物帰りの徒歩負担を軽減"],
      beforeAfter: [
        { label: "来場見込み", before: "80人", after: "140人" },
        { label: "駅から徒歩", before: "13分", after: "5分" },
      ],
      aiReason: "イベント開始前の移動需要と、駅前から商店街への回遊効果が高いです。",
    },
  },
  {
    id: "student",
    tabLabel: "学生",
    title: "学生イベント参加",
    subtitle: "放課後のイベントに合わせて、学校前へバス停を移動します。",
    mascotLine: "若者の参加機会を増やします。",
    scoreLabel: "参加増",
    primaryDestinationId: "school",
    recommendedTime: "今日 16:30",
    reasonOptions: [
      "イベントに行きたい",
      "学校アクセスをよくしたい",
      "友だちと参加したい",
    ],
    audienceOptions: ["学生", "高校生", "地域サークル"],
    regionInfo: [
      {
        title: "放課後ワークショップ",
        category: "学生",
        locationId: "school",
        description: "地域企業と学生の交流会が16時半から開催されます。",
      },
      {
        title: "駅前から学校まで距離があります",
        category: "交通",
        locationId: "station",
        description: "夕方は徒歩移動が多く、参加を諦める学生が出ています。",
      },
    ],
    defaultRequest: {
      requestType: "citizen",
      title: "青空キャンパス前に来てほしい",
      destinationId: "school",
      desiredTime: "今日 16:30",
      reason: "イベントに行きたい",
      audience: "学生",
      note: "放課後イベントに間に合うように、学校の近くで乗り降りしたいです。",
      reactions: { wantToGo: 31, helpful: 8, cheer: 15 },
      impact: ["学生イベントの参加者増", "駅から学校までの移動負担を軽減", "地域企業との接点を増やす"],
      beforeAfter: [
        { label: "参加見込み", before: "24人", after: "52人" },
        { label: "駅から徒歩", before: "15分", after: "6分" },
      ],
      aiReason: "学生の応援が多く、イベント開始時刻と既存バスの空白時間が一致しています。",
    },
  },
  {
    id: "business",
    tabLabel: "企業",
    title: "地元企業説明会",
    subtitle: "企業説明会の参加率を上げるため、会場近くへバス停を呼びます。",
    mascotLine: "採用イベントにも交通を合わせます。",
    scoreLabel: "応募増",
    primaryDestinationId: "company",
    recommendedTime: "金曜 13:00",
    reasonOptions: [
      "企業説明会に行きたい",
      "採用イベントに人を呼びたい",
      "若者の移動を助けたい",
    ],
    audienceOptions: ["学生", "求職者", "企業イベント参加者"],
    regionInfo: [
      {
        title: "ローカルテック社 説明会",
        category: "企業",
        locationId: "company",
        description: "13時開始。駅からのアクセス改善で参加率を上げられます。",
      },
      {
        title: "協賛による実証実験",
        category: "toB",
        locationId: "company",
        description: "企業が地域交通へ協賛する将来像を見せられます。",
      },
    ],
    defaultRequest: {
      requestType: "business",
      title: "ローカルテック社前に来てほしい",
      destinationId: "company",
      desiredTime: "金曜 13:00",
      reason: "企業説明会に行きたい",
      audience: "学生",
      note: "説明会の開始前に駅から迷わず来られる導線を作りたいです。",
      reactions: { wantToGo: 17, helpful: 9, cheer: 22 },
      impact: ["地元企業説明会へのアクセス改善", "説明会参加者の増加", "企業協賛モデルを提示"],
      beforeAfter: [
        { label: "参加見込み", before: "8人", after: "20人" },
        { label: "駅から徒歩", before: "14分", after: "5分" },
      ],
      aiReason: "説明会開始前に駅前需要が高まり、企業協賛の効果も説明しやすい移動です。",
    },
  },
];

const now = () => new Date().toISOString();

export function getScenario(id: ScenarioId) {
  return scenarios.find((scenario) => scenario.id === id) ?? scenarios[0];
}

export function getLocation(id: string) {
  return locations.find((location) => location.id === id) ?? locations[0];
}

export function getMapFeature(id: string) {
  return mapFeatures.find((feature) => feature.id === id) ?? mapFeatures[0];
}

function getRoadNeighbors(point: GridPoint) {
  return [
    { row: point.row - 1, col: point.col },
    { row: point.row + 1, col: point.col },
    { row: point.row, col: point.col - 1 },
    { row: point.row, col: point.col + 1 },
  ].filter(
    (candidate) =>
      candidate.row >= 0 &&
      candidate.row < TOWN_ROWS &&
      candidate.col >= 0 &&
      candidate.col < TOWN_COLS &&
      isRoadTile(candidate)
  );
}

export function findRoadRoute(fromLocationId: string, toLocationId: string) {
  const start = getLocation(fromLocationId).roadAccess;
  const goal = getLocation(toLocationId).roadAccess;
  const queue: GridPoint[] = [start];
  const visited = new Set([gridKey(start)]);
  const previous = new Map<string, GridPoint>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;

    if (sameGridPoint(current, goal)) {
      const route: GridPoint[] = [goal];
      let cursor = previous.get(gridKey(goal));

      while (cursor) {
        route.unshift(cursor);
        cursor = previous.get(gridKey(cursor));
      }

      return route;
    }

    for (const next of getRoadNeighbors(current)) {
      const key = gridKey(next);
      if (visited.has(key)) continue;
      visited.add(key);
      previous.set(key, current);
      queue.push(next);
    }
  }

  return [start, goal];
}

export function getScenarioLocations(scenarioId: ScenarioId) {
  const scenario = getScenario(scenarioId);
  const locationIds = new Set([
    "station",
    "housing",
    scenario.primaryDestinationId,
    ...scenario.regionInfo.map((item) => item.locationId),
  ]);

  return locations.filter((location) => locationIds.has(location.id));
}

export function createSeedRequests(): MoveRequest[] {
  return scenarios.map((scenario, index) => ({
    ...scenario.defaultRequest,
    id: `seed-${scenario.id}`,
    scenarioId: scenario.id,
    status: index === 0 ? "adopted" : "candidate",
    createdAt: now(),
  }));
}

export const REQUEST_SUPPORT_THRESHOLD = 60;

export function createInitialDemoState(
  scenarioId: ScenarioId = "medical"
): DemoState {
  const scenario = getScenario(scenarioId);

  return {
    scenarioId,
    currentLocationId: "station",
    robotStatus: "idle",
    selectedDestinationId: scenario.primaryDestinationId,
    requests: createSeedRequests(),
    activeCommand: null,
    updatedAt: now(),
  };
}
