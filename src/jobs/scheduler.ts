import { logger } from '../utils/logger';
import { retryDueProvisioning } from '../modules/vpn/provisioning';
import { processExpirations, syncAllServices } from '../modules/vpn/service';
import { reverifyPending } from '../modules/payments/service';
import { flushPending } from '../modules/notifications/service';
import { expireStaleOrders } from '../modules/orders/service';
import { getNumber } from '../modules/settings/service';
import { listPanels, testPanel } from '../modules/panels/service';
import { notifyAdmins } from '../modules/notifications/service';

interface Job { name: string; everyMs: number; run: () => Promise<unknown> }

/** Consecutive failures per panel; an alert is sent after 2 in a row (one blip is not an outage) and once more on recovery. */
const panelFails = new Map<string, number>();
const panelAlerted = new Set<string>();

export async function checkPanels() {
  const active = (await listPanels()).filter((p) => p.isActive);
  // forget state of panels that were deleted/deactivated meanwhile (no stale alerts, no missing recovery notice later)
  for (const code of [...panelFails.keys(), ...panelAlerted]) if (!active.some((p) => p.code === code)) { panelFails.delete(code); panelAlerted.delete(code); }
  await Promise.all(active.map(async (p) => {
    const r = await testPanel(p.code); // probed in parallel: one dead panel cannot delay the others
    if (r.ok) {
      panelFails.delete(p.code);
      if (panelAlerted.delete(p.code)) await notifyAdmins('xui_recovered', `🟢 پنل «${p.name}» دوباره متصل شد.`, { roles: ['VPN_ADMIN'] });
      return;
    }
    const n = (panelFails.get(p.code) ?? 0) + 1;
    panelFails.set(p.code, n);
    if (n >= 2 && !panelAlerted.has(p.code)) {
      panelAlerted.add(p.code);
      await notifyAdmins('xui_unavailable', `🔌 پنل «${p.name}» در دسترس نیست: ${r.detail}`, { roles: ['VPN_ADMIN'] });
    }
  }));
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
