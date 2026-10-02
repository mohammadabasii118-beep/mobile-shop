import { api } from "@/lib/api";
import { getDashboard } from "@/services/dashboard";

export const GET = api(() => getDashboard());
