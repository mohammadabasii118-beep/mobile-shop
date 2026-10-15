import { sfxEnabled } from './music';

/** صدای کلیک روی همه‌ی دکمه‌ها (با Web Audio تا روی موبایل بدون تأخیر پخش شود) */
let ctx: AudioContext | null = null;
let buf: AudioBuffer | null = null;
let loading = false;

async function prepare() {
  if (loading) return;
  loading = true;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    const data = await (await fetch('/assets/sfx_click.mp3')).arrayBuffer();
    buf = await new Promise<AudioBuffer>((res, rej) => ctx!.decodeAudioData(data, res, rej));
  } catch { loading = false; }
}

function play() {
  if (!ctx || !buf || !sfxEnabled()) return;
  try {
    void ctx.resume();
    const src = ctx.createBufferSource();
    const g = ctx.createGain();
    g.gain.value = 0.7;
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
    play();
  }, true);
}
