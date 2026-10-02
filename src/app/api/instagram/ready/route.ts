import { getDb } from "@/database/store";
import { api } from "@/lib/api";
import { instagramMode } from "@/config/instagram";

export const GET = api(() => ({ mode: instagramMode(), items: getDb().readyPosts }));
