"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckIcon, MapPinIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createEmptyMapGrid,
  defaultMapDefinition,
} from "@/lib/bus-stop-demo/data";
import { createMap, updateMap } from "@/lib/maps/queries";
import type {
  GridPoint,
  MapDefinition,
  MapFeature,
} from "@/lib/bus-stop-demo/types";
import type { TileKindDef } from "@/lib/tiles/types";

const MAX_DIM = 32;
const MIN_DIM = 3;

const ZOOM_OPTIONS = [24, 32, 40, 48] as const;
const DEFAULT_ZOOM = 40;

const FALLBACK_BG = "#78c95e";
const FALLBACK_LABEL = "?";

type EditorMode = "size" | "spot";
type PickStage = "none" | "grid" | "roadAccess";

type FeatureDraft = MapFeature;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  map: MapDefinition | null; // null なら新規作成扱い (createMap)
  onSaved: (saved: MapDefinition) => void;
  tileKinds: TileKindDef[];
};

function reshapeGrid(
  grid: string[],
  nextRows: number,
  nextCols: number
): string[] {
  const result: string[] = [];
  for (let r = 0; r < nextRows; r += 1) {
    const source = grid[r] ?? "";
    const padded = source.padEnd(nextCols, "g").slice(0, nextCols);
    result.push(padded);
  }
  return result;
}

function setCell(grid: string[], row: number, col: number, code: string): string[] {
  return grid.map((line, r) => {
    if (r !== row) return line;
    return line.substring(0, col) + code + line.substring(col + 1);
  });
}

// 隣接 4 マスから道路 (road / intersection) を探す
function findAdjacentRoad(
  grid: string[],
  row: number,
  col: number,
  roadCodes: Set<string>
): GridPoint | null {
  const cands: GridPoint[] = [
    { row: row - 1, col },
    { row: row + 1, col },
    { row, col: col - 1 },
    { row, col: col + 1 },
  ];
  for (const c of cands) {
    const code = grid[c.row]?.[c.col];
    if (code && roadCodes.has(code)) return c;
  }
  return null;
}

