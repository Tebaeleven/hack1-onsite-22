"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { toast } from "sonner";
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
  TILE_CODE_TO_KIND,
  TILE_KINDS,
  TILE_KIND_LABEL,
  TILE_KIND_TO_CODE,
  createEmptyMapGrid,
  defaultMapDefinition,
} from "@/lib/bus-stop-demo/data";
import { createMap, updateMap } from "@/lib/maps/queries";
import type {
  GridPoint,
  MapDefinition,
  MapFeature,
  TileKind,
} from "@/lib/bus-stop-demo/types";

const MAX_DIM = 32;
const MIN_DIM = 3;

const tileBgClass: Record<TileKind, string> = {
  grass: "bg-[#78c95e]",
  road: "bg-[#9fb0b8]",
  intersection: "bg-[#97aab4]",
  house: "bg-[#80ce62]",
  shop: "bg-[#d8b85c]",
  company: "bg-[#87d6e7]",
  hospital: "bg-[#f8aeba]",
  school: "bg-[#c3a7f6]",
  station: "bg-[#95d8f6]",
  park: "bg-[#86d968]",
  tree: "bg-[#6fbe55]",
  busStop: "bg-[#fff2b8]",
};

const tileEmoji: Record<TileKind, string> = {
  grass: "",
  road: "",
  intersection: "✚",
  house: "🏠",
  shop: "🏪",
  company: "🏢",
  hospital: "🏥",
  school: "🎓",
  station: "🚉",
  park: "🎪",
  tree: "🌳",
  busStop: "🚌",
};

type EditorMode = "size" | "poi";

type FeatureDraft = MapFeature;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  map: MapDefinition | null; // null なら新規作成扱い (createMap)
  onSaved: (saved: MapDefinition) => void;
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

