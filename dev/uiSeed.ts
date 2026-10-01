/**
 * Visual-QA harness (dev only): fills the DEV database through the real services (orders, payments, provisioning against
 * the fake 3x-ui HTTP panel, tickets…) and serves the real web panel, printing a one-time login URL.
 *   DATABASE_URL=…/vpnbot_dev NODE_ENV=development BOT_TOKEN=1:x ADMIN_TELEGRAM_ID=9000 npx tsx dev/uiSeed.ts
 */
import { prisma } from '../src/db/client';
import { FakeXui } from './fakeXui';
import { XuiClient } from '../src/providers/vpn/xui/client';
import { XuiVpnProvider } from '../src/providers/vpn/xui/provider';
import { setVpnProvider } from '../src/providers/vpn';
import { setSender } from '../src/modules/notifications/service';
import { upsertUser } from '../src/modules/users/service';
import { createProduct } from '../src/modules/products/service';
import { createOrder } from '../src/modules/orders/service';
import { approvePayment, ingestBankTransaction, rejectPayment, submitReceipt } from '../src/modules/payments/service';
import { createCoupon } from '../src/modules/coupons/service';
import { createTicket, adminReply } from '../src/modules/support/service';
import { syncService, suspendService } from '../src/modules/vpn/service';
import { setSetting } from '../src/modules/settings/service';
import { createServer } from '../src/server';
import { createLoginToken, loginUrl } from '../src/admin-web/auth';
import QRCode from 'qrcode';

