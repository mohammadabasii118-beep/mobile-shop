import { AdminRole } from '@prisma/client';
import { prisma } from '../../db/client';
import { env } from '../../config/env';
import { ForbiddenError } from '../../utils/errors';

export type Permission =
  | 'payments.view' | 'payments.review'
  | 'vpn.view' | 'vpn.manage' | 'vpn.delete'
  | 'products.manage' | 'coupons.manage'
  | 'support.reply' | 'users.view'
  | 'settings.manage' | 'audit.view' | 'stats.view' | 'admins.manage' | 'texts.manage' | 'panels.manage';

const ALL: Permission[] = [
  'payments.view', 'payments.review', 'vpn.view', 'vpn.manage', 'vpn.delete', 'products.manage',
  'coupons.manage', 'support.reply', 'users.view', 'settings.manage', 'audit.view', 'stats.view', 'admins.manage', 'texts.manage', 'panels.manage',
];

export const ROLE_PERMISSIONS: Record<AdminRole, Permission[]> = {
  SUPER_ADMIN: ALL,
  PAYMENT_ADMIN: ['payments.view', 'payments.review', 'stats.view', 'users.view'],
  VPN_ADMIN: ['vpn.view', 'vpn.manage', 'stats.view', 'users.view'],
  SUPPORT_ADMIN: ['support.reply', 'users.view', 'vpn.view', 'payments.view'],
  PRODUCT_ADMIN: ['products.manage', 'coupons.manage', 'stats.view', 'texts.manage'],
};

export async function getAdmin(telegramId: bigint) {
  const bootstrap = env().ADMIN_TELEGRAM_ID;
  if (bootstrap && BigInt(bootstrap) === telegramId) {
    return { telegramId, role: 'SUPER_ADMIN' as AdminRole, isActive: true, id: 'bootstrap' };
  }
  const a = await prisma.admin.findUnique({ where: { telegramId } });
  return a && a.isActive ? a : null;
}

export async function hasPermission(telegramId: bigint, perm: Permission): Promise<boolean> {
  const a = await getAdmin(telegramId);
  return !!a && ROLE_PERMISSIONS[a.role].includes(perm);
}

export async function requirePermission(telegramId: bigint, perm: Permission) {
  const a = await getAdmin(telegramId);
  if (!a || !ROLE_PERMISSIONS[a.role].includes(perm)) throw new ForbiddenError(`Missing permission ${perm}`);
  return a;
}

export const adminActor = (telegramId: bigint) => `admin:${telegramId}`;
