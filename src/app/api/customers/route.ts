import { z } from "zod";
import { api, parseBody } from "@/lib/api";
import { createCustomer, listCustomers } from "@/services/customer";

export const GET = api(() => listCustomers());
export const POST = api(async ({ request }) => {
  const body = await parseBody(request, z.object({ name: z.string().min(1), username: z.string().min(1), phone: z.string().optional() }));
  return createCustomer(body);
}, { role: "editor" });
