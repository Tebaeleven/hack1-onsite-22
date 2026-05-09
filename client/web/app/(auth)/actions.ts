"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

// 環境変数優先で baseUrl を取得。未設定なら headers から推測
async function getBaseUrl() {
  const envOrigin = process.env.NEXT_PUBLIC_SITE_URL;
  if (envOrigin) return envOrigin.replace(/\/$/, "");
  const headerStore = await headers();
  const origin = headerStore.get("origin") ?? headerStore.get("host");
  if (!origin) return "";
  return origin.startsWith("http") ? origin : `https://${origin}`;
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// Google OAuth 開始: 認可 URL を取得して redirect する
export async function signInWithGoogle() {
  const supabase = await createClient();
  const baseUrl = await getBaseUrl();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${baseUrl}/auth/callback?next=/`,
    },
  });

  if (error || !data.url) {
    redirect(`/login?error=oauth_failed`);
  }
  redirect(data.url);
}
