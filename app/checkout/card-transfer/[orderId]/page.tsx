import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getBankSettings } from "@/lib/bankSettings";
import CardTransferForm from "@/components/CardTransferForm";

export default async function CardTransferPage(
  props: {
    params: Promise<{ orderId: string }>;
    searchParams: Promise<{ t?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const order = await db.order.findUnique({
    where: { id: params.orderId },
    include: { receipts: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!order) notFound();

  const session = await getServerSession(authOptions);
  const isAdmin = session?.user?.role === "ADMIN";
  const guestToken = searchParams.t || null;

  if (order.userId) {
    const isOwner = session?.user?.id === order.userId;
    if (!isOwner && !isAdmin) redirect("/login");
  } else if (!isAdmin) {
    // Guest order — the order id alone is never enough; the exact token
    // issued at checkout must be present in the URL.
    if (!order.guestToken || !guestToken || guestToken !== order.guestToken) {
      notFound();
    }
  }

  const bank = await getBankSettings();
  const latestReceipt = order.receipts[0] || null;

  return (
    <div className="max-w-lg mx-auto px-4 md:px-8 py-12">
      <h1 className="text-2xl font-extrabold mb-1 text-center">پرداخت کارت‌به‌کارت</h1>
      <p className="muted text-sm text-center mb-8">سفارش {order.orderNumber}</p>
      <CardTransferForm
        orderId={order.id}
        guestToken={order.userId ? null : guestToken}
        orderStatus={order.status}
        amount={order.total - order.walletAmountUsed}
        bank={{ cardNumber: bank.cardNumber, cardHolderName: bank.cardHolderName, bankName: bank.bankName }}
        latestReceipt={latestReceipt ? { status: latestReceipt.status, rejectReason: latestReceipt.rejectReason } : null}
        reservationExpiresAt={order.reservationExpiresAt ? order.reservationExpiresAt.toISOString() : null}
      />
    </div>
  );
}
