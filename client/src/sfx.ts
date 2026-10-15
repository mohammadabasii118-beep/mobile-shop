import { sfxEnabled } from './music';

/** افکت‌های صوتی کوتاه (با Web Audio تا روی موبایل بدون تأخیر پخش شوند): کلیک دکمه‌ها و ضربه‌ی کارت‌ها */
const FILES = { click: '/assets/sfx_click.mp3', hit: '/assets/sfx_hit.mp3' } as const;
const GAIN = { click: 0.7, hit: 0.9 } as const;
export type Sfx = keyof typeof FILES;

let ctx: AudioContext | null = null;
const bufs: Partial<Record<Sfx, AudioBuffer>> = {};
let loading = false;

async function prepare() {
  if (loading) return;
  loading = true;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    await Promise.all((Object.keys(FILES) as Sfx[]).map(async (k) => {
      const data = await (await fetch(FILES[k])).arrayBuffer();
      bufs[k] = await new Promise<AudioBuffer>((res, rej) => ctx!.decodeAudioData(data, res, rej));
    }));
  } catch { loading = false; }
}

export function playSfx(name: Sfx) {
  const buf = bufs[name];
  if (!ctx || !buf || !sfxEnabled()) return;
  try {
    void ctx.resume();
    const src = ctx.createBufferSource();
    const g = ctx.createGain();
    g.gain.value = GAIN[name];
    src.buffer = buf;
    src.connect(g); g.connect(ctx.destination);
    src.start();
  } catch { /* مهم نیست */ }
}

export function startClickSfx() {
  window.addEventListener('pointerdown', (e) => {
    void prepare();
    const el = (e.target as HTMLElement | null)?.closest?.('button, [role="button"], [role="tab"], a[href], select, summary') as HTMLButtonElement | null;
    if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
    playSfx('click');
  }, true);
}
