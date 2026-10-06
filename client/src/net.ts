import type { ClientMsg, GameConfig, Profile, ServerMsg } from '@game/shared';
import { initData } from './telegram';

export async function call(path: string, body?: object): Promise<any> {
  const r = await fetch(path, {
    method: body ? 'POST' : 'GET',
    headers: { 'x-init-data': initData, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? 'خطا در ارتباط با سرور');
  return j;
}

export const loadConfig = (): Promise<GameConfig> => fetch('/api/config').then((r) => r.json());
export const loadProfile = (): Promise<Profile> => call('/api/me').then((j) => j.profile);

type Listener = (m: ServerMsg | { t: 'closed' }) => void;

export class Socket {
  private ws!: WebSocket;
  private listeners = new Set<Listener>();
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      this.ws = new WebSocket(`${proto}://${location.host}/ws`);
      this.ws.onopen = () => this.send({ t: 'hello', initData });
      this.ws.onmessage = (e) => {
        const m = JSON.parse(e.data) as ServerMsg;
        if (m.t === 'ready') resolve();
        if (m.t === 'error') reject(new Error(m.message));
        this.listeners.forEach((l) => l(m));
      };
      this.ws.onclose = () => { this.listeners.forEach((l) => l({ t: 'closed' })); reject(new Error('closed')); };
    });
  }
  send(m: ClientMsg) { if (this.ws.readyState === 1) this.ws.send(JSON.stringify(m)); }
  on(l: Listener) { this.listeners.add(l); return () => { this.listeners.delete(l); }; }
}
