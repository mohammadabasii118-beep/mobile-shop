import { api } from "@/lib/api";

export const GET = api(({ session }) => ({ email: session.email, name: session.name, role: session.role }));
