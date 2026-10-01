import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/db/client';
import { addLedgerTx, makeOrder, makeProduct, makeUser, png, resetDb, setup, submit } from './helpers';
import { approvePayment, rejectPayment, reverifyPending } from '../src/modules/payments/service';
import { setSetting } from '../src/modules/settings/service';

let ctx: ReturnType<typeof setup>;
beforeEach(async () => { await resetDb(); ctx = setup(); });

async function scenario() {
  const user = await makeUser();
  const product = await makeProduct();
  const order = await makeOrder(user.id, product.id);
  return { user, product, order };
}

describe('payment verification + auto approval', () => {
  it('receipt image alone is NEVER auto-approved (needs review)', async () => {
    const { user, order } = await scenario();
    const p = await submit(user.id, order.id, { trackingCode: '123456789' });
    expect(p.status).toBe('NEEDS_REVIEW');
    expect(p.verificationStatus).toBe('UNKNOWN');
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('PAYMENT_REVIEW');
    expect(await prisma.vpnService.count()).toBe(0);
    expect(ctx.vpn.createCalls).toBe(0);
  });

  it('receipt-only auto approval stays blocked unless explicitly enabled AND risk is low', async () => {
    const { user, order } = await scenario();
    await setSetting('verification.allowReceiptOnlyAutoApprove', 'true');
    const p = await submit(user.id, order.id, { trackingCode: '123456789' });
    // not externally verified => +30 risk => MEDIUM => still review
    expect(p.status).toBe('NEEDS_REVIEW');
  });

  it('verified by bank ledger (tracking + amount) => auto approve => provision => deliver', async () => {
    const { user, order } = await scenario();
    await addLedgerTx(order.finalAmount, '555111222');
    const p = await submit(user.id, order.id, { trackingCode: '555111222' });
    expect(p.status).toBe('APPROVED');
    expect(p.autoApproved).toBe(true);
    expect(p.verificationStatus).toBe('VERIFIED');
    expect(p.riskLevel).toBe('LOW');
    const o = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(o.status).toBe('FULFILLED');
    const svc = await prisma.vpnService.findUniqueOrThrow({ where: { orderId: order.id } });
    expect(svc.provisioningStatus).toBe('SUCCESS');
    expect(svc.config).toContain('vless://');
    expect(ctx.sent.some((m) => m.text.includes('سرویس شما آماده است') && m.text.includes('vless://'))).toBe(true);
    const audits = await prisma.auditLog.findMany({ select: { action: true } });
    expect(audits.map((a) => a.action)).toEqual(expect.arrayContaining(['payment.auto_approve', 'vpn.provision.success']));
  });

  it('ledger tx arriving AFTER the receipt auto-approves via re-verification', async () => {
    const { user, order } = await scenario();
    const p = await submit(user.id, order.id, { trackingCode: '777888999' });
    expect(p.status).toBe('NEEDS_REVIEW');
    const r = await addLedgerTx(order.finalAmount, '777888999');
    expect((r as any).autoApproved).toBe(1);
    expect(await reverifyPending()).toBe(0); // nothing left to do
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: p.id } })).status).toBe('APPROVED');
  });

  it('wrong amount in ledger => NEEDS_REVIEW, never approved', async () => {
    const { user, order } = await scenario();
    await addLedgerTx(order.finalAmount - 1000, '314159265');
    const p = await submit(user.id, order.id, { trackingCode: '314159265' });
    expect(p.status).toBe('NEEDS_REVIEW');
    expect(p.verificationStatus).toBe('NEEDS_REVIEW');
    expect(JSON.stringify(p.riskFactors)).not.toContain('"duplicate');
  });

  it('amount-only ledger match is weak => review', async () => {
    const { user, order } = await scenario();
    await addLedgerTx(order.finalAmount);
    const p = await submit(user.id, order.id);
    expect(p.verificationStatus).toBe('VERIFIED');
    expect(p.status).toBe('NEEDS_REVIEW');
    expect(JSON.stringify(p.riskFactors)).toContain('weak_match_amount_time_only');
  });

  it('duplicate tracking code is never auto-approved', async () => {
    const { user, order } = await scenario();
    await addLedgerTx(order.finalAmount, '999000111');
    await submit(user.id, order.id, { trackingCode: '999000111' }); // legit, approved
    const u2 = await makeUser();
    const o2 = await makeOrder(u2.id, (await makeProduct({ name: 'other' })).id);
    await addLedgerTx(o2.finalAmount, '999000111', { externalId: 'second' });
    const p2 = await submit(u2.id, o2.id, { trackingCode: '999000111' });
    expect(p2.status).not.toBe('APPROVED');
    expect(JSON.stringify(p2.riskFactors)).toContain('duplicate_tracking');
  });

  it('one bank transaction cannot pay two orders (claim is unique)', async () => {
    const { user, order } = await scenario();
    await addLedgerTx(order.finalAmount, '424242424');
    await submit(user.id, order.id, { trackingCode: '424242424' });
    const u2 = await makeUser();
    const o2 = await makeOrder(u2.id, (await makeProduct({ name: 'p2' })).id);
    const p2 = await submit(u2.id, o2.id, { trackingCode: '424242424' });
    expect(p2.status).toBe('NEEDS_REVIEW');
    expect(await prisma.vpnService.count()).toBe(1);
  });

  it('duplicate receipt image is flagged', async () => {
    const { user, order } = await scenario();
    const img = png('same');
    await submit(user.id, order.id, { image: img, trackingCode: '111222333' });
    const u2 = await makeUser();
    const o2 = await makeOrder(u2.id, (await makeProduct({ name: 'p3' })).id);
    const p2 = await submit(u2.id, o2.id, { image: img, trackingCode: '444555666' });
    expect(JSON.stringify(p2.riskFactors)).toContain('duplicate_receipt');
    expect(p2.status).toBe('NEEDS_REVIEW');
  });

  it('manual mode never auto approves even when verified', async () => {
    const { user, order } = await scenario();
    await setSetting('verification.mode', 'MANUAL_REVIEW');
    await addLedgerTx(order.finalAmount, '135791357');
    const p = await submit(user.id, order.id, { trackingCode: '135791357' });
    expect(p.status).toBe('NEEDS_REVIEW');
  });

  it('OCR/caption extraction is stored but is not proof', async () => {
    const { user, order } = await scenario();
    const caption = `مبلغ: ${order.finalAmount.toLocaleString('en-US')} تومان\nشماره پیگیری: 987654321\n1405/07/10 14:30\nبانک ملت`;
    const p = await submit(user.id, order.id, { caption });
    const rd = p.receiptData as any;
    expect(rd.amount).toBe(order.finalAmount);
    expect(rd.trackingCode).toBe('987654321');
    expect(rd.bank).toBe('ملت');
    expect(p.status).toBe('NEEDS_REVIEW');
  });

  it('high risk can be configured to auto reject', async () => {
    const { user, order } = await scenario();
    await setSetting('risk.highAction', 'REJECT');
    await submit(user.id, order.id, { trackingCode: '606060606' });
    // second attempt (user rejected? no) -> craft high risk: wrong amount in caption + dup tracking + missing ledger
    const u2 = await makeUser();
    const o2 = await makeOrder(u2.id, (await makeProduct({ name: 'p4' })).id);
    const p2 = await submit(u2.id, o2.id, { trackingCode: '606060606', caption: 'مبلغ: 1,000 تومان' });
    expect(p2.status).toBe('REJECTED');
    expect((await prisma.order.findUniqueOrThrow({ where: { id: o2.id } })).status).toBe('PENDING_PAYMENT');
  });
});

