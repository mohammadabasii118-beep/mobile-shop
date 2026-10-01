import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

export default async function setup() {
  const url = process.env.TEST_DATABASE_URL ?? 'postgresql://vpn:vpn@localhost:5432/vpnbot_test?schema=public';
  const dbName = new URL(url).pathname.slice(1);
  if (!/_test$/.test(dbName)) throw new Error(`refusing to wipe non-test database "${dbName}" (name must end with _test)`);
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  await prisma.$executeRawUnsafe('DROP SCHEMA IF EXISTS public CASCADE');
  await prisma.$executeRawUnsafe('CREATE SCHEMA public');
  await prisma.$disconnect();
  execSync('npx prisma migrate deploy', { stdio: 'pipe', env: { ...process.env, DATABASE_URL: url } });
}
