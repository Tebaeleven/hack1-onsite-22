import Link from "next/link";
import {
  ArrowLeftIcon,
  ExternalLinkIcon,
  FileIcon,
  GlobeIcon,
  LockIcon,
  LogInIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldDescription,
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
import {
  deletePublicAsset,
  deleteUserFile,
  uploadPublicAsset,
  uploadUserFile,
} from "./actions";
import { SignedDownloadButton } from "./_components/SignedDownloadButton";

const USER_BUCKET = "user-files";
const PUBLIC_BUCKET = "public-assets";

export default async function FilesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userFilesRes = user
    ? await supabase.storage
        .from(USER_BUCKET)
        .list(user.id, { sortBy: { column: "created_at", order: "desc" } })
    : null;

  const publicAssetsRes = await supabase.storage
    .from(PUBLIC_BUCKET)
    .list("", { sortBy: { column: "created_at", order: "desc" } });

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Storage デモ</h1>
        <Button asChild variant="ghost" size="sm">
          <Link href="/demo">
            <ArrowLeftIcon data-icon="inline-start" />
            demo トップ
          </Link>
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LockIcon className="size-4" />
            user-files
            <Badge variant="secondary">private</Badge>
          </CardTitle>
          <CardDescription>
            自分の uid 配下にのみ書き込めます。閲覧は署名付き URL 経由 (有効期限 5 分)
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {user ? (
            <>
              <form
                action={uploadUserFile}
                className="flex flex-col gap-3"
              >
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="user-file">ファイル選択</FieldLabel>
                    <Input id="user-file" type="file" name="file" required />
                    <FieldDescription>
                      <code>{user.id}/</code> 配下に保存されます
                    </FieldDescription>
                  </Field>
                </FieldGroup>
                <Button type="submit" className="self-start">
                  <UploadIcon data-icon="inline-start" />
                  アップロード
                </Button>
              </form>

              {userFilesRes?.error ? (
                <Alert variant="destructive">
                  <AlertTitle>一覧取得エラー</AlertTitle>
                  <AlertDescription>
                    {userFilesRes.error.message}
                  </AlertDescription>
                </Alert>
              ) : null}

              {userFilesRes?.data && userFilesRes.data.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <FileIcon />
                    </EmptyMedia>
                    <EmptyTitle>まだファイルはありません</EmptyTitle>
                    <EmptyDescription>
                      上のフォームからアップロードしてみましょう
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : null}

              <ul className="flex flex-col gap-2">
                {userFilesRes?.data?.map((f) => {
                  const path = `${user.id}/${f.name}`;
                  return (
                    <FileRow key={f.id ?? f.name} name={f.name}>
                      <SignedDownloadButton path={path} />
                      <form action={deleteUserFile}>
                        <input type="hidden" name="path" value={path} />
                        <Button
                          type="submit"
                          size="sm"
                          variant="destructive"
                        >
                          <Trash2Icon data-icon="inline-start" />
                          削除
                        </Button>
                      </form>
                    </FileRow>
                  );
                })}
              </ul>
            </>
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <LockIcon />
                </EmptyMedia>
                <EmptyTitle>ログインが必要です</EmptyTitle>
                <EmptyDescription>
                  user-files は各ユーザー専用です
                </EmptyDescription>
              </EmptyHeader>
              <Button asChild size="sm">
                <Link href="/login">
                  <LogInIcon data-icon="inline-start" />
                  ログイン
                </Link>
              </Button>
            </Empty>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GlobeIcon className="size-4" />
            public-assets
            <Badge variant="secondary">public</Badge>
          </CardTitle>
          <CardDescription>
            誰でも URL で閲覧可能。書き込みは認証ユーザーのみ
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {user ? (
            <form
              action={uploadPublicAsset}
              className="flex flex-col gap-3"
            >
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="public-file">ファイル選択</FieldLabel>
                  <Input id="public-file" type="file" name="file" required />
                </Field>
              </FieldGroup>
              <Button type="submit" className="self-start">
                <UploadIcon data-icon="inline-start" />
                アップロード
              </Button>
            </form>
          ) : (
            <Alert>
              <AlertDescription>
                アップロードするにはログインが必要です。一覧と公開 URL は誰でも閲覧できます。
              </AlertDescription>
            </Alert>
          )}

          {publicAssetsRes.error ? (
            <Alert variant="destructive">
              <AlertTitle>一覧取得エラー</AlertTitle>
              <AlertDescription>
                {publicAssetsRes.error.message}
              </AlertDescription>
            </Alert>
          ) : null}

          {publicAssetsRes.data && publicAssetsRes.data.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FileIcon />
                </EmptyMedia>
                <EmptyTitle>まだファイルはありません</EmptyTitle>
              </EmptyHeader>
            </Empty>
          ) : null}

          <ul className="flex flex-col gap-2">
            {publicAssetsRes.data?.map((f) => {
              if (!f.name) return null;
              const { data } = supabase.storage
                .from(PUBLIC_BUCKET)
                .getPublicUrl(f.name);
              return (
                <FileRow key={f.id ?? f.name} name={f.name}>
                  <Button asChild size="sm" variant="outline">
                    <a
                      href={data.publicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLinkIcon data-icon="inline-start" />
                      公開 URL
                    </a>
                  </Button>
                  {user ? (
                    <form action={deletePublicAsset}>
                      <input type="hidden" name="path" value={f.name} />
                      <Button
                        type="submit"
                        size="sm"
                        variant="destructive"
                      >
                        <Trash2Icon data-icon="inline-start" />
                        削除
                      </Button>
                    </form>
                  ) : null}
                </FileRow>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </main>
  );
}

function FileRow({
  name,
  children,
}: {
  name: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-md border bg-card px-3 py-2">
      <FileIcon className="size-4 shrink-0 text-muted-foreground" />
      <span className="flex-1 truncate font-mono text-xs">{name}</span>
      {children}
    </li>
  );
}
