import { useMemo } from 'react'
import * as THREE from 'three'
import { slabGeometry } from '../lib/geometry'

/** Independent 3D wall adapter + braided cable. */
export default function Charger(props: JSX.IntrinsicElements['group']) {
  const bodyGeo = useMemo(() => slabGeometry(0.58, 0.66, 0.5, 0.15, 0.03), [])

  const cableGeo = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.33, 0),
      new THREE.Vector3(0.15, -0.7, 0.1),
      new THREE.Vector3(-0.1, -1.0, -0.1),
      new THREE.Vector3(0.25, -1.3, 0.05),
      new THREE.Vector3(0.1, -1.6, 0),
    ])
    return new THREE.TubeGeometry(curve, 48, 0.028, 12, false)
  }, [])

  return (
    <group {...props}>
      {/* adapter body */}
      <mesh geometry={bodyGeo} castShadow>
        <meshPhysicalMaterial color="#f2f3f6" metalness={0.1} roughness={0.35} clearcoat={0.6} clearcoatRoughness={0.25} />
      </mesh>
      {/* prongs */}
      <mesh position={[-0.09, 0.42, 0]} castShadow>
        <boxGeometry args={[0.05, 0.22, 0.03]} />
        <meshStandardMaterial color="#d7dae0" metalness={0.9} roughness={0.3} />
      </mesh>
      <mesh position={[0.09, 0.42, 0]} castShadow>
        <boxGeometry args={[0.05, 0.22, 0.03]} />
        <meshStandardMaterial color="#d7dae0" metalness={0.9} roughness={0.3} />
      </mesh>
      {/* USB-C ports on the bottom */}
      <mesh position={[0, -0.34, 0.12]}>
        <boxGeometry args={[0.2, 0.06, 0.08]} />
        <meshStandardMaterial color="#1a1c20" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, -0.34, -0.12]}>
        <boxGeometry args={[0.2, 0.06, 0.08]} />
        <meshStandardMaterial color="#1a1c20" metalness={0.6} roughness={0.4} />
      </mesh>

      {/* cable */}
      <mesh geometry={cableGeo} castShadow>
        <meshStandardMaterial color="#1b1b1f" metalness={0.3} roughness={0.5} />
      </mesh>
      {/* cable connector (USB-C) */}
      <mesh position={[0.1, -1.64, 0]} castShadow>
        <boxGeometry args={[0.08, 0.12, 0.05]} />
        <meshStandardMaterial color="#c9ccd2" metalness={0.95} roughness={0.25} />
      </mesh>
    </group>
  )
}
