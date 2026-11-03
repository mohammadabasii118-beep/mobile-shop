// Shared product dimensions (world units) so parts align during assembly.
export const PHONE = { w: 0.98, h: 2.0, d: 0.1, r: 0.18 }
export const TITAN = '#c8ccd3'

// iPhone 18 Pro Max rear camera plateau, measured from the product photo.
// Coordinates are phone-local (x as seen in phone space; the back is at -Z).
export const PLATEAU = { w: 0.94, h: 0.52, r: 0.15, cy: 0.725, depth: 0.028 }
export const LENSES: [number, number][] = [
  [0.318, 0.816],
  [0.059, 0.698],
  [0.318, 0.586],
]
export const LENS_R = 0.1
export const FLASH: [number, number] = [-0.322, 0.828]
export const LIDAR: [number, number] = [-0.322, 0.586]
// z of the plateau's outer surface
export const PLATEAU_Z = -(PHONE.d / 2) - PLATEAU.depth
