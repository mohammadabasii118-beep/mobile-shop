import { api } from "@/lib/api";
import { listConversations } from "@/services/instagram";

export const GET = api(() => listConversations());
