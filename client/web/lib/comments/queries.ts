import { createClient } from "@/lib/supabase/client";
import { listProfiles } from "@/lib/profiles/queries";
import { listOrganizationsByOwners } from "@/lib/organizations/queries";
import type {
  Comment,
  CommentReactionKind,
  CommentReactionSummary,
  CommentTarget,
  CommentTargetKind,
  CommentWithMeta,
} from "./types";
import { EMPTY_COMMENT_REACTION_SUMMARY } from "./types";

type CommentRow = {
  id: string;
  request_id: string;
  target_kind: CommentTargetKind;
  author_id: string;
  body: string;
  created_at: string;
  updated_at: string;
};

function rowToComment(row: CommentRow): Comment {
  return {
    id: row.id,
    targetKind: row.target_kind,
    targetId: row.request_id,
    authorId: row.author_id,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// 対象 (申請 or イベント) のコメント + 著者プロフィール + リアクション集計
export async function listCommentsForTarget(
  target: CommentTarget,
  currentUserId: string | null
): Promise<CommentWithMeta[]> {
  const supabase = createClient();
  const { data: comments, error } = await supabase
    .from("comments")
    .select("*")
    .eq("target_kind", target.kind)
    .eq("request_id", target.id)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[comments] list", error.message);
    return [];
  }
  const rows = (comments ?? []) as CommentRow[];
  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.id);
  const authorIds = Array.from(new Set(rows.map((row) => row.author_id)));

  const [profiles, organizations, reactions] = await Promise.all([
    listProfiles(authorIds),
    listOrganizationsByOwners(authorIds),
    fetchReactionsForComments(ids),
  ]);

  return rows.map((row) => {
    const summary = mergeReactionSummary(reactions[row.id], currentUserId);
    return {
      ...rowToComment(row),
      author: profiles[row.author_id] ?? null,
      organization: organizations[row.author_id] ?? null,
      reactions: summary,
    };
  });
}

export async function createComment(
  target: CommentTarget,
  authorId: string,
  body: string
): Promise<Comment | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("comments")
    .insert({
      request_id: target.id,
      target_kind: target.kind,
      author_id: authorId,
      body,
    })
    .select("*")
    .single();
  if (error) {
    console.error("[comments] create", error.message);
    return null;
  }
  return rowToComment(data as CommentRow);
}

// 自分のコメント本文を更新する。RLS により他人のは弾かれる。
export async function updateComment(
  commentId: string,
  body: string
): Promise<Comment | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("comments")
    .update({ body })
    .eq("id", commentId)
    .select("*")
    .single();
  if (error) {
    console.error("[comments] update", error.message);
    return null;
  }
  return rowToComment(data as CommentRow);
}

export async function deleteComment(commentId: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from("comments")
    .delete()
    .eq("id", commentId);
  if (error) {
    console.error("[comments] delete", error.message);
    return false;
  }
  return true;
}

// --- comment_reactions ---

type CommentReactionRow = {
  comment_id: string;
  user_id: string;
  kind: CommentReactionKind;
};

async function fetchReactionsForComments(
  commentIds: string[]
): Promise<Record<string, CommentReactionRow[]>> {
  if (commentIds.length === 0) return {};
  const supabase = createClient();
  const { data, error } = await supabase
    .from("comment_reactions")
    .select("comment_id, user_id, kind")
    .in("comment_id", commentIds);
  if (error) {
    console.error("[comments] fetchReactions", error.message);
    return {};
  }
  const map: Record<string, CommentReactionRow[]> = {};
  for (const row of (data ?? []) as CommentReactionRow[]) {
    (map[row.comment_id] ??= []).push(row);
  }
  return map;
}

function mergeReactionSummary(
  rows: CommentReactionRow[] | undefined,
  currentUserId: string | null
): CommentReactionSummary {
  if (!rows || rows.length === 0) return { ...EMPTY_COMMENT_REACTION_SUMMARY };
  const summary: CommentReactionSummary = {
    same: 0,
    cheer: 0,
    thanks: 0,
    myReactions: [],
  };
  for (const row of rows) {
    summary[row.kind] = (summary[row.kind] ?? 0) + 1;
    if (currentUserId && row.user_id === currentUserId) {
      summary.myReactions.push(row.kind);
    }
  }
  return summary;
}

// 自分のリアクションを toggle する
export async function toggleCommentReaction(
  commentId: string,
  userId: string,
  kind: CommentReactionKind,
  shouldAdd: boolean
): Promise<boolean> {
  const supabase = createClient();
  if (shouldAdd) {
    const { error } = await supabase
      .from("comment_reactions")
      .insert({ comment_id: commentId, user_id: userId, kind });
    if (error && error.code !== "23505") {
      console.error("[comments] toggleReaction add", error.message);
      return false;
    }
  } else {
    const { error } = await supabase
      .from("comment_reactions")
      .delete()
      .eq("comment_id", commentId)
      .eq("user_id", userId)
      .eq("kind", kind);
    if (error) {
      console.error("[comments] toggleReaction remove", error.message);
      return false;
    }
  }
  return true;
}
