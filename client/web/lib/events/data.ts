export type EventDefinition = {
  id: string;
  category: string;
  icon: string;
  title: string;
  date: string;
  locationId: string;
  organizer: string;
  summary: string;
  robot: string;
  scheduledMove: string;
  route: string;
};

export const eventDefinitions: EventDefinition[] = [
  {
    id: "market-fair",
    category: "地域",
    icon: "🎪",
    title: "週末まちなかマルシェ",
    date: "土曜 11:00-16:00",
    locationId: "market",
    organizer: "商店街",
    summary: "飲食店と手作り市が集まる週末イベントです。",
    robot: "バス停ロボット A",
    scheduledMove: "土曜 10:30 出発予定",
    route: "みんな駅前 → 商店街マルシェ",
  },
  {
    id: "company-session",
    category: "企業",
    icon: "🏢",
    title: "ローカルテック社 会社説明会",
    date: "金曜 13:00-15:00",
    locationId: "company",
    organizer: "ローカルテック社",
    summary: "地元企業の採用説明会。駅からのアクセス改善が必要です。",
    robot: "バス停ロボット B",
    scheduledMove: "金曜 12:30 出発予定",
    route: "みんな駅前 → ローカルテック社",
  },
  {
    id: "clinic-morning",
    category: "医療",
    icon: "🏥",
    title: "中央クリニック 午前診療サポート",
    date: "明日 9:00-11:30",
    locationId: "hospital",
    organizer: "中央クリニック",
    summary: "高齢者の通院時間に合わせて、病院前に停留所を寄せます。",
    robot: "バス停ロボット A",
    scheduledMove: "明日 8:30 出発予定",
    route: "みんな駅前 → 中央クリニック",
  },
  {
    id: "campus-meetup",
    category: "学校",
    icon: "🎓",
    title: "青空キャンパス 交流イベント",
    date: "今日 16:30-18:00",
    locationId: "school",
    organizer: "青空キャンパス",
    summary: "学生イベントと地域交流会の集合場所を作ります。",
    robot: "バス停ロボット C",
    scheduledMove: "今日 16:00 出発予定",
    route: "みんな駅前 → 青空キャンパス",
  },
  {
    id: "shopping-day",
    category: "地域",
    icon: "🛒",
    title: "買い物サポートデー",
    date: "水曜 10:00-12:00",
    locationId: "supermarket",
    organizer: "まちのスーパー",
    summary: "荷物が多い買い物帰りを支援する生活便です。",
    robot: "バス停ロボット A",
    scheduledMove: "水曜 9:30 出発予定",
    route: "みんな駅前 → まちのスーパー",
  },
];

export const eventCategories = [
  "すべて",
  "地域",
  "企業",
  "医療",
  "学校",
] as const;
