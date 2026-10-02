import { getDb, nextId } from "@/database/store";
import { logActivity, notify } from "@/services/activity";
import { aiReply } from "@/services/ai";
import { createCustomer } from "@/services/customer";
import { publishPost, publishStory, replyToComment } from "@/services/instagram";
import { getProviders } from "@/services/providers";
import { placeholderImage } from "@/lib/placeholder";
import { instagramMode, sidecarConfig } from "@/config/instagram";
import { publishReadyPost } from "@/services/instagram/publish-ready";
import { saveTelegramState } from "@/services/telegram/storage";
import type {
  Automation, AutomationKey, Comment, Conversation, PipelineRun, TelegramPost, TelegramToInstagramOptions,
} from "@/types";
import { Pipeline } from "./pipeline";

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export const listAutomations = () => getDb().automations;
export const getAutomation = (id: string) => getDb().automations.find((a) => a.id === id);
export const getOptions = () => getDb().options;
export const listExecutions = (automationId?: string) =>
  getDb().executions.filter((e) => !automationId || e.automationId === automationId);

export function updateOptions(patch: Partial<TelegramToInstagramOptions>) {
  return Object.assign(getDb().options, patch);
}

export function setAutomationStatus(id: string, status: Automation["status"]) {
  const a = getAutomation(id);
  if (a) {
    a.status = status;
    logActivity("automation.toggle", "info", `Automation ${status === "active" ? "enabled" : "paused"}`, a.name);
  }
  return a;
}

const isActive = (key: AutomationKey) => getDb().automations.find((a) => a.key === key)?.status === "active";

function recordExecution(key: AutomationKey, ok: boolean, summary: string, ms = 1200) {
  const a = getDb().automations.find((x) => x.key === key);
  if (!a) return;
  a.runs += 1;
  a.lastRun = new Date().toISOString();
  a.successRate = Math.round(((a.successRate * (a.runs - 1) + (ok ? 100 : 0)) / a.runs) * 10) / 10;
  getDb().executions.unshift({ id: nextId("ex"), automationId: a.id, status: ok ? "success" : "failed", startedAt: a.lastRun, durationMs: ms, summary });
}

const SAMPLE_PRODUCTS = [
  { title: "قاب آیفون 17 Pro", price: 1_290_000, emoji: "📱" },
  { title: "گلس سامسونگ S25 Ultra", price: 340_000, emoji: "🛡️" },
  { title: "شارژر سریع 65 وات", price: 1_450_000, emoji: "🔌" },
  { title: "هندزفری بلوتوثی", price: 1_890_000, emoji: "🎧" },
];

/* ---------- Telegram → Instagram ---------- */
/** Runs the Telegram → Instagram workflow for a post that is already stored (used by both the simulator and the live poller). */
export async function processTelegramPost(tg: TelegramPost) {
  const db = getDb();
  const o = db.options;
  const p = new Pipeline("Telegram → Instagram", "automation.telegram");
  const isVideo = tg.mediaType === "video";
  p.step("received", "Telegram Post Received", `${db.channel.username} · ${tg.title}`);

  const postOn = isActive("tg-ig-post") && o.publishPost;
  const storyOn = isActive("tg-ig-story") && o.publishStory;
  if (!postOn && !storyOn) {
    tg.status = "published";
    p.step("skipped", "Automation paused or all outputs disabled", "Nothing published", "warning");
    return { run: p.toRun(), telegramPost: tg };
  }

  p.step("media", "Media Processed", isVideo ? "Video transcoded to 9:16 / 1080p" : "Image resized to 1080×1080");
  let caption = tg.caption;
  if (o.aiCaption) {
    caption = await getProviders().ai.generateCaption({ title: tg.title, price: tg.price, addHashtags: o.addHashtags });
    p.step("caption", "AI Caption Generated", o.addHashtags ? "Persian caption + hashtags" : "Persian caption");
  } else if (o.copyCaption) {
    p.step("caption", "Caption Copied", "Original Telegram caption reused");
  }

  if (instagramMode() !== "mock") {
    // Semi-automatic Instagram: queue a ready-to-post item instead of calling any Instagram API.
    db.readyPosts.unshift({ id: nextId("rp"), telegramPostId: tg.id, title: tg.title, caption, imageUrl: tg.imageUrl, mediaType: tg.mediaType, createdAt: new Date().toISOString(), status: "ready" });
    saveTelegramState({ posts: db.telegramPosts, ready: db.readyPosts });
    tg.status = "published";
    p.step("ready", "Ready for Instagram", "Caption and image prepared — post it from your phone");
    if (o.notifyAdmin) {
      notify("info", "New post ready for Instagram");
      p.step("notify", "Admin Notified", "Notification sent");
    }
    const queued = db.readyPosts[0];
    if (instagramMode() === "unofficial" && sidecarConfig().autoPublish) {
      try {
        const kinds: ("photo" | "story")[] = [];
        if (postOn) kinds.push("photo");
        if (storyOn) kinds.push("story");
        await publishReadyPost(queued.id, kinds.length ? kinds : ["photo"]);
        p.step("ig-post", "Instagram Post Created", `Post ${queued.instagramPostId ?? ""}`);
      } catch (e) {
        p.step("ig-post", "Instagram Post Failed", e instanceof Error ? e.message : "Unknown error", "error");
      }
    }
    recordExecution("tg-ig-post", true, `${tg.title} ready for Instagram`);
    return { run: p.toRun(), telegramPost: tg };
  }

  let igPostId: string | undefined;
  if (postOn) {
    const kind = isVideo && o.publishReel ? "reel" : "post";
    const post = await publishPost({ caption, imageUrl: tg.imageUrl, kind, source: "telegram", telegramPostId: tg.id });
    igPostId = post.id;
    p.step("ig-post", kind === "reel" ? "Instagram Reel Created" : "Instagram Post Created", `Post ${post.id}`);
  }
  if (storyOn) {
    const story = await publishStory({ imageUrl: tg.imageUrl, label: tg.title.slice(0, 18), source: "telegram" });
    p.step("ig-story", "Instagram Story Created", `Story ${story.id}`);
  }
  tg.status = "published";
  if (o.notifyAdmin) {
    notify("success", "Instagram post published");
    p.step("notify", "Admin Notified", "Notification sent");
  }
  recordExecution("tg-ig-post", true, `${tg.title} published`);
  if (storyOn) recordExecution("tg-ig-story", true, `${tg.title} story published`);
  return { run: p.toRun(), telegramPost: tg, instagramPostId: igPostId };
}

