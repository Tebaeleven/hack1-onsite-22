import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { normalizeSupabaseUrl } from "./url";

// Server Component / Server Action / Route Handler で使うクライアント
// Next.js 16 では cookies() は async なので await 必須
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL!),
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Component から呼ばれた場合は set 不可。
            // proxy.ts 側で必ずリフレッシュしているので無視で OK
          }
        },
      },
    }
  );
}
