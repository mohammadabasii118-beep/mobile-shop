import { getDb, nextId } from "@/database/store";
import { logActivity } from "@/services/activity";
import { getProviders } from "@/services/providers";
import { placeholderImage } from "@/lib/placeholder";
import type { Comment, Conversation, InstagramPost, Story } from "@/types";

export const listPosts = () => [...getDb().instagramPosts].sort((a, b) => b.date.localeCompare(a.date));
export const listStories = () => [...getDb().stories].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
export const listComments = () => [...getDb().comments].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

export function listConversations() {
  const db = getDb();
  return [...db.conversations]
    .sort((a, b) => b.lastAt.localeCompare(a.lastAt))
    .map((c) => ({ ...c, customer: db.customers.find((x) => x.id === c.customerId)! }));
}

export async function publishPost(input: Pick<InstagramPost, "caption" | "imageUrl" | "kind" | "source" | "telegramPostId">) {
  await getProviders().instagram.publishPost(input);
  const post: InstagramPost = { id: nextId("ig"), likes: 0, comments: 0, date: new Date().toISOString(), status: "published", ...input };
  getDb().instagramPosts.unshift(post);
  getDb().stats.published++;
  return post;
}

export async function publishStory(input: { imageUrl: string; label: string; source: Story["source"] }) {
  await getProviders().instagram.publishStory(input);
  const story: Story = { id: nextId("st"), status: "published", publishedAt: new Date().toISOString(), views: 0, ...input };
  getDb().stories.unshift(story);
  return story;
}

export function createManualStory(label: string) {
  return publishStory({ label, source: "manual", imageUrl: placeholderImage("✨", Math.floor(Math.random() * 6), label.slice(0, 18)) });
}

export async function replyToComment(id: string, text: string) {
  const c = getDb().comments.find((x) => x.id === id);
  if (!c) return null;
  await getProviders().instagram.replyToComment({ commentId: id, text });
  c.reply = text;
  c.status = "replied";
  logActivity("instagram.comment", "success", "Comment reply sent", `@${c.username}`);
  return c;
}

export function setCommentStatus(id: string, status: Comment["status"]) {
  const c = getDb().comments.find((x) => x.id === id);
  if (!c) return null;
  c.status = status;
  logActivity("instagram.comment", "info", `Comment marked ${status}`, `@${c.username}`);
  return c;
}

export async function sendMessage(conversationId: string, from: "admin" | "bot", text: string): Promise<Conversation | null> {
  const conv = getDb().conversations.find((x) => x.id === conversationId);
  if (!conv) return null;
  const customer = getDb().customers.find((x) => x.id === conv.customerId);
  await getProviders().instagram.sendDirectMessage({ username: customer?.username ?? "", text });
  const at = new Date().toISOString();
  conv.messages.push({ id: nextId("m"), from, text, at });
  conv.lastAt = at;
  conv.unread = 0;
  if (from === "bot") conv.aiHandled = true;
  logActivity("instagram.dm", "success", from === "bot" ? "AI Reply Sent" : "DM sent by admin", `@${customer?.username}`);
  return conv;
}
