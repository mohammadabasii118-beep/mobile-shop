import { ProviderError } from '../types';

export interface RawInbound {
  id: number;
  enable: boolean;
  protocol: string;
  port: number;
  listen?: string;
  remark?: string;
  settings: string | Record<string, any>;
  streamSettings?: string | Record<string, any>;
  clientStats?: Array<{ email: string; up: number; down: number; total: number; expiryTime: number; enable: boolean }> | null;
}

const parse = (v: string | Record<string, any> | undefined) => (typeof v === 'string' ? (v ? JSON.parse(v) : {}) : (v ?? {}));
export const parseSettings = (i: RawInbound) => parse(i.settings);
export const parseStream = (i: RawInbound) => parse(i.streamSettings);

export interface LinkInput {
  inbound: RawInbound;
  client: Record<string, any>; // client entry as stored in the inbound settings
  host: string; // fallback host
  remark: string;
}

const enc = encodeURIComponent;
function setIf(p: URLSearchParams, k: string, v: unknown) {
  if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
}

/** Build the share link from the REAL inbound/stream settings. Nothing is invented. */
export function buildLink({ inbound, client, host, remark }: LinkInput): string {
  const stream = parseStream(inbound);
  const settings = parseSettings(inbound);
  const network: string = stream.network ?? 'tcp';
  const security: string = stream.security ?? 'none';

  let addr = host;
  let port = inbound.port;
  const ext = Array.isArray(stream.externalProxy) ? stream.externalProxy[0] : undefined;
  if (ext?.dest) { addr = ext.dest; if (ext.port) port = ext.port; }
  else if (inbound.listen && inbound.listen !== '0.0.0.0' && inbound.listen !== '::' && /[a-z]/i.test(inbound.listen)) addr = inbound.listen;

  const p = new URLSearchParams();
  p.set('type', network);
  let path: string | undefined, hostHeader: string | undefined, headerType: string | undefined;
  switch (network) {
    case 'ws': path = stream.wsSettings?.path; hostHeader = stream.wsSettings?.headers?.Host ?? stream.wsSettings?.host; break;
    case 'httpupgrade': path = stream.httpupgradeSettings?.path; hostHeader = stream.httpupgradeSettings?.host; break;
    case 'xhttp': case 'splithttp':
      path = stream.xhttpSettings?.path; hostHeader = stream.xhttpSettings?.host; setIf(p, 'mode', stream.xhttpSettings?.mode); break;
    case 'grpc':
      setIf(p, 'serviceName', stream.grpcSettings?.serviceName);
      if (stream.grpcSettings?.multiMode) p.set('mode', 'multi');
      break;
    case 'tcp': {
      const h = stream.tcpSettings?.header;
      if (h?.type === 'http') {
        headerType = 'http';
        path = h.request?.path?.[0];
        const hh = h.request?.headers?.Host;
        hostHeader = Array.isArray(hh) ? hh[0] : hh;
      }
      break;
    }
    case 'kcp': setIf(p, 'headerType', stream.kcpSettings?.header?.type); setIf(p, 'seed', stream.kcpSettings?.seed); break;
  }
  setIf(p, 'path', path);
  setIf(p, 'host', hostHeader);
  setIf(p, 'headerType', headerType);

  const protocol = inbound.protocol;
  if (protocol === 'vless' || protocol === 'trojan') p.set('security', security);
  if (security === 'tls') {
    const t = stream.tlsSettings ?? {};
    setIf(p, 'sni', t.serverName);
    setIf(p, 'fp', t.settings?.fingerprint ?? t.fingerprint);
    if (Array.isArray(t.alpn) && t.alpn.length) p.set('alpn', t.alpn.join(','));
  } else if (security === 'reality') {
    const r = stream.realitySettings ?? {};
    setIf(p, 'sni', Array.isArray(r.serverNames) ? r.serverNames[0] : undefined);
    setIf(p, 'fp', r.settings?.fingerprint ?? r.fingerprint);
    setIf(p, 'pbk', r.settings?.publicKey ?? r.publicKey);
    setIf(p, 'sid', Array.isArray(r.shortIds) ? r.shortIds[0] : undefined);
    setIf(p, 'spx', r.settings?.spiderX ?? r.spiderX);
  }

  const tag = enc(remark);
  if (protocol === 'vless') {
    if (!client.id) throw new ProviderError('client has no id', false);
    setIf(p, 'encryption', settings.encryption ?? 'none');
    if (client.flow) p.set('flow', client.flow);
    return `vless://${client.id}@${addr}:${port}?${p.toString()}#${tag}`;
  }
  if (protocol === 'vmess') {
    if (!client.id) throw new ProviderError('client has no id', false);
    const t = stream.tlsSettings ?? {};
    const obj = {
      v: '2', ps: remark, add: addr, port: String(port), id: client.id, aid: '0', scy: client.security ?? 'auto',
      net: network, type: headerType ?? stream.kcpSettings?.header?.type ?? 'none', host: hostHeader ?? '',
      path: path ?? stream.grpcSettings?.serviceName ?? '', tls: security === 'tls' ? 'tls' : 'none',
      sni: security === 'tls' ? (t.serverName ?? '') : '', alpn: security === 'tls' && Array.isArray(t.alpn) ? t.alpn.join(',') : '',
      fp: security === 'tls' ? (t.settings?.fingerprint ?? t.fingerprint ?? '') : '',
    };
    return `vmess://${Buffer.from(JSON.stringify(obj)).toString('base64')}`;
  }
  if (protocol === 'trojan') {
    if (!client.password) throw new ProviderError('client has no password', false);
    return `trojan://${enc(client.password)}@${addr}:${port}?${p.toString()}#${tag}`;
  }
  if (protocol === 'shadowsocks') {
    const method: string = settings.method;
    if (!method || !client.password) throw new ProviderError('shadowsocks method/password missing', false);
    const pw = method.startsWith('2022') && settings.password ? `${settings.password}:${client.password}` : client.password;
    const userinfo = Buffer.from(`${method}:${pw}`).toString('base64');
    return `ss://${userinfo}@${addr}:${port}?type=${network}#${tag}`;
  }
  throw new ProviderError(`unsupported protocol ${protocol}`, false);
}
