import { telegramConfig } from "@/config/telegram";
import { getDb } from "@/database/store";
import { logActivity, notify } from "@/services/activity";
import { processTelegramPost } from "@/services/automation";
import { placeholderImage } from "@/lib/placeholder";
import type { TelegramPost } from "@/types";
import { tgCall } from "./client";
import { loadTelegramState, saveTelegramState } from "./storage";

interface TgChat { id: number; type: string; title?: string; username?: string }
interface TgMessage {
  message_id: number; date: number; chat: TgChat; text?: string; caption?: string;
  photo?: { file_id: string }[]; video?: { thumbnail?: { file_id: string } };
}
interface TgUpdate { update_id: number; channel_post?: TgMessage; edited_channel_post?: TgMessage }

const g = globalThis as unknown as { __tgPoller?: boolean };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Unknown error");

function matchesChannel(chat: TgChat, channel: string) {
  return chat.type === "channel" && (String(chat.id) === channel || (chat.username && `@${chat.username}`.toLowerCase() === channel.toLowerCase()));
}

const PRICE_RE = /(?:قیمت|price)\D{0,6}([\d,٬،.]+)/i;
function parsePrice(text: string) {
  const m = PRICE_RE.exec(text.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))));
  const n = m ? Number(m[1].replace(/[^\d]/g, "")) : NaN;
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function toPost(m: TgMessage): TelegramPost {
  const text = (m.text ?? m.caption ?? "").trim();
  const fileId = m.photo?.at(-1)?.file_id ?? m.video?.thumbnail?.file_id;
  const title = (text.split("\n")[0] || "Telegram post").slice(0, 70);
  return {
    id: `tg-${m.message_id}`, title, caption: text || title, mediaType: m.video ? "video" : "photo",
    imageUrl: fileId ? `/api/telegram/media?id=${encodeURIComponent(fileId)}` : placeholderImage("📢", m.message_id, "Telegram"),
    date: new Date(m.date * 1000).toISOString(), views: 0, status: "processing", price: parsePrice(text),
  };
}

async function refreshChannel() {
  const { channel } = telegramConfig();
  const db = getDb();
  const [chat, members] = await Promise.all([
    tgCall<TgChat>("getChat", { chat_id: channel }),
    tgCall<number>("getChatMemberCount", { chat_id: channel }),
  ]);
  db.channel = { name: chat.title ?? channel, username: chat.username ? `@${chat.username}` : channel, status: "connected", members };
}

async function handle(u: TgUpdate) {
  const { channel } = telegramConfig();
  const edited = Boolean(u.edited_channel_post);
  const m = u.channel_post ?? u.edited_channel_post;
  if (!m || !matchesChannel(m.chat, channel)) return;
  const db = getDb();
  const post = toPost(m);
  const existing = db.telegramPosts.find((p) => p.id === post.id);
  if (existing) {
    if (edited) Object.assign(existing, { caption: post.caption, title: post.title, price: post.price });
    return;
  }
  db.telegramPosts.unshift(post);
  notify("info", "Telegram post received");
  try {
    await processTelegramPost(post);
  } catch (e) {
    post.status = "published";
    logActivity("automation.telegram", "error", "Telegram → Instagram failed", errMsg(e));
  }
}

async function loop() {
  const db = getDb();
  const state = loadTelegramState();
  const live = db.telegramLive;
  live.enabled = true;

  try {
    await tgCall("deleteWebhook", { drop_pending_updates: false }); // polling and webhooks are mutually exclusive
    await refreshChannel();
    logActivity("telegram.connect", "success", "Telegram channel connected", db.channel.username);
  } catch (e) {
    live.error = errMsg(e);
  }

  let lastRefresh = Date.now();
  for (;;) {
    try {
      const updates = await tgCall<TgUpdate[]>("getUpdates", { offset: state.offset, timeout: 25, allowed_updates: ["channel_post", "edited_channel_post"] }, 40_000);
      live.lastPollAt = new Date().toISOString();
      for (const u of updates) {
        state.offset = u.update_id + 1;
        await handle(u);
      }
      if (updates.length) saveTelegramState({ offset: state.offset, posts: db.telegramPosts });
      if (Date.now() - lastRefresh > 10 * 60_000 || db.channel.status !== "connected") {
        lastRefresh = Date.now();
        await refreshChannel();
      }
      live.error = undefined;
    } catch (e) {
      live.error = errMsg(e);
      db.channel.status = "disconnected";
      await sleep(10_000);
    }
  }
}

/** Long-polling worker (no public HTTPS needed). Started once per server process from instrumentation.ts. */
export function startTelegramPolling() {
  if (!telegramConfig().live || g.__tgPoller) return;
  g.__tgPoller = true;
  void loop();
}
