"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ActivityLog, AISettings, AppNotification, AppSettings, Automation, AutomationExecution, Comment, Conversation, Customer,
  InstagramPost, Product, Story, TelegramChannelInfo, TelegramPost, TelegramToInstagramOptions,
} from "@/types";

export async function apiFetch<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  });
  if (res.status === 401 && typeof window !== "undefined") window.location.href = "/login";
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
  return data as T;
}

const get = <T,>(key: string, url: string, refetchInterval?: number) =>
  useQuery({ queryKey: [key], queryFn: () => apiFetch<T>(url), refetchInterval });

export interface DashboardData {
  stats: { followers: number; members: number; published: number; messagesToday: number; commentsToday: number; aiReplies: number };
  engagement: { day: string; messages: number; comments: number }[];
  content: { day: string; posts: number; stories: number }[];
  activity: ActivityLog[];
  pendingComments: number;
  unreadChats: number;
}
export type ConversationView = Conversation & { customer: Customer };

export const useDashboard = () => get<DashboardData>("dashboard", "/api/dashboard");
export const usePosts = () => get<InstagramPost[]>("posts", "/api/posts");
export const useStories = () => get<Story[]>("stories", "/api/stories");
export const useComments = () => get<Comment[]>("comments", "/api/comments");
export const useConversations = () => get<ConversationView[]>("messages", "/api/messages");
export const useCustomers = () => get<Customer[]>("customers", "/api/customers");
export const useProducts = () => get<Product[]>("products", "/api/products");
export interface TelegramLive { enabled: boolean; lastPollAt?: string; error?: string }
export const useTelegram = () => get<{ channel: TelegramChannelInfo; posts: TelegramPost[]; live: TelegramLive }>("telegram", "/api/telegram", 10000);
export const useAutomations = () => get<{ automations: Automation[]; options: TelegramToInstagramOptions }>("automations", "/api/automations");
export const useAutomation = (id: string) =>
  useQuery({ queryKey: ["automation", id], queryFn: () => apiFetch<{ automation: Automation; executions: AutomationExecution[] }>(`/api/automations/${id}`) });
export const useAiSettings = () => get<AISettings>("ai-settings", "/api/ai/settings");
export const useLogs = () => get<ActivityLog[]>("logs", "/api/logs");
export const useNotifications = () => get<AppNotification[]>("notifications", "/api/notifications", 15000);
export const useSettings = () => get<AppSettings>("settings", "/api/settings");

/** Mutation that refreshes every cached resource afterwards (the demo touches many entities at once). */
export function useAction<TVars = void, TRes = unknown>(fn: (v: TVars) => Promise<TRes>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries() });
}
