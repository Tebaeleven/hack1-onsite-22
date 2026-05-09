import { redirect } from "next/navigation";

// Google 認証一本化に伴い、サインアップ専用ページは廃止。
// 既存リンクや古いブックマークから来たユーザーを /login に流す。
export default function SignupPage() {
  redirect("/login");
}
