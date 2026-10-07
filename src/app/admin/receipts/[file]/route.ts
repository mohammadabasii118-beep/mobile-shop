import fs from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { assertAdmin } from '@/lib/auth';
import { DATA_DIR } from '@/lib/db';

export const runtime = 'nodejs';

/** نمایش عکس رسید؛ فقط برای مدیر */
export async function GET(_req: Request, ctx: { params: Promise<{ file: string }> }) {
  try { await assertAdmin(); } catch { return new NextResponse('Unauthorized', { status: 401 }); }
  const { file } = await ctx.params;
  if (!/^[a-f0-9]{16}\.webp$/.test(file)) return new NextResponse('Not found', { status: 404 });
  const p = path.join(DATA_DIR, 'receipts', file);
  if (!fs.existsSync(p)) return new NextResponse('Not found', { status: 404 });
  return new NextResponse(new Uint8Array(fs.readFileSync(p)), {
    headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}
