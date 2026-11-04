import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { getBrand, getModel } from "@/data/vehicles";

/** No-JS fallback of the vehicle finder form: maps ?brand&model&year to the canonical model URL. */
export function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const brand = getBrand(sp.get("brand") ?? "");
  if (!brand) redirect("/shop");
  const model = getModel(sp.get("model") ?? "");
  if (!model || model.brand !== brand.id) redirect(`/${brand.id}`);
  const year = Number(sp.get("year"));
  redirect(`/${brand.id}/${model.id}${year >= model.from && year <= model.to ? `?year=${year}` : ""}`);
}
