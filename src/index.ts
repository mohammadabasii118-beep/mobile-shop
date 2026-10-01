import { env } from './config/env';
import { prisma } from './db/client';
import { logger } from './utils/logger';
import { createBot, USER_COMMANDS } from './bot';
import { createServer } from './server';
import { startJobs } from './jobs/scheduler';
import { getVpnProvider } from './providers/vpn';
import { createTesseractEngine } from './modules/payments/receipt';
import { setPaymentDeps } from './modules/payments/service';

async function main() {
  const e = env();
  if (!e.BOT_TOKEN) throw new Error('BOT_TOKEN is required');
  await prisma.$connect();

  const vpn = getVpnProvider();
  const health = await vpn.healthCheck();
  logger.info({ provider: vpn.name, ok: health.ok, detail: health.detail }, 'VPN provider status');
  if (!health.ok && e.NODE_ENV === 'production') logger.warn('X-UI is unreachable at startup; provisioning will retry automatically');

  if (e.OCR_ENABLED) {
    const ocr = await createTesseractEngine();
    if (ocr) setPaymentDeps({ ocr }); else logger.warn('OCR_ENABLED=true but tesseract.js is not installed; OCR disabled');
  }

  const bot = createBot(e.BOT_TOKEN);
  await bot.api.setMyCommands(USER_COMMANDS).catch(() => undefined);
  const server = createServer().listen(e.PORT, () => logger.info({ port: e.PORT }, 'http listening (/health, /webhooks/bank-transactions)'));
  const stopJobs = startJobs();

  const shutdown = async (sig: string) => {
    logger.info({ sig }, 'shutting down');
    stopJobs();
    server.close();
    await bot.stop();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  await bot.start({ onStart: (me) => logger.info({ bot: me.username }, 'bot started (long polling)') });
}

main().catch((err) => {
  logger.fatal({ err: String(err?.message ?? err) }, 'fatal');
  process.exit(1);
});
