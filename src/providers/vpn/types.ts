import { Protocol } from '@prisma/client';

export interface ServiceRef {
  inboundId: number;
  email: string; // externalId — unique, searchable (tg_<telegramId>_<order>)
  credential: string; // uuid (vless/vmess) | password (trojan/shadowsocks)
  protocol: Protocol;
}

export interface CreateServiceRequest extends ServiceRef {
  subId: string;
  telegramId: string;
  trafficLimitBytes: bigint;
  expiresAt: Date;
}

export interface RenewServiceRequest extends ServiceRef {
  trafficLimitBytes: bigint; // absolute target
  expiresAt: Date; // absolute target
}

export interface ServiceStatus {
  exists: boolean;
  enabled: boolean;
  expiresAt: Date | null; // null => unlimited
  trafficLimit: bigint; // 0 => unlimited
  up: bigint;
  down: bigint;
  used: bigint;
}

export interface ServiceConfig {
  config: string;
  subscriptionUrl?: string;
}

export interface InboundInfo {
  id: number;
  enable: boolean;
  protocol: string;
  port: number;
  remark?: string;
}

export interface VpnProvider {
  readonly name: string;
  /** Idempotent by `email`: if the client already exists it is adopted, never duplicated. */
  createService(req: CreateServiceRequest): Promise<{ status: ServiceStatus; adopted: boolean }>;
  renewService(req: RenewServiceRequest): Promise<ServiceStatus>;
  suspendService(ref: ServiceRef): Promise<void>;
  resumeService(ref: ServiceRef): Promise<void>;
  deleteService(ref: ServiceRef): Promise<void>;
  getServiceStatus(ref: ServiceRef): Promise<ServiceStatus | null>;
  getTraffic(ref: ServiceRef): Promise<{ up: bigint; down: bigint; used: bigint; total: bigint } | null>;
  getConfig(ref: ServiceRef & { subId: string }): Promise<ServiceConfig>;
  getInbound(inboundId: number): Promise<InboundInfo | null>;
  healthCheck(): Promise<{ ok: boolean; detail: string }>;
}

export class ProviderError extends Error {
  constructor(message: string, public retryable = true) {
    super(message);
    this.name = 'ProviderError';
  }
}
