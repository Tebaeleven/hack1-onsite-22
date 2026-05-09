import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// メール確認後のリダイレクト先。code を session に交換する
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // open redirect 防止: 自サイト内のパス (/foo) のみ許可。// や http:// で始まる値は弾く
  const rawNext = searchParams.get("next") ?? "/";
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
