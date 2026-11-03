import type { Track } from './lib/track'

/*
 * Scroll choreography — five beats:
 *   intro → screen glass (front) → lens glass (back, close-up) → case → final hero
 * Accessory tracks are in the PHONE's local space, so they ride along as it turns.
 */

export const THRESHOLDS = [0.2, 0.42, 0.64, 0.86]

const phone: Track = [
  { p: 0.0, rot: [0, 0, 0] },
  { p: 0.08, rot: [0, 0.3, 0] },
  { p: 0.2, rot: [0, 0, 0] },
  { p: 0.38, rot: [0, 0, 0] },
  { p: 0.47, rot: [0.05, Math.PI, 0] },
  { p: 0.84, rot: [0.05, Math.PI, 0] },
  { p: 1.0, rot: [0.12, Math.PI + 0.6, 0.04] },
]

const glass: Track = [
  { p: 0.19, pos: [-3.0, 0.4, 1.4], rot: [0.15, 0.8, -0.25], scale: 0 },
  { p: 0.21, pos: [-3.0, 0.4, 1.4], rot: [0.15, 0.8, -0.25], scale: 1 },
  { p: 0.32, pos: [0, 0, 0.42], rot: [0, 0, 0], scale: 1 },
  { p: 0.38, pos: [0, 0, 0.068], rot: [0, 0, 0], scale: 1 },
]

const lens: Track = [
  { p: 0.45, pos: [0.3, 0.9, -1.7], rot: [-0.5, 0.4, 0.2], scale: 0 },
  { p: 0.47, pos: [0.3, 0.9, -1.7], rot: [-0.5, 0.4, 0.2], scale: 1 },
  { p: 0.57, pos: [0, 0, -0.2], rot: [0, 0, 0], scale: 1 },
  { p: 0.62, pos: [0, 0, 0], rot: [0, 0, 0], scale: 1 },
]

const phoneCase: Track = [
  { p: 0.65, pos: [3.4, 0.5, -0.9], rot: [0.2, -1.1, 0.35], scale: 0 },
  { p: 0.67, pos: [3.4, 0.5, -0.9], rot: [0.2, -1.1, 0.35], scale: 1 },
  { p: 0.78, pos: [0, 0, -0.25], rot: [0, 0, 0], scale: 1 },
  { p: 0.83, pos: [0, 0, 0], rot: [0, 0, 0], scale: 1 },
]

const camPos: Track = [
  { p: 0.0, pos: [0, 0.15, 6.4] },
  { p: 0.1, pos: [0, 0.1, 5.4] },
  { p: 0.3, pos: [0, 0.05, 4.9] },
  { p: 0.42, pos: [0.3, 0.2, 5.2] },
  { p: 0.52, pos: [0.1, 0.75, 3.4] },
  { p: 0.62, pos: [0, 0.75, 3.2] },
  { p: 0.72, pos: [0.4, 0.3, 5.0] },
  { p: 0.86, pos: [0.2, 0.2, 5.2] },
  { p: 1.0, pos: [1.1, 0.5, 5.0] },
]

const camTarget: Track = [
  { p: 0.0, pos: [0, 0.15, 0] },
  { p: 0.3, pos: [0, 0.05, 0] },
  { p: 0.42, pos: [0, 0.1, 0] },
  { p: 0.52, pos: [0, 0.55, 0] },
  { p: 0.62, pos: [0, 0.6, 0] },
  { p: 0.72, pos: [0, 0.15, 0] },
  { p: 1.0, pos: [0, 0.4, 0] },
]

// Portrait: same story, camera pulled back so the phone fits the narrow frame.
const mobileCam: Track = camPos.map((k) => ({
  p: k.p,
  pos: [k.pos![0] * 0.5, k.pos![1], k.pos![2] * 1.45] as [number, number, number],
}))

export function getTracks(isMobile: boolean) {
  return {
    phone,
    glass,
    lens,
    case: phoneCase,
    camPos: isMobile ? mobileCam : camPos,
    camTarget,
  }
}