export async function simulateTelegramPost(_opts: { forFullDemo?: boolean } = {}) {
  const db = getDb();
  const sample = pick(SAMPLE_PRODUCTS);
  const tg: TelegramPost = {
    id: nextId("tg"), title: sample.title, price: sample.price, mediaType: Math.random() < 0.25 ? "video" : "photo",
    caption: `${sample.title} — قیمت: ${new Intl.NumberFormat("en-US").format(sample.price)} تومان`,
    imageUrl: placeholderImage(sample.emoji, db.seq, sample.title.slice(0, 16)), date: new Date().toISOString(), views: 0, status: "processing",
  };
  db.telegramPosts.unshift(tg);
  db.channel.members += 1;
  return processTelegramPost(tg);
}

/* ---------- Comments ---------- */
const COMMENTERS = ["ali123", "sara.m", "mehdi_tech", "parisa_n", "kian.a", "niloo_sh"];
const COMMENT_TEXTS = ["قیمت این قاب چنده؟", "موجوده؟", "ارسال به مشهد چند روزه؟", "رنگ دیگه‌ای هم دارید؟", "خیلی قشنگه 😍", "تخفیف داره؟"];

export async function simulateComment(opts: { postId?: string; text?: string; fromFullDemo?: boolean } = {}) {
  const db = getDb();
  const p = new Pipeline("Instagram Comment", "automation.comment");
  const post = db.instagramPosts.find((x) => x.id === opts.postId) ?? pick(db.instagramPosts.filter((x) => x.status === "published"));
  const comment: Comment = {
    id: nextId("c"), username: pick(COMMENTERS), text: opts.text ?? pick(COMMENT_TEXTS), postId: post.id,
    createdAt: new Date().toISOString(), status: "new", aiSuggestion: "",
  };
  post.comments += 1;
  db.comments.unshift(comment);
  p.step("comment", "New Comment Received", `@${comment.username}: ${comment.text}`);

  const ai = await aiReply(comment.text);
  comment.aiSuggestion = ai.text;
  if (!isActive("comment-ai") || !db.aiSettings.enabled) {
    p.step("skipped", "Automation paused", "Comment left for manual reply", "warning");
    return { run: p.toRun(), comment };
  }
  p.step("trigger", "Automation Triggered", "New Comment → AI Reply");
  p.step("analyze", "AI Analyzed Comment", `Intent: ${ai.intent}`);
  p.step("generate", "AI Generated Reply", ai.text);
  if (ai.confident && db.aiSettings.autoReply) {
    await replyToComment(comment.id, ai.text);
    p.step("reply", "Reply Sent", `@${comment.username}`);
    recordExecution("comment-ai", true, `Replied to @${comment.username}`);
  } else {
    p.step("escalate", "Reply held for review", "AI wasn't confident", "warning");
    notify("warning", "AI couldn't answer customer");
    recordExecution("comment-ai", false, "Low-confidence comment");
  }
  return { run: p.toRun(), comment };
}

