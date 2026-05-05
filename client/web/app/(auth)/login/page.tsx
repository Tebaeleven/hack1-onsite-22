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
import { signIn } from "../actions";
import { AuthForm } from "../_components/AuthForm";

export default async function LoginPage() {
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
          <CardTitle>ログイン</CardTitle>
          <CardDescription>
            メールアドレスとパスワードでサインインします
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuthForm action={signIn} submitLabel="ログイン" />
        </CardContent>
        <CardFooter className="justify-between text-sm">
          <span className="text-muted-foreground">アカウント未作成？</span>
          <Button asChild variant="link" size="sm">
            <Link href="/signup">サインアップ</Link>
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
}
