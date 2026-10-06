import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from '@/lib/db';

const TYPES: Record<string, string> = { '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif' };
const ROOT = path.join(DATA_DIR, 'uploads');

export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await ctx.params;
  const file = path.resolve(ROOT, ...parts.map((p) => decodeURIComponent(p)));
  if (!file.startsWith(ROOT + path.sep)) return new Response('Not found', { status: 404 });
  const type = TYPES[path.extname(file).toLowerCase()];
  if (!type || !fs.existsSync(file)) return new Response('Not found', { status: 404 });
  const buf = fs.readFileSync(file);
  return new Response(new Uint8Array(buf), {
    headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' },
  });
}
