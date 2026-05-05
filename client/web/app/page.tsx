import Link from "next/link";
import { LogInIcon, LogOutIcon, UserPlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./(auth)/actions";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Next.js × Supabase Starter</CardTitle>
          <CardDescription>
            Auth / DB / Storage の CRUD を一通り動かせるサンプル
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {user ? (
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarFallback>
                  {user.email?.slice(0, 2).toUpperCase() ?? "??"}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="text-sm font-medium">ログイン中</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {user.email}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              ログインしなくてもデモは閲覧できます。書き込み機能はログイン後に有効になります。
            </p>
          )}
        </CardContent>
        <CardFooter className="gap-2">
          {user ? (
            <>
              <Button asChild>
                <Link href="/demo">デモを開く</Link>
              </Button>
              <form action={signOut}>
                <Button type="submit" variant="outline">
                  <LogOutIcon data-icon="inline-start" />
                  ログアウト
                </Button>
              </form>
            </>
          ) : (
            <>
              <Button asChild>
                <Link href="/login">
                  <LogInIcon data-icon="inline-start" />
                  ログイン
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/signup">
                  <UserPlusIcon data-icon="inline-start" />
                  サインアップ
                </Link>
              </Button>
              <Button asChild variant="ghost" className="ml-auto">
                <Link href="/demo">デモを見る</Link>
              </Button>
            </>
          )}
        </CardFooter>
      </Card>
    </main>
  );
}
