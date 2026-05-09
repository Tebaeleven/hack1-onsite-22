import type { Profile } from "@/lib/profiles/types";
import type { Organization } from "@/lib/organizations/queries";

export type CommentTargetKind = "request" | "event";

export type CommentTarget = {
  kind: CommentTargetKind;
  id: string;
};

export type CommentReactionKind = "same" | "cheer" | "thanks";

export type CommentReactionMeta = {
  id: CommentReactionKind;
  emoji: string;
  label: string;
};

export const COMMENT_REACTION_KINDS: CommentReactionMeta[] = [
  { id: "same", emoji: "👍", label: "同じ！" },
  { id: "cheer", emoji: "📣", label: "がんばれ" },
  { id: "thanks", emoji: "🙏", label: "ありがとう" },
];

export type Comment = {
  id: string;
  targetKind: CommentTargetKind;
  targetId: string;
  authorId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
};

export type CommentReactionSummary = Record<CommentReactionKind, number> & {
  myReactions: CommentReactionKind[];
};

export type CommentWithMeta = Comment & {
  author: Profile | null;
  organization: Organization | null;
  reactions: CommentReactionSummary;
};

export const EMPTY_COMMENT_REACTION_SUMMARY: CommentReactionSummary = {
  same: 0,
  cheer: 0,
  thanks: 0,
  myReactions: [],
};
