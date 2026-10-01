import http from 'node:http';
import { AddressInfo } from 'node:net';

/**
 * In-process fake of the 3x-ui panel HTTP API (login, inbounds list/get, addClient, updateClient,
 * delClient, getClientTraffics, resetClientTraffic). Used by tests and the demo ONLY.
 * Mimics the real panel's behaviour of answering 404 to unauthenticated API calls.
 */
export interface FakeInbound {
  id: number; enable: boolean; protocol: string; port: number; remark: string; listen: string;
  settings: any; streamSettings: any; traffic: Record<string, { up: number; down: number }>;
}

export class FakeXui {
  server!: http.Server;
  url = '';
  username = 'admin';
  password = 'secret';
  apiToken?: string;
  inbounds = new Map<number, FakeInbound>();
  requests: string[] = [];
  /** drop the response of the next addClient AFTER applying it (simulates network timeout) */
  dropNextAddClientResponse = false;
  failNext = 0;
  /** after a successful addClient, answer the next N requests with 503 (panel dies mid-provisioning) */
  failAfterAddClient = 0;
  private failCountdown = 0;
  logins = 0;
  addClientCalls = 0;

  constructor() {
    this.inbounds.set(1, {
      id: 1, enable: true, protocol: 'vless', port: 443, remark: 'main', listen: '',
      settings: { clients: [], decryption: 'none', encryption: 'none' },
      streamSettings: {
        network: 'tcp', security: 'reality',
        realitySettings: { serverNames: ['www.example.com'], shortIds: ['ab12cd34'], settings: { publicKey: 'PUBKEY123', fingerprint: 'chrome', spiderX: '/' } },
        tcpSettings: { header: { type: 'none' } },
      },
      traffic: {},
    });
  }

  private authed(req: http.IncomingMessage) {
    if (this.apiToken && req.headers.authorization === `Bearer ${this.apiToken}`) return true;
    return (req.headers.cookie ?? '').includes('3x-ui=sess-ok');
  }

  private obj(i: FakeInbound) {
    return {
      id: i.id, enable: i.enable, protocol: i.protocol, port: i.port, remark: i.remark, listen: i.listen,
      settings: JSON.stringify(i.settings), streamSettings: JSON.stringify(i.streamSettings),
      clientStats: (i.settings.clients as any[]).map((c) => this.stat(i, c)),
    };
  }
  private stat(i: FakeInbound, c: any) {
    const t = i.traffic[c.email] ?? { up: 0, down: 0 };
    return { id: 1, inboundId: i.id, enable: c.enable, email: c.email, up: t.up, down: t.down, expiryTime: c.expiryTime, total: c.totalGB, reset: 0 };
  }
  addUsage(email: string, up: number, down: number) {
    for (const i of this.inbounds.values()) if ((i.settings.clients as any[]).some((c) => c.email === email)) i.traffic[email] = { up, down };
  }
  clientCount() { return [...this.inbounds.values()].reduce((n, i) => n + i.settings.clients.length, 0); }

  async start(port = 0) {
    this.server = http.createServer(async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      const body = new URLSearchParams(Buffer.concat(chunks).toString());
      const u = new URL(req.url!, 'http://x');
      this.requests.push(`${req.method} ${u.pathname}`);
      const send = (obj: unknown, extra: http.OutgoingHttpHeaders = {}) => {
        res.writeHead(200, { 'content-type': 'application/json', ...extra });
        res.end(JSON.stringify({ success: true, msg: '', obj }));
      };
      const fail = (msg: string) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ success: false, msg })); };

      const subm = u.pathname.match(/^\/sub\/([\w-]+)$/);
      if (subm) {
        for (const ib of this.inbounds.values()) {
          const c = (ib.settings.clients as any[]).find((x) => x.subId === subm[1] && x.enable);
          if (c) { res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'profile-title': c.email }); return void res.end(Buffer.from(`vless://${c.id}@fake:443#${c.email}`).toString('base64')); }
        }
        res.writeHead(404); return void res.end('not found');
      }
      if (u.pathname === '/login') {
        this.logins++;
        if (body.get('username') === this.username && body.get('password') === this.password) return send(null, { 'set-cookie': '3x-ui=sess-ok; Path=/; HttpOnly' });
        return fail('wrong username or password');
      }
      if (!this.authed(req)) { res.writeHead(404); return res.end('404 page not found'); }
      if (this.failCountdown > 0) { this.failCountdown--; res.writeHead(503); return res.end('down'); }
      if (this.failNext > 0) { this.failNext--; res.writeHead(503); return res.end('down'); }

      const p = u.pathname;
      if (p === '/panel/api/inbounds/list') return send([...this.inbounds.values()].map((i) => this.obj(i)));
      let m = p.match(/^\/panel\/api\/inbounds\/get\/(\d+)$/);
      if (m) { const i = this.inbounds.get(Number(m[1])); return i ? send(this.obj(i)) : fail('record not found'); }
      if (p === '/panel/api/inbounds/addClient') {
        const i = this.inbounds.get(Number(body.get('id')));
        if (!i) return fail('inbound not found');
        const clients = JSON.parse(body.get('settings')!).clients as any[];
        for (const c of clients) {
          if (!c.email) return fail('empty client email');
          if (Object.values(this.inbounds).some(() => false)) return fail('x');
          for (const ib of this.inbounds.values()) if ((ib.settings.clients as any[]).some((x) => x.email === c.email)) return fail('Duplicate email: ' + c.email);
          i.settings.clients.push({ ...c });
        }
        this.addClientCalls++;
        this.failCountdown = this.failAfterAddClient; this.failAfterAddClient = 0;
        if (this.dropNextAddClientResponse) { this.dropNextAddClientResponse = false; return req.socket.destroy(); }
        return send(null);
      }
      m = p.match(/^\/panel\/api\/inbounds\/updateClient\/(.+)$/);
      if (m) {
        const key = decodeURIComponent(m[1]);
        const i = this.inbounds.get(Number(body.get('id')));
        const upd = JSON.parse(body.get('settings')!).clients[0];
        const idx = i ? (i.settings.clients as any[]).findIndex((c) => c.id === key || c.password === key || c.email === key) : -1;
        if (!i || idx < 0) return fail('client not found');
        i.settings.clients[idx] = upd;
        return send(null);
      }
      m = p.match(/^\/panel\/api\/inbounds\/(\d+)\/delClient\/(.+)$/);
      if (m) {
        const i = this.inbounds.get(Number(m[1])); const key = decodeURIComponent(m[2]);
        if (!i) return fail('inbound not found');
        i.settings.clients = (i.settings.clients as any[]).filter((c) => !(c.id === key || c.password === key || c.email === key));
        return send(null);
      }
      m = p.match(/^\/panel\/api\/inbounds\/getClientTraffics\/(.+)$/);
      if (m) {
        const email = decodeURIComponent(m[1]);
        for (const i of this.inbounds.values()) { const c = (i.settings.clients as any[]).find((x) => x.email === email); if (c) return send(this.stat(i, c)); }
        return send(null);
      }
      m = p.match(/^\/panel\/api\/inbounds\/(\d+)\/resetClientTraffic\/(.+)$/);
      if (m) { const i = this.inbounds.get(Number(m[1])); if (i) delete i.traffic[decodeURIComponent(m[2])]; return send(null); }
      res.writeHead(404); res.end('404 page not found');
    });
    await new Promise<void>((r) => this.server.listen(port, '127.0.0.1', r));
    this.url = `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
    return this;
  }
  stop() { return new Promise<void>((r) => { this.server.closeAllConnections?.(); this.server.close(() => r()); }); }
}