/* ---------- Direct messages ---------- */
const DM_TEXTS = ["سلام قاب سامسونگ S25 دارید؟", "قیمت شارژر 45 وات چنده؟", "ارسال به اصفهان چند روزه؟", "ساعت کاری شما چیه؟", "کابل تایپ‌سی موجوده؟", "میشه درباره گارانتی توضیح بدید؟"];

export async function simulateDirectMessage(opts: { text?: string } = {}) {
  const db = getDb();
  const p = new Pipeline("Instagram DM", "automation.dm");
  const conv: Conversation = pick(db.conversations);
  const customer = db.customers.find((c) => c.id === conv.customerId)!;
  const text = opts.text ?? pick(DM_TEXTS);
  const at = new Date().toISOString();
  conv.messages.push({ id: nextId("m"), from: "customer", text, at });
  conv.lastAt = at;
  conv.unread += 1;
  customer.lastContact = at;
  p.step("dm", "New Instagram DM", `@${customer.username}: ${text}`);

  if (!isActive("dm-ai") || !db.aiSettings.enabled) {
    p.step("skipped", "AI auto-reply disabled", "Waiting for admin", "warning");
    return { run: p.toRun(), conversationId: conv.id };
  }
  const ai = await aiReply(text);
  p.step("analyze", "AI Analyzed Message", `Intent: ${ai.intent}`);
  if (ai.confident) {
    conv.messages.push({ id: nextId("m"), from: "bot", text: ai.text, at: new Date().toISOString() });
    conv.aiHandled = true;
    conv.unread = 0;
    p.step("reply", "AI Reply Sent", ai.text);
    recordExecution("dm-ai", true, `Replied to @${customer.username}`);
  } else {
    conv.aiHandled = false;
    p.step("escalate", "AI couldn't answer — escalated to admin", ai.text, "warning");
    notify("warning", "AI couldn't answer customer");
    recordExecution("dm-ai", false, "Low-confidence DM");
  }
  return { run: p.toRun(), conversationId: conv.id };
}

/* ---------- New customer ---------- */
const NEW_NAMES: [string, string][] = [["آرمین صالحی", "armin.s"], ["هلیا فرهادی", "helia_f"], ["بهنام عباسی", "behnam.a"], ["ترانه یوسفی", "taraneh_y"]];

export async function simulateNewCustomer() {
  const db = getDb();
  const p = new Pipeline("New Customer", "customer.new");
  const [name, base] = pick(NEW_NAMES);
  const customer = createCustomer({ name, username: `${base}${db.seq % 100}` });
  db.conversations.unshift({
    id: nextId("cv"), customerId: customer.id, important: false, aiHandled: false, unread: 1, lastAt: new Date().toISOString(),
    messages: [{ id: nextId("m"), from: "customer", text: "سلام، سفارش میخواستم ثبت کنم", at: new Date().toISOString() }],
  });
  p.step("customer", "New Customer", `@${customer.username}`);
  p.step("profile", "Customer Profile Created", name);
  if (isActive("new-customer")) {
    notify("info", `New customer: ${customer.username}`);
    p.step("notify", "Admin Notified", "Notification sent");
    recordExecution("new-customer", true, `Welcomed ${customer.username}`);
  }
  return { run: p.toRun(), customer };
}

/* ---------- Generic / full demo ---------- */
export async function runAutomation(id: string): Promise<PipelineRun | null> {
  const a = getAutomation(id);
  if (!a) return null;
  switch (a.key) {
    case "tg-ig-post":
    case "tg-ig-story":
      return (await simulateTelegramPost()).run;
    case "comment-ai":
      return (await simulateComment()).run;
    case "dm-ai":
      return (await simulateDirectMessage()).run;
    case "new-customer":
      return (await simulateNewCustomer()).run;
    case "keyword-dm": {
      const p = new Pipeline(a.name, "automation.keyword");
      const { comment } = await simulateComment({ text: "قیمت؟" });
      p.step("trigger", "Keyword «قیمت» matched", `@${comment.username}`);
      p.step("dm", "Direct Message Sent", `Price list sent to @${comment.username}`);
      recordExecution("keyword-dm", true, `DM sent to @${comment.username}`);
      return p.toRun();
    }
  }
}

export async function runFullDemo(): Promise<PipelineRun> {
  const p = new Pipeline("Full Demo", "demo.full");
  const tg = await simulateTelegramPost({ forFullDemo: true });
  const keep = ["received", "media", "caption", "ig-post", "ig-story", "skipped"];
  tg.run.steps.filter((s) => keep.includes(s.key)).forEach((s) => p.steps.push(s));
  const cm = await simulateComment({ postId: tg.instagramPostId, text: "قیمت این قاب چنده؟", fromFullDemo: true });
  cm.run.steps.filter((s) => ["comment", "analyze", "generate", "reply", "escalate"].includes(s.key)).forEach((s) => p.steps.push(s));
  p.step("log", "Activity Log Created", "All events recorded");
  return p.toRun();
}
