/** Sends queued external notification deliveries (run from cron/systemd timer once a channel is configured). */
import "dotenv/config";
import { processDeliveries } from "../lib/server/notify";

processDeliveries(200).then((r) => { console.log(r); process.exit(0); });
