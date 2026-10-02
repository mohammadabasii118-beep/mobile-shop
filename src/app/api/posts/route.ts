import { api } from "@/lib/api";
import { listPosts } from "@/services/instagram";

export const GET = api(() => listPosts());
