import { parseJson, route } from "@/lib/server/http";
import { resetPassword } from "@/lib/server/auth/service";
import { resetSchema } from "@/lib/server/validation";

export const POST = route(async (req) => {
  const { ticket, password } = await parseJson(req, resetSchema);
  return resetPassword(ticket, password);
});
