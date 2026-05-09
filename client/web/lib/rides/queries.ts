import { createClient } from "@/lib/supabase/client";

export type RideIntentSummary = {
  count: number;
  myReserved: boolean;
};

type RideIntentRow = {
  command_id: string;
  user_id: string;
};

export async function getRideIntentSummary(
  commandId: string,
  currentUserId: string | null
): Promise<RideIntentSummary> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("ride_intents")
    .select("command_id, user_id")
    .eq("command_id", commandId);
  if (error) {
    console.error("[rides] summary", error.message);
    return { count: 0, myReserved: false };
  }
  const rows = (data ?? []) as RideIntentRow[];
  return {
    count: rows.length,
    myReserved: Boolean(
      currentUserId && rows.some((r) => r.user_id === currentUserId)
    ),
  };
}

export async function toggleRideIntent(
  commandId: string,
  userId: string,
  shouldAdd: boolean
): Promise<boolean> {
  const supabase = createClient();
  if (shouldAdd) {
    const { error } = await supabase
      .from("ride_intents")
      .insert({ command_id: commandId, user_id: userId });
    if (error && error.code !== "23505") {
      console.error("[rides] add", error.message);
      return false;
    }
  } else {
    const { error } = await supabase
      .from("ride_intents")
      .delete()
      .eq("command_id", commandId)
      .eq("user_id", userId);
    if (error) {
      console.error("[rides] remove", error.message);
      return false;
    }
  }
  return true;
}
