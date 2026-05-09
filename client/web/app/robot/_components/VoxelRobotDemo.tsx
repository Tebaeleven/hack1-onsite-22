"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import {
  ArrowLeftIcon,
  BotIcon,
  BusIcon,
  CheckCircle2Icon,
  MapPinIcon,
  NavigationIcon,
  SparklesIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  TILE_SIZE,
  defaultMapDefinition,
  findRoadRoute,
  getLocation,
  getTileKind,
  gridKey,
  gridToWorld,
} from "@/lib/bus-stop-demo/data";
import { updateRobotStatus } from "@/lib/bus-stop-demo/state";
import type {
  GridPoint,
  MapDefinition,
  TileKind,
} from "@/lib/bus-stop-demo/types";
import { useSyncedDemoState } from "@/lib/bus-stop-demo/use-synced-demo-state";
import { getDefaultMap, getMap } from "@/lib/maps/queries";

type ThreeRefs = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  robot: THREE.Group;
  wheels: THREE.Mesh[];
  targetMarker: THREE.Group;
  routeLine: THREE.Line;
  route: THREE.Vector3[];
  frameId: number;
  disposed: boolean;
};

const statusLabel = {
  idle: "待機中",
  moving: "移動中",
  arrived: "到着",
  guiding: "案内中",
};

// 1 タイル進むのに要する時間。command.createdAt からの経過時間で位置を決定的に算出する
const TILE_DURATION_MS = 600;

