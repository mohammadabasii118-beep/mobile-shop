import { HeaderView } from "@/components/header";
import { getCurrentUser } from "@/lib/server/auth/session";
import { getCategoryTree, getMenu, getSiteInfo } from "@/lib/queries";

/** Server component: header data (categories, main menu, site info) comes from the database. */
export async function Header() {
  const [tree, main, mobile, info, user] = await Promise.all([getCategoryTree(), getMenu("main"), getMenu("mobile"), getSiteInfo(), getCurrentUser()]);
  const menu = tree.map((c) => ({ slug: c.slug, label: c.label, subs: c.subs }));
  return <HeaderView loggedIn={!!user} menu={menu} info={info} links={main.map((m) => ({ label: m.label, link: m.link ?? "/" }))} mobileLinks={mobile.map((m) => ({ label: m.label, link: m.link ?? "/" }))} />;
}
