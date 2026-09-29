import { catalog, shopCatOf, shopCats } from "@/lib/data";

export const dynamic = "force-static";

const fa: Record<string, string> = { Apple: "اپل آیفون", Samsung: "سامسونگ", Xiaomi: "شیائومی شیامی", Anker: "انکر", Baseus: "بیسوس", JBL: "جی بی ال" };

export function GET() {
  const label = (slug: string) => shopCats.find((c) => c.slug === slug)?.label ?? "";
  return Response.json(
    catalog.map((p) => ({ id: p.id, name: p.name, brand: `${p.brand} ${fa[p.brand] ?? ""}`, compat: p.compat ?? "", hue: p.hue, img: p.img ?? "", price: p.price, catLabel: label(shopCatOf(p)) })),
  );
}
