import { useSyncExternalStore } from 'react';

/** موسیقی پس‌زمینه: از همان لحظه‌ی باز شدن بازی پخش می‌شود، لوپ است، و صدایش (خطی) قابل تنظیم/قطع است. */
const KEY = 'miras.music';
interface State { volume: number; muted: boolean }

const load = (): State => {
  try { const j = JSON.parse(localStorage.getItem(KEY) ?? ''); if (typeof j.volume === 'number') return { volume: Math.min(1, Math.max(0, j.volume)), muted: !!j.muted }; } catch { /* اولین بار */ }
  return { volume: 0.5, muted: false };
};

let state = load();
const subs = new Set<() => void>();
let audio: HTMLAudioElement | null = null;
let ctx: AudioContext | null = null;
let gain: GainNode | null = null;
let playing = false;

const effective = () => (state.muted ? 0 : state.volume);

function apply() {
  if (!audio) return;
  // روی آیفون audio.volume کار نمی‌کند؛ برای همین صدا از طریق GainNode تنظیم می‌شود (روی بقیه هم درست کار می‌کند)
  if (gain) gain.gain.value = effective(); else audio.volume = effective();
}

function ensure() {
  if (audio) return audio;
  audio = new Audio('/assets/music.mp3');
  audio.loop = true;
  audio.preload = 'auto';
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AC) { ctx = new AC(); gain = ctx.createGain(); ctx.createMediaElementSource(audio).connect(gain); gain.connect(ctx.destination); }
  } catch { gain = null; }
  apply();
  return audio;
}

/** پخش را امتحان می‌کند؛ اگر مرورگر بدون لمس کاربر اجازه نداد false برمی‌گرداند */
async function tryPlay(): Promise<boolean> {
  const a = ensure();
  try { await ctx?.resume(); await a.play(); playing = true; return true; } catch { return false; }
}

let started = false;
/** یک‌بار در شروع برنامه صدا زده می‌شود */
export function startMusic() {
  if (started) return;
  started = true;
  void tryPlay().then((ok) => {
    if (ok) return;
    // مرورگرها بدون لمس کاربر صدا را مسدود می‌کنند؛ با اولین لمس شروع می‌شود
    const kick = () => { void tryPlay().then((done) => { if (done) off(); }); };
    const evs = ['pointerdown', 'touchend', 'click', 'keydown'] as const;
    const off = () => evs.forEach((e) => window.removeEventListener(e, kick, true));
    evs.forEach((e) => window.addEventListener(e, kick, true));
  });
  // وقتی بازی به پس‌زمینه می‌رود صدا قطع و موقع برگشت ادامه پیدا می‌کند
  document.addEventListener('visibilitychange', () => {
    if (!audio || !playing) return;
    if (document.hidden) audio.pause(); else void tryPlay();
  });
}

function set(next: Partial<State>) {
  state = { ...state, ...next };
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ذخیره نشد؛ مهم نیست */ }
  apply();
  subs.forEach((f) => f());
  if (!playing && !document.hidden) void tryPlay(); // اگر کاربر همین الان اسلایدر را کشید، همین لمس اجازه‌ی پخش است
}

export const setVolume = (v: number) => set({ volume: Math.min(1, Math.max(0, v)), muted: v <= 0 ? state.muted : false });
export const setMuted = (m: boolean) => set({ muted: m });

export function useMusic(): State {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => state);
}