export function VoxelRobotDemo() {
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const refs = useRef<ThreeRefs | null>(null);
  const arrivalCommandRef = useRef<string | null>(null);
  const { state, updateState } = useSyncedDemoState();
  const [currentMap, setCurrentMap] = useState<MapDefinition>(defaultMapDefinition);
  // 最新 state を animate ループ (frame closure) から参照するための ref
  const stateRef = useRef(state);
  stateRef.current = state;

  // activeMapId が変わったらリモートからマップを取得
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const fetched = state.activeMapId
        ? await getMap(state.activeMapId)
        : await getDefaultMap();
      if (!cancelled && fetched) setCurrentMap(fetched);
    })();
    return () => {
      cancelled = true;
    };
  }, [state.activeMapId]);

  const command = state.activeCommand;
  const fromLocation = getLocation(
    command?.fromLocationId ?? state.currentLocationId,
    currentMap
  );
  const toLocation = getLocation(
    command?.toLocationId ?? state.selectedDestinationId,
    currentMap
  );
  const impact = command?.impact ?? [
    "アプリの申請を受け取ると、ロボットが目的地へ移動します。",
    "到着後に新しいバス停位置として案内します。",
  ];

  const robotLine = useMemo(() => {
    if (!command) return "アプリで申請すると、ここに指令が届きます。";
    if (state.robotStatus === "moving") {
      return `${toLocation.name}へ自律移動中です。`;
    }
    if (state.robotStatus === "arrived") {
      return `${toLocation.name}に到着しました。`;
    }
    return `${toLocation.shortName}で乗り場案内を開始しました。`;
  }, [command, state.robotStatus, toLocation.name, toLocation.shortName]);

  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#8be7ff");
    scene.fog = new THREE.Fog("#8be7ff", 18, 42);

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 16, 18);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    host.appendChild(renderer.domElement);

    const hemi = new THREE.HemisphereLight("#ffffff", "#58cc02", 1.8);
    scene.add(hemi);

    const sun = new THREE.DirectionalLight("#ffffff", 2.2);
    sun.position.set(8, 14, 7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    scene.add(sun);

    buildWorld(scene, currentMap);
    const robot = createBusStopRobot();
    const startLocation = getLocation(state.currentLocationId, currentMap);
    robot.position.copy(gridToVector(startLocation.roadAccess, currentMap));
    scene.add(robot);

    const targetMarker = createTargetMarker();
    const targetLocation = getLocation(
      command?.toLocationId ?? state.selectedDestinationId,
      currentMap
    );
    targetMarker.position.copy(gridToVector(targetLocation.roadAccess, currentMap));
    scene.add(targetMarker);

    const initialRoute = findRoadRoute(
      startLocation.id,
      targetLocation.id,
      currentMap
    ).map((p) => gridToVector(p, currentMap));
    const routeLine = createRouteLine(initialRoute);
    scene.add(routeLine);

    refs.current = {
      renderer,
      scene,
      camera,
      robot,
      wheels: robot.userData.wheels as THREE.Mesh[],
      targetMarker,
      routeLine,
      route: initialRoute,
      frameId: 0,
      disposed: false,
    };

    const resize = () => {
      if (!refs.current || !host) return;
      const { width, height } = host.getBoundingClientRect();
      refs.current.renderer.setSize(width, height);
      refs.current.camera.aspect = width / Math.max(height, 1);
      refs.current.camera.updateProjectionMatrix();
    };

    const animate = () => {
      const active = refs.current;
      if (!active || active.disposed) return;

      const cmd = stateRef.current.activeCommand;
      const status = stateRef.current.robotStatus;
      const route = active.route;

      // moving 中は command.createdAt + 経過時間 + ルート長から決定的に位置を算出する。
      // 全クライアントが同じ計算をするので、別端末でも同じマス目に揃う。
      if (cmd && status === "moving" && route.length >= 2) {
        const startTime = new Date(cmd.createdAt).getTime();
        const totalMs = (route.length - 1) * TILE_DURATION_MS;
        const elapsedMs = Date.now() - startTime;
        const progress = Math.max(0, Math.min(elapsedMs / totalMs, 1));
        const seg = progress * (route.length - 1);
        const idx = Math.min(Math.floor(seg), route.length - 2);
        const t = seg - idx;
        const a = route[idx];
        const b = route[idx + 1];
        active.robot.position.copy(a).lerp(b, t);
        const dir = b.clone().sub(a);
        if (dir.lengthSq() > 0.0001) {
          active.robot.rotation.y = Math.atan2(dir.x, dir.z);
        }
        active.wheels.forEach((wheel) => {
          wheel.rotation.x -= 0.18;
        });
      }

      active.targetMarker.rotation.y += 0.02;
      active.targetMarker.position.y = 0.12 + Math.sin(Date.now() * 0.004) * 0.05;
      active.camera.lookAt(active.robot.position.x * 0.25, 0.8, active.robot.position.z * 0.25);
      active.renderer.render(active.scene, active.camera);
      active.frameId = requestAnimationFrame(animate);
    };

    resize();
    window.addEventListener("resize", resize);
    animate();

    return () => {
      window.removeEventListener("resize", resize);
      if (!refs.current) return;
      refs.current.disposed = true;
      cancelAnimationFrame(refs.current.frameId);
      disposeScene(refs.current.scene);
      refs.current.renderer.dispose();
      refs.current.renderer.domElement.remove();
      refs.current = null;
    };
    // currentMap が変わるとシーンを丸ごと作り直す
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMap]);

  useEffect(() => {
    const active = refs.current;
    if (!active) return;

    const routePoints = findRoadRoute(
      command?.fromLocationId ?? state.currentLocationId,
      command?.toLocationId ?? state.selectedDestinationId,
      currentMap
    ).map((p) => gridToVector(p, currentMap));
    const start = routePoints[0];
    const target = routePoints[routePoints.length - 1];

    active.route = routePoints;

    if (!command) {
      active.robot.position.copy(start);
    } else if (state.robotStatus !== "moving") {
      active.robot.position.copy(target);
    }
    // moving 中は animate ループが時間ベースで位置を決めるので、ここでは触らない

    active.targetMarker.position.copy(target);
    updateRouteLine(active.routeLine, routePoints);

    if (command?.id) {
      arrivalCommandRef.current = null;
    }
  }, [command, state.currentLocationId, state.selectedDestinationId, state.robotStatus, currentMap]);

  useEffect(() => {
    if (!command || state.robotStatus !== "moving") return;
    if (arrivalCommandRef.current === command.id) return;
    const active = refs.current;
    if (!active || active.route.length < 2) return;

    const startTime = new Date(command.createdAt).getTime();
    const totalMs = (active.route.length - 1) * TILE_DURATION_MS;
    const remaining = Math.max(50, startTime + totalMs - Date.now());

    const arriveTimer = window.setTimeout(() => {
      if (arrivalCommandRef.current === command.id) return;
      arrivalCommandRef.current = command.id;
      updateState((current) => updateRobotStatus(current, "arrived"));
      window.setTimeout(() => {
        updateState((current) => updateRobotStatus(current, "guiding"));
      }, 1400);
    }, remaining);

    return () => window.clearTimeout(arriveTimer);
  }, [command, state.robotStatus, updateState]);

  return (
    <main className="min-h-screen bg-[#dff8f2] p-3 text-[#25302b] sm:p-5">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-[2rem] border-4 border-[#313131] bg-white px-4 py-3 shadow-[0_8px_0_#313131]">
          <div className="flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-2xl bg-[#58cc02] text-white shadow-[0_5px_0_#2f8d12]">
              <BotIcon />
            </div>
            <div>
              <p className="text-xs font-black text-[#58a700]">3D連動デモ</p>
              <h1 className="text-lg font-black sm:text-2xl">
                バス停ロボットが動く街
              </h1>
            </div>
          </div>
          <Button asChild className="h-12 rounded-2xl bg-[#1cb0f6] px-4 font-black text-white shadow-[0_5px_0_#0b82bd] hover:bg-[#1899d6]">
            <Link href="/">
              <ArrowLeftIcon data-icon="inline-start" />
              アプリへ戻る
            </Link>
          </Button>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1fr_370px]">
          <div className="relative min-h-[68vh] overflow-hidden rounded-[2rem] border-4 border-[#313131] bg-[#8be7ff] shadow-[0_8px_0_#313131]">
            <div ref={canvasHostRef} className="absolute inset-0" />
            <div className="pointer-events-none absolute left-4 top-4 flex flex-wrap gap-2">
              <Badge className="rounded-full bg-[#ff9600] px-3 py-1 text-white">
                <NavigationIcon data-icon="inline-start" />
                {fromLocation.shortName} → {toLocation.shortName}
              </Badge>
              <Badge className="rounded-full bg-[#58cc02] px-3 py-1 text-white">
                <BusIcon data-icon="inline-start" />
                {statusLabel[state.robotStatus]}
              </Badge>
            </div>
            <div className="pointer-events-none absolute bottom-4 left-1/2 w-[min(92%,720px)] -translate-x-1/2 rounded-[1.5rem] border-4 border-[#313131] bg-white/95 p-4 text-center shadow-[0_6px_0_#313131]">
              <p className="text-sm font-black text-[#58a700]">ロボットの接客表示</p>
              <p className="mt-1 text-lg font-black sm:text-2xl">{robotLine}</p>
            </div>
          </div>

          <aside className="flex flex-col gap-4">
            <section className="rounded-[2rem] border-4 border-[#313131] bg-white p-4 shadow-[0_8px_0_#313131]">
              <div className="flex items-center gap-3">
                <div className="grid size-12 place-items-center rounded-2xl bg-[#ff4b4b] text-white shadow-[0_5px_0_#c73434]">
                  <SparklesIcon />
                </div>
                <div>
                  <p className="text-xs font-black text-[#ff4b4b]">受信した指令</p>
                  <h2 className="text-xl font-black">{statusLabel[state.robotStatus]}</h2>
                </div>
              </div>

              <div className="mt-4 grid gap-3">
                <PanelRow icon={<MapPinIcon />} label="出発地点" value={fromLocation.name} />
                <PanelRow icon={<NavigationIcon />} label="目的地" value={toLocation.name} />
                <PanelRow icon={<BotIcon />} label="理由" value={command?.reason ?? "アプリから申請待ち"} />
                <PanelRow icon={<CheckCircle2Icon />} label="対象者" value={command?.audience ?? "地域の利用者"} />
              </div>
            </section>

            <section className="rounded-[2rem] border-4 border-[#313131] bg-[#fff2b8] p-4 shadow-[0_8px_0_#313131]">
              <p className="text-xs font-black text-[#9c6500]">地域効果</p>
              <h2 className="text-xl font-black">この移動で助かること</h2>
              <ul className="mt-3 flex flex-col gap-2">
                {impact.map((item) => (
                  <li key={item} className="rounded-2xl bg-white px-3 py-2 text-sm font-black shadow-[0_4px_0_#d1d5db]">
                    {item}
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-[2rem] border-4 border-[#313131] bg-white p-4 shadow-[0_8px_0_#313131]">
              <p className="text-xs font-black text-[#58a700]">Before / After</p>
              <h2 className="text-xl font-black">効果の見える化</h2>
              <div className="mt-3 grid gap-2">
                {(command?.beforeAfter ?? []).map((metric) => (
                  <div key={metric.label} className="rounded-2xl bg-[#f3f7f2] p-3">
                    <p className="text-xs font-black text-[#53635a]">{metric.label}</p>
                    <p className="mt-1 text-lg font-black">
                      <span className="text-[#ff4b4b]">{metric.before}</span>
                      <span className="px-2">→</span>
                      <span className="text-[#58cc02]">{metric.after}</span>
                    </p>
                  </div>
                ))}
                {!command ? (
                  <p className="rounded-2xl bg-[#f3f7f2] p-3 text-sm font-bold text-[#53635a]">
                    アプリ側で申請を出すと、ここに効果指標が表示されます。
                  </p>
                ) : null}
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}

function PanelRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-[#f3f7f2] p-3">
      <div className="grid size-10 place-items-center rounded-full bg-white text-[#58a700]">
        {icon}
      </div>
      <div>
        <p className="text-xs font-black text-[#53635a]">{label}</p>
        <p className="font-black">{value}</p>
      </div>
    </div>
  );
}

function buildWorld(scene: THREE.Scene, map: MapDefinition) {
  const groundWidth = map.cols * TILE_SIZE;
  const groundDepth = map.rows * TILE_SIZE;
  const ground = box("#58cc02", groundWidth + 0.9, 0.35, groundDepth + 0.9, 0, -0.22, 0);
  ground.receiveShadow = true;
  scene.add(ground);

  const featureByGrid = new Map(
    map.features.map((feature) => [gridKey(feature.grid), feature])
  );

  map.grid.forEach((row, rowIndex) => {
    [...row].forEach((_, colIndex) => {
      const point = { row: rowIndex, col: colIndex };
      const kind = getTileKind(point, map.grid);
      const position = gridToWorld(point, map.rows, map.cols);
      scene.add(createGroundTile(kind, position.x, position.z));

      const feature = featureByGrid.get(gridKey(point));
      if (feature) {
        const building = createBuilding(
          feature.shortLabel,
          feature.color,
          feature.tileKind,
          feature.height
        );
        building.position.set(position.x, 0, position.z);
        scene.add(building);
        return;
      }

      if (kind === "tree") {
        const tree = createTree();
        tree.position.set(position.x, 0, position.z);
        scene.add(tree);
      } else if (kind === "house") {
        const house = createBuilding("住宅", "#84CC16", "house", 0.95);
        house.position.set(position.x, 0, position.z);
        scene.add(house);
      } else if (kind === "shop") {
        const shop = createBuilding("店", "#F59E0B", "shop", 1.0);
        shop.position.set(position.x, 0, position.z);
        scene.add(shop);
      } else if (kind === "park") {
        const tent = createBuilding("広場", "#22C55E", "park", 0.75);
        tent.position.set(position.x, 0, position.z);
        scene.add(tent);
      }
    });
  });

  // 駅前に既存バス車両を1台 (マップの最初の駅 feature を基準にする)
  const station = map.features.find((f) => f.kind === "station") ?? map.features[0];
  if (station) {
    const bus = createVoxelBus();
    const busPoint = gridToWorld(station.roadAccess, map.rows, map.cols);
    bus.position.set(busPoint.x, 0.25, busPoint.z);
    bus.rotation.y = Math.PI / 2;
    scene.add(bus);
  }
}

function createGroundTile(kind: TileKind, x: number, z: number) {
  const isRoad = kind === "road" || kind === "intersection";
  const tile = box(
    isRoad ? (kind === "intersection" ? "#b8bec3" : "#cfd3d6") : "#58cc02",
    TILE_SIZE * 0.96,
    isRoad ? 0.08 : 0.06,
    TILE_SIZE * 0.96,
    x,
    isRoad ? 0.02 : 0,
    z
  );

  if (isRoad) {
    const lane = box("#f8fafc", TILE_SIZE * 0.1, 0.09, TILE_SIZE * 0.72, x, 0.08, z);
    const group = new THREE.Group();
    group.add(tile, lane);
    return group;
  }

  return tile;
}

function createBuilding(
  label: string,
  color: string,
  kind: TileKind | string,
  height: number
) {
  const group = new THREE.Group();
  const footprint = kind === "house" ? 0.82 : 1.02;
  const body = box(color, footprint, height, footprint, 0, height / 2, 0);
  const roofColor = kind === "hospital" ? "#ff4b4b" : "#313131";
  const roof = box(roofColor, footprint + 0.18, 0.22, footprint + 0.18, 0, height + 0.14, 0);
  const sign = createTextPlane(label, "#ffffff", "#25302b", 1.05, 0.34);
  sign.position.set(0, height + 0.52, 0.81);
  sign.scale.setScalar(kind === "house" ? 0.7 : 1);
  sign.rotation.x = 0;

  group.add(body, roof, sign);

  for (let row = 0; row < 2; row += 1) {
    for (let col = 0; col < 2; col += 1) {
      const windowBlock = box("#dff8f2", 0.2, 0.18, 0.04, -0.22 + col * 0.44, 0.48 + row * 0.32, footprint / 2 + 0.03);
      group.add(windowBlock);
    }
  }

  return group;
}

function createVoxelBus() {
  const group = new THREE.Group();
  group.add(box("#ffde59", 2.6, 0.9, 1.1, 0, 0.62, 0));
  group.add(box("#ffffff", 2.4, 0.38, 1.12, 0, 0.98, 0));
  group.add(box("#1cb0f6", 0.42, 0.28, 1.16, -0.72, 1.02, 0));
  group.add(box("#1cb0f6", 0.42, 0.28, 1.16, 0, 1.02, 0));
  group.add(box("#1cb0f6", 0.42, 0.28, 1.16, 0.72, 1.02, 0));
  [-0.8, 0.8].forEach((x) => {
    const wheel = cylinder("#313131", 0.24, 0.22);
    wheel.position.set(x, 0.28, -0.58);
    wheel.rotation.z = Math.PI / 2;
    group.add(wheel);
  });
  return group;
}

function createBusStopRobot() {
  const group = new THREE.Group();
  const wheels: THREE.Mesh[] = [];

  group.add(box("#ffffff", 1.45, 0.5, 1.25, 0, 0.55, 0));
  group.add(box("#58cc02", 1.62, 0.22, 1.42, 0, 0.92, 0));
  group.add(box("#313131", 0.18, 1.6, 0.18, -0.5, 1.65, 0));
  group.add(box("#313131", 0.18, 1.6, 0.18, 0.5, 1.65, 0));
  group.add(box("#ffde59", 1.5, 0.28, 1.25, 0, 2.45, 0));

  const face = createTextPlane("BUS STOP", "#ffffff", "#25302b", 1.45, 0.58);
  face.position.set(0, 1.64, 0.66);
  group.add(face);

  const message = createTextPlane("案内中", "#1cb0f6", "#ffffff", 1.1, 0.36);
  message.position.set(0, 1.2, 0.67);
  group.add(message);

  [
    [-0.55, -0.48],
    [0.55, -0.48],
    [-0.55, 0.48],
    [0.55, 0.48],
  ].forEach(([x, z]) => {
    const wheel = cylinder("#313131", 0.2, 0.18);
    wheel.position.set(x, 0.26, z);
    wheel.rotation.z = Math.PI / 2;
    wheels.push(wheel);
    group.add(wheel);
  });

  group.userData.wheels = wheels;
  return group;
}

function createTargetMarker() {
  const group = new THREE.Group();
  group.add(box("#ff4b4b", 0.95, 0.12, 0.95, 0, 0.08, 0));
  const pole = cylinder("#ff4b4b", 0.08, 1.2);
  pole.position.y = 0.7;
  group.add(pole);
  const top = box("#ffde59", 0.65, 0.65, 0.16, 0, 1.42, 0);
  top.rotation.y = Math.PI / 4;
  group.add(top);
  return group;
}

function createTree() {
  const group = new THREE.Group();
  const trunk = box("#9c6500", 0.28, 0.8, 0.28, 0, 0.4, 0);
  const leaf = box("#2f8d12", 0.95, 0.95, 0.95, 0, 1.05, 0);
  leaf.rotation.y = Math.PI / 4;
  group.add(trunk, leaf);
  return group;
}

function createRouteLine(route: THREE.Vector3[]) {
  const geometry = new THREE.BufferGeometry().setFromPoints(toRouteLinePoints(route));
  const material = new THREE.LineBasicMaterial({ color: "#ff4b4b", linewidth: 4 });
  return new THREE.Line(geometry, material);
}

function updateRouteLine(line: THREE.Line, route: THREE.Vector3[]) {
  line.geometry.dispose();
  line.geometry = new THREE.BufferGeometry().setFromPoints(toRouteLinePoints(route));
}

function toRouteLinePoints(route: THREE.Vector3[]) {
  return (route.length > 0 ? route : [new THREE.Vector3(0, 0.28, 0)]).map(
    (point) => point.clone().setY(0.14)
  );
}

function box(
  color: string,
  width: number,
  height: number,
  depth: number,
  x: number,
  y: number,
  z: number
) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshStandardMaterial({ color, roughness: 0.72 })
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function cylinder(color: string, radius: number, height: number) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, height, 18),
    new THREE.MeshStandardMaterial({ color, roughness: 0.68 })
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createTextPlane(
  text: string,
  background: string,
  foreground: string,
  width: number,
  height: number
) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 192;
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = background;
    roundRect(context, 18, 18, 476, 156, 34);
    context.fill();
    context.fillStyle = foreground;
    context.font = "900 58px sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, 256, 96, 430);
  }

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
  return new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
}

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function gridToVector(point: GridPoint, map: MapDefinition) {
  const world = gridToWorld(point, map.rows, map.cols);
  return new THREE.Vector3(world.x, 0.28, world.z);
}

function disposeScene(scene: THREE.Scene) {
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh || object instanceof THREE.Line)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    materials.forEach((material) => material.dispose());
  });
}
