import { getDb } from "@/database/store";
import { api } from "@/lib/api";
import { getChannel, listTelegramPosts } from "@/services/telegram";

export const GET = api(async () => ({ channel: await getChannel(), posts: await listTelegramPosts(), live: getDb().telegramLive }));
