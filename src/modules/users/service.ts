import { prisma } from '../../db/client';
import { NotFoundError } from '../../utils/errors';

export interface TgUser { id: number | bigint; username?: string; first_name?: string; last_name?: string; language_code?: string }

export async function upsertUser(tg: TgUser) {
  const telegramId = BigInt(tg.id);
  return prisma.user.upsert({
    where: { telegramId },
    create: { telegramId, username: tg.username, firstName: tg.first_name, lastName: tg.last_name, language: 'fa' },
    update: { username: tg.username, firstName: tg.first_name, lastName: tg.last_name },
  });
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
