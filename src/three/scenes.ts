import type { Track } from './lib/track'

/*
 * Scroll choreography. Progress 0..1 is split into seven beats:
 *   intro → case → glass → charger → power bank → AirPods → final
 * Case & glass tracks are in the PHONE's local space (they ride along as it turns);
 * the other accessories are in world space.
 */

export const THRESHOLDS = [0.14, 0.3, 0.46, 0.62, 0.76, 0.9]
export const PODS_OPEN: [number, number] = [0.79, 0.9]

const TAU = Math.PI * 2

// Phone turns to show its back (case beat), then returns to the front (glass beat).
const phoneTrack: Track = [
  { p: 0.0, rot: [0, 0, 0] },
  { p: 0.08, rot: [0, 0.35, 0] },
  { p: 0.18, rot: [0.04, Math.PI, 0] },
  { p: 0.27, rot: [0.04, Math.PI, 0] },
  { p: 0.36, rot: [0, TAU, 0] },
  { p: 0.74, rot: [0.04, TAU, 0] },
  { p: 1.0, pos: [-0.15, 0.05, 0], rot: [0.08, TAU + 0.28, 0] },
]

// Case: swoops in from the side with a twist, hovers just off the body, then snaps on.
const caseTrack: Track = [
  { p: 0.13, pos: [3.4, 0.5, -0.9], rot: [0.2, -1.1, 0.35], scale: 0 },
  { p: 0.15, pos: [3.4, 0.5, -0.9], rot: [0.2, -1.1, 0.35], scale: 1 },
  { p: 0.235, pos: [0, 0, -0.22], rot: [0, 0, 0], scale: 1 },
  { p: 0.27, pos: [0, 0, 0], rot: [0, 0, 0], scale: 1 },
]

// Glass: arrives from the front, aligns square over the display, then lowers on.
const glassTrack: Track = [
  { p: 0.29, pos: [-3.0, 0.4, 1.4], rot: [0.15, 0.8, -0.25], scale: 0 },
  { p: 0.31, pos: [-3.0, 0.4, 1.4], rot: [0.15, 0.8, -0.25], scale: 1 },
  { p: 0.385, pos: [0, 0, 0.42], rot: [0, 0, 0], scale: 1 },
  { p: 0.425, pos: [0, 0, 0.068], rot: [0, 0, 0], scale: 1 },
]

interface Layout {
  charger: Track
  power: Track
  pods: Track
  camPos: Track
  camTarget: Track
}

const desktop: Layout = {
  charger: [
    { p: 0.45, pos: [-5.5, -1.4, 0.5], rot: [0.3, 1.2, 0.3], scale: 0 },
    { p: 0.46, pos: [-5.5, -1.4, 0.5], rot: [0.3, 1.2, 0.3], scale: 1 },
    { p: 0.58, pos: [-2.35, -0.45, 0.25], rot: [0.1, 0.35, 0.05], scale: 1 },
    { p: 1.0, pos: [-2.45, -0.5, 0], rot: [0.1, 0.42, 0.05], scale: 1 },
  ],
  power: [
    { p: 0.61, pos: [5.5, -2.2, 1.4], rot: [0.6, -1.6, 0.8], scale: 0 },
    { p: 0.62, pos: [5.5, -2.2, 1.4], rot: [0.6, -1.6, 0.8], scale: 1 },
    { p: 0.72, pos: [2.2, -0.8, 0.3], rot: [0.12, -0.4, 0.08], scale: 1 },
    { p: 1.0, pos: [2.3, -0.65, 0], rot: [0.12, -0.45, 0.06], scale: 1 },
  ],
  pods: [
    { p: 0.75, pos: [1.6, 4.2, 0], rot: [0.8, 0.6, 0], scale: 0 },
    { p: 0.76, pos: [1.6, 4.2, 0], rot: [0.8, 0.6, 0], scale: 1 },
    { p: 0.84, pos: [2.2, 1.0, 0], rot: [0.15, -0.3, 0], scale: 1 },
    { p: 1.0, pos: [2.25, 0.95, 0], rot: [0.15, -0.35, 0], scale: 1 },
  ],
  camPos: [
    { p: 0.0, pos: [0, 0.15, 6.4] },
    { p: 0.1, pos: [0, 0.1, 5.4] },
    { p: 0.27, pos: [0.35, 0.15, 5.3] },
    { p: 0.42, pos: [0, 0.1, 5.1] },
    { p: 0.58, pos: [-0.3, 0.35, 6.4] },
    { p: 0.74, pos: [0.3, 0.5, 7.2] },
    { p: 1.0, pos: [1.4, 1.0, 8.2] },
  ],
  camTarget: [
    { p: 0.0, pos: [0, 0.2, 0] },
    { p: 0.42, pos: [0, 0.2, 0] },
    { p: 1.0, pos: [0.2, 0.3, 0] },
  ],
}

// Portrait screens: accessories gather in a row beneath the phone instead of at the sides.
const mobile: Layout = {
  charger: [
    { p: 0.45, pos: [-3.2, -3.5, 0.5], rot: [0.3, 1.2, 0.3], scale: 0 },
    { p: 0.46, pos: [-3.2, -3.5, 0.5], rot: [0.3, 1.2, 0.3], scale: 0.5 },
    { p: 0.58, pos: [-0.95, -1.55, 0.3], rot: [0.1, 0.35, 0.05], scale: 0.5 },
    { p: 1.0, pos: [-0.95, -1.55, 0.3], rot: [0.1, 0.42, 0.05], scale: 0.5 },
  ],
  power: [
    { p: 0.61, pos: [3.2, -3.5, 1], rot: [0.6, -1.6, 0.8], scale: 0 },
    { p: 0.62, pos: [3.2, -3.5, 1], rot: [0.6, -1.6, 0.8], scale: 0.55 },
    { p: 0.72, pos: [0.95, -1.7, 0.3], rot: [0.12, -0.4, 0.08], scale: 0.55 },
    { p: 1.0, pos: [0.95, -1.7, 0.3], rot: [0.12, -0.45, 0.06], scale: 0.55 },
  ],
  pods: [
    { p: 0.75, pos: [0, -5, 0], rot: [0.8, 0.6, 0], scale: 0 },
    { p: 0.76, pos: [0, -5, 0], rot: [0.8, 0.6, 0], scale: 0.5 },
    { p: 0.84, pos: [0, -1.85, 0.6], rot: [0.15, 0, 0], scale: 0.5 },
    { p: 1.0, pos: [0, -1.85, 0.6], rot: [0.15, 0, 0], scale: 0.5 },
  ],
  camPos: [
    { p: 0.0, pos: [0, 0.0, 7.6] },
    { p: 0.1, pos: [0, 0.0, 6.8] },
    { p: 0.27, pos: [0.25, 0.05, 6.7] },
    { p: 0.42, pos: [0, 0.0, 6.6] },
    { p: 0.58, pos: [0, -0.3, 8.2] },
    { p: 1.0, pos: [0.5, -0.2, 9.0] },
  ],
  camTarget: [
    { p: 0.0, pos: [0, 0.35, 0] },
    { p: 0.42, pos: [0, 0.35, 0] },
    { p: 0.58, pos: [0, -0.25, 0] },
    { p: 1.0, pos: [0, -0.25, 0] },
  ],
}

export function getTracks(isMobile: boolean) {
  const l = isMobile ? mobile : desktop
  return { phone: phoneTrack, case: caseTrack, glass: glassTrack, ...l }
}
