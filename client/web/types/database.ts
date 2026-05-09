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
      profiles: {
        Row: {
          user_id: string;
          role: ProfileRole;
          display_name: string;
          avatar_url: string | null;
          home_grid: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          role?: ProfileRole;
          display_name?: string;
          avatar_url?: string | null;
          home_grid?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          role?: ProfileRole;
          display_name?: string;
          avatar_url?: string | null;
          home_grid?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      comments: {
        Row: {
          id: string;
          request_id: string;
          target_kind: "request" | "event";
          author_id: string;
          body: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          request_id: string;
          target_kind?: "request" | "event";
          author_id: string;
          body: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          request_id?: string;
          target_kind?: "request" | "event";
          author_id?: string;
          body?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      comment_reactions: {
        Row: {
          comment_id: string;
          user_id: string;
          kind: string;
          created_at: string;
        };
        Insert: {
          comment_id: string;
          user_id: string;
          kind: string;
          created_at?: string;
        };
        Update: {
          comment_id?: string;
          user_id?: string;
          kind?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      request_reactions: {
        Row: {
          request_id: string;
          user_id: string;
          kind: string;
          created_at: string;
        };
        Insert: {
          request_id: string;
          user_id: string;
          kind: string;
          created_at?: string;
        };
        Update: {
          request_id?: string;
          user_id?: string;
          kind?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      command_logs: {
        Row: {
          id: string;
          command_id: string;
          request_id: string;
          scenario_id: string | null;
          from_location_id: string;
          to_location_id: string;
          distance: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          command_id: string;
          request_id: string;
          scenario_id?: string | null;
          from_location_id: string;
          to_location_id: string;
          distance: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          command_id?: string;
          request_id?: string;
          scenario_id?: string | null;
          from_location_id?: string;
          to_location_id?: string;
          distance?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      organizations: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          kind: string;
          verified: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          kind?: string;
          verified?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          kind?: string;
          verified?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      ride_intents: {
        Row: {
          command_id: string;
          user_id: string;
          planned_time: string | null;
          created_at: string;
        };
        Insert: {
          command_id: string;
          user_id: string;
          planned_time?: string | null;
          created_at?: string;
        };
        Update: {
          command_id?: string;
          user_id?: string;
          planned_time?: string | null;
          created_at?: string;
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
    Enums: {
      profile_role: ProfileRole;
    };
    CompositeTypes: Record<string, never>;
  };
};

export type ProfileRole =
  | "resident"
  | "student"
  | "senior"
  | "business"
  | "organizer"
  | "gov";
