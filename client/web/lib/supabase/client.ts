import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { normalizeSupabaseUrl } from "./url";

// ブラウザ (Client Component) で使うクライアント
export function createClient() {
  return createBrowserClient<Database>(
    normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL!),
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
