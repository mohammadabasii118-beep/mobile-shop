import { User } from '@prisma/client';
import { prisma } from '../../db/client';
import { NotFoundError } from '../../utils/errors';

export interface TgUser { id: number | bigint; username?: string; first_name?: string; last_name?: string; language_code?: string }

export async function registerUser(tg: TgUser): Promise<{ user: User; isNew: boolean }> {
  const telegramId = BigInt(tg.id);
  const profile = { username: tg.username, firstName: tg.first_name, lastName: tg.last_name };
  const existing = await prisma.user.findUnique({ where: { telegramId } });
  if (existing) return { user: await prisma.user.update({ where: { telegramId }, data: profile }), isNew: false };
  try {
    return { user: await prisma.user.create({ data: { telegramId, ...profile, language: 'fa' } }), isNew: true };
  } catch (e: any) {
    if (e?.code !== 'P2002') throw e; // two first updates raced: the loser is not "new"
    return { user: await prisma.user.update({ where: { telegramId }, data: profile }), isNew: false };
  }
}

export async function upsertUser(tg: TgUser) {
  return (await registerUser(tg)).user;
}

export async function getUserByTelegramId(telegramId: bigint) {
  const u = await prisma.user.findUnique({ where: { telegramId } });
  if (!u) throw new NotFoundError('user');
  return u;
}

/** Account summary — strictly scoped to the given user. */
export async function accountSummary(userId: string) {
  const [user, orders, services] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.order.count({ where: { userId } }),
    prisma.vpnService.count({ where: { userId, provisioningStatus: 'SUCCESS' } }),
  ]);
  return { user, orders, services };
}
