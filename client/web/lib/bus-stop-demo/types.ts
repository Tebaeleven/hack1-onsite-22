export type ScenarioId = "medical" | "shopping" | "student" | "business";

export type RobotStatus = "idle" | "moving" | "arrived" | "guiding";

export type ReactionKey = "wantToGo" | "helpful" | "cheer";

export type RequestType = "citizen" | "business";

export type LocationKind =
  | "station"
  | "hospital"
  | "shopping"
  | "event"
  | "school"
  | "company"
  | "community";

export type TileKind =
  | "grass"
  | "road"
  | "intersection"
  | "house"
  | "shop"
  | "company"
  | "hospital"
  | "school"
  | "station"
  | "park"
  | "tree"
  | "busStop";

export type GridPoint = {
  row: number;
  col: number;
};

export type MapFeature = {
  id: string;
  label: string;
  shortLabel: string;
  kind: LocationKind;
  tileKind: TileKind;
  grid: GridPoint;
  roadAccess: GridPoint;
  color: string;
  icon: string;
  height: number;
};

export type BusStopLocation = {
  id: string;
  name: string;
  shortName: string;
  kind: LocationKind;
  grid: GridPoint;
  roadAccess: GridPoint;
  map: {
    x: number;
    y: number;
  };
  world: {
    x: number;
    z: number;
  };
  color: string;
  icon: string;
  description: string;
};

export type BeforeAfterMetric = {
  label: string;
  before: string;
  after: string;
};

export type MoveRequest = {
  id: string;
  scenarioId: ScenarioId;
  requestType: RequestType;
  title: string;
  destinationId: string;
  desiredTime: string;
  reason: string;
  audience: string;
  note: string;
  status: "candidate" | "adopted";
  reactions: Record<ReactionKey, number>;
  impact: string[];
  beforeAfter: BeforeAfterMetric[];
  aiReason: string;
  createdAt: string;
};

export type MoveCommand = {
  id: string;
  requestId: string;
  fromLocationId: string;
  toLocationId: string;
  reason: string;
  audience: string;
  impact: string[];
  beforeAfter: BeforeAfterMetric[];
  aiReason: string;
  message: string;
  status: RobotStatus;
  createdAt: string;
};

export type DemoScenario = {
  id: ScenarioId;
  tabLabel: string;
  title: string;
  subtitle: string;
  mascotLine: string;
  scoreLabel: string;
  primaryDestinationId: string;
  recommendedTime: string;
  reasonOptions: string[];
  audienceOptions: string[];
  regionInfo: Array<{
    title: string;
    category: string;
    locationId: string;
    description: string;
  }>;
  defaultRequest: Omit<
    MoveRequest,
    "id" | "scenarioId" | "createdAt" | "status"
  >;
};

export type DemoState = {
  scenarioId: ScenarioId;
  currentLocationId: string;
  robotStatus: RobotStatus;
  selectedDestinationId: string;
  requests: MoveRequest[];
  activeCommand: MoveCommand | null;
  updatedAt: string;
};