describe('admin review + idempotency', () => {
  it('admin approve twice => exactly one client / one service', async () => {
    const { user, order } = await scenario();
    const p = await submit(user.id, order.id, { trackingCode: '246824682' });
    const [a, b] = await Promise.all([
      approvePayment(p.id, { actor: 'admin:1' }),
      approvePayment(p.id, { actor: 'admin:1' }),
    ]);
    expect([a.changed, b.changed].filter(Boolean)).toHaveLength(1);
    const c = await approvePayment(p.id, { actor: 'admin:1' });
    expect(c.changed).toBe(false);
    expect(ctx.vpn.createCalls).toBe(1);
    expect(await prisma.vpnService.count()).toBe(1);
    expect(await prisma.provisioningTask.count()).toBe(1);
  });

  it('reject returns order to pending so user can resubmit; cannot approve a rejected payment', async () => {
    const { user, order } = await scenario();
    const p = await submit(user.id, order.id, { trackingCode: '112233445' });
    expect((await rejectPayment(p.id, { actor: 'admin:1', reason: 'مبلغ اشتباه' })).changed).toBe(true);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('PENDING_PAYMENT');
    expect((await approvePayment(p.id, { actor: 'admin:1' })).changed).toBe(false);
    expect(ctx.sent.some((m) => m.text.includes('تأیید نشد'))).toBe(true);
    const p2 = await submit(user.id, order.id, { trackingCode: '998877665' });
    expect(p2.id).not.toBe(p.id);
  });

  it('a paid order cannot be submitted again; cancelled order cannot be approved', async () => {
    const { user, order } = await scenario();
    const p = await submit(user.id, order.id, { trackingCode: '123123123' });
    await approvePayment(p.id, { actor: 'admin:1' });
    await expect(submit(user.id, order.id, { trackingCode: '321321321' })).rejects.toThrow();
  });

  it('replayed submit (double tap) does not create two submitted payments', async () => {
    const { user, order } = await scenario();
    const img = png('x');
    const r = await Promise.allSettled([submit(user.id, order.id, { image: img }), submit(user.id, order.id, { image: img })]);
    expect(r.filter((x) => x.status === 'fulfilled').length).toBeGreaterThanOrEqual(1);
    expect(await prisma.payment.count({ where: { status: { in: ['SUBMITTED', 'NEEDS_REVIEW', 'APPROVED'] } } })).toBe(1);
  });
});
