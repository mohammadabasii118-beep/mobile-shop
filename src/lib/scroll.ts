/**
 * Shared scroll state for the cinematic home experience.
 *
 * GSAP ScrollTrigger is the single source of truth for scroll-driven motion.
 * It writes `scrollState.progress` (0..1 across the 5 cinematic scenes) on every
 * update, and the R3F render loop reads it inside `useFrame` — so the 3D scene
 * follows the scroll *position* exactly (scrubbed), with zero React re-renders.
 */
export const scrollState = { progress: 0 };

/** Scene boundaries on the 0..1 timeline. */
export const SCENES = {
  hero: [0.0, 0.2],
  cases: [0.2, 0.4],
  power: [0.4, 0.6],
  audio: [0.6, 0.8],
  showcase: [0.8, 1.0],
} as const;

export const clamp = (v: number, a = 0, b = 1) =>
  Math.min(b, Math.max(a, v));

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Smooth 0..1 ramp between edges a and b. */
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Normalised 0..1 position of `p` inside the [start,end] segment. */
export const seg = (p: number, start: number, end: number) =>
  clamp((p - start) / (end - start));

/** Map x from one range to another, clamped. */
export const mapRange = (
  x: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
) => lerp(outMin, outMax, clamp((x - inMin) / (inMax - inMin)));
