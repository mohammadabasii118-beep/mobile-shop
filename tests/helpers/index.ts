import { prisma } from '../../src/db/client';
import { setSender, OutMessage } from '../../src/modules/notifications/service';
import { MockVpnProvider } from '../../src/providers/vpn/mock';
import { setVpnProvider } from '../../src/providers/vpn';
import { upsertUser } from '../../src/modules/users/service';
import { createProduct } from '../../src/modules/products/service';
import { createOrder } from '../../src/modules/orders/service';
import { ingestBankTransaction, submitReceipt } from '../../src/modules/payments/service';
import { resetEnvCache } from '../../src/config/env';

export async function resetDb() {
  const rows = await prisma.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations'`;
  await prisma.$executeRawUnsafe(`TRUNCATE ${rows.map((r) => `"${r.tablename}"`).join(',')} RESTART IDENTITY CASCADE`);
  resetEnvCache();
}

export function setup() {
  const sent: OutMessage[] = [];
  setSender(async (m) => { sent.push(m); });
  const vpn = new MockVpnProvider();
  setVpnProvider(vpn);
  return { sent, vpn };
}

let tg = 1000;
export const makeUser = (id = ++tg) => upsertUser({ id, username: `u${id}`, first_name: 'T' });
export const makeProduct = (over: Partial<Parameters<typeof createProduct>[1]> = {}) =>
  createProduct('test', { name: '50GB / 30d', durationDays: 30, trafficGB: 50, price: 250000, xuiInboundId: 1, protocol: 'VLESS', ...over }, { verifyInbound: false });

export async function makeOrder(userId: string, productId: string, extra: Partial<Parameters<typeof createOrder>[0]> = {}) {
  return (await createOrder({ userId, productId, paymentMethod: 'CARD_TO_CARD', ...extra })).order;
}

export async function addLedgerTx(amount: number, trackingCode?: string, over: Partial<Parameters<typeof ingestBankTransaction>[0]> = {}) {
  return ingestBankTransaction({
    externalId: `ext-${Math.random()}`, trackingCode, amount, occurredAt: new Date(), source: 'test', destination: '6037991122334455', ...over,
  });
}

export const png = (seed = 'a') => Buffer.from(`fake-image-${seed}`);
export async function submit(userId: string, orderId: string, o: { trackingCode?: string; image?: Buffer; caption?: string } = {}) {
  return submitReceipt({ userId, orderId, fileId: 'tgfile', image: o.image ?? png(String(Math.random())), trackingCode: o.trackingCode, caption: o.caption });
}
