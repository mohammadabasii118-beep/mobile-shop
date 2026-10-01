import http from 'node:http';
import { z } from 'zod';
import { prisma } from './db/client';
import { env } from './config/env';
import { hmacSha256, safeEqual, sha256 } from './utils/misc';
import { RateLimiter } from './utils/ratelimit';
import { logger } from './utils/logger';
import { ingestBankTransaction } from './modules/payments/service';

const bankTxSchema = z.object({
  externalId: z.string().max(128).optional(),
  trackingCode: z.string().max(40).optional(),
  amount: z.number().int().positive(),
  unit: z.enum(['IRT', 'IRR']).default('IRT'),
  destination: z.string().max(40).optional(),
  occurredAt: z.string().datetime({ offset: true }),
  status: z.enum(['SUCCESS', 'FAILED']).default('SUCCESS'),
  source: z.string().max(40).default('webhook'),
});

/**
 * - GET  /health                      liveness + DB check (no secrets)
 * - POST /webhooks/bank-transactions  signed feed of REAL incoming bank credits (bank API / SMS gateway).
 *   Header: X-Signature = hex(HMAC-SHA256(BANK_WEBHOOK_SECRET, rawBody))
 */
export function createServer() {
  const limiter = new RateLimiter(120, 60_000);
  return http.createServer(async (req, res) => {
    const send = (code: number, body: unknown) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
    try {
      if (req.method === 'GET' && req.url === '/health') {
        await prisma.$queryRaw`SELECT 1`;
        return send(200, { ok: true, uptime: Math.round(process.uptime()) });
      }
      if (req.method === 'POST' && req.url === '/webhooks/bank-transactions') {
        const ip = String(req.socket.remoteAddress);
        if (!limiter.allow(ip)) return send(429, { error: 'rate_limited' });
        const secret = env().BANK_WEBHOOK_SECRET;
        if (!secret) return send(503, { error: 'webhook_not_configured' });
        const chunks: Buffer[] = [];
        let size = 0;
        for await (const c of req) { size += (c as Buffer).length; if (size > 16_384) return send(413, { error: 'too_large' }); chunks.push(c as Buffer); }
        const raw = Buffer.concat(chunks);
        const sig = String(req.headers['x-signature'] ?? '');
        if (!safeEqual(sig, hmacSha256(secret, raw))) return send(401, { error: 'bad_signature' });
        const parsed = bankTxSchema.safeParse(JSON.parse(raw.toString('utf8')));
        if (!parsed.success) return send(400, { error: 'invalid_body' });
        const b = parsed.data;
        const amount = b.unit === 'IRR' ? Math.round(b.amount / 10) : b.amount;
        const r = await ingestBankTransaction({
          externalId: b.externalId ?? sha256(`${b.trackingCode ?? ''}|${amount}|${b.occurredAt}|${b.destination ?? ''}`),
          trackingCode: b.trackingCode, amount, destination: b.destination, occurredAt: new Date(b.occurredAt), status: b.status, source: b.source,
        });
        return send(200, r);
      }
      send(404, { error: 'not_found' });
    } catch (e: any) {
      logger.error({ err: String(e?.message) }, 'http error');
      send(500, { error: 'internal' });
    }
  });
}
