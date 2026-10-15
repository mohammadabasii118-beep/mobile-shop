import { useSyncExternalStore } from 'react';

/**
 * موسیقی بازی: دو آهنگ (منو و نبرد). هر دو لوپ‌اند، فقط یکی در هر لحظه پخش می‌شود
 * (منو در همه‌جا به‌جز نبرد؛ نبرد در سولو و آنلاین)، و صدای هر کدام جدا (خطی) قابل تنظیم/قطع است.
 */
export type Channel = 'menu' | 'battle';
interface State { volume: number; muted: boolean }

const SRC: Record<Channel, string> = { menu: '/assets/music.mp3', battle: '/assets/battle-music.mp3' };
const KEY: Record<Channel, string> = { menu: 'miras.music', battle: 'miras.music.battle' };

const load = (ch: Channel): State => {
  try { const j = JSON.parse(localStorage.getItem(KEY[ch]) ?? ''); if (typeof j.volume === 'number') return { volume: Math.min(1, Math.max(0, j.volume)), muted: !!j.muted }; } catch { /* اولین بار */ }
  return { volume: 0.5, muted: false };
};

const state: Record<Channel, State> = { menu: load('menu'), battle: load('battle') };
const audio: Partial<Record<Channel, HTMLAudioElement>> = {};
const gain: Partial<Record<Channel, GainNode>> = {};
const subs = new Set<() => void>();
let ctx: AudioContext | null = null;
let scene: Channel = 'menu';
let unlocked = false; // یعنی مرورگر اجازه‌ی پخش داده (بعد از اولین لمس یا خودکار)

const effective = (ch: Channel) => (state[ch].muted ? 0 : state[ch].volume);

function apply(ch: Channel) {
  const a = audio[ch];
  if (!a) return;
  // روی آیفون audio.volume کار نمی‌کند؛ صدا از طریق GainNode تنظیم می‌شود (روی بقیه هم درست کار می‌کند)
  const g = gain[ch];
  if (g) g.gain.value = effective(ch); else a.volume = effective(ch);
}

function ensure(ch: Channel): HTMLAudioElement {
  const ex = audio[ch];
  if (ex) return ex;
  const a = new Audio(SRC[ch]);
  a.loop = true;
  a.preload = 'auto';
  audio[ch] = a;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AC) {
      ctx ??= new AC();
      const g = ctx.createGain();
      ctx.createMediaElementSource(a).connect(g);
      g.connect(ctx.destination);
      gain[ch] = g;
    }
  } catch { /* بدون GainNode ادامه می‌دهد */ }
  apply(ch);
  return a;
}

/** فقط آهنگِ صحنه‌ی فعلی پخش می‌شود؛ آهنگ دیگر متوقف می‌شود (لوپِ بعدی از همان‌جا ادامه دارد) */
async function sync(): Promise<boolean> {
  const want = scene;
  const other: Channel = want === 'menu' ? 'battle' : 'menu';
  audio[other]?.pause();
  if (document.hidden) { audio[want]?.pause(); return true; }
  const a = ensure(want);
  try {
    await ctx?.resume();
    await a.play();
    unlocked = true;
    return true;
  } catch { return false; }
}

let started = false;
/** یک‌بار در شروع برنامه صدا زده می‌شود */
export function startMusic() {
  if (started) return;
  started = true;
  void sync().then((ok) => {
    if (ok) return;
    // مرورگرها بدون لمس کاربر صدا را مسدود می‌کنند؛ با اولین لمس شروع می‌شود
    const kick = () => { void sync().then((done) => { if (done) off(); }); };
    const evs = ['pointerdown', 'touchend', 'click', 'keydown'] as const;
    const off = () => evs.forEach((e) => window.removeEventListener(e, kick, true));
    evs.forEach((e) => window.addEventListener(e, kick, true));
  });
  // وقتی بازی به پس‌زمینه می‌رود صدا قطع و موقع برگشت ادامه پیدا می‌کند
  document.addEventListener('visibilitychange', () => { if (unlocked) void sync(); });
}

/** صحنه عوض شد (منو ↔ نبرد) */
export function setScene(next: Channel) {
  if (scene === next) return;
  scene = next;
  if (started && unlocked) void sync();
}

function set(ch: Channel, next: Partial<State>) {
  state[ch] = { ...state[ch], ...next }; // آبجکت جدید تا useSyncExternalStore دوباره رندر کند
  try { localStorage.setItem(KEY[ch], JSON.stringify(state[ch])); } catch { /* ذخیره نشد؛ مهم نیست */ }
  apply(ch);
  subs.forEach((f) => f());
  if (!unlocked && started) void sync(); // اگر کاربر همین الان اسلایدر را کشید، همین لمس اجازه‌ی پخش است
}

export const setVolume = (ch: Channel, v: number) => set(ch, { volume: Math.min(1, Math.max(0, v)), muted: v <= 0 ? state[ch].muted : false });
export const setMuted = (ch: Channel, m: boolean) => set(ch, { muted: m });

export function useMusic(ch: Channel = 'menu'): State {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => state[ch]);
}

/** صدای کلیک دکمه‌ها وقتی موسیقی منو قطع (یا صفر) است، قطع می‌ماند */
export const sfxEnabled = () => !(state.menu.muted || state.menu.volume === 0);
