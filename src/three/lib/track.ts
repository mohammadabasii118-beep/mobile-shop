export type Vec3 = [number, number, number]

export interface Key {
  p: number
  pos?: Vec3
  rot?: Vec3
  scale?: number
  opacity?: number
}

export type Track = Key[]

export interface Sample {
  pos: Vec3
  rot: Vec3
  scale: number
  opacity: number
}

const smooth = (t: number) => t * t * (3 - 2 * t)
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}
function lerp3(a: Vec3, b: Vec3, t: number): Vec3 {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]
}

/**
 * Samples a keyframe track at global progress `p` (0..1).
 * Values hold before the first / after the last key, and ease between keys.
 */
export function sampleTrack(track: Track, p: number): Sample {
  const def: Sample = { pos: [0, 0, 0], rot: [0, 0, 0], scale: 1, opacity: 1 }
  if (track.length === 0) return def

  // before first
  if (p <= track[0].p) return fill(track[0], def)
  // after last
  const last = track[track.length - 1]
  if (p >= last.p) return fill(last, def)

  let i = 0
  while (i < track.length - 1 && p > track[i + 1].p) i++
  const a = track[i]
  const b = track[i + 1]
  const span = b.p - a.p || 1
  const t = smooth(clamp01((p - a.p) / span))

  const sa = fill(a, def)
  const sb = fill(b, def)
  return {
    pos: lerp3(sa.pos, sb.pos, t),
    rot: lerp3(sa.rot, sb.rot, t),
    scale: lerp(sa.scale, sb.scale, t),
    opacity: lerp(sa.opacity, sb.opacity, t),
  }
}

function fill(k: Key, def: Sample): Sample {
  return {
    pos: k.pos ?? def.pos,
    rot: k.rot ?? def.rot,
    scale: k.scale ?? def.scale,
    opacity: k.opacity ?? def.opacity,
  }
}

/** Frame-rate independent damping toward a target. */
export function damp(current: number, target: number, lambda: number, dt: number) {
  return lerp(current, target, 1 - Math.exp(-lambda * dt))
}

/** Maps global progress to a local 0..1 inside [start,end]. */
export function segment(p: number, start: number, end: number) {
  return clamp01((p - start) / (end - start || 1))
}
