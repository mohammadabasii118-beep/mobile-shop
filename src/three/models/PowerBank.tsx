import { useMemo } from 'react'
import { slabGeometry } from '../lib/geometry'

/** Independent 3D MagSafe power bank with a magnetic ring and glowing display. */
export default function PowerBank(props: JSX.IntrinsicElements['group']) {
  const bodyGeo = useMemo(() => slabGeometry(0.64, 1.02, 0.3, 0.15, 0.02), [])
  const z = 0.15

  return (
    <group {...props}>
      <mesh geometry={bodyGeo} castShadow receiveShadow>
        <meshPhysicalMaterial color="#17181c" metalness={0.5} roughness={0.4} clearcoat={0.5} clearcoatRoughness={0.3} />
      </mesh>
      {/* MagSafe ring */}
      <mesh position={[0, 0.16, z + 0.001]}>
        <torusGeometry args={[0.2, 0.012, 16, 48]} />
        <meshStandardMaterial color="#8fb4ff" emissive="#3b6fd4" emissiveIntensity={0.5} metalness={0.6} roughness={0.3} />
      </mesh>
      {/* digital display */}
      <mesh position={[0, -0.28, z + 0.002]}>
        <planeGeometry args={[0.34, 0.16]} />
        <meshBasicMaterial color="#0a1326" toneMapped={false} />
      </mesh>
      <mesh position={[0, -0.28, z + 0.004]}>
        <planeGeometry args={[0.2, 0.05]} />
        <meshBasicMaterial color="#6ea8ff" toneMapped={false} />
      </mesh>
      {/* charge bars */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[-0.08 + i * 0.08, -0.4, z + 0.003]}>
          <planeGeometry args={[0.05, 0.03]} />
          <meshBasicMaterial color="#6ea8ff" toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}
