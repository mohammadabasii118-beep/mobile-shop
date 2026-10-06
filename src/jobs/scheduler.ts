import { logger } from '../utils/logger';
import { retryDueProvisioning } from '../modules/vpn/provisioning';
import { processExpirations, syncAllServices } from '../modules/vpn/service';
import { reverifyPending } from '../modules/payments/service';
import { flushPending } from '../modules/notifications/service';
import { expireStaleOrders } from '../modules/orders/service';
import { getNumber } from '../modules/settings/service';
import { activePanelCodes, getPanel, testPanel } from '../modules/panels/service';
import { notifyAdmins } from '../modules/notifications/service';

interface Job { name: string; everyMs: number; run: () => Promise<unknown> }

/** Consecutive failures per panel; an alert is sent after 2 in a row (one blip is not an outage) and once more on recovery. */
const panelFails = new Map<string, number>();
const panelAlerted = new Set<string>();

export async function checkPanels() {
  for (const code of await activePanelCodes()) {
    const r = await testPanel(code);
    const name = await getPanel(code).then((p) => p.name).catch(() => code);
    if (r.ok) {
      panelFails.delete(code);
      if (panelAlerted.delete(code)) await notifyAdmins('xui_recovered', `🟢 پنل «${name}» دوباره متصل شد.`, { roles: ['VPN_ADMIN'] });
      continue;
    }
    const n = (panelFails.get(code) ?? 0) + 1;
    panelFails.set(code, n);
    if (n >= 2 && !panelAlerted.has(code)) {
      panelAlerted.add(code);
      await notifyAdmins('xui_unavailable', `🔌 پنل «${name}» در دسترس نیست: ${r.detail}`, { roles: ['VPN_ADMIN'] });
    }
  }
}
export const jobs: Job[] = [
  { name: 'provisioning-retry', everyMs: 30_000, run: retryDueProvisioning },
  { name: 'notifications-flush', everyMs: 20_000, run: () => flushPending() },
  { name: 'payments-reverify', everyMs: 120_000, run: () => reverifyPending() },
  { name: 'traffic-sync', everyMs: 10 * 60_000, run: syncAllServices },
  { name: 'expirations', everyMs: 5 * 60_000, run: () => processExpirations() },
  { name: 'orders-expire', everyMs: 15 * 60_000, run: async () => expireStaleOrders(await getNumber('orders.expireMinutes')) },
  { name: 'xui-health', everyMs: 60_000, run: checkPanels },
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