async function main() {
  const rows = await prisma.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations'`;
  if (!/_dev$|_test$/.test(new URL(process.env.DATABASE_URL!).pathname)) throw new Error('refusing to seed a non-dev database');
  await prisma.$executeRawUnsafe(`TRUNCATE ${rows.map((r) => `"${r.tablename}"`).join(',')} RESTART IDENTITY CASCADE`);
  const panel = await new FakeXui().start();
  setVpnProvider(new XuiVpnProvider({ client: new XuiClient({ baseUrl: panel.url, username: 'admin', password: 'secret' }), publicHost: 'vpn.example.com', subBaseUrl: 'https://sub.example.com/sub/' }));
  setSender(async () => undefined);
  await setSetting('card.number', '6037991122334455'); await setSetting('card.holder', 'علی رضایی'); await setSetting('card.bank', 'ملت'); await setSetting('card.enabled', 'true');
  const p1 = await createProduct('seed', { name: 'اقتصادی ۵۰ گیگ', description: 'مناسب استفاده روزمره', durationDays: 30, trafficGB: 50, price: 250000, xuiInboundId: 1, protocol: 'VLESS', sortOrder: 1 });
  const p2 = await createProduct('seed', { name: 'ویژه ۱۰۰ گیگ', durationDays: 60, trafficGB: 100, price: 450000, xuiInboundId: 1, protocol: 'VLESS', sortOrder: 2 });
  await createProduct('seed', { name: 'قدیمی (غیرفعال)', durationDays: 30, trafficGB: 20, price: 120000, xuiInboundId: 1, protocol: 'VLESS', isActive: false, sortOrder: 3 });
  const { createCategory, setProductCategory } = await import('../src/modules/categories/service');
  const cm = await createCategory('seed', { name: 'ماهانه', icon: '🗓', description: 'پلن‌های یک‌ماهه' });
  const cv = await createCategory('seed', { name: 'حجمی', icon: '📦', parentId: cm.id });
  await createCategory('seed', { name: 'سالانه', icon: '⭐' });
  await setProductCategory('seed', p1.id, cm.id); await setProductCategory('seed', p2.id, cv.id);
  await createCoupon('seed', { code: 'WELCOME20', type: 'PERCENT', value: 20, maxUses: 100 });
  await createCoupon('seed', { code: 'FIX50K', type: 'FIXED', value: 50000, expiresAt: new Date(Date.now() + 20 * 86_400_000) });
  const img = await QRCode.toBuffer('receipt-demo-image', { width: 420 });
  const names = ['علی', 'سارا', 'محمد', 'نگین', 'رضا', 'مینا', 'کیان', 'هانیه'];
  const users: Awaited<ReturnType<typeof upsertUser>>[] = [];
  for (let k = 0; k < names.length; k++) users.push(await upsertUser({ id: 700100 + k, first_name: names[k], last_name: 'کاربر', username: `user_${700100 + k}` }));
  const order = async (u: number, p = p1) => (await createOrder({ userId: users[u].id, productId: p.id, paymentMethod: 'CARD_TO_CARD' })).order;
  const pay = (u: number, o: { id: string }, track?: string, image = true) => submitReceipt({ userId: users[u].id, orderId: o.id, fileId: 'x', image: image ? Buffer.concat([img, Buffer.from(String(Math.random()))]) : undefined, trackingCode: track, caption: track ? `مبلغ: 250,000 تومان\nشماره پیگیری: ${track}\n1405/07/10 14:30\nبانک ملت` : undefined });

  // 0,1: auto-approved via real ledger
  for (const [u, t] of [[0, '556677881'], [1, '556677882']] as const) { const o = await order(u); await ingestBankTransaction({ externalId: `l${t}`, trackingCode: t, amount: o.finalAmount, occurredAt: new Date(), source: 'seed', destination: '6037991122334455' }); await pay(u, o, t); }
  // 2: needs review (no ledger)  3: wrong amount in ledger  4: manual approve  5: rejected  6: pending payment  7: ordered renewal-less cancelled
  const o2 = await order(2, p2); await pay(2, o2, '111222333');
  const o3 = await order(3); await ingestBankTransaction({ externalId: 'l3', trackingCode: '444555666', amount: o3.finalAmount - 50000, occurredAt: new Date(), source: 'seed' }); await pay(3, o3, '444555666');
  const o4 = await order(4, p2); const pm4 = await pay(4, o4, '777888999'); await approvePayment(pm4.id, { actor: 'admin:9000' });
  const o5 = await order(5); const pm5 = await pay(5, o5, '999000111'); await rejectPayment(pm5.id, { actor: 'admin:9000', reason: 'مبلغ واریزی با سفارش مطابقت ندارد' });
  await order(6, p2);
  // service states: usage, expired, suspended, failed provisioning
  const svcs = await prisma.vpnService.findMany({ orderBy: { createdAt: 'asc' } });
  panel.addUsage(svcs[0].externalId, 6_200_000_000, 14_800_000_000); await syncService(svcs[0].id);
  panel.addUsage(svcs[1].externalId, 1_000_000_000, 2_500_000_000); await syncService(svcs[1].id);
  await prisma.vpnService.update({ where: { id: svcs[2].id }, data: { expiresAt: new Date(Date.now() - 3 * 86_400_000), status: 'EXPIRED' } });
  await suspendService(svcs[1].id, 'admin:9000');
  const o7 = await order(7); const pm7 = await pay(7, o7, '121212121'); panel.failNext = 50; await approvePayment(pm7.id, { actor: 'admin:9000' }); panel.failNext = 0;
  // tickets
  const t1 = await createTicket(users[0].id, 'VPN_ISSUE', 'اتصال برقرار نمی‌شود', 'سلام، از دیروز کانفیگ وصل نمی‌شود.\nلطفاً راهنمایی کنید.');
  await adminReply(9000n, t1.id, 'سلام، لطفاً برنامه را به‌روزرسانی کنید و دوباره امتحان کنید.');
  await createTicket(users[2].id, 'PAYMENT_ISSUE', 'پرداخت من تأیید نشده', 'دو ساعت پیش پرداخت کردم ولی هنوز سرویس نگرفتم.');
  await createTicket(users[1].id, 'RENEWAL', 'تمدید سرویس', 'می‌خواهم سرویسم را تمدید کنم.');

  const server = createServer().listen(Number(process.env.PORT ?? 8110));
  for (let k = 0; k < 6; k++) console.log('LOGIN', loginUrl(createLoginToken(9000n)));
  console.log('READY');
  process.on('SIGTERM', async () => { server.close(); await panel.stop(); process.exit(0); });
}
main().catch((e) => { console.error(e); process.exit(1); });
