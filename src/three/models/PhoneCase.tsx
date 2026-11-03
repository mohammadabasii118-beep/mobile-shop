import { useMemo } from 'react'
import * as THREE from 'three'
import { roundedRectShape, normalizeUVs } from '../lib/geometry'
import { PHONE, PLATEAU } from '../lib/dims'

type Props = JSX.IntrinsicElements['group'] & {
  color?: string
}

/** Independent 3D case: translucent side rim + back panel with the real case photo. */
export default function PhoneCase({ color = '#6b2f4a', ...props }: Props) {
  const { w, h, d, r } = PHONE

  const rimGeo = useMemo(() => {
    const outer = roundedRectShape(w + 0.07, h + 0.07, r + 0.035)
    const inner = roundedRectShape(w + 0.012, h + 0.012, r + 0.004)
    outer.holes.push(new THREE.Path(inner.getPoints(48)))
    const geo = new THREE.ExtrudeGeometry(outer, {
      depth: d + 0.05,
      bevelEnabled: true,
      bevelThickness: 0.012,
      bevelSize: 0.012,
      bevelSegments: 4,
      curveSegments: 32,
    })
    geo.center()
    geo.computeVertexNormals()
    return geo
  }, [w, h, d, r])

  // Camera opening matching the raised plateau.
  const holePts = useMemo(
    () =>
      roundedRectShape(PLATEAU.w + 0.03, PLATEAU.h + 0.03, PLATEAU.r + 0.015)
        .getPoints(48)
        .map((p) => new THREE.Vector2(p.x, p.y + PLATEAU.cy)),
    [],
  )
  const backGeo = useMemo(() => {
    const s = roundedRectShape(w + 0.07, h + 0.07, r + 0.035)
    s.holes.push(new THREE.Path(holePts))
    return normalizeUVs(new THREE.ShapeGeometry(s, 32))
  }, [w, h, r, holePts])
  // Raised translucent bumper around the camera opening.
  const lipGeo = useMemo(() => {
    const outer = new THREE.Shape(
      roundedRectShape(PLATEAU.w + 0.08, PLATEAU.h + 0.08, PLATEAU.r + 0.04)
        .getPoints(48)
        .map((p) => new THREE.Vector2(p.x, p.y + PLATEAU.cy)),
    )
    outer.holes.push(new THREE.Path(holePts))
    return new THREE.ExtrudeGeometry(outer, { depth: 0.05, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 3, curveSegments: 32 })
  }, [holePts])
  const tex = useMemo(() => {
    const t = new THREE.TextureLoader().load('/textures/case-back.jpg')
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    return t
  }, [])

  return (
    <group {...props}>
      <mesh geometry={rimGeo} castShadow>
        <meshPhysicalMaterial color={color} metalness={0.05} roughness={0.3} clearcoat={1} clearcoatRoughness={0.15} transparent opacity={0.92} />
      </mesh>
      <mesh geometry={backGeo} position={[0, 0, -(d / 2) - 0.032]} rotation={[0, Math.PI, 0]} castShadow>
        <meshStandardMaterial map={tex} roughness={0.35} metalness={0.05} envMapIntensity={0.7} />
      </mesh>
      <mesh geometry={lipGeo} position={[0, 0, -(d / 2) - 0.03]} rotation={[0, Math.PI, 0]} castShadow>
        <meshPhysicalMaterial color={color} metalness={0.05} roughness={0.3} clearcoat={1} transparent opacity={0.88} />
      </mesh>
    </group>
  )
}
