"use client";

import { useEffect, useMemo, useState } from "react";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createTileKind,
  deleteTileKind,
  updateTileKind,
} from "@/lib/tiles/queries";
import type { TileKindDef } from "@/lib/tiles/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tileKinds: TileKindDef[];
  onChanged: () => void;
};

type FormState = {
  mode: "create" | "edit";
  kind: string;
  code: string;
  label: string;
  bgColor: string;
  emoji: string;
  isBuilding: boolean;
  sortOrder: number;
};

const EMPTY_FORM: FormState = {
  mode: "create",
  kind: "",
  code: "",
  label: "",
  bgColor: "#f0c987",
  emoji: "📚",
  isBuilding: true,
  sortOrder: 300,
};

const KIND_PATTERN = /^[a-z][a-zA-Z0-9_-]{0,31}$/;
const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

export function TileKindManager({
  open,
  onOpenChange,
  tileKinds,
  onChanged,
}: Props) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TileKindDef | null>(null);

  useEffect(() => {
    if (!open) {
      setForm(EMPTY_FORM);
      setDeleteTarget(null);
    }
  }, [open]);

  const sorted = useMemo(
    () => [...tileKinds].sort((a, b) => a.sortOrder - b.sortOrder || a.kind.localeCompare(b.kind)),
    [tileKinds]
  );

  const startCreate = () => {
    setForm(EMPTY_FORM);
  };

  const startEdit = (def: TileKindDef) => {
    setForm({
      mode: "edit",
      kind: def.kind,
      code: def.code,
      label: def.label,
      bgColor: def.bgColor,
      emoji: def.emoji,
      isBuilding: def.isBuilding,
      sortOrder: def.sortOrder,
    });
  };

  const handleSave = async () => {
    if (!form.label.trim()) {
      toast.error("表示名を入力してください");
      return;
    }
    if (!COLOR_PATTERN.test(form.bgColor)) {
      toast.error("背景色は #RRGGBB 形式で指定してください");
      return;
    }
    if (form.mode === "create") {
      if (!KIND_PATTERN.test(form.kind)) {
        toast.error("ID は英小文字始まりの英数字 (1〜32 文字) にしてください");
        return;
      }
      if (Array.from(form.code).length !== 1) {
        toast.error("コードは 1 文字にしてください");
        return;
      }
    }
    setSaving(true);
    try {
      if (form.mode === "create") {
        await createTileKind({
          kind: form.kind,
          code: form.code,
          label: form.label.trim(),
          bgColor: form.bgColor,
          emoji: form.emoji,
          isBuilding: form.isBuilding,
          sortOrder: form.sortOrder,
        });
        toast.success("タイル種類を追加しました");
      } else {
        await updateTileKind(form.kind, {
          label: form.label.trim(),
          bgColor: form.bgColor,
          emoji: form.emoji,
          isBuilding: form.isBuilding,
          sortOrder: form.sortOrder,
        });
        toast.success("タイル種類を更新しました");
      }
      onChanged();
      setForm(EMPTY_FORM);
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "保存に失敗しました";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await deleteTileKind(deleteTarget.kind);
      toast.success(`「${deleteTarget.label}」を削除しました`);
      onChanged();
      setDeleteTarget(null);
      if (form.mode === "edit" && form.kind === deleteTarget.kind) {
        setForm(EMPTY_FORM);
      }
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "削除に失敗しました";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[min(96vw,900px)] !w-[min(96vw,900px)] max-h-[88vh] overflow-hidden p-0 sm:max-w-[min(96vw,900px)]">
        <div className="flex h-full max-h-[88vh] flex-col">
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle className="text-lg font-bold">タイル種類を管理</DialogTitle>
            <DialogDescription>
              マップエディタで使うタイル (家・店舗など) の種類を追加・編集できます。
              ビルトインの 12 種は削除できません。
            </DialogDescription>
          </DialogHeader>

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden p-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            {/* 一覧 */}
            <Card className="min-h-0 overflow-hidden">
              <CardHeader className="flex-row items-center justify-between gap-2">
                <CardTitle>一覧 ({sorted.length})</CardTitle>
                <Button type="button" size="sm" onClick={startCreate}>
                  <PlusIcon data-icon="inline-start" />
                  追加
                </Button>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 overflow-y-auto">
                <div className="grid gap-2">
                  {sorted.map((def) => {
                    const isActive = form.mode === "edit" && form.kind === def.kind;
                    return (
                      <button
                        key={def.kind}
                        type="button"
                        onClick={() => startEdit(def)}
                        className={`flex items-center gap-3 rounded border px-3 py-2 text-left text-sm transition ${
                          isActive
                            ? "border-primary bg-primary/10"
                            : "border-border hover:bg-muted"
                        }`}
                      >
                        <span
                          className="grid size-9 place-items-center rounded text-lg"
                          style={{ backgroundColor: def.bgColor }}
                        >
                          {def.emoji || ""}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold">{def.label}</span>
                            {def.isBuiltin ? (
                              <Badge variant="secondary" className="text-[10px]">ビルトイン</Badge>
                            ) : null}
                            {def.isBuilding ? (
                              <Badge className="bg-[#1cb0f6] text-white text-[10px]">建物</Badge>
                            ) : null}
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            ID: {def.kind} / コード: {def.code}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* フォーム */}
            <Card className="min-h-0 overflow-hidden">
              <CardHeader>
                <CardTitle className="text-sm">
                  {form.mode === "create" ? "新規追加" : `編集: ${form.label || form.kind}`}
                </CardTitle>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 overflow-y-auto">
                <div className="grid gap-3 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="tk-kind">ID (kind)</Label>
                      <Input
                        id="tk-kind"
                        value={form.kind}
                        onChange={(e) => setForm({ ...form, kind: e.target.value })}
                        disabled={form.mode === "edit"}
                        placeholder="library"
                        className="mt-1 h-8"
                      />
                    </div>
                    <div>
                      <Label htmlFor="tk-code">コード (1文字)</Label>
                      <Input
                        id="tk-code"
                        value={form.code}
                        onChange={(e) => setForm({ ...form, code: e.target.value })}
                        disabled={form.mode === "edit"}
                        maxLength={2}
                        placeholder="l"
                        className="mt-1 h-8"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="tk-label">表示名</Label>
                    <Input
                      id="tk-label"
                      value={form.label}
                      onChange={(e) => setForm({ ...form, label: e.target.value })}
                      placeholder="図書館"
                      className="mt-1 h-8"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="tk-emoji">絵文字</Label>
                      <Input
                        id="tk-emoji"
                        value={form.emoji}
                        onChange={(e) => setForm({ ...form, emoji: e.target.value })}
                        placeholder="📚"
                        className="mt-1 h-8"
                      />
                    </div>
                    <div>
                      <Label htmlFor="tk-color">背景色</Label>
                      <Input
                        id="tk-color"
                        type="color"
                        value={form.bgColor}
                        onChange={(e) => setForm({ ...form, bgColor: e.target.value })}
                        className="mt-1 h-8 p-1"
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.isBuilding}
                      onChange={(e) => setForm({ ...form, isBuilding: e.target.checked })}
                    />
                    <span>建物として扱う (スポットの建物候補に出す)</span>
                  </label>
                  <div>
                    <Label htmlFor="tk-sort">並び順</Label>
                    <Input
                      id="tk-sort"
                      type="number"
                      value={form.sortOrder}
                      onChange={(e) =>
                        setForm({ ...form, sortOrder: Number(e.target.value) || 100 })
                      }
                      className="mt-1 h-8"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
                      <CheckIcon data-icon="inline-start" />
                      {form.mode === "create" ? "追加する" : "保存"}
                    </Button>
                    {form.mode === "edit" && !sorted.find((d) => d.kind === form.kind)?.isBuiltin ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          const target = sorted.find((d) => d.kind === form.kind);
                          if (target) setDeleteTarget(target);
                        }}
                        disabled={saving}
                      >
                        <Trash2Icon data-icon="inline-start" />
                        この種類を削除
                      </Button>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex items-center justify-end gap-2 border-t px-5 py-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              <XIcon data-icon="inline-start" />
              閉じる
            </Button>
          </div>
        </div>

        <Dialog
          open={deleteTarget !== null}
          onOpenChange={(o) => !o && setDeleteTarget(null)}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>このタイル種類を削除しますか？</DialogTitle>
              <DialogDescription>
                「{deleteTarget?.label}」を削除します。既存マップでこのタイルを使っているマスは草地に置き換わります。
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
                キャンセル
              </Button>
              <Button type="button" variant="destructive" onClick={handleDelete} disabled={saving}>
                削除する
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
