import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { signUp } from "../actions";
import { AuthForm } from "../_components/AuthForm";

export default async function SignupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    redirect("/demo");
  }

  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>サインアップ</CardTitle>
          <CardDescription>
            新規アカウントを作成します。確認メールが届きます。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuthForm action={signUp} submitLabel="アカウントを作成" />
        </CardContent>
        <CardFooter className="justify-between text-sm">
          <span className="text-muted-foreground">既にアカウントあり？</span>
          <Button asChild variant="link" size="sm">
            <Link href="/login">ログイン</Link>
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
}
