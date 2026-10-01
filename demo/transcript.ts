/** Scripted end-to-end demo printed as a chat transcript. Run: npm run demo:script */
import { prisma } from '../src/db/client';
import { createEngine } from './engine';
import { setSender } from '../src/modules/notifications/service';

async function main() {
  const e = await createEngine();
  const U = 700001, ADMIN = Number(process.env.ADMIN_TELEGRAM_ID ?? 9000);
  let printed = 0;
  const flush = (title: string) => {
    console.log(`\n━━━ ${title} ━━━`);
    for (const m of e.log.slice(printed)) {
      const who = m.chat === ADMIN ? '🛠 ADMIN' : '👤 USER ';
      console.log(`[${who}] ${(m.text ?? '(photo)').split('\n').join('\n          ')}`);
      if (m.buttons?.length) console.log('          ' + m.buttons.flat().map((b) => `[${b.text}]`).join(' '));
      if (m.image) console.log('          (QR image sent)');
    }
    printed = e.log.length;
  };
  void setSender;
  await e.text(U, 'Ali', '/start'); flush('1) کاربر /start می‌زند');
  await e.tap(U, 'Ali', 'menu:buy'); flush('2) خرید VPN');
  const product = await prisma.product.findFirstOrThrow({ orderBy: { sortOrder: 'asc' } });
  await e.tap(U, 'Ali', `buy:${product.id}`);
  await e.tap(U, 'Ali', `bo:${product.id}`); flush('3) سفارش + دستور پرداخت کارت‌به‌کارت');
  const order = await prisma.order.findFirstOrThrow({ orderBy: { createdAt: 'desc' } });

  console.log('\n💸 (بانک) واریز واقعی ۲۵۰٬۰۰۰ تومان با کد پیگیری 556677889 در لجر ثبت می‌شود (webhook امضاشده)');
  await e.bankDeposit(order.finalAmount, '556677889');
  await e.tap(U, 'Ali', `rc:${order.id}`);
  await e.photo(U, 'Ali', 'کد پیگیری: 556677889'); flush('4) ارسال رسید → Verification → Auto Approve → X-UI → تحویل');

  const svc = await prisma.vpnService.findFirstOrThrow();
  await e.tap(U, 'Ali', `sv:qr:${svc.id}`);
  await e.tap(U, 'Ali', `sv:v:${svc.id}`); flush('5) QR و وضعیت سرویس');
  console.log('\n🛰 کلاینت‌های موجود در پنل (جعلی X-UI، از مسیر HTTP واقعی):');
  console.log(JSON.stringify(e.panel.inbounds.get(1)!.settings.clients.map((c: any) => ({ email: c.email, uuid: c.id, totalGB_bytes: c.totalGB, expiry: new Date(c.expiryTime).toISOString(), enable: c.enable })), null, 2));

  // second user: no ledger match => manual review queue, then admin approves
  const U2 = 700002;
  await e.text(U2, 'Sara', '/start');
  await e.tap(U2, 'Sara', `bo:${product.id}`);
  const o2 = await prisma.order.findFirstOrThrow({ where: { user: { telegramId: BigInt(U2) } } });
  await e.tap(U2, 'Sara', `rc:${o2.id}`);
  await e.text(U2, 'Sara', '123123123'); flush('6) رسید بدون تأیید بانکی ⇒ صف بررسی (NEEDS_REVIEW)، هیچ سرویسی ساخته نمی‌شود');
  const p2 = await prisma.payment.findFirstOrThrow({ where: { orderId: o2.id } });
  await e.tap(ADMIN, 'Admin', `ap:v:${p2.id}`); flush('7) ادمین جزئیات پرداخت (ریسک/OCR/تأیید) را می‌بیند');
  await e.tap(ADMIN, 'Admin', `ap:ok2:${p2.id}`);
  await e.tap(ADMIN, 'Admin', `ap:ok2:${p2.id}`); flush('8) ادمین دوبار Approve می‌زند ⇒ فقط یک Client ساخته می‌شود');
  console.log(`\n✅ تعداد Clientهای پنل: ${e.panel.clientCount()} (انتظار: 2)`);
  console.log('🧾 Audit:', (await prisma.auditLog.findMany({ orderBy: { createdAt: 'asc' } })).map((a) => a.action).join(' → '));
  await e.close();
  await prisma.$disconnect();
}
main().catch((err) => { console.error(err); process.exit(1); });
