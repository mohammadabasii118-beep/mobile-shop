export type Role = "admin" | "editor" | "viewer";
export type ContentSource = "telegram" | "manual" | "ai";
export type PostStatus = "published" | "scheduled" | "failed";
export type LogLevel = "success" | "info" | "warning" | "error";

export interface TelegramChannelInfo {
  name: string;
  username: string;
  status: "connected" | "disconnected";
  members: number;
}
export interface TelegramPost {
  id: string;
  title: string;
  caption: string;
  imageUrl: string;
  mediaType: "photo" | "video";
  date: string;
  views: number;
  status: "published" | "processing";
  price?: number;
}
export interface InstagramPost {
  id: string;
  caption: string;
  imageUrl: string;
  kind: "post" | "reel";
  likes: number;
  comments: number;
  date: string;
  status: PostStatus;
  source: ContentSource;
  telegramPostId?: string;
}
export interface ReadyPost {
  id: string;
  telegramPostId: string;
  title: string;
  caption: string;
  imageUrl: string;
  mediaType: "photo" | "video";
  createdAt: string;
  status: "ready" | "posted";
}
export interface Story {
  id: string;
  imageUrl: string;
  label: string;
  status: "published" | "scheduled";
  publishedAt: string;
  source: ContentSource;
  views: number;
}
export interface Comment {
  id: string;
  username: string;
  text: string;
  postId: string;
  createdAt: string;
  status: "new" | "replied" | "ignored" | "resolved";
  aiSuggestion: string;
  reply?: string;
}
export interface Message {
  id: string;
  from: "customer" | "bot" | "admin";
  text: string;
  at: string;
}
export interface Conversation {
  id: string;
  customerId: string;
  unread: number;
  important: boolean;
  aiHandled: boolean;
  lastAt: string;
  messages: Message[];
}
export type CustomerStatus = "VIP" | "New" | "Returning";
export interface Customer {
  id: string;
  name: string;
  username: string;
  phone: string;
  lastContact: string;
  orders: number;
  totalSpent: number;
  tags: string[];
  status: CustomerStatus;
}
export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  price: number;
  stock: number;
  status: "active" | "draft" | "out_of_stock";
}
export type AutomationStepKind = "trigger" | "condition" | "action";
export interface AutomationStep {
  kind: AutomationStepKind;
  label: string;
  detail?: string;
}
export interface Automation {
  id: string;
  key: AutomationKey;
  name: string;
  description: string;
  trigger: string;
  action: string;
  steps: AutomationStep[];
  status: "active" | "paused";
  lastRun: string | null;
  successRate: number;
  runs: number;
}
export type AutomationKey =
  | "tg-ig-post"
  | "tg-ig-story"
  | "comment-ai"
  | "dm-ai"
  | "keyword-dm"
  | "new-customer";

export interface TelegramToInstagramOptions {
  publishPost: boolean;
  publishStory: boolean;
  publishReel: boolean;
  copyCaption: boolean;
  aiCaption: boolean;
  addHashtags: boolean;
  notifyAdmin: boolean;
}
export interface AutomationExecution {
  id: string;
  automationId: string;
  status: "success" | "failed";
  startedAt: string;
  durationMs: number;
  summary: string;
}
export interface ActivityLog {
  id: string;
  at: string;
  type: string;
  status: LogLevel;
  title: string;
  details: string;
}
export interface AppNotification {
  id: string;
  level: "success" | "warning" | "info";
  title: string;
  at: string;
  read: boolean;
}
export type AiTone = "friendly" | "professional" | "short" | "sales" | "persian";
export interface AISettings {
  enabled: boolean;
  tones: AiTone[];
  businessName: string;
  businessType: string;
  workingHours: string;
  rules: string[];
  autoReply: boolean;
}
export interface AppSettings {
  appName: string;
  demoMode: boolean;
  language: string;
  timezone: string;
  notifyEmail: boolean;
  notifyPush: boolean;
  twoFactor: boolean;
  instagram: { account: string; businessAccountId: string; accessToken: string; webhook: "verified" | "pending" };
  telegram: { botToken: string; channel: string; webhook: "verified" | "pending" | "polling"; live: boolean };
}

export type StepStatus = "pending" | "running" | "success" | "warning" | "error";
export interface PipelineStep {
  key: string;
  label: string;
  detail: string;
  status: StepStatus;
  at: string;
}
export interface PipelineRun {
  id: string;
  title: string;
  ok: boolean;
  steps: PipelineStep[];
}
