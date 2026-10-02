import { api } from "@/lib/api";
import { listComments } from "@/services/instagram";

export const GET = api(() => listComments());
