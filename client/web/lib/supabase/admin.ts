import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { normalizeSupabaseUrl } from "./url";

// service_role 権限で動くクライアント。RLS をバイパスするので慎重に。
// ブラウザに絶対渡さないこと (このファイルは "server-only" で守られている)
export function createAdminClient() {
  return createSupabaseClient<Database>(
    normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL!),
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
