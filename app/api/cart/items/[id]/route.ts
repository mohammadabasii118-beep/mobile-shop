import { parseJson, route } from "@/lib/server/http";
import { getCurrentUser } from "@/lib/server/auth/session";
import { removeCartItem, setCartQuantity } from "@/lib/server/cart";
import { cartUpdateSchema } from "@/lib/server/validation";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const { quantity } = await parseJson(req, cartUpdateSchema);
  return setCartQuantity(await getCurrentUser(), id, quantity);
});
export const DELETE = route<Ctx>(async (_req, { params }) => removeCartItem(await getCurrentUser(), (await params).id));
