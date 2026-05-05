import Link from "next/link";
import {
  DatabaseIcon,
  FolderIcon,
  LogInIcon,
  LogOutIcon,
  UserPlusIcon,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../(auth)/actions";

export default async function DemoHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">demo</h1>
        {user ? (
          <div className="flex items-center gap-3">
            <Avatar className="size-8">
              <AvatarFallback className="text-xs">
                {user.email?.slice(0, 2).toUpperCase() ?? "??"}
              </AvatarFallback>
            </Avatar>
            <span className="font-mono text-xs text-muted-foreground">
              {user.email}
            </span>
            <form action={signOut}>
              <Button type="submit" variant="outline" size="sm">
                <LogOutIcon data-icon="inline-start" />
                ログアウト
              </Button>
            </form>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button asChild size="sm">
              <Link href="/login">
                <LogInIcon data-icon="inline-start" />
                ログイン
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/signup">
                <UserPlusIcon data-icon="inline-start" />
                サインアップ
              </Link>
            </Button>
          </div>
        )}
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/demo/items" className="group">
          <Card className="h-full transition-colors group-hover:bg-muted/40">
            <CardHeader>
              <DatabaseIcon className="size-5 text-muted-foreground" />
              <CardTitle>DB CRUD: items</CardTitle>
              <CardDescription>
                汎用 items テーブルでの作成・更新・削除 (要ログイン)
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/demo/files" className="group">
          <Card className="h-full transition-colors group-hover:bg-muted/40">
            <CardHeader>
              <FolderIcon className="size-5 text-muted-foreground" />
              <CardTitle>Storage</CardTitle>
              <CardDescription>
                public-assets は閲覧のみ未ログインでも可。アップロード・user-files は要ログイン
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </main>
  );
}
