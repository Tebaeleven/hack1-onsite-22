// 後で `supabase gen types typescript --project-id <ref> > types/database.ts` で再生成する
// ここは最小限の手書き定義。スキーマを変えたら必ず更新する
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      items: {
        Row: {
          id: number;
          user_id: string;
          title: string;
          content: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          user_id?: string;
          title: string;
          content?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          user_id?: string;
          title?: string;
          content?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      maps: {
        Row: {
          id: string;
          slug: string;
          name: string;
          rows: number;
          cols: number;
          grid: string[];
          features: Json;
          is_default: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          rows: number;
          cols: number;
          grid: string[];
          features?: Json;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          rows?: number;
          cols?: number;
          grid?: string[];
          features?: Json;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      demo_states: {
        Row: {
          id: string;
          state: Json;
          updated_at: string;
        };
        Insert: {
          id: string;
          state: Json;
          updated_at?: string;
        };
        Update: {
          id?: string;
          state?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      tile_kinds: {
        Row: {
          kind: string;
          code: string;
          label: string;
          bg_color: string;
          emoji: string;
          is_building: boolean;
          is_builtin: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          kind: string;
          code: string;
          label: string;
          bg_color: string;
          emoji?: string;
          is_building?: boolean;
          is_builtin?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          kind?: string;
          code?: string;
          label?: string;
          bg_color?: string;
          emoji?: string;
          is_building?: boolean;
          is_builtin?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
