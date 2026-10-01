import { RiskLevel } from '@prisma/client';

export interface RiskInput {
  orderAmount: number;
  ocrAmount?: number;
  submittedAmount?: number;
  trackingCode?: string;
  trackingMatchedLedger: boolean;
  matchedBy?: 'tracking' | 'amount_time' | 'none';
  duplicateTracking: boolean;
  duplicateReceipt: boolean;
  ocrConfidence?: number; // undefined if OCR wasn't used
  ocrMinConfidence: number;
  receiptTimeBeforeOrder: boolean;
  submissions24h: number;
  maxSubmissions24h: number;
  userRejectedCount: number;
  userApprovedCount: number;
  verificationVerified: boolean;
}

export interface RiskFactor { code: string; points: number; detail?: string }
export interface RiskResult { score: number; level: RiskLevel; factors: RiskFactor[] }

export interface RiskThresholds { mediumAt: number; highAt: number }

export function assessRisk(i: RiskInput, t: RiskThresholds): RiskResult {
  const f: RiskFactor[] = [];
  const add = (code: string, points: number, detail?: string) => f.push({ code, points, detail });

  const claimed = i.ocrAmount ?? i.submittedAmount;
  if (claimed !== undefined && claimed !== i.orderAmount) add('amount_mismatch', 40, `${claimed} != ${i.orderAmount}`);
  if (!i.trackingCode) add('tracking_missing', 20);
  if (i.duplicateTracking) add('duplicate_tracking', 70);
  if (i.duplicateReceipt) add('duplicate_receipt', 60);
  if (i.ocrConfidence !== undefined && i.ocrConfidence < i.ocrMinConfidence) add('ocr_low_confidence', 15, String(i.ocrConfidence));
  if (i.receiptTimeBeforeOrder) add('payment_time_before_order', 25);
  if (i.submissions24h > i.maxSubmissions24h) add('repeated_submissions', 25, String(i.submissions24h));
  if (i.userRejectedCount > 0 && i.userApprovedCount === 0) add('user_history_rejected', 20);
  if (i.userApprovedCount >= 2 && i.userRejectedCount === 0) add('user_history_good', -10);
  if (!i.verificationVerified) add('not_externally_verified', 30);
  if (i.verificationVerified && i.matchedBy === 'amount_time') add('weak_match_amount_time_only', 35);

  const score = Math.max(0, Math.min(100, f.reduce((s, x) => s + x.points, 0)));
  const level: RiskLevel = score >= t.highAt ? 'HIGH' : score >= t.mediumAt ? 'MEDIUM' : 'LOW';
  return { score, level, factors: f };
}
