import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import type { Profile } from "./types";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

function rowToProfile(row: ProfileRow): Profile {
  const homeGrid =
    row.home_grid &&
    typeof row.home_grid === "object" &&
    !Array.isArray(row.home_grid) &&
    typeof (row.home_grid as { row?: unknown }).row === "number" &&
    typeof (row.home_grid as { col?: unknown }).col === "number"
      ? {
          row: (row.home_grid as { row: number }).row,
          col: (row.home_grid as { col: number }).col,
        }
      : null;

  return {
    userId: row.user_id,
    role: row.role,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    homeGrid,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("[profiles] getProfile", error.message);
    return null;
  }
  return data ? rowToProfile(data) : null;
}

export async function listProfiles(
  userIds: string[]
): Promise<Record<string, Profile>> {
  if (userIds.length === 0) return {};
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .in("user_id", userIds);
  if (error) {
    console.error("[profiles] listProfiles", error.message);
    return {};
  }
  const map: Record<string, Profile> = {};
  for (const row of data ?? []) {
    const profile = rowToProfile(row);
    map[profile.userId] = profile;
  }
  return map;
}

export type ProfileUpdate = {
  role?: Profile["role"];
  displayName?: string;
  avatarUrl?: string | null;
  homeGrid?: { row: number; col: number } | null;
};

export async function upsertProfile(
  userId: string,
  patch: ProfileUpdate
): Promise<Profile | null> {
  const supabase = createClient();
  const update: Database["public"]["Tables"]["profiles"]["Update"] = {};
  if (patch.role !== undefined) update.role = patch.role;
  if (patch.displayName !== undefined) update.display_name = patch.displayName;
  if (patch.avatarUrl !== undefined) update.avatar_url = patch.avatarUrl;
  if (patch.homeGrid !== undefined)
    update.home_grid = patch.homeGrid as Database["public"]["Tables"]["profiles"]["Update"]["home_grid"];

  const { data, error } = await supabase
    .from("profiles")
    .update(update)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();
  if (error) {
    console.error("[profiles] upsertProfile", error.message);
    return null;
  }
  return data ? rowToProfile(data) : null;
}
