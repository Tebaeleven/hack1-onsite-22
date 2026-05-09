import type {
  BusStopLocation,
  DemoScenario,
  DemoState,
  GridPoint,
  MapDefinition,
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

// 1文字コード ↔ TileKind の双方向変換テーブル (エディタが使う)
export const TILE_CODE_TO_KIND: Readonly<Record<string, TileKind>> = tileKindByCode;
export const TILE_KIND_TO_CODE: Readonly<Record<TileKind, string>> = {
  grass: "g",
  road: "r",
  intersection: "+",
  house: "h",
  shop: "s",
  company: "c",
  hospital: "p",
  school: "u",
  station: "a",
  park: "e",
  tree: "t",
  busStop: "b",
};

export const TILE_KINDS: readonly TileKind[] = [
  "grass",
  "road",
  "intersection",
  "house",
  "shop",
  "company",
  "hospital",
  "school",
  "station",
  "park",
  "tree",
  "busStop",
];

export const TILE_KIND_LABEL: Record<TileKind, string> = {
  grass: "草地",
  road: "道路",
  intersection: "交差点",
  house: "住宅",
  shop: "店舗",
  company: "会社",
  hospital: "病院",
  school: "学校",
  station: "駅",
  park: "公園",
  tree: "樹木",
  busStop: "バス停",
};

export function getTileKind(
  point: GridPoint,
  grid: readonly string[] = TOWN_GRID
): TileKind {
  const code = grid[point.row]?.[point.col] ?? "g";
  return tileKindByCode[code] ?? "grass";
}

export function isRoadTile(
  point: GridPoint,
  grid: readonly string[] = TOWN_GRID
) {
  const kind = getTileKind(point, grid);
  return kind === "road" || kind === "intersection";
}

export function gridKey(point: GridPoint) {
  return `${point.row}:${point.col}`;
}

export function sameGridPoint(a: GridPoint, b: GridPoint) {
  return a.row === b.row && a.col === b.col;
}

export function gridToMapPercent(
  point: GridPoint,
  rows: number = TOWN_ROWS,
  cols: number = TOWN_COLS
) {
  return {
    x: ((point.col + 0.5) / cols) * 100,
    y: ((point.row + 0.5) / rows) * 100,
  };
}

export function gridToWorld(
  point: GridPoint,
  rows: number = TOWN_ROWS,
  cols: number = TOWN_COLS
) {
  return {
    x: (point.col - (cols - 1) / 2) * TILE_SIZE,
    z: (point.row - (rows - 1) / 2) * TILE_SIZE,
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
    description: "鉄道と路線バスの乗り換え拠点",
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
    description: "午前中の通院需要が集中する医療拠点",
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
    description: "買い物と荷物の持ち帰りを支える生活拠点",
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
    description: "週末イベントと飲食店が集まるにぎわい拠点",
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
    description: "学生イベントや部活動の集合場所",
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
    description: "地元企業説明会と採用イベントの会場",
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
    description: "高齢者世帯が多く、バス停まで距離がある住宅地",
  },
];

// SSR・Supabase接続前のフォールバック用デフォルトマップ
export const defaultMapDefinition: MapDefinition = {
  id: "town-default-fallback",
  slug: "town-default",
  name: "みんなのまち",
  rows: TOWN_ROWS,
  cols: TOWN_COLS,
  grid: [...TOWN_GRID],
  features: mapFeatures,
  isDefault: true,
  updatedAt: "1970-01-01T00:00:00.000Z",
};

function buildLocation(
  feature: MapFeature,
  rows: number,
  cols: number
): BusStopLocation {
  return {
    id: feature.id,
    name: feature.label,
    shortName: feature.shortLabel,
    kind: feature.kind,
    grid: feature.grid,
    roadAccess: feature.roadAccess,
    map: gridToMapPercent(feature.grid, rows, cols),
    world: gridToWorld(feature.roadAccess, rows, cols),
    color: feature.color,
    icon: feature.icon,
    description: feature.description ?? "",
  };
}

export function getMapLocations(
  map: MapDefinition = defaultMapDefinition
): BusStopLocation[] {
  return map.features.map((feature) =>
    buildLocation(feature, map.rows, map.cols)
  );
}

export const locations: BusStopLocation[] = getMapLocations(defaultMapDefinition);

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

export function getLocation(
  id: string,
  map: MapDefinition = defaultMapDefinition
): BusStopLocation {
  const feature = map.features.find((item) => item.id === id) ?? map.features[0];
  if (!feature) {
    return locations[0];
  }
  return buildLocation(feature, map.rows, map.cols);
}

export function getMapFeature(
  id: string,
  map: MapDefinition = defaultMapDefinition
): MapFeature {
  return map.features.find((feature) => feature.id === id) ?? map.features[0] ?? mapFeatures[0];
}

function getRoadNeighbors(point: GridPoint, grid: readonly string[]) {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  return [
    { row: point.row - 1, col: point.col },
    { row: point.row + 1, col: point.col },
    { row: point.row, col: point.col - 1 },
    { row: point.row, col: point.col + 1 },
  ].filter(
    (candidate) =>
      candidate.row >= 0 &&
      candidate.row < rows &&
      candidate.col >= 0 &&
      candidate.col < cols &&
      isRoadTile(candidate, grid)
  );
}

export function findRoadRoute(
  fromLocationId: string,
  toLocationId: string,
  map: MapDefinition = defaultMapDefinition
): GridPoint[] {
  const start = getLocation(fromLocationId, map).roadAccess;
  const goal = getLocation(toLocationId, map).roadAccess;
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

    for (const next of getRoadNeighbors(current, map.grid)) {
      const key = gridKey(next);
      if (visited.has(key)) continue;
      visited.add(key);
      previous.set(key, current);
      queue.push(next);
    }
  }

  return [start, goal];
}

export function getScenarioLocations(
  scenarioId: ScenarioId,
  map: MapDefinition = defaultMapDefinition
) {
  const scenario = getScenario(scenarioId);
  const locationIds = new Set([
    "station",
    "housing",
    scenario.primaryDestinationId,
    ...scenario.regionInfo.map((item) => item.locationId),
  ]);

  return getMapLocations(map).filter((location) => locationIds.has(location.id));
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

export const REQUEST_SUPPORT_THRESHOLD = 10;

export function createInitialDemoState(
  scenarioId: ScenarioId = "medical",
  activeMapId: string | null = null
): DemoState {
  const scenario = getScenario(scenarioId);

  return {
    scenarioId,
    currentLocationId: "station",
    robotStatus: "idle",
    selectedDestinationId: scenario.primaryDestinationId,
    requests: createSeedRequests(),
    activeCommand: null,
    activeMapId,
    updatedAt: now(),
  };
}

// Supabase 行 (snake_case) を MapDefinition (camelCase) に変換するヘルパ。
// queries.ts と Route Handler 双方から使うのでここに置く。
export function mapRowToDefinition(row: {
  id: string;
  slug: string;
  name: string;
  rows: number;
  cols: number;
  grid: string[];
  features: unknown;
  is_default: boolean;
  updated_at: string;
}): MapDefinition {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    rows: row.rows,
    cols: row.cols,
    grid: row.grid,
    features: Array.isArray(row.features)
      ? (row.features as MapFeature[])
      : [],
    isDefault: row.is_default,
    updatedAt: row.updated_at,
  };
}

// 空マップを作る (新規作成時)
export function createEmptyMapGrid(rows: number, cols: number): string[] {
  return Array.from({ length: rows }, () => "g".repeat(cols));
}
