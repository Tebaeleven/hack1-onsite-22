"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { LogInIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { createClient } from "@/lib/supabase/client";
import {
  createComment,
  deleteComment,
  listCommentsForTarget,
  toggleCommentReaction,
  updateComment,
} from "@/lib/comments/queries";
import {
  COMMENT_REACTION_KINDS,
  type CommentReactionKind,
  type CommentTarget,
  type CommentWithMeta,
} from "@/lib/comments/types";
import { useCurrentProfile } from "@/lib/profiles/use-current-profile";
import { ROLE_META } from "@/lib/profiles/types";

type Props = {
  target: CommentTarget;
};

export function CommentsSection({ target }: Props) {
  const { profile, userId } = useCurrentProfile();
  const [comments, setComments] = useState<CommentWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    const list = await listCommentsForTarget(target, userId);
    setComments(list);
    setLoading(false);
  }, [target, userId]);

  useEffect(() => {
    // 外部 (Supabase) との同期 + ローディング表示を初期化
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    void refresh();
  }, [refresh]);

  // Realtime: comments と comment_reactions のどちらかが変わったら再読み込み
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`comments-${target.kind}-${target.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comments",
          filter: `request_id=eq.${target.id}`,
        },
        () => {
          void refresh();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comment_reactions",
        },
        () => {
          void refresh();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refresh, target.id, target.kind]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!userId) {
      toast.error("コメントするにはログインが必要です");
      return;
    }
    const trimmed = body.trim();
    if (!trimmed) return;
    setSubmitting(true);
    const created = await createComment(target, userId, trimmed);
    setSubmitting(false);
    if (created) {
      setBody("");
      void refresh();
    } else {
      toast.error("コメントの投稿に失敗しました");
    }
  };

  const handleReact = async (
    comment: CommentWithMeta,
    kind: CommentReactionKind
  ) => {
    if (!userId) {
      toast.error("リアクションするにはログインが必要です", {
        action: {
          label: "ログイン",
          onClick: () => {
            window.location.href = "/login";
          },
        },
      });
      return;
    }
    const has = comment.reactions.myReactions.includes(kind);
    // 楽観更新
    setComments((prev) =>
      prev.map((c) => {
        if (c.id !== comment.id) return c;
        const next = { ...c.reactions };
        next[kind] = (next[kind] ?? 0) + (has ? -1 : 1);
        next.myReactions = has
          ? next.myReactions.filter((k) => k !== kind)
          : [...next.myReactions, kind];
        return { ...c, reactions: next };
      })
    );
    const ok = await toggleCommentReaction(comment.id, userId, kind, !has);
    if (!ok) void refresh();
  };

  const handleDelete = async (comment: CommentWithMeta) => {
    if (!window.confirm("このコメントを削除しますか？")) return;
    const ok = await deleteComment(comment.id);
    if (ok) {
      void refresh();
      toast.success("コメントを削除しました");
    } else {
      toast.error("削除に失敗しました");
    }
  };

  const handleEditSave = async (
    comment: CommentWithMeta,
    nextBody: string
  ): Promise<boolean> => {
    const trimmed = nextBody.trim();
    if (!trimmed || trimmed === comment.body) return false;
    const updated = await updateComment(comment.id, trimmed);
    if (!updated) {
      toast.error("編集の保存に失敗しました");
      return false;
    }
    // 楽観更新（Realtime でも反映されるが、即時性のため上書き）
    setComments((prev) =>
      prev.map((c) =>
        c.id === comment.id
          ? { ...c, body: updated.body, updatedAt: updated.updatedAt }
          : c
      )
    );
    toast.success("コメントを更新しました");
    return true;
  };

  return (
    <section className="rounded-[1.25rem] border-[3px] border-[#313131] bg-white p-3">
      <header className="flex items-center justify-between gap-2">
        <p className="text-sm font-black text-[#58a700]">
          みんなの声 ({comments.length})
        </p>
        {loading ? <Spinner className="size-4" /> : null}
      </header>

      {profile ? (
        <form onSubmit={handleSubmit} className="mt-2 flex flex-col gap-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
            maxLength={800}
            placeholder="「自分も行きたかった！」など、ひとこと添えてみよう"
            className="rounded-2xl text-sm font-bold"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-[#53635a]">
              {ROLE_META[profile.role].emoji}{" "}
              {profile.displayName || "ゲスト"} として投稿
            </span>
            <Button
              type="submit"
              disabled={submitting || !body.trim()}
              className="h-9 rounded-xl bg-[#58cc02] px-3 text-xs font-black text-white shadow-[0_3px_0_#2f8d12]"
            >
              {submitting ? <Spinner data-icon="inline-start" /> : null}
              投稿
            </Button>
          </div>
        </form>
      ) : (
        <div className="mt-2 flex flex-col items-stretch gap-2 rounded-2xl border-2 border-dashed border-[#1cb0f6] bg-[#eaf6ff] p-3 text-center">
          <p className="text-xs font-bold text-[#53635a]">
            コメント投稿にはログインが必要です
          </p>
          <Button
            asChild
            className="h-10 rounded-xl bg-[#1cb0f6] text-sm font-black text-white shadow-[0_3px_0_#0b82bd]"
          >
            <Link href="/login">
              <LogInIcon data-icon="inline-start" />
              ログイン / サインアップ
            </Link>
          </Button>
        </div>
      )}

      <ul className="mt-3 flex flex-col gap-2">
        {comments.length === 0 && !loading ? (
          <li className="rounded-2xl bg-[#f3f7f2] p-3 text-xs font-bold text-[#53635a]">
            まだコメントはありません。最初の声を届けよう。
          </li>
        ) : null}
        {comments.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            mine={comment.authorId === userId}
            onReact={(kind) => handleReact(comment, kind)}
            onDelete={() => handleDelete(comment)}
            onEditSave={(nextBody) => handleEditSave(comment, nextBody)}
          />
        ))}
      </ul>
    </section>
  );
}

function CommentItem({
  comment,
  mine,
  onReact,
  onDelete,
  onEditSave,
}: {
  comment: CommentWithMeta;
  mine: boolean;
  onReact: (kind: CommentReactionKind) => void;
  onDelete: () => void;
  onEditSave: (nextBody: string) => Promise<boolean>;
}) {
  const author = comment.author;
  const role = author ? ROLE_META[author.role] : null;
  const displayName = author?.displayName || "ゲスト";
  const initials = useMemo(
    () => displayName.slice(0, 1).toUpperCase(),
    [displayName]
  );
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [savingEdit, setSavingEdit] = useState(false);
  const wasEdited = comment.updatedAt !== comment.createdAt;

  const startEdit = () => {
    setDraft(comment.body);
    setEditing(true);
  };

  const cancelEdit = () => {
    setDraft(comment.body);
    setEditing(false);
  };

  const saveEdit = async () => {
    setSavingEdit(true);
    const ok = await onEditSave(draft);
    setSavingEdit(false);
    if (ok) setEditing(false);
  };

  return (
    <li className="flex flex-col gap-2 rounded-2xl bg-[#f9fbf7] p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Avatar className="size-8">
            {author?.avatarUrl ? (
              <AvatarImage src={author.avatarUrl} alt={displayName} />
            ) : null}
            <AvatarFallback className="bg-[#1cb0f6] text-xs font-black text-white">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-black">{displayName}</span>
              {role ? (
                <Badge className="rounded-full bg-[#ff9600] px-2 py-0 text-[10px] text-white">
                  {role.emoji} {role.label}
                </Badge>
              ) : null}
              {comment.organization ? (
                <Badge
                  className={`rounded-full px-2 py-0 text-[10px] text-white ${
                    comment.organization.verified
                      ? "bg-[#3a7d00]"
                      : "bg-[#1cb0f6]"
                  }`}
                >
                  {comment.organization.verified ? "✓ " : ""}
                  {comment.organization.name}
                </Badge>
              ) : null}
            </div>
            <span className="text-[10px] font-bold text-[#53635a]">
              {formatRelativeTime(comment.createdAt)}
              {wasEdited ? " ・編集済み" : ""}
            </span>
          </div>
        </div>
        {mine && !editing ? (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={startEdit}
              aria-label="自分のコメントを編集"
              className="grid size-7 place-items-center rounded-lg border-[2px] border-[#1cb0f6] bg-white text-[#1cb0f6] transition active:scale-95"
            >
              <PencilIcon className="size-3" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              aria-label="自分のコメントを削除"
              className="grid size-7 place-items-center rounded-lg border-[2px] border-[#e35d6a] bg-white text-[#e35d6a] transition active:scale-95"
            >
              <Trash2Icon className="size-3" />
            </button>
          </div>
        ) : null}
      </div>

      {editing ? (
        <div className="flex flex-col gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            maxLength={800}
            className="rounded-2xl text-sm font-bold"
          />
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={cancelEdit}
              disabled={savingEdit}
              className="h-9 rounded-xl text-xs font-black"
            >
              キャンセル
            </Button>
            <Button
              type="button"
              onClick={saveEdit}
              disabled={
                savingEdit || !draft.trim() || draft.trim() === comment.body
              }
              className="h-9 rounded-xl bg-[#58cc02] px-3 text-xs font-black text-white shadow-[0_3px_0_#2f8d12]"
            >
              {savingEdit ? <Spinner data-icon="inline-start" /> : null}
              保存
            </Button>
          </div>
        </div>
      ) : (
        <p className="whitespace-pre-wrap text-sm font-bold leading-snug">
          {comment.body}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {COMMENT_REACTION_KINDS.map((meta) => {
          const count = comment.reactions[meta.id];
          const has = comment.reactions.myReactions.includes(meta.id);
          return (
            <button
              key={meta.id}
              type="button"
              onClick={() => onReact(meta.id)}
              className={`flex items-center gap-1 rounded-full border-[2px] px-2 py-0.5 text-xs font-black transition active:scale-95 ${
                has
                  ? "border-[#58cc02] bg-[#e8ffd9] text-[#3a7d00]"
                  : "border-[#d8e0dc] bg-white text-[#53635a]"
              }`}
              aria-label={`${meta.label}: ${count}`}
            >
              <span>{meta.emoji}</span>
              <span>{meta.label}</span>
              {count > 0 ? <span>{count}</span> : null}
            </button>
          );
        })}
      </div>
    </li>
  );
}

function formatRelativeTime(iso: string) {
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return "";
  const diffSec = (Date.now() - ts) / 1000;
  if (diffSec < 60) return "たった今";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}分前`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}時間前`;
  return new Date(iso).toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
