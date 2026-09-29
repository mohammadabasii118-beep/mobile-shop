import { HeaderView } from "@/components/header";
import { getCategoryTree, getMenu, getSiteInfo } from "@/lib/queries";

/** Server component: header data (categories, main menu, site info) comes from the database. */
export async function Header() {
  const [tree, main, info] = await Promise.all([getCategoryTree(), getMenu("main"), getSiteInfo()]);
  const menu = tree.map((c) => ({ slug: c.slug, label: c.label, subs: c.subs }));
  return <HeaderView menu={menu} info={info} links={main.map((m) => ({ label: m.label, link: m.link ?? "/" }))} />;
}
