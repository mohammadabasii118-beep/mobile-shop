import { useMemo, useRef, type MutableRefObject } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { slabGeometry } from '../lib/geometry'

type Props = JSX.IntrinsicElements['group'] & {
  /** 0 = closed & stowed, 1 = lid open & buds lifted out. */
  revealRef: MutableRefObject<number>
}

// Proportions follow a real AirPods Pro case (~60 × 45 × 22 mm).
const W = 0.9
const BODY_H = 0.46
const LID_H = 0.22
const D = 0.34

function Bud({ side }: { side: -1 | 1 }) {
  return (
    <group rotation={[0, side * 0.35, 0]}>
      <mesh castShadow>
        <sphereGeometry args={[0.085, 32, 32]} />
        <meshPhysicalMaterial color="#f7f8fa" roughness={0.22} clearcoat={0.9} clearcoatRoughness={0.15} />
      </mesh>
      {/* silicone tip */}
      <mesh position={[side * -0.06, 0.01, 0.03]} rotation={[0, 0, side * 1.2]}>
        <cylinderGeometry args={[0.04, 0.05, 0.05, 24]} />
        <meshStandardMaterial color="#e6e8ec" roughness={0.6} />
      </mesh>
      {/* stem */}
      <mesh castShadow position={[side * 0.015, -0.17, 0]} rotation={[0, 0, side * 0.08]}>
        <capsuleGeometry args={[0.03, 0.22, 8, 20]} />
        <meshPhysicalMaterial color="#eef0f3" roughness={0.22} clearcoat={0.9} />
      </mesh>
      {/* stem microphone grille */}
      <mesh position={[side * 0.02, -0.3, 0]}>
        <cylinderGeometry args={[0.031, 0.031, 0.025, 20]} />
        <meshStandardMaterial color="#9aa0aa" metalness={0.8} roughness={0.35} />
      </mesh>
    </group>
  )
}

/** Independent 3D AirPods case — lid opens and the buds lift out, driven by scroll. */
export default function AirPods({ revealRef, ...props }: Props) {
  const bodyGeo = useMemo(() => slabGeometry(W, BODY_H, D, 0.17, 0.02), [])
  const lidGeo = useMemo(() => slabGeometry(W, LID_H, D, 0.1, 0.02), [])

  const lidRef = useRef<THREE.Group>(null)
  const budL = useRef<THREE.Group>(null)
  const budR = useRef<THREE.Group>(null)

  const top = BODY_H / 2 // body is centred on y=0

  useFrame(() => {
    const t = Math.min(1, Math.max(0, revealRef.current))
    // lid opens first, buds follow
    const lidT = Math.min(1, t / 0.55)
    const budT = Math.max(0, (t - 0.35) / 0.65)
    const ease = (x: number) => 1 - Math.pow(1 - x, 3)
    if (lidRef.current) lidRef.current.rotation.x = -ease(lidT) * 1.75
    const lift = ease(budT)
    if (budL.current) {
      budL.current.position.set(-0.2 - lift * 0.12, top - 0.12 + lift * 0.55, 0)
      budL.current.rotation.z = lift * 0.25
    }
    if (budR.current) {
      budR.current.position.set(0.2 + lift * 0.12, top - 0.12 + lift * 0.55, 0)
      budR.current.rotation.z = -lift * 0.25
    }
  })

  return (
    <group {...props}>
      {/* case body */}
      <mesh geometry={bodyGeo} castShadow receiveShadow>
        <meshPhysicalMaterial color="#f3f4f7" roughness={0.3} clearcoat={0.9} clearcoatRoughness={0.2} />
      </mesh>
      {/* recess visible when the lid is open */}
      <mesh position={[0, top - 0.035, 0]}>
        <boxGeometry args={[W * 0.72, 0.08, D * 0.62]} />
        <meshStandardMaterial color="#0b0d12" roughness={0.7} />
      </mesh>
      {/* status LED + hinge line */}
      <mesh position={[0, -0.02, D / 2 + 0.002]}>
        <circleGeometry args={[0.016, 20]} />
        <meshBasicMaterial color="#5ef08a" toneMapped={false} />
      </mesh>
      <mesh position={[0, top + 0.002, -D / 2 + 0.01]}>
        <boxGeometry args={[W * 0.3, 0.012, 0.02]} />
        <meshStandardMaterial color="#b5bac3" metalness={1} roughness={0.25} />
      </mesh>

      {/* lid, pivoting on the rear hinge */}
      <group ref={lidRef} position={[0, top, -D / 2]}>
        <mesh geometry={lidGeo} position={[0, LID_H / 2, D / 2]} castShadow>
          <meshPhysicalMaterial color="#f3f4f7" roughness={0.3} clearcoat={0.9} clearcoatRoughness={0.2} />
        </mesh>
      </group>

      {/* buds (start stowed inside the body) */}
      <group ref={budL}>
        <Bud side={-1} />
      </group>
      <group ref={budR}>
        <Bud side={1} />
      </group>
    </group>
  )
}
