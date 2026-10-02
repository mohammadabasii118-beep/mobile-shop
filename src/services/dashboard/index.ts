import { getDb } from "@/database/store";

const DAYS = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];
const BASE_MSG = [38, 52, 44, 61, 49, 70, 55];
const BASE_COM = [21, 30, 26, 35, 28, 41, 32];
const BASE_PUB = [[3, 2], [4, 3], [2, 2], [5, 4], [3, 3], [6, 5], [4, 3]];

export function getDashboard() {
  const db = getDb();
  const day = 24 * 3600_000;
  const today = (iso: string) => Date.now() - new Date(iso).getTime() < day;
  const msgToday = db.conversations.flatMap((c) => c.messages).filter((m) => m.from === "customer" && today(m.at)).length;
  const comToday = db.comments.filter((c) => today(c.createdAt)).length;
  const aiReplies = db.conversations.flatMap((c) => c.messages).filter((m) => m.from === "bot").length + db.comments.filter((c) => c.reply).length;
  const lastIdx = DAYS.length - 1;
  return {
    stats: {
      followers: db.stats.followers + db.instagramPosts.filter((p) => p.source === "telegram").length,
      members: db.channel.members,
      published: db.stats.published,
      messagesToday: msgToday,
      commentsToday: comToday,
      aiReplies,
    },
    engagement: DAYS.map((d, i) => ({
      day: d,
      messages: i === lastIdx ? BASE_MSG[i] + msgToday : BASE_MSG[i],
      comments: i === lastIdx ? BASE_COM[i] + comToday : BASE_COM[i],
    })),
    content: DAYS.map((d, i) => ({ day: d, posts: BASE_PUB[i][0], stories: BASE_PUB[i][1] })),
    activity: db.logs.slice(0, 8),
    pendingComments: db.comments.filter((c) => c.status === "new").length,
    unreadChats: db.conversations.filter((c) => c.unread > 0).length,
  };
}
