import { Environment, Lightformer, ContactShadows } from '@react-three/drei'

/** Dark studio lighting + an image-based environment crafted from lightformers (no external HDRI). */
export default function Stage({ isMobile }: { isMobile: boolean }) {
  return (
    <>
      <color attach="background" args={['#050506']} />
      <fog attach="fog" args={['#050506', 9, 20]} />

      <ambientLight intensity={0.12} />
      <directionalLight
        position={[4, 6, 5]}
        intensity={2.2}
        castShadow={!isMobile}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={1}
        shadow-camera-far={20}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
        shadow-bias={-0.0003}
      />
      <directionalLight position={[-5, 2, 3]} intensity={0.6} color="#9ec2ff" />
      <pointLight position={[0, -2, 4]} intensity={0.4} color="#6ea8ff" />

      {/* reflective studio environment */}
      <Environment resolution={isMobile ? 128 : 256}>
        <Lightformer intensity={2.2} position={[0, 2, 4]} scale={[7, 7, 1]} color="#ffffff" />
        <Lightformer intensity={1.3} position={[-4, 1, 2]} rotation={[0, Math.PI / 4, 0]} scale={[4, 8, 1]} color="#aecbff" />
        <Lightformer intensity={1.1} position={[4, 0, 2]} rotation={[0, -Math.PI / 4, 0]} scale={[4, 8, 1]} color="#ffffff" />
        <Lightformer intensity={0.7} position={[0, -3, 2]} scale={[10, 3, 1]} color="#5e8bff" />
        <Lightformer intensity={0.5} position={[0, 4, -3]} scale={[10, 4, 1]} color="#8f9bff" />
      </Environment>

      {!isMobile && (
        <ContactShadows
          position={[0, -1.7, 0]}
          opacity={0.6}
          scale={14}
          blur={2.6}
          far={4}
          color="#000000"
          resolution={512}
        />
      )}
    </>
  )
}
