import { Prisma } from '@prisma/client';
import { prisma } from '../../db/client';

const SECRET_KEY = /pass|token|secret|authorization|cookie|api[-_]?key|credential/i;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[deep]';
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET_KEY.test(k) ? '[REDACTED]' : redact(v, depth + 1);
    }
    return out;
  }
  if (typeof value === 'bigint') return value.toString();
  return value;
}

export interface AuditInput {
  actor: string; // "admin:<telegramId>" | "system" | "user:<id>" | "auto"
  action: string;
  target?: string;
  targetId?: string;
  metadata?: unknown;
  ip?: string;
}

export async function audit(input: AuditInput, tx: Prisma.TransactionClient | typeof prisma = prisma) {
  return tx.auditLog.create({
    data: {
      actor: input.actor,
      action: input.action,
      target: input.target,
      targetId: input.targetId,
      metadata: input.metadata === undefined ? undefined : (redact(input.metadata) as Prisma.InputJsonValue),
      ip: input.ip,
    },
  });
}
