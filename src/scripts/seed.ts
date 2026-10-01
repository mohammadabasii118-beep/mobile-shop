/** Optional: seed example products. Admins are configured via ADMIN_TELEGRAM_ID (SUPER_ADMIN) and the Admin table. */
import { prisma } from '../db/client';
import { createProduct } from '../modules/products/service';

async function main() {
  const inbound = Number(process.argv[2] ?? 1);
  if ((await prisma.product.count()) > 0) return console.log('products already exist; nothing to do');
  await createProduct('seed', { name: '50GB / 30 روزه', durationDays: 30, trafficGB: 50, price: 250000, xuiInboundId: inbound, protocol: 'VLESS', sortOrder: 1 });
  await createProduct('seed', { name: '100GB / 60 روزه', durationDays: 60, trafficGB: 100, price: 450000, xuiInboundId: inbound, protocol: 'VLESS', sortOrder: 2 });
  console.log(`seeded 2 products on inbound ${inbound} — verify protocol/inbound in the admin panel`);
}
main().finally(() => prisma.$disconnect());
