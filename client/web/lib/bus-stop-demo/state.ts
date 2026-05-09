import {
  createInitialDemoState,
  defaultMapDefinition,
  getLocation,
  getScenario,
} from "./data";
import type {
  DemoState,
  MapDefinition,
  MoveCommand,
  MoveRequest,
  ReactionKey,
  RequestType,
  RobotStatus,
  ScenarioId,
} from "./types";

type RequestInput = {
  requestType: RequestType;
  title: string;
  destinationId: string;
  desiredTime: string;
  reason: string;
  audience: string;
  note: string;
  eventName?: string;
  expectedPeople?: string;
  sponsored?: boolean;
};

const now = () => new Date().toISOString();

const makeId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

export function touchState(state: DemoState): DemoState {
  return {
    ...state,
    updatedAt: now(),
  };
}

export function getRequestSupportTotal(request: MoveRequest) {
  return (
    request.reactions.wantToGo + request.reactions.helpful + request.reactions.cheer
  );
}

export function switchScenario(
  state: DemoState,
  scenarioId: ScenarioId
): DemoState {
  const scenario = getScenario(scenarioId);

  return touchState({
    ...state,
    scenarioId,
    selectedDestinationId: scenario.primaryDestinationId,
    robotStatus: "idle",
    activeCommand: null,
  });
}

export function selectDestination(
  state: DemoState,
  destinationId: string
): DemoState {
  return touchState({
    ...state,
    selectedDestinationId: destinationId,
  });
}

export function addReaction(
  state: DemoState,
  requestId: string,
  reaction: ReactionKey
): DemoState {
  return touchState({
    ...state,
    requests: state.requests.map((request) =>
      request.id === requestId
        ? {
            ...request,
            reactions: {
              ...request.reactions,
              [reaction]: request.reactions[reaction] + 1,
            },
          }
        : request
    ),
  });
}

export function createMoveRequest(
  state: DemoState,
  input: RequestInput,
  map: MapDefinition = defaultMapDefinition
): MoveRequest {
  const scenario = getScenario(state.scenarioId);
  const destination = getLocation(input.destinationId, map);
  const isBusiness = input.requestType === "business";
  const eventPrefix = input.eventName ? `${input.eventName}: ` : "";
  const expected = input.expectedPeople || "20";
  const title =
    input.title.trim() ||
    `${eventPrefix}${destination.name}にバス停を呼びたい`;

  return {
    id: makeId("req"),
    scenarioId: state.scenarioId,
    requestType: input.requestType,
    title,
    destinationId: input.destinationId,
    desiredTime: input.desiredTime || scenario.recommendedTime,
    reason: input.reason,
    audience: input.audience,
    note: input.note,
    status: "candidate",
    reactions: {
      wantToGo: isBusiness ? 8 : 3,
      helpful: isBusiness ? 5 : 4,
      cheer: input.sponsored ? 14 : 6,
    },
    impact: isBusiness
      ? [
          "企業説明会へのアクセス改善",
          `参加見込み ${expected}人の移動を支援`,
          "協賛による地域交通モデルを提示",
        ]
      : [
          `${input.audience}の徒歩距離を短縮`,
          `${destination.shortName}周辺への移動需要を可視化`,
          "地域の声を交通運用に反映",
        ],
    beforeAfter: isBusiness
      ? [
          { label: "参加見込み", before: "8人", after: `${expected}人` },
          { label: "駅から徒歩", before: "14分", after: "5分" },
        ]
      : [
          { label: "最寄りまで徒歩", before: "12分", after: "4分" },
          { label: "助かる人", before: "18人", after: "42人" },
        ],
    aiReason: isBusiness
      ? "開催時刻と駅前需要が重なり、協賛効果も説明しやすい移動です。"
      : `${destination.shortName}への申請と応援が集まり、既存バス停から遠い人の改善効果が大きいです。`,
    createdAt: now(),
  };
}

export function addRequest(
  state: DemoState,
  input: RequestInput,
  map: MapDefinition = defaultMapDefinition
): DemoState {
  const request = createMoveRequest(state, input, map);
  return touchState({
    ...state,
    selectedDestinationId: request.destinationId,
    requests: [request, ...state.requests],
  });
}

export function removeRequest(
  state: DemoState,
  requestId: string
): DemoState {
  const stillReferenced =
    state.activeCommand?.requestId === requestId ? null : state.activeCommand;
  return touchState({
    ...state,
    requests: state.requests.filter((request) => request.id !== requestId),
    activeCommand: stillReferenced,
  });
}

export function issueCommand(
  state: DemoState,
  requestId: string,
  map: MapDefinition = defaultMapDefinition
): DemoState {
  const request = state.requests.find((item) => item.id === requestId);
  if (!request) return state;

  const destination = getLocation(request.destinationId, map);
  const command: MoveCommand = {
    id: makeId("cmd"),
    requestId,
    fromLocationId: state.currentLocationId,
    toLocationId: request.destinationId,
    reason: request.reason,
    audience: request.audience,
    impact: request.impact,
    beforeAfter: request.beforeAfter,
    aiReason: request.aiReason,
    message: `${destination.name}へ向かいます。${request.audience}の移動を支援します。`,
    status: "moving",
    createdAt: now(),
  };

  return touchState({
    ...state,
    selectedDestinationId: request.destinationId,
    robotStatus: "moving",
    activeCommand: command,
    requests: state.requests.map((item) => ({
      ...item,
      status: item.id === requestId ? "adopted" : "candidate",
    })),
  });
}

export function updateRobotStatus(
  state: DemoState,
  status: RobotStatus
): DemoState {
  const activeCommand = state.activeCommand
    ? { ...state.activeCommand, status }
    : null;

  return touchState({
    ...state,
    robotStatus: status,
    currentLocationId:
      status === "arrived" || status === "guiding"
        ? state.activeCommand?.toLocationId ?? state.currentLocationId
        : state.currentLocationId,
    activeCommand,
  });
}

export function resetDemoState(
  scenarioId?: ScenarioId,
  activeMapId: string | null = null
): DemoState {
  return createInitialDemoState(scenarioId, activeMapId);
}
