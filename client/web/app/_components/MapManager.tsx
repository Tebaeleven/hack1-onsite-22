"use client";

import { useState } from "react";
import {
  CheckCircle2Icon,
  LayersIcon,
  PencilIcon,
  PlusIcon,
  StarIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteMap, setDefaultMap } from "@/lib/maps/queries";
import type { MapDefinition } from "@/lib/bus-stop-demo/types";
import type { TileKindDef } from "@/lib/tiles/types";
import { MapEditor } from "./MapEditor";
import { TileKindManager } from "./TileKindManager";

type Props = {
  maps: MapDefinition[];
  activeMapId: string | null;
  onActivate: (id: string) => void;
  onChanged: () => void; // refetch
  tileKinds: TileKindDef[];
  onTileKindsChanged: () => void;
};

export function MapManager({
  maps,
  activeMapId,
  onActivate,
  onChanged,
  tileKinds,
  onTileKindsChanged,
}: Props) {
  const [editorMap, setEditorMap] = useState<MapDefinition | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MapDefinition | null>(null);
  const [tileManagerOpen, setTileManagerOpen] = useState(false);

  const openCreate = () => {
    setEditorMap(null);
    setEditorOpen(true);
  };
  const openEdit = (map: MapDefinition) => {
    setEditorMap(map);
    setEditorOpen(true);
  };

  const handleSetDefault = async (map: MapDefinition) => {
    try {
      await setDefaultMap(map.id);
      toast.success(`「${map.name}」をデフォルトに設定しました`);
      onChanged();
    } catch (e) {
      console.error(e);
      toast.error("デフォルト設定に失敗しました");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMap(deleteTarget.id);
      toast.success("マップを削除しました");
      setDeleteTarget(null);
      onChanged();
    } catch (e) {
      console.error(e);
      toast.error("削除に失敗しました");
    }
  };

  return (
    <section className="flex flex-col gap-4 rounded-[1.5rem] border-4 border-[#313131] bg-white p-4 shadow-[0_6px_0_#313131]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black text-[#58a700]">管理者メニュー</p>
          <h2 className="text-2xl font-black">マップ管理</h2>
          <p className="mt-1 text-xs font-bold text-[#53635a]">
            複数のマップを登録・切替できます。エディタでタイルを自由に編集できます。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setTileManagerOpen(true)}
          >
            <LayersIcon data-icon="inline-start" />
            タイル種類を管理
          </Button>
          <Button type="button" onClick={openCreate}>
            <PlusIcon data-icon="inline-start" />
            新規作成
          </Button>
        </div>
      </div>

      <div className="grid gap-3">
        {maps.length === 0 ? (
          <p className="rounded-2xl bg-[#f3f7f2] p-3 text-sm font-bold text-[#53635a]">
            登録されたマップがありません。「新規作成」から追加してください。
          </p>
        ) : (
          maps.map((map) => {
            const isActive = activeMapId === map.id;
            return (
              <Card key={map.id} size="sm">
                <CardHeader className="flex-row items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="flex items-center gap-2 text-base">
                      {map.name}
                      {map.isDefault ? (
                        <Badge className="bg-[#ff9600] text-white">
                          <StarIcon data-icon="inline-start" />
                          デフォルト
                        </Badge>
                      ) : null}
                      {isActive ? (
                        <Badge className="bg-[#58cc02] text-white">
                          <CheckCircle2Icon data-icon="inline-start" />
                          使用中
                        </Badge>
                      ) : null}
                    </CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {map.rows}×{map.cols} / スポット {map.features.length}件 / slug: {map.slug}
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={isActive ? "secondary" : "default"}
                    onClick={() => onActivate(map.id)}
                    disabled={isActive}
                  >
                    {isActive ? "使用中" : "このマップを使う"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => openEdit(map)}
                  >
                    <PencilIcon data-icon="inline-start" />
                    編集
                  </Button>
                  {!map.isDefault ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleSetDefault(map)}
                    >
                      <StarIcon data-icon="inline-start" />
                      デフォルトに設定
                    </Button>
                  ) : null}
                  {!map.isDefault ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => setDeleteTarget(map)}
                    >
                      <Trash2Icon data-icon="inline-start" />
                      削除
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <MapEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        map={editorMap}
        onSaved={() => onChanged()}
        tileKinds={tileKinds}
      />

      <TileKindManager
        open={tileManagerOpen}
        onOpenChange={setTileManagerOpen}
        tileKinds={tileKinds}
        onChanged={onTileKindsChanged}
      />

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>マップを削除しますか？</DialogTitle>
            <DialogDescription>
              「{deleteTarget?.name}」を削除します。この操作は元に戻せません。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
            >
              キャンセル
            </Button>
            <Button type="button" variant="destructive" onClick={handleDelete}>
              削除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
