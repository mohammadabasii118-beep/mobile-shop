// The execution side of the no-code automation engine. Admins build rules
// entirely from the UI at /admin/automation (trigger + action + a tiny
// config, no code); this file is the ONLY place those rules are actually
// run, and it is called from the exact real event points already in the
// codebase (never a fabricated/simulated event).
//
// Deliberately NOT a generic "run arbitrary code" engine — actionConfig is
// only ever read as plain data (e.g. a points number), never eval'd.
import type { Prisma, AutomationTrigger } from "@prisma/client";

interface TriggerContext {
  orderId?: string;
  userId?: string;
  orderTotal?: number;
  message?: string;
  link?: string;
}

/**
 * Runs every active rule for a given trigger. Takes the transaction client
 * when called from inside an existing `$transaction` (so an automation
 * side-effect commits or rolls back together with the event that caused
 * it), or the plain `db` client otherwise.
 */
export async function runAutomationRules(
  tx: Prisma.TransactionClient,
  trigger: AutomationTrigger,
  ctx: TriggerContext
): Promise<void> {
  const rules = await tx.automationRule.findMany({ where: { trigger, isActive: true } });
  for (const rule of rules) {
    const cfg = (rule.actionConfig as Record<string, unknown>) || {};
    if (rule.action === "CREATE_ADMIN_ALERT") {
      await tx.adminAlert.create({
        data: {
          message: ctx.message || `رویداد خودکار: ${rule.name}`,
          link: ctx.link || null,
        },
      });
    } else if (rule.action === "GRANT_LOYALTY_BONUS") {
      // Only meaningful when the trigger actually has a real user + order
      // to credit — a rule misconfigured against a userless trigger is
      // simply skipped rather than crediting the wrong thing.
      if (ctx.userId && ctx.orderId) {
        const points = Number(cfg.points) || 0;
        // A synthetic-but-stable orderId per (order, rule) pair keeps this
        // idempotent via the same @unique constraint the real checkout
        // loyalty credit relies on — replaying this event never
        // double-grants the bonus.
        const ledgerKey = `${ctx.orderId}:automation:${rule.id}`;
        if (points > 0) {
          const existing = await tx.loyaltyTransaction.findUnique({ where: { orderId: ledgerKey } });
          if (!existing) {
            await tx.loyaltyTransaction.create({
              data: { userId: ctx.userId, points, reason: `پاداش خودکار: ${rule.name}`, orderId: ledgerKey },
            });
            await tx.user.update({ where: { id: ctx.userId }, data: { loyaltyPoints: { increment: points } } });
          }
        }
      }
    }
  }
}
