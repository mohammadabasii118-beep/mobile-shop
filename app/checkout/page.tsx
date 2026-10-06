import type { Metadata } from "next";
import { BottomNav } from "@/components/header";
import { Header } from "@/components/site-header";
import { Footer } from "@/components/footer";
import { Container } from "@/components/ui";
import { CheckoutClient } from "@/components/checkout/checkout-client";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/server/auth/guard";
import { getCartView } from "@/lib/server/cart";
import { getEnabledProviders } from "@/lib/server/payments";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "تسویه حساب | CaseLine", robots: { index: false, follow: false } };

export default async function CheckoutPage() {
  const user = await requirePageUser("/checkout");
  const [addresses, cart] = await Promise.all([
    db.address.findMany({ where: { userId: user.id }, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] }),
    getCartView(user),
  ]);
  return (
    <>
      <Header />
      <main id="main" tabIndex={-1} className="py-6">
        <Container>
          <h1 className="font-display mb-6 text-[36px] leading-none sm:text-[44px]">تسویه حساب</h1>
          <CheckoutClient
            initialAddresses={addresses.map((a) => ({ id: a.id, title: a.title, receiver: a.receiver, phone: a.phone, province: a.province, city: a.city, postalCode: a.postalCode, address: a.address, isDefault: a.isDefault }))}
            providers={getEnabledProviders().map((p) => ({ key: p.key, label: p.label, description: p.description }))}
            initialCoupon={cart.couponCode}
          />
        </Container>
      </main>
      <Footer />
      <BottomNav />
    </>
  );
}
