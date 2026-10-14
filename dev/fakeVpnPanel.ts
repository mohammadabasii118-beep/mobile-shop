/**
 * In-process fake of the multi-location panel's REST API (vpn-panel/panel/API.md), shapes captured from the real panel.
 * Used by tests and the demo. Real HTTP, so the real client/provider code is exercised.
 */
import http from 'node:http';
import { AddressInfo } from 'node:net';

const GB = 1024 ** 3;
export interface FakeUser { id: number; name: string; enabled: boolean; used_bytes: number; quota_bytes: number; expire_at: Date | null; protos: string[]; node_ids: number[]; sub_token: string }

export class FakeVpnPanel {
  server!: http.Server;
  url = '';
  apiKey = 'testkey-0123456789abcdef-0123456789';
  users = new Map<number, FakeUser>();
  nodes = [{ id: 1, name: 'Germany', cc: 'DE', address: 'de.example.com', online: true, load: 10 }, { id: 2, name: 'Turkey', cc: 'TR', address: 'tr.example.com', online: false, load: 0 }];
  protocols = [
    { id: 'vless', label: 'VLESS + Reality', counted: true, uri: true }, { id: 'trojan', label: 'Trojan', counted: true, uri: true },
    { id: 'l2tp', label: 'L2TP/IPsec', counted: true, uri: false }, { id: 'hy2', label: 'Hysteria2', counted: false, uri: true },
  ];
  rotateSupported = false;
  requests: string[] = [];
  failNext = 0;
  private nextId = 1;

  private out(u: FakeUser) {
    const left = u.expire_at ? Math.max(0, Math.floor((u.expire_at.getTime() - Date.now()) / 86_400_000)) : null;
    const status = !u.enabled ? 'disabled' : u.expire_at && u.expire_at.getTime() <= Date.now() ? 'expired' : u.quota_bytes && u.used_bytes >= u.quota_bytes ? 'quota' : 'active';
    return {
      id: u.id, name: u.name, status, enabled: u.enabled, used_gb: Math.round((u.used_bytes / GB) * 100) / 100, quota_gb: Math.round((u.quota_bytes / GB) * 100) / 100, days_left: left,
      expire_at: u.expire_at ? u.expire_at.toISOString().replace('Z', '000Z') : null, protos: u.protos, node_ids: u.node_ids, sub_url: `${this.url}/sub/${u.sub_token}`,
    };
  }
  byName(name: string) { return [...this.users.values()].find((u) => u.name === name); }
  addUsage(name: string, bytes: number) { const u = this.byName(name); if (u) u.used_bytes += bytes; }

  async start(port = 0) {
    this.server = http.createServer(async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      const raw = Buffer.concat(chunks).toString();
      const body = raw ? JSON.parse(raw) : {};
      const u = new URL(req.url!, 'http://x');
      this.requests.push(`${req.method} ${u.pathname}`);
      const send = (code: number, obj: unknown) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
      if ((req.headers.authorization ?? '') !== `Bearer ${this.apiKey}`) return send(401, { detail: 'نشست نامعتبر است' });
      if (this.failNext > 0) { this.failNext--; return send(503, { detail: 'down' }); }
      const p = u.pathname;
      if (p === '/api/nodes' && req.method === 'GET') return send(200, this.nodes);
      if (p === '/api/protocols' && req.method === 'GET') return send(200, this.protocols);
      if (p === '/api/users' && req.method === 'POST') {
        if (!/^[A-Za-z0-9_.-]{2,32}$/.test(body.name ?? '')) return send(422, { detail: [{ msg: 'String should match pattern' }] });
        if (this.byName(body.name)) return send(409, { detail: 'این نام کاربری وجود دارد' });
        if (!Array.isArray(body.protos) || !body.protos.length) return send(422, { detail: [{ msg: 'List should have at least 1 item' }] });
        const user: FakeUser = { id: this.nextId++, name: body.name, enabled: true, used_bytes: 0, quota_bytes: Math.floor((body.quota_gb ?? 0) * GB), expire_at: body.days ? new Date(Date.now() + body.days * 86_400_000) : null, protos: body.protos, node_ids: body.node_ids ?? [], sub_token: `tok${Math.random().toString(36).slice(2, 12)}` };
        this.users.set(user.id, user);
        return send(200, this.out(user));
      }
      let m = p.match(/^\/api\/users\/by-name\/([^/]+)$/);
      if (m && req.method === 'GET') { const user = this.byName(decodeURIComponent(m[1])); return user ? send(200, this.out(user)) : send(404, { detail: 'پیدا نشد' }); }
      m = p.match(/^\/api\/users\/(\d+)(?:\/(configs|rotate))?$/);
      if (m) {
        const user = this.users.get(Number(m[1]));
        if (m[2] === 'rotate') { if (!this.rotateSupported) return send(404, { detail: 'Not Found' }); if (!user) return send(404, { detail: 'پیدا نشد' }); user.sub_token = `tok${Math.random().toString(36).slice(2, 12)}`; return send(200, this.out(user)); }
        if (!user) return send(404, { detail: 'پیدا نشد' });
        if (m[2] === 'configs' && req.method === 'GET') return send(200, user.protos.includes('vless') ? [{ node: 'Germany', node_id: 1, cc: 'DE', proto: 'vless', label: 'VLESS + Reality', link: `vless://${user.name}@de.example.com:443?security=reality#DE`, details: {}, summary: '', copy: '', file_ext: null }] : [{ node: 'Germany', node_id: 1, cc: 'DE', proto: 'l2tp', label: 'L2TP/IPsec', link: null, details: {}, summary: 'x', copy: 'x', file_ext: null }]);
        if (req.method === 'PATCH') {
          if (body.enabled !== undefined) user.enabled = body.enabled;
          if (body.quota_gb !== undefined) user.quota_bytes = Math.floor(body.quota_gb * GB);
          if (body.days !== undefined) user.expire_at = body.days ? new Date(Date.now() + body.days * 86_400_000) : null;
          if (body.protos) user.protos = body.protos;
          if (body.reset_usage) user.used_bytes = 0;
          return send(200, this.out(user));
        }
        if (req.method === 'DELETE') { this.users.delete(user.id); return send(200, { ok: true }); }
      }
      return send(404, { detail: 'Not Found' });
    });
    await new Promise<void>((r) => this.server.listen(port, '127.0.0.1', r));
    this.url = `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
    return this;
  }
  stop() { return new Promise<void>((r) => { this.server.closeAllConnections?.(); this.server.close(() => r()); }); }
}
