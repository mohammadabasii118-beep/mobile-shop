import { Suspense, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows, Float, OrbitControls, useGLTF, Center } from '@react-three/drei';
import { RotateCcw, Hand } from 'lucide-react';
import type { OrbitControls as OrbitImpl } from 'three-stdlib';
import type { ArtKind } from '@/types';
import { Cable, Charger, MagSafe, MiniCase, PhoneModel } from './shapes';

/** اتصال مدل واقعی: فایل GLB/GLTF را در modelUrl بدهید. */
function GLBModel({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return <Center><primitive object={scene} /></Center>;
}

function Mockup({ art, color }: { art: ArtKind; color: string }) {
  switch (art) {
    case 'cable': return <group scale={2}><Cable color={color} /></group>;
    case 'charger': case 'adapter': return <group scale={2.2}><Charger color={color} /></group>;
    case 'powerbank': return <group scale={2} rotation={[0, 0.4, 0]}><MiniCase color={color} /></group>;
    case 'lens': case 'holder': case 'bag': return <group scale={2.2}><MagSafe /></group>;
    default: return <PhoneModel caseColor={color} scale={0.95} />; // case / glass
  }
}

/** نمایشگر سه‌بعدی محصول: چرخش، Zoom، لمس، ریست. */
export default function ProductViewer3D({ art, color, modelUrl }: { art: ArtKind; color: string; modelUrl?: string }) {
  const ctl = useRef<OrbitImpl>(null);
  return (
    <div className="relative h-full min-h-[320px] w-full overflow-hidden rounded-3xl bg-gradient-to-b from-surface2 to-surface">
      <Canvas camera={{ position: [0, 0, 7], fov: 38 }} dpr={[1, 1.75]}>
        <ambientLight intensity={0.6} /><directionalLight position={[3, 4, 5]} intensity={2} />
        <pointLight position={[-4, 0, 3]} intensity={20} color={color} />
        <Suspense fallback={null}>
          <Float speed={1.2} floatIntensity={0.4} rotationIntensity={0.1}>
            {modelUrl ? <GLBModel url={modelUrl} /> : <Mockup art={art} color={color} />}
          </Float>
          <ContactShadows position={[0, -2.2, 0]} opacity={0.45} scale={8} blur={2.5} far={4} />
        </Suspense>
        <OrbitControls ref={ctl} enablePan={false} minDistance={4} maxDistance={11} autoRotate autoRotateSpeed={1.2} />
      </Canvas>
      <div className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 text-[11px] text-mist/80 backdrop-blur"><Hand size={12} />بچرخانید و زوم کنید</div>
      <button onClick={() => ctl.current?.reset()} className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-bold text-white backdrop-blur hover:bg-black/80"><RotateCcw size={13} />بازنشانی</button>
    </div>
  );
}
