import { getCatalogIndex } from "@/lib/queries";

export const dynamic = "force-dynamic";

const fa: Record<string, string> = { Apple: "اپل آیفون", Samsung: "سامسونگ", Xiaomi: "شیائومی شیامی", Anker: "انکر", Baseus: "بیسوس", JBL: "جی بی ال" };

/** Lightweight search index for the header search overlay. */
export async function GET() {
  const items = await getCatalogIndex();
  return Response.json(
    items.map((p) => ({ id: p.slug, name: p.name, brand: `${p.brand ?? ""} ${fa[p.brand ?? ""] ?? ""}`.trim(), compat: p.compat ?? "", hue: p.hue, img: p.img ?? "", price: p.price, catLabel: p.categoryLabel })),
    { headers: { "Cache-Control": "public, max-age=60" } },
  );
}