export function MapEditor({ open, onOpenChange, map, onSaved }: Props) {
  const isNew = map === null;
  const [name, setName] = useState("");
  const [rows, setRows] = useState(defaultMapDefinition.rows);
  const [cols, setCols] = useState(defaultMapDefinition.cols);
  const [grid, setGrid] = useState<string[]>(() =>
    createEmptyMapGrid(defaultMapDefinition.rows, defaultMapDefinition.cols)
  );
  const [features, setFeatures] = useState<FeatureDraft[]>([]);
  const [selectedTile, setSelectedTile] = useState<TileKind>("road");
  const [mode, setMode] = useState<EditorMode>("size");
  const [editingFeatureId, setEditingFeatureId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isPaintingRef = useRef(false);

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
  }, [open, map]);

  const handleResize = (nextRows: number, nextCols: number) => {
    const r = Math.max(MIN_DIM, Math.min(MAX_DIM, Math.floor(nextRows)));
    const c = Math.max(MIN_DIM, Math.min(MAX_DIM, Math.floor(nextCols)));
    setRows(r);
    setCols(c);
    setGrid((current) => reshapeGrid(current, r, c));
    // POI が範囲外になったら除外
    setFeatures((current) =>
      current.filter(
        (f) => f.grid.row < r && f.grid.col < c && f.roadAccess.row < r && f.roadAccess.col < c
      )
    );
  };

  const paintCell = (row: number, col: number) => {
    const code = TILE_KIND_TO_CODE[selectedTile];
    setGrid((current) => setCell(current, row, col, code));
  };

  const editingFeature = useMemo(
    () => features.find((f) => f.id === editingFeatureId) ?? null,
    [features, editingFeatureId]
  );

  const handleAddFeature = () => {
    const id = `poi-${Date.now().toString(36)}`;
    const next: FeatureDraft = {
      id,
      label: "新しい場所",
      shortLabel: "場所",
      kind: "community",
      tileKind: "house",
      grid: { row: 0, col: 0 },
      roadAccess: { row: 0, col: 0 },
      color: "#58cc02",
      icon: "📍",
      height: 1.0,
      description: "",
    };
    setFeatures((current) => [...current, next]);
    setEditingFeatureId(id);
    setMode("poi");
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[min(96vw,1200px)] !w-[min(96vw,1200px)] max-h-[92vh] overflow-hidden p-0 sm:max-w-[min(96vw,1200px)]">
        <div className="flex h-full max-h-[92vh] flex-col">
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle className="text-lg font-bold">
              {isNew ? "マップを新規作成" : `マップを編集: ${map?.name}`}
            </DialogTitle>
            <DialogDescription>
              タイルパレットから選んで、マス目をクリックでペイントします。
            </DialogDescription>
          </DialogHeader>

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden p-5 lg:grid-cols-[200px_minmax(0,1fr)_320px]">
            {/* Left: tile palette */}
            <Card className="overflow-y-auto">
              <CardHeader>
                <CardTitle>タイル</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2">
                {TILE_KINDS.map((kind) => (
                  <Button
                    key={kind}
                    type="button"
                    variant={kind === selectedTile ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedTile(kind)}
                    className="h-auto flex-col gap-1 py-2"
                  >
                    <span
                      className={`grid size-7 place-items-center rounded ${tileBgClass[kind]} text-base`}
                    >
                      {tileEmoji[kind]}
                    </span>
                    <span className="text-[10px]">{TILE_KIND_LABEL[kind]}</span>
                  </Button>
                ))}
              </CardContent>
            </Card>

            {/* Center: grid editor */}
            <Card className="min-h-0 overflow-hidden">
              <CardHeader className="flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <CardTitle>マップ ({rows}×{cols})</CardTitle>
                  <Badge variant="secondary" className="text-xs">
                    選択: {TILE_KIND_LABEL[selectedTile]}
                  </Badge>
                </div>
                <div>
                  <Label htmlFor="map-name" className="sr-only">マップ名</Label>
                  <Input
                    id="map-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-8 w-48"
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
                <div
                  className="mx-auto grid w-fit gap-px rounded border border-border bg-border p-px"
                  style={{
                    gridTemplateColumns: `repeat(${cols}, 28px)`,
                    gridTemplateRows: `repeat(${rows}, 28px)`,
                  }}
                >
                  {Array.from({ length: rows }).map((_, r) =>
                    Array.from({ length: cols }).map((_, c) => {
                      const code = grid[r]?.[c] ?? "g";
                      const kind = TILE_CODE_TO_KIND[code] ?? "grass";
                      const featuresHere = features.filter(
                        (f) => f.grid.row === r && f.grid.col === c
                      );
                      return (
                        <button
                          key={`${r}:${c}`}
                          type="button"
                          onMouseDown={() => {
                            isPaintingRef.current = true;
                            paintCell(r, c);
                          }}
                          onMouseEnter={() => {
                            if (isPaintingRef.current) paintCell(r, c);
                          }}
                          className={`relative grid size-[28px] place-items-center text-xs ${tileBgClass[kind]} hover:ring-2 hover:ring-foreground/40`}
                          title={`(${r},${c}) ${TILE_KIND_LABEL[kind]}${featuresHere.length > 0 ? ` / POI:${featuresHere[0].label}` : ""}`}
                        >
                          {tileEmoji[kind] || ""}
                          {featuresHere.length > 0 ? (
                            <span className="absolute right-0.5 top-0.5 size-1.5 rounded-full bg-red-500 ring-1 ring-white" />
                          ) : null}
                        </button>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Right: size or POI panel */}
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
                    variant={mode === "poi" ? "default" : "outline"}
                    onClick={() => setMode("poi")}
                  >
                    POI ({features.length})
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
                      範囲: {MIN_DIM}〜{MAX_DIM}。サイズを縮めると、はみ出した POI は自動で削除されます。
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    <Button type="button" size="sm" onClick={handleAddFeature}>
                      <PlusIcon data-icon="inline-start" />
                      POI を追加
                    </Button>
                    <div className="grid gap-2">
                      {features.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          まだ POI がありません。
                        </p>
                      ) : (
                        features.map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() =>
                              setEditingFeatureId(
                                editingFeatureId === f.id ? null : f.id
                              )
                            }
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
                        onChange={(patch) =>
                          handleUpdateFeature(editingFeature.id, patch)
                        }
                        onDelete={() => handleDeleteFeature(editingFeature.id)}
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
  onChange,
  onDelete,
}: {
  feature: FeatureDraft;
  rows: number;
  cols: number;
  onChange: (patch: Partial<FeatureDraft>) => void;
  onDelete: () => void;
}) {
  const setGridPart = (key: "grid" | "roadAccess", part: keyof GridPoint, value: number) => {
    const max = part === "row" ? rows - 1 : cols - 1;
    const v = Math.max(0, Math.min(max, Math.floor(value)));
    onChange({ [key]: { ...feature[key], [part]: v } });
  };

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader>
        <CardTitle className="text-sm">POI を編集</CardTitle>
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
            onChange={(e) =>
              onChange({ tileKind: e.target.value as TileKind })
            }
            className="mt-1 h-8 w-full rounded-md border bg-background px-2 text-xs"
          >
            {TILE_KINDS.map((k) => (
              <option key={k} value={k}>
                {TILE_KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>建物 row</Label>
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
            <Label>建物 col</Label>
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
            <Label>道路アクセス row</Label>
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
            <Label>道路アクセス col</Label>
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
          この POI を削除
        </Button>
      </CardContent>
    </Card>
  );
}
