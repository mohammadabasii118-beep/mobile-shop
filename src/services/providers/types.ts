import type { AISettings, Product, TelegramChannelInfo, TelegramPost } from "@/types";

/** Provider contracts. Real implementations (Telegram Bot API, Meta Graph API, OpenAI) plug in here. */
export interface TelegramProvider {
  getChannel(): Promise<TelegramChannelInfo>;
  listPosts(): Promise<TelegramPost[]>;
}

export interface InstagramProvider {
  publishPost(input: { caption: string; imageUrl: string; kind: "post" | "reel" }): Promise<{ externalId: string }>;
  publishStory(input: { imageUrl: string }): Promise<{ externalId: string }>;
  replyToComment(input: { commentId: string; text: string }): Promise<{ externalId: string }>;
  sendDirectMessage(input: { username: string; text: string }): Promise<{ externalId: string }>;
}

export interface AIReply {
  text: string;
  /** false = the assistant didn't have enough data and the message should be escalated to a human */
  confident: boolean;
  intent: "price" | "availability" | "shipping" | "hours" | "greeting" | "unknown";
}

export interface AIProvider {
  generateCaption(input: { title: string; price?: number; addHashtags: boolean }): Promise<string>;
  reply(input: { text: string; products: Product[]; settings: AISettings }): Promise<AIReply>;
}

export interface Providers {
  telegram: TelegramProvider;
  instagram: InstagramProvider;
  ai: AIProvider;
}
