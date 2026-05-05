import Link from "next/link";
import {
  ArrowLeftIcon,
  InboxIcon,
  LogInIcon,
  PlusIcon,
  SaveIcon,
  Trash2Icon,
  UserPlusIcon,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { createClient } from "@/lib/supabase/server";
import { createItem, deleteItem, updateItem } from "./actions";

export default async function ItemsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
        <PageHeader />
        <Card>
          <CardHeader>
            <CardTitle>ログインが必要です</CardTitle>
            <CardDescription>
              items は各ユーザーごとに分離されています (RLS)。閲覧・作成にはログインが必要です。
            </CardDescription>
          </CardHeader>
          <CardFooter className="gap-2">
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
          </CardFooter>
        </Card>
      </main>
    );
  }

  const { data: items, error } = await supabase
    .from("items")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
      <PageHeader />

      <Card>
        <CardHeader>
          <CardTitle>新規作成</CardTitle>
          <CardDescription>title は必須、content は任意</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createItem} className="flex flex-col gap-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="new-title">タイトル</FieldLabel>
                <Input id="new-title" name="title" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="new-content">本文 (任意)</FieldLabel>
                <Textarea id="new-content" name="content" rows={3} />
              </Field>
            </FieldGroup>
            <Button type="submit" className="self-start">
              <PlusIcon data-icon="inline-start" />
              作成
            </Button>
          </form>
        </CardContent>
      </Card>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">一覧</h2>
          <Badge variant="secondary">{items?.length ?? 0} 件</Badge>
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertTitle>読み込みエラー</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        ) : null}

        {items && items.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <InboxIcon />
              </EmptyMedia>
              <EmptyTitle>まだ何もありません</EmptyTitle>
              <EmptyDescription>
                上のフォームから最初の item を作ってみましょう
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : null}

        <ul className="flex flex-col gap-3">
          {items?.map((item) => (
            <li key={item.id}>
              <Card>
                <CardContent>
                  <form action={updateItem} className="flex flex-col gap-4">
                    <input type="hidden" name="id" value={item.id} />
                    <FieldGroup>
                      <Field>
                        <FieldLabel htmlFor={`title-${item.id}`}>
                          タイトル
                        </FieldLabel>
                        <Input
                          id={`title-${item.id}`}
                          name="title"
                          defaultValue={item.title}
                          required
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor={`content-${item.id}`}>
                          本文
                        </FieldLabel>
                        <Textarea
                          id={`content-${item.id}`}
                          name="content"
                          rows={2}
                          defaultValue={item.content ?? ""}
                        />
                      </Field>
                    </FieldGroup>
                    <Button type="submit" size="sm" className="self-start">
                      <SaveIcon data-icon="inline-start" />
                      更新
                    </Button>
                  </form>
                </CardContent>
                <CardFooter className="justify-between gap-3">
                  <span className="text-xs text-muted-foreground">
                    作成 {new Date(item.created_at).toLocaleString("ja-JP")}
                    {" ・ "}
                    更新 {new Date(item.updated_at).toLocaleString("ja-JP")}
                  </span>
                  <form action={deleteItem}>
                    <input type="hidden" name="id" value={item.id} />
                    <Button type="submit" size="sm" variant="destructive">
                      <Trash2Icon data-icon="inline-start" />
                      削除
                    </Button>
                  </form>
                </CardFooter>
              </Card>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function PageHeader() {
  return (
    <header className="flex items-center justify-between">
      <h1 className="text-2xl font-semibold">items CRUD デモ</h1>
      <Button asChild variant="ghost" size="sm">
        <Link href="/demo">
          <ArrowLeftIcon data-icon="inline-start" />
          demo トップ
        </Link>
      </Button>
    </header>
  );
}
