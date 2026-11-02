"use client";

import { Canvas } from "@react-three/fiber";
import {
  OrbitControls,
  Environment,
  Lightformer,
  ContactShadows,
  RoundedBox,
  Float,
  useGLTF,
  Center,
} from "@react-three/drei";
import { Suspense } from "react";

/** Loads a real GLB/GLTF model when a product provides one. */
function GLBModel({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return (
    <Center>
      <primitive object={scene} />
    </Center>
  );
}

/**
 * Rotatable 3D view of a product. If the product supplies a real GLB/GLTF
 * model (`modelUrl`), it is shown; otherwise a stylized decorative primitive
 * (clearly not a scanned model) is rendered, tinted by the selected color.
 * Drag to rotate.
 */
export default function ProductViewer3D({
  categorySlug,
  color,
  modelUrl,
}: {
  categorySlug: string;
  color: string;
  modelUrl?: string;
}) {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0, 5], fov: 40 }}
      gl={{ antialias: true, alpha: true }}
    >
      <Suspense fallback={null}>
        <ambientLight intensity={0.3} />
        <spotLight position={[5, 6, 5]} angle={0.4} penumbra={1} intensity={40} />

        <Float speed={1.2} rotationIntensity={0.3} floatIntensity={0.6}>
          {modelUrl ? (
            <GLBModel url={modelUrl} />
          ) : (
            <Shape categorySlug={categorySlug} color={color} />
          )}
        </Float>

        <ContactShadows
          position={[0, -1.6, 0]}
          opacity={0.45}
          scale={10}
          blur={2.4}
          far={3}
        />
        <Environment resolution={256}>
          <Lightformer
            form="rect"
            intensity={3}
            position={[0, 3, 3]}
            scale={[6, 3, 1]}
            color="#dfe4f0"
          />
          <Lightformer
            form="circle"
            intensity={2}
            position={[-3, -1, 2]}
            scale={[3, 3, 1]}
            color="#6a7bb0"
          />
        </Environment>

        <OrbitControls
          enablePan={false}
          enableZoom={false}
          autoRotate
          autoRotateSpeed={1.2}
          minPolarAngle={Math.PI / 3}
          maxPolarAngle={Math.PI / 1.8}
        />
      </Suspense>
    </Canvas>
  );
}

function Shape({
  categorySlug,
  color,
}: {
  categorySlug: string;
  color: string;
}) {
  const mat = (
    <meshStandardMaterial
      color={color}
      metalness={0.95}
      roughness={0.2}
      envMapIntensity={1.1}
    />
  );

  switch (categorySlug) {
    case "smartwatch":
      return (
        <group>
          <RoundedBox args={[1.5, 1.8, 0.4]} radius={0.35} smoothness={6}>
            {mat}
          </RoundedBox>
          <mesh position={[0, 0, 0.22]}>
            <planeGeometry args={[1.1, 1.4]} />
            <meshStandardMaterial
              color="#06070a"
              emissive="#223"
              emissiveIntensity={0.4}
              roughness={0.1}
            />
          </mesh>
        </group>
      );
    case "headphones":
      return (
        <mesh>
          <torusGeometry args={[0.9, 0.28, 32, 80]} />
          {mat}
        </mesh>
      );
    case "powerbanks":
    case "speakers":
      return (
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <capsuleGeometry args={[0.7, 1.4, 16, 32]} />
          {mat}
        </mesh>
      );
    case "chargers":
      return (
        <RoundedBox args={[1.4, 1.4, 1.4]} radius={0.28} smoothness={6}>
          {mat}
        </RoundedBox>
      );
    case "cases":
    case "glass":
    default:
      return (
        <RoundedBox args={[1.5, 3, 0.2]} radius={0.18} smoothness={6}>
          {mat}
        </RoundedBox>
      );
  }
}
