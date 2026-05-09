// マップエディタが使うタイル種類定義 (DB 由来)。
// camelCase で扱うため、Supabase 行を変換した後の形。
export type TileKindDef = {
  kind: string;
  code: string;
  label: string;
  bgColor: string;
  emoji: string;
  isBuilding: boolean;
  isBuiltin: boolean;
  sortOrder: number;
  updatedAt: string;
};

export type TileKindWriteInput = {
  kind: string;
  code: string;
  label: string;
  bgColor: string;
  emoji?: string;
  isBuilding?: boolean;
  sortOrder?: number;
};

export type TileKindPatch = {
  label?: string;
  bgColor?: string;
  emoji?: string;
  isBuilding?: boolean;
  sortOrder?: number;
};
