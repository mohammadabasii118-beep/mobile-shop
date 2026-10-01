import { logger } from '../utils/logger';
import { retryDueProvisioning } from '../modules/vpn/provisioning';
import { processExpirations, syncAllServices } from '../modules/vpn/service';
import { reverifyPending } from '../modules/payments/service';
import { flushPending } from '../modules/notifications/service';
import { expireStaleOrders } from '../modules/orders/service';
import { getNumber } from '../modules/settings/service';
import { getVpnProvider } from '../providers/vpn';
import { notifyAdmins } from '../modules/notifications/service';

interface Job { name: string; everyMs: number; run: () => Promise<unknown> }

let xuiDown = false;
export const jobs: Job[] = [
  { name: 'provisioning-retry', everyMs: 30_000, run: retryDueProvisioning },
  { name: 'notifications-flush', everyMs: 20_000, run: () => flushPending() },
  { name: 'payments-reverify', everyMs: 120_000, run: () => reverifyPending() },
  { name: 'traffic-sync', everyMs: 10 * 60_000, run: syncAllServices },
  { name: 'expirations', everyMs: 5 * 60_000, run: () => processExpirations() },
  { name: 'orders-expire', everyMs: 15 * 60_000, run: async () => expireStaleOrders(await getNumber('orders.expireMinutes')) },
  {
    name: 'xui-health', everyMs: 2 * 60_000,
    run: async () => {
      const h = await getVpnProvider().healthCheck();
      if (!h.ok && !xuiDown) await notifyAdmins('xui_unavailable', `🔌 X-UI در دسترس نیست: ${h.detail}`, { roles: ['VPN_ADMIN'] });
      xuiDown = !h.ok;
    },
  },
];

/** Simple in-process scheduler; each job is serialised (no overlapping runs). */
export function startJobs(): () => void {
  const timers = jobs.map((j) => {
    let running = false;
    const tick = async () => {
      if (running) return;
      running = true;
      try { await j.run(); } catch (e: any) { logger.error({ job: j.name, err: String(e?.message) }, 'job failed'); }
      finally { running = false; }
    };
    return setInterval(tick, j.everyMs);
  });
  return () => timers.forEach(clearInterval);
}
