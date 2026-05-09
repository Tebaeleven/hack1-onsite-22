import type { ProfileRole } from "@/types/database";

export type Profile = {
  userId: string;
  role: ProfileRole;
  displayName: string;
  avatarUrl: string | null;
  homeGrid: { row: number; col: number } | null;
  createdAt: string;
  updatedAt: string;
};

export type RoleMeta = {
  id: ProfileRole;
  label: string;
  emoji: string;
  description: string;
};

export const ROLE_META: Record<ProfileRole, RoleMeta> = {
  resident: {
    id: "resident",
    label: "一般住民",
    emoji: "👤",
    description: "日常の買い物や通勤で使う住民",
  },
  student: {
    id: "student",
    label: "学生",
    emoji: "🎒",
    description: "通学・イベント参加が多い学生",
  },
  senior: {
    id: "senior",
    label: "高齢者",
    emoji: "🧓",
    description: "通院・買い物を負担なくしたい",
  },
  business: {
    id: "business",
    label: "企業",
    emoji: "🏢",
    description: "採用・販促イベントに人を呼びたい",
  },
  organizer: {
    id: "organizer",
    label: "イベント主催者",
    emoji: "🎪",
    description: "祭り・マルシェ・地域イベントを開催",
  },
  gov: {
    id: "gov",
    label: "行政・運営",
    emoji: "🏛️",
    description: "地域需要の可視化と運用最適化",
  },
};

export const ALL_ROLES: ProfileRole[] = [
  "resident",
  "student",
  "senior",
  "business",
  "organizer",
  "gov",
];