export function MapEditor({ open, onOpenChange, map, onSaved, tileKinds }: Props) {
  const isNew = map === null;
  const [name, setName] = useState("");
  const [rows, setRows] = useState(defaultMapDefinition.rows);
  const [cols, setCols] = useState(defaultMapDefinition.cols);
  const [grid, setGrid] = useState<string[]>(() =>
    createEmptyMapGrid(defaultMapDefinition.rows, defaultMapDefinition.cols)
  );
  const [features, setFeatures] = useState<FeatureDraft[]>([]);
  const [selectedTile, setSelectedTile] = useState<string>("road");
  const [mode, setMode] = useState<EditorMode>("size");
  const [editingFeatureId, setEditingFeatureId] = useState<string | null>(null);
  const [pickStage, setPickStage] = useState<PickStage>("none");
  const [cellPx, setCellPx] = useState<number>(DEFAULT_ZOOM);
  const [saving, setSaving] = useState(false);
  const isPaintingRef = useRef(false);

  // tile_kinds から派生する各種マップ
  const defByKind = useMemo(() => {
    const map = new Map<string, TileKindDef>();
    for (const def of tileKinds) map.set(def.kind, def);
    return map;
  }, [tileKinds]);

  const kindByCode = useMemo(() => {
    const map = new Map<string, string>();
    for (const def of tileKinds) map.set(def.code, def.kind);
    return map;
  }, [tileKinds]);

  const sortedTileKinds = useMemo(
    () =>
      [...tileKinds].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.kind.localeCompare(b.kind)
      ),
    [tileKinds]
  );

  const buildingTileKinds = useMemo(
    () => sortedTileKinds.filter((d) => d.isBuilding),
    [sortedTileKinds]
  );

  const roadCodes = useMemo(() => {
    const set = new Set<string>();
    for (const def of tileKinds) {
      if (def.kind === "road" || def.kind === "intersection") set.add(def.code);
    }
    return set;
  }, [tileKinds]);

  const codeToCellInfo = (code: string | undefined) => {
    const kind = code ? kindByCode.get(code) : undefined;
    const def = kind ? defByKind.get(kind) : undefined;
    return {
      bgColor: def?.bgColor ?? FALLBACK_BG,
      emoji: def?.emoji ?? "",
      label: def?.label ?? FALLBACK_LABEL,
    };
  };

  const selectedTileDef = defByKind.get(selectedTile);
  const selectedTileLabel = selectedTileDef?.label ?? selectedTile;
  const selectedTileCode = selectedTileDef?.code ?? "g";

  // open または map が変わったときに state を初期化
  useEffect(() => {
    if (!open) return;
    if (map) {
      setName(map.name);
      setRows(map.rows);
      setCols(map.cols);
      setGrid(map.grid);
      setFeatures(map.features);
    } else {
      setName("新しいマップ");
      setRows(defaultMapDefinition.rows);
      setCols(defaultMapDefinition.cols);
      setGrid(createEmptyMapGrid(defaultMapDefinition.rows, defaultMapDefinition.cols));
      setFeatures([]);
    }
    setMode("size");
    setEditingFeatureId(null);
    setPickStage("none");
    setCellPx(DEFAULT_ZOOM);
    if (defByKind.has("road")) setSelectedTile("road");
  }, [open, map, defByKind]);

  // Esc でピック中断
  useEffect(() => {
    if (pickStage === "none") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPickStage("none");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pickStage]);

  const handleResize = (nextRows: number, nextCols: number) => {
    const r = Math.max(MIN_DIM, Math.min(MAX_DIM, Math.floor(nextRows)));
    const c = Math.max(MIN_DIM, Math.min(MAX_DIM, Math.floor(nextCols)));
    setRows(r);
    setCols(c);
    setGrid((current) => reshapeGrid(current, r, c));
    // スポットが範囲外になったら除外
    setFeatures((current) =>
      current.filter(
        (f) => f.grid.row < r && f.grid.col < c && f.roadAccess.row < r && f.roadAccess.col < c
      )
    );
  };

  const paintCell = (row: number, col: number) => {
    setGrid((current) => setCell(current, row, col, selectedTileCode));
  };

  const editingFeature = useMemo(
    () => features.find((f) => f.id === editingFeatureId) ?? null,
    [features, editingFeatureId]
  );

  const handleAddFeature = () => {
    const id = `spot-${Date.now().toString(36)}`;
    const houseDef = defByKind.get("house");
    const next: FeatureDraft = {
      id,
      label: "新しい場所",
      shortLabel: "場所",
      kind: "community",
      tileKind: houseDef?.kind ?? "house",
      grid: { row: 0, col: 0 },
      roadAccess: { row: 0, col: 0 },
      color: "#58cc02",
      icon: "📍",
      height: 1.0,
      description: "",
    };
    setFeatures((current) => [...current, next]);
    setEditingFeatureId(id);
    setMode("spot");
  };

  const handleUpdateFeature = (id: string, patch: Partial<FeatureDraft>) => {
    setFeatures((current) =>
      current.map((f) => (f.id === id ? { ...f, ...patch } : f))
    );
  };

  const handleDeleteFeature = (id: string) => {
    setFeatures((current) => current.filter((f) => f.id !== id));
    if (editingFeatureId === id) setEditingFeatureId(null);
  };

  const startPickGrid = () => {
    if (!editingFeature) return;
    setPickStage("grid");
  };

  const handleCellMouseDown = (row: number, col: number) => {
    // クリック配置モードを優先
    if (pickStage !== "none" && editingFeature) {
      if (pickStage === "grid") {
        const buildingDef = defByKind.get(editingFeature.tileKind) ?? defByKind.get("house");
        const buildingCode = buildingDef?.code ?? "h";
        // 建物セルを書き込み
        setGrid((current) => setCell(current, row, col, buildingCode));
        // 隣接道路を探す
        const adj = findAdjacentRoad(grid, row, col, roadCodes);
        if (adj) {
          handleUpdateFeature(editingFeature.id, {
            grid: { row, col },
            roadAccess: adj,
          });
          setPickStage("none");
          toast.success("建物のマスと隣接バス停を自動で設定しました");
        } else {
          handleUpdateFeature(editingFeature.id, {
            grid: { row, col },
            roadAccess: { row, col },
          });
          setPickStage("roadAccess");
          toast.message("続けて、バス停のマスをクリックしてください");
        }
        return;
      }
      if (pickStage === "roadAccess") {
        handleUpdateFeature(editingFeature.id, {
          roadAccess: { row, col },
        });
        setPickStage("none");
        return;
      }
    }
    // スポット編集タブ中はタイル上書きを禁止し、既存スポットの選択切替のみ
    if (mode === "spot") {
      const spotHere = features.find(
        (f) => f.grid.row === row && f.grid.col === col
      );
      if (spotHere) setEditingFeatureId(spotHere.id);
      return;
    }
    // サイズタブ: 通常のペイントモード
    isPaintingRef.current = true;
    paintCell(row, col);
  };

  const handleCellMouseEnter = (row: number, col: number) => {
    if (pickStage !== "none") return;
    if (mode === "spot") return;
    if (isPaintingRef.current) paintCell(row, col);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("マップ名を入力してください");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        rows,
        cols,
        grid,
        features,
      };
      const saved = isNew
        ? await createMap(payload)
        : await updateMap(map!.id, payload);
      toast.success(isNew ? "マップを作成しました" : "マップを保存しました");
      onSaved(saved);
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const cellEmojiClass =
    cellPx >= 44 ? "text-xl" : cellPx >= 36 ? "text-lg" : cellPx >= 28 ? "text-base" : "text-sm";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[min(96vw,1200px)] !w-[min(96vw,1200px)] max-h-[92vh] overflow-hidden p-0 sm:max-w-[min(96vw,1200px)]">
        <div className="flex h-full max-h-[92vh] flex-col">
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle className="text-lg font-bold">
              {isNew ? "マップを新規作成" : `マップを編集: ${map?.name}`}
            </DialogTitle>
            <DialogDescription>
              タイルパレットから選んで、マス目をクリックでペイントします。スポットは「📍 地図で位置を指定」で直感的に配置できます。
            </DialogDescription>
          </DialogHeader>

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden p-5 lg:grid-cols-[200px_minmax(0,1fr)_320px]">
            {/* Left: tile palette */}
            <Card className="overflow-y-auto">
              <CardHeader>
                <CardTitle>タイル</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2">
                {sortedTileKinds.map((def) => (
                  <Button
                    key={def.kind}
                    type="button"
                    variant={def.kind === selectedTile ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedTile(def.kind)}
                    className="h-auto flex-col gap-1 py-2"
                  >
                    <span
                      className="grid size-7 place-items-center rounded text-base"
                      style={{ backgroundColor: def.bgColor }}
                    >
                      {def.emoji}
                    </span>
                    <span className="text-[10px]">{def.label}</span>
                  </Button>
                ))}
              </CardContent>
            </Card>

            {/* Center: grid editor */}
            <Card className="min-h-0 overflow-hidden">
              <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <CardTitle>マップ ({rows}×{cols})</CardTitle>
                  <Badge variant="secondary" className="text-xs">
                    選択: {selectedTileLabel}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">ズーム</span>
                  {ZOOM_OPTIONS.map((z) => (
                    <Button
                      key={z}
                      type="button"
                      size="sm"
                      variant={cellPx === z ? "default" : "outline"}
                      onClick={() => setCellPx(z)}
                      className="h-7 px-2 text-[10px]"
                    >
                      {z}
                    </Button>
                  ))}
                  <Label htmlFor="map-name" className="sr-only">マップ名</Label>
                  <Input
                    id="map-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-8 w-40"
                    placeholder="マップ名"
                  />
                </div>
              </CardHeader>
              <CardContent
                className="min-h-0 flex-1 overflow-auto"
                onMouseUp={() => {
                  isPaintingRef.current = false;
                }}
                onMouseLeave={() => {
                  isPaintingRef.current = false;
                }}
              >
                {pickStage !== "none" ? (
                  <Alert className="mb-3 border-[#1cb0f6] bg-[#e0f5ff]">
                    <AlertDescription className="font-bold">
                      {pickStage === "grid"
                        ? "🟦 建物のマスをクリックしてください (Esc でキャンセル)"
                        : "🟨 バス停のマス (道路上) をクリックしてください (Esc でキャンセル)"}
                    </AlertDescription>
                  </Alert>
                ) : mode === "spot" ? (
                  <Alert className="mb-3 border-[#ffcf32] bg-[#fff8d6]">
                    <AlertDescription className="text-xs font-bold leading-relaxed">
                      📌 スポット編集モード: タイルのペイントは無効です。タイル編集は「サイズ」タブに切り替えてください。
                      編集中スポットの<span className="text-[#1cb0f6]">建物🟦</span>と<span className="text-[#ad7800]">バス停🟨</span>が地図上に色付き枠で表示されます。
                    </AlertDescription>
                  </Alert>
                ) : null}
                <div
                  className="mx-auto grid w-fit gap-px rounded border border-border bg-border p-px"
                  style={{
                    gridTemplateColumns: `repeat(${cols}, ${cellPx}px)`,
                    gridTemplateRows: `repeat(${rows}, ${cellPx}px)`,
                  }}
                >
                  {Array.from({ length: rows }).map((_, r) =>
                    Array.from({ length: cols }).map((_, c) => {
                      const code = grid[r]?.[c] ?? "g";
                      const cell = codeToCellInfo(code);
                      const featuresHere = features.filter(
                        (f) => f.grid.row === r && f.grid.col === c
                      );
                      const isEditingBuilding =
                        editingFeature !== null &&
                        editingFeature.grid.row === r &&
                        editingFeature.grid.col === c;
                      const isEditingRoad =
                        editingFeature !== null &&
                        editingFeature.roadAccess.row === r &&
                        editingFeature.roadAccess.col === c;
                      const cursor =
                        pickStage !== "none"
                          ? "cursor-crosshair"
                          : mode === "spot"
                            ? "cursor-pointer"
                            : "";
                      const editShadow = isEditingBuilding
                        ? "inset 0 0 0 3px #1cb0f6"
                        : isEditingRoad
                          ? "inset 0 0 0 3px #ffcf32"
                          : undefined;
                      return (
                        <button
                          key={`${r}:${c}`}
                          type="button"
                          onMouseDown={() => handleCellMouseDown(r, c)}
                          onMouseEnter={() => handleCellMouseEnter(r, c)}
                          className={`relative grid place-items-center hover:ring-2 hover:ring-foreground/40 ${cellEmojiClass} ${cursor} ${editShadow ? "z-10" : ""}`}
                          style={{
                            width: cellPx,
                            height: cellPx,
                            backgroundColor: cell.bgColor,
                            boxShadow: editShadow,
                          }}
                          title={`(${r},${c}) ${cell.label}${featuresHere.length > 0 ? ` / スポット:${featuresHere[0].label}` : ""}${isEditingBuilding ? " / 編集中スポットの建物🟦" : ""}${isEditingRoad ? " / 編集中スポットのバス停🟨" : ""}`}
                        >
                          {cell.emoji || ""}
                          {featuresHere.length > 0 ? (
                            <span className="absolute right-0.5 top-0.5 size-1.5 rounded-full bg-red-500 ring-1 ring-white" />
                          ) : null}
                          {isEditingBuilding ? (
                            <span className="absolute left-0.5 top-0.5 rounded-sm bg-[#1cb0f6] px-1 text-[8px] font-black leading-tight text-white">
                              建物
                            </span>
                          ) : null}
                          {isEditingRoad && !isEditingBuilding ? (
                            <span className="absolute left-0.5 top-0.5 rounded-sm bg-[#ffcf32] px-1 text-[8px] font-black leading-tight text-[#25302b]">
                              バス停
                            </span>
                          ) : null}
                        </button>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Right: size or spot panel */}
            <Card className="min-h-0 overflow-hidden">
              <CardHeader className="border-b">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={mode === "size" ? "default" : "outline"}
                    onClick={() => setMode("size")}
                  >
                    サイズ
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={mode === "spot" ? "default" : "outline"}
                    onClick={() => setMode("spot")}
                  >
                    スポット ({features.length})
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 overflow-y-auto">
                {mode === "size" ? (
                  <div className="grid gap-3">
                    <div>
                      <Label htmlFor="map-rows">行数 (rows)</Label>
                      <Input
                        id="map-rows"
                        type="number"
                        min={MIN_DIM}
                        max={MAX_DIM}
                        value={rows}
                        onChange={(e) =>
                          handleResize(Number(e.target.value || rows), cols)
                        }
                        className="mt-1 h-9"
                      />
                    </div>
                    <div>
                      <Label htmlFor="map-cols">列数 (cols)</Label>
                      <Input
                        id="map-cols"
                        type="number"
                        min={MIN_DIM}
                        max={MAX_DIM}
                        value={cols}
                        onChange={(e) =>
                          handleResize(rows, Number(e.target.value || cols))
                        }
                        className="mt-1 h-9"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      範囲: {MIN_DIM}〜{MAX_DIM}。サイズを縮めると、はみ出したスポットは自動で削除されます。
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    <Button type="button" size="sm" onClick={handleAddFeature}>
                      <PlusIcon data-icon="inline-start" />
                      スポットを追加
                    </Button>
                    <div className="grid gap-2">
                      {features.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          まだスポットがありません。
                        </p>
                      ) : (
                        features.map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => {
                              setEditingFeatureId(
                                editingFeatureId === f.id ? null : f.id
                              );
                              setPickStage("none");
                            }}
                            className={`flex items-center gap-2 rounded border px-2 py-1.5 text-left text-xs ${
                              editingFeatureId === f.id
                                ? "border-primary bg-primary/10"
                                : "border-border"
                            }`}
                          >
                            <span className="text-base">{f.icon}</span>
                            <span className="flex-1 truncate font-medium">
                              {f.label}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              ({f.grid.row},{f.grid.col})
                            </span>
                          </button>
                        ))
                      )}
                    </div>

                    {editingFeature ? (
                      <FeatureForm
                        key={editingFeature.id}
                        feature={editingFeature}
                        rows={rows}
                        cols={cols}
                        buildingTileKinds={buildingTileKinds}
                        pickStage={pickStage}
                        onChange={(patch) =>
                          handleUpdateFeature(editingFeature.id, patch)
                        }
                        onDelete={() => handleDeleteFeature(editingFeature.id)}
                        onStartPick={startPickGrid}
                        onCancelPick={() => setPickStage("none")}
                      />
                    ) : null}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="flex items-center justify-end gap-2 border-t px-5 py-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              <XIcon data-icon="inline-start" />
              キャンセル
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              <CheckIcon data-icon="inline-start" />
              {saving ? "保存中..." : "保存"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FeatureForm({
  feature,
  rows,
  cols,
  buildingTileKinds,
  pickStage,
  onChange,
  onDelete,
  onStartPick,
  onCancelPick,
}: {
  feature: FeatureDraft;
  rows: number;
  cols: number;
  buildingTileKinds: TileKindDef[];
  pickStage: PickStage;
  onChange: (patch: Partial<FeatureDraft>) => void;
  onDelete: () => void;
  onStartPick: () => void;
  onCancelPick: () => void;
}) {
  const setGridPart = (key: "grid" | "roadAccess", part: keyof GridPoint, value: number) => {
    const max = part === "row" ? rows - 1 : cols - 1;
    const v = Math.max(0, Math.min(max, Math.floor(value)));
    onChange({ [key]: { ...feature[key], [part]: v } });
  };

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader>
        <CardTitle className="text-sm">スポットを編集</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 text-xs">
        <div>
          <Label htmlFor={`f-id-${feature.id}`}>ID</Label>
          <Input
            id={`f-id-${feature.id}`}
            value={feature.id}
            onChange={(e) => onChange({ id: e.target.value })}
            className="h-8"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor={`f-label-${feature.id}`}>表示名</Label>
            <Input
              id={`f-label-${feature.id}`}
              value={feature.label}
              onChange={(e) => onChange({ label: e.target.value })}
              className="h-8"
            />
          </div>
          <div>
            <Label htmlFor={`f-short-${feature.id}`}>短縮名</Label>
            <Input
              id={`f-short-${feature.id}`}
              value={feature.shortLabel}
              onChange={(e) => onChange({ shortLabel: e.target.value })}
              className="h-8"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor={`f-icon-${feature.id}`}>アイコン</Label>
            <Input
              id={`f-icon-${feature.id}`}
              value={feature.icon}
              onChange={(e) => onChange({ icon: e.target.value })}
              className="h-8"
            />
          </div>
          <div>
            <Label htmlFor={`f-color-${feature.id}`}>色</Label>
            <Input
              id={`f-color-${feature.id}`}
              type="color"
              value={feature.color}
              onChange={(e) => onChange({ color: e.target.value })}
              className="h-8 p-1"
            />
          </div>
        </div>
        <div>
          <Label htmlFor={`f-kind-${feature.id}`}>カテゴリ</Label>
          <select
            id={`f-kind-${feature.id}`}
            value={feature.kind}
            onChange={(e) =>
              onChange({ kind: e.target.value as MapFeature["kind"] })
            }
            className="mt-1 h-8 w-full rounded-md border bg-background px-2 text-xs"
          >
            {[
              "station",
              "hospital",
              "shopping",
              "event",
              "school",
              "company",
              "community",
            ].map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor={`f-tile-${feature.id}`}>建物タイル種類</Label>
          <select
            id={`f-tile-${feature.id}`}
            value={feature.tileKind}
            onChange={(e) => onChange({ tileKind: e.target.value })}
            className="mt-1 h-8 w-full rounded-md border bg-background px-2 text-xs"
          >
            {buildingTileKinds.map((def) => (
              <option key={def.kind} value={def.kind}>
                {def.label}
              </option>
            ))}
            {buildingTileKinds.find((d) => d.kind === feature.tileKind) ? null : (
              <option value={feature.tileKind}>{feature.tileKind}</option>
            )}
          </select>
        </div>

        <div className="rounded border border-dashed border-primary/40 bg-white p-2">
          <Label className="text-[11px]">配置</Label>
          {pickStage === "none" ? (
            <Button
              type="button"
              size="sm"
              variant="default"
              onClick={onStartPick}
              className="mt-1 w-full"
            >
              <MapPinIcon data-icon="inline-start" />
              地図で位置を指定
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onCancelPick}
              className="mt-1 w-full"
            >
              <XIcon data-icon="inline-start" />
              配置をキャンセル
            </Button>
          )}
        </div>

        {/* 位置プレビュー: 建物 → バス停の関係を視覚化 */}
        <div className="flex items-center justify-around gap-2 rounded bg-white p-2">
          <div className="flex flex-col items-center gap-1">
            <span
              className="grid size-9 place-items-center rounded text-lg text-white shadow-[0_2px_0_rgba(0,0,0,0.18)]"
              style={{ backgroundColor: "#1cb0f6" }}
            >
              {feature.icon || "🏠"}
            </span>
            <span className="text-[10px] font-black text-[#1cb0f6]">建物</span>
            <span className="text-[10px] text-muted-foreground">
              ({feature.grid.row}, {feature.grid.col})
            </span>
          </div>
          <span className="text-base text-[#53635a]">→</span>
          <div className="flex flex-col items-center gap-1">
            <span
              className="grid size-9 place-items-center rounded text-lg shadow-[0_2px_0_rgba(0,0,0,0.18)]"
              style={{ backgroundColor: "#ffcf32" }}
            >
              🚌
            </span>
            <span className="text-[10px] font-black text-[#ad7800]">バス停</span>
            <span className="text-[10px] text-muted-foreground">
              ({feature.roadAccess.row}, {feature.roadAccess.col})
            </span>
          </div>
        </div>

        {/* 位置の説明枠 */}
        <div className="rounded border border-dashed border-[#ffcf32] bg-[#fff8d6] p-2 text-[11px] leading-relaxed">
          <p className="mb-1 font-black">📌 位置の見方</p>
          <p className="flex items-center gap-1">
            <span
              className="inline-block size-2 rounded-sm"
              style={{ backgroundColor: "#1cb0f6" }}
            />
            <span>
              <b>建物のマス</b>: 建物アイコンが立つ場所
            </span>
          </p>
          <p className="flex items-center gap-1">
            <span
              className="inline-block size-2 rounded-sm"
              style={{ backgroundColor: "#ffcf32" }}
            />
            <span>
              <b>バス停のマス</b>: バスが実際に停まる<u>道路</u>マス。建物のすぐ隣の道路を選んでください
            </span>
          </p>
          <p className="mt-1 text-muted-foreground">
            「📍 地図で位置を指定」を使うと、隣接道路があれば自動でバス停も埋まります。
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>建物のマス・行 (row)</Label>
            <Input
              type="number"
              min={0}
              max={rows - 1}
              value={feature.grid.row}
              onChange={(e) => setGridPart("grid", "row", Number(e.target.value))}
              className="h-8"
            />
          </div>
          <div>
            <Label>建物のマス・列 (col)</Label>
            <Input
              type="number"
              min={0}
              max={cols - 1}
              value={feature.grid.col}
              onChange={(e) => setGridPart("grid", "col", Number(e.target.value))}
              className="h-8"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>バス停のマス・行 (row)</Label>
            <Input
              type="number"
              min={0}
              max={rows - 1}
              value={feature.roadAccess.row}
              onChange={(e) =>
                setGridPart("roadAccess", "row", Number(e.target.value))
              }
              className="h-8"
            />
          </div>
          <div>
            <Label>バス停のマス・列 (col)</Label>
            <Input
              type="number"
              min={0}
              max={cols - 1}
              value={feature.roadAccess.col}
              onChange={(e) =>
                setGridPart("roadAccess", "col", Number(e.target.value))
              }
              className="h-8"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>建物高さ (3D)</Label>
            <Input
              type="number"
              min={0.5}
              max={3}
              step={0.05}
              value={feature.height}
              onChange={(e) =>
                onChange({ height: Number(e.target.value) || 1 })
              }
              className="h-8"
            />
          </div>
        </div>
        <div>
          <Label htmlFor={`f-desc-${feature.id}`}>説明</Label>
          <Textarea
            id={`f-desc-${feature.id}`}
            value={feature.description ?? ""}
            onChange={(e) => onChange({ description: e.target.value })}
            rows={2}
            className="text-xs"
          />
        </div>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={onDelete}
        >
          <Trash2Icon data-icon="inline-start" />
          このスポットを削除
        </Button>
      </CardContent>
    </Card>
  );
}
