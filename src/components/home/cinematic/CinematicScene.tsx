"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Environment,
  Lightformer,
  ContactShadows,
  RoundedBox,
  AdaptiveDpr,
  PerformanceMonitor,
} from "@react-three/drei";
import { EffectComposer, DepthOfField, Vignette } from "@react-three/postprocessing";
import { Suspense, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { scrollState, SCENES, seg, smoothstep, lerp, mapRange } from "@/lib/scroll";

const TWO_PI = Math.PI * 2;

/* ---------- helpers ---------- */

function fadeMesh(m: THREE.Mesh | null | undefined, o: number) {
  if (!m) return;
  m.visible = o > 0.004;
  const mat = m.material as THREE.MeshStandardMaterial | undefined;
  if (mat) {
    mat.transparent = true;
    mat.opacity = o;
  }
}

function fadeGroup(g: THREE.Group | null | undefined, o: number) {
  if (!g) return;
  g.visible = o > 0.004;
  g.traverse((c) => {
    const mat = (c as THREE.Mesh).material as
      | THREE.MeshStandardMaterial
      | undefined;
    if (mat && "opacity" in mat) {
      mat.transparent = true;
      mat.opacity = o;
    }
  });
}

/** Piecewise camera path across the 5 scenes. */
const CAM_STOPS = [0, 0.25, 0.5, 0.75, 1];
const CAM_ANCHORS = [
  new THREE.Vector3(0, 0.2, 8.6),
  new THREE.Vector3(1.7, 0.5, 6.6),
  new THREE.Vector3(-1.9, -0.3, 6.1),
  new THREE.Vector3(0.2, 0.7, 6.3),
  new THREE.Vector3(0, 0.3, 11.5),
];

function sampleCam(p: number, out: THREE.Vector3) {
  let i = 0;
  while (i < CAM_STOPS.length - 2 && p > CAM_STOPS[i + 1]) i++;
  const t = smoothstep(CAM_STOPS[i], CAM_STOPS[i + 1], p);
  out.copy(CAM_ANCHORS[i]).lerp(CAM_ANCHORS[i + 1], t);
}

/* ---------- materials ---------- */

const metalProps = (color: string, roughness = 0.2) => ({
  color,
  metalness: 1,
  roughness,
  envMapIntensity: 1.15,
});

/* ---------- the rig ---------- */

function Rig({ quality }: { quality: number }) {
  const { camera } = useThree();

  const phone = useRef<THREE.Group>(null);
  const screen = useRef<THREE.Mesh>(null);

  const caseA = useRef<THREE.Mesh>(null);
  const caseB = useRef<THREE.Mesh>(null);
  const caseC = useRef<THREE.Mesh>(null);
  const glass = useRef<THREE.Mesh>(null);

  const charger = useRef<THREE.Mesh>(null);
  const powerbank = useRef<THREE.Mesh>(null);
  const cable = useRef<THREE.Mesh>(null);
  const energy = useRef<THREE.Group>(null);

  const earbudCase = useRef<THREE.Group>(null);
  const lid = useRef<THREE.Group>(null);
  const budL = useRef<THREE.Mesh>(null);
  const budR = useRef<THREE.Mesh>(null);
  const headphone = useRef<THREE.Mesh>(null);
  const rings = useRef<THREE.Group>(null);

  const camTarget = useMemo(() => new THREE.Vector3(), []);

  useFrame((state) => {
    const p = scrollState.progress;
    const t = state.clock.elapsedTime;

    /* camera — transparent canvas lets an optional ad backdrop show behind */
    sampleCam(p, camTarget);
    camera.position.lerp(camTarget, 0.06);
    camera.lookAt(0, mapRange(p, 0.6, 0.8, 0, -0.2), 0);

    /* ---- Phone (scenes 1-3, exits during 4) ---- */
    const phoneExit = smoothstep(0.62, 0.8, p);
    if (phone.current) {
      phone.current.rotation.y = p * TWO_PI * 2.1 + Math.sin(t * 0.3) * 0.1;
      phone.current.rotation.x = 0.16 + Math.sin(t * 0.4) * 0.03;
      phone.current.position.set(0, Math.sin(t * 0.6) * 0.08 + phoneExit * 4.2, 0);
      const sc = 1 - phoneExit * 0.7;
      phone.current.scale.setScalar(sc);
      fadeGroup(phone.current, 1 - phoneExit);
    }
    if (screen.current) {
      // screen lights up during the power scene
      const glow = seg(p, 0.46, 0.58) * (1 - phoneExit);
      const mat = screen.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.25 + glow * 1.6;
    }

    /* ---- Scene 2: cases ---- */
    const sCase = seg(p, ...SCENES.cases);
    const caseIn = smoothstep(0.18, 0.26, p);
    const caseOut = 1 - smoothstep(0.37, 0.42, p);
    const caseVis = Math.min(caseIn, caseOut);
    const snap = smoothstep(0.3, 0.4, p); // one case snaps onto the phone
    const cfgs = [
      { ref: caseA, color: "#c7ccd6", base: 0 },
      { ref: caseB, color: "#4b4f58", base: TWO_PI / 3 },
      { ref: caseC, color: "#aeb9d6", base: (TWO_PI * 2) / 3 },
    ];
    cfgs.forEach((c, i) => {
      const m = c.ref.current;
      if (!m) return;
      const ang = c.base + sCase * Math.PI * 1.1 + t * 0.2;
      const rr = i === 0 ? lerp(2.0, 0.26, snap) : 2.0;
      const ox = Math.cos(ang) * rr;
      const oy = Math.sin(ang * 0.9) * 0.6;
      const oz = Math.sin(ang) * rr * 0.4;
      if (i === 0) {
        // first case aligns flat and settles onto the phone as it snaps
        m.position.set(lerp(ox, 0, snap), lerp(oy, 0, snap), lerp(oz, -0.16, snap));
        m.rotation.set(lerp(0.4, 0.16, snap), lerp(ang, 0, snap), lerp(0.2, 0, snap));
        fadeMesh(m, Math.max(caseVis, snap * caseOut));
      } else {
        m.position.set(ox, oy, oz);
        m.rotation.set(0.4, ang, 0.2);
        fadeMesh(m, caseVis);
      }
    });
    if (glass.current) {
      const g = glass.current;
      const lift = Math.sin(sCase * Math.PI); // lifts off then returns
      g.position.set(0, 0, 0.18 + lift * 1.3);
      g.rotation.y = p * TWO_PI;
      fadeMesh(g, caseVis * 0.7);
    }

    /* ---- Scene 3: power & charging ---- */
    const sPow = seg(p, ...SCENES.power);
    const powIn = smoothstep(0.38, 0.46, p);
    const powOut = 1 - smoothstep(0.57, 0.62, p);
    const powVis = Math.min(powIn, powOut);
    if (charger.current) {
      charger.current.rotation.set(t * 0.5, sPow * Math.PI * 2 + t * 0.6, 0);
      charger.current.position.set(-1.9, 0.9, 0);
      fadeMesh(charger.current, powVis);
    }
    if (powerbank.current) {
      powerbank.current.rotation.set(0, 0, Math.PI / 2 + sPow * 0.8);
      powerbank.current.position.set(1.9, -0.9, -0.3);
      fadeMesh(powerbank.current, powVis);
    }
    if (cable.current) {
      cable.current.rotation.set(Math.PI / 2, 0, sPow * Math.PI);
      cable.current.position.set(-0.9, 0.2, 0.2);
      const mat = cable.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.4 + Math.sin(t * 3) * 0.2;
      fadeMesh(cable.current, powVis);
    }
    if (energy.current) {
      energy.current.visible = powVis > 0.01;
      energy.current.children.forEach((c, i) => {
        const mesh = c as THREE.Mesh;
        const phase = (t * 0.8 + i / energy.current!.children.length) % 1;
        mesh.position.x = lerp(-1.6, 0, phase);
        mesh.position.y = lerp(0.8, 0, phase);
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.transparent = true;
        mat.opacity = powVis * (1 - Math.abs(phase - 0.5) * 2);
      });
    }

    /* ---- Scene 4: audio ---- */
    const sAud = seg(p, ...SCENES.audio);
    const audIn = smoothstep(0.58, 0.66, p);
    const audOut = 1 - smoothstep(0.77, 0.82, p);
    const audVis = Math.min(audIn, audOut);
    if (earbudCase.current) {
      earbudCase.current.position.set(0, 0, 0);
      earbudCase.current.rotation.y = sAud * Math.PI * 1.4 + t * 0.2;
      fadeGroup(earbudCase.current, audVis);
    }
    if (lid.current) {
      // lid opens as scene begins
      lid.current.rotation.x = -smoothstep(0.6, 0.68, p) * 2.1;
    }
    const budPop = smoothstep(0.64, 0.74, p);
    if (budL.current) {
      budL.current.position.set(-0.4, budPop * 1.2, 0.2);
      budL.current.rotation.z = budPop * 0.6;
    }
    if (budR.current) {
      budR.current.position.set(0.4, budPop * 1.5, -0.2);
      budR.current.rotation.z = -budPop * 0.6;
    }
    if (headphone.current) {
      headphone.current.rotation.set(Math.PI / 2, t * 0.6, sAud * Math.PI);
      headphone.current.position.set(0, 0.2, -0.5);
      fadeMesh(headphone.current, audVis * 0.9);
    }
    if (rings.current) {
      rings.current.visible = audVis > 0.01;
      rings.current.children.forEach((c, i) => {
        const mesh = c as THREE.Mesh;
        const phase = (t * 0.4 + i / rings.current!.children.length) % 1;
        const s = 0.6 + phase * 3.4;
        mesh.scale.setScalar(s);
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.transparent = true;
        mat.opacity = audVis * (1 - phase) * 0.7;
      });
    }
  });

  /* accessory positions for scene 1 are set declaratively below and nudged
     by the orbit in useFrame via group rotation */
  const heroOrbit = useRef<THREE.Group>(null);
  useFrame((state) => {
    const p = scrollState.progress;
    const sHero = seg(p, ...SCENES.hero);
    const g = heroOrbit.current;
    if (!g) return;
    g.rotation.y = state.clock.elapsedTime * 0.25 + p * 2;
    const spread = Math.sin(sHero * Math.PI);
    g.scale.setScalar(1 + spread * 0.7);
    fadeGroup(g, 1 - smoothstep(0.16, 0.23, p));
  });

  return (
    <group>
      {/* ----- Phone ----- */}
      <group ref={phone}>
        <RoundedBox args={[1.45, 2.95, 0.18]} radius={0.16} smoothness={5}>
          <meshStandardMaterial {...metalProps("#1b1c22", 0.28)} />
        </RoundedBox>
        <mesh ref={screen} position={[0, 0, 0.1]}>
          <planeGeometry args={[1.26, 2.76]} />
          <meshStandardMaterial
            color="#06070b"
            metalness={0.3}
            roughness={0.1}
            emissive="#2a3b63"
            emissiveIntensity={0.25}
          />
        </mesh>
        <mesh position={[-0.42, 1.08, 0.14]}>
          <circleGeometry args={[0.15, 32]} />
          <meshStandardMaterial {...metalProps("#0d0d11", 0.35)} />
        </mesh>
      </group>

      {/* ----- Scene 1: floating accessories ----- */}
      <group ref={heroOrbit}>
        <mesh position={[2.3, 0.3, 0]}>
          <torusGeometry args={[0.4, 0.14, 20, 48]} />
          <meshStandardMaterial {...metalProps("#c7ccd6", 0.15)} />
        </mesh>
        <mesh position={[-2.3, 0.6, -0.4]}>
          <icosahedronGeometry args={[0.42, 0]} />
          <meshStandardMaterial {...metalProps("#aeb9d6", 0.2)} />
        </mesh>
        <RoundedBox args={[0.6, 0.6, 0.6]} radius={0.12} smoothness={4} position={[1.9, -1.2, 0.3]}>
          <meshStandardMaterial {...metalProps("#8f97a6", 0.25)} />
        </RoundedBox>
        <mesh position={[-1.9, -1.1, 0.2]} rotation={[0, 0, Math.PI / 2]}>
          <capsuleGeometry args={[0.2, 0.7, 8, 24]} />
          <meshStandardMaterial {...metalProps("#6f7686", 0.25)} />
        </mesh>
        <mesh position={[0.2, 1.9, -0.6]}>
          <torusGeometry args={[0.3, 0.1, 16, 40]} />
          <meshStandardMaterial {...metalProps("#d2d6dd", 0.18)} />
        </mesh>
        <mesh position={[-0.4, -2, -0.3]}>
          <dodecahedronGeometry args={[0.3, 0]} />
          <meshStandardMaterial {...metalProps("#b4bac4", 0.2)} />
        </mesh>
      </group>

      {/* ----- Scene 2: cases + glass ----- */}
      <RoundedBox ref={caseA} args={[1.5, 3.0, 0.3]} radius={0.18} smoothness={5}>
        <meshStandardMaterial {...metalProps("#c7ccd6", 0.3)} />
      </RoundedBox>
      <RoundedBox ref={caseB} args={[1.5, 3.0, 0.3]} radius={0.18} smoothness={5}>
        <meshStandardMaterial {...metalProps("#4b4f58", 0.35)} />
      </RoundedBox>
      <RoundedBox ref={caseC} args={[1.5, 3.0, 0.3]} radius={0.18} smoothness={5}>
        <meshStandardMaterial {...metalProps("#aeb9d6", 0.25)} />
      </RoundedBox>
      <mesh ref={glass}>
        <planeGeometry args={[1.3, 2.8]} />
        <meshPhysicalMaterial
          color="#dfe7f5"
          metalness={0.1}
          roughness={0.05}
          transmission={0.6}
          transparent
          opacity={0.5}
          thickness={0.3}
        />
      </mesh>

      {/* ----- Scene 3: power ----- */}
      <RoundedBox ref={charger} args={[0.9, 0.9, 0.9]} radius={0.16} smoothness={4}>
        <meshStandardMaterial {...metalProps("#e9ebef", 0.3)} />
      </RoundedBox>
      <mesh ref={powerbank}>
        <capsuleGeometry args={[0.5, 1.4, 12, 28]} />
        <meshStandardMaterial {...metalProps("#2a2c33", 0.3)} />
      </mesh>
      <mesh ref={cable}>
        <torusGeometry args={[0.7, 0.07, 16, 60, Math.PI * 1.4]} />
        <meshStandardMaterial
          color="#aeb9d6"
          metalness={0.9}
          roughness={0.2}
          emissive="#8fa0cf"
          emissiveIntensity={0.5}
        />
      </mesh>
      <group ref={energy}>
        {Array.from({ length: 6 }).map((_, i) => (
          <mesh key={i}>
            <boxGeometry args={[0.07, 0.07, 0.07]} />
            <meshStandardMaterial
              color="#cfd6e4"
              emissive="#aeb9d6"
              emissiveIntensity={2}
              transparent
            />
          </mesh>
        ))}
      </group>

      {/* ----- Scene 4: audio ----- */}
      <group ref={earbudCase}>
        <RoundedBox args={[1.1, 0.55, 0.9]} radius={0.22} smoothness={5} position={[0, -0.2, 0]}>
          <meshStandardMaterial {...metalProps("#e9ebef", 0.25)} />
        </RoundedBox>
        <group ref={lid} position={[0, 0.08, -0.45]}>
          <RoundedBox args={[1.1, 0.5, 0.9]} radius={0.22} smoothness={5} position={[0, 0.2, 0.45]}>
            <meshStandardMaterial {...metalProps("#d2d6dd", 0.25)} />
          </RoundedBox>
        </group>
        <mesh ref={budL}>
          <capsuleGeometry args={[0.12, 0.3, 8, 20]} />
          <meshStandardMaterial {...metalProps("#f7f8fa", 0.2)} />
        </mesh>
        <mesh ref={budR}>
          <capsuleGeometry args={[0.12, 0.3, 8, 20]} />
          <meshStandardMaterial {...metalProps("#f7f8fa", 0.2)} />
        </mesh>
      </group>
      <mesh ref={headphone}>
        <torusGeometry args={[1.0, 0.26, 24, 64]} />
        <meshStandardMaterial {...metalProps("#2a2c33", 0.3)} />
      </mesh>
      <group ref={rings}>
        {Array.from({ length: 4 }).map((_, i) => (
          <mesh key={i} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1, 0.02, 12, 80]} />
            <meshStandardMaterial
              color="#aeb9d6"
              emissive="#aeb9d6"
              emissiveIntensity={1.4}
              transparent
            />
          </mesh>
        ))}
      </group>

      {/* ----- lighting + reflections ----- */}
      <ambientLight intensity={0.28} />
      <spotLight position={[7, 9, 7]} angle={0.4} penumbra={1} intensity={60} color="#dfe4f0" />
      <pointLight position={[-7, -3, 5]} intensity={34} color="#5b6ea8" />

      <ContactShadows
        position={[0, -2.9, 0]}
        opacity={0.45}
        scale={16}
        blur={2.8}
        far={5}
        color="#000000"
      />

      <Environment resolution={quality > 0.5 ? 256 : 128}>
        <Lightformer form="rect" intensity={3} position={[0, 5, 5]} scale={[9, 4, 1]} color="#dfe4f0" />
        <Lightformer form="rect" intensity={1.6} position={[-5, 1, 3]} scale={[4, 7, 1]} color="#6a7bb0" />
        <Lightformer form="circle" intensity={2.2} position={[5, -2, 3]} scale={[4, 4, 1]} color="#ffffff" />
      </Environment>
    </group>
  );
}

/* subtle drifting particles, independent of scroll */
function Particles({ count }: { count: number }) {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 18;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 12;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 10;
    }
    return arr;
  }, [count]);
  useFrame((s) => {
    if (ref.current) ref.current.rotation.y = s.clock.elapsedTime * 0.02;
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.028} color="#aeb9d6" transparent opacity={0.6} sizeAttenuation />
    </points>
  );
}

export default function CinematicScene({ mobile = false }: { mobile?: boolean }) {
  const [quality, setQuality] = useState(1);
  return (
    <Canvas
      dpr={[1, mobile ? 1.4 : 2]}
      camera={{ position: [0, 0.2, 8.6], fov: 42 }}
      gl={{ antialias: !mobile, alpha: true, powerPreference: "high-performance" }}
    >
      <Suspense fallback={null}>
        <PerformanceMonitor
          onDecline={() => setQuality((q) => Math.max(0.4, q - 0.3))}
        />
        <AdaptiveDpr pixelated />
        <Rig quality={quality} />
        <Particles count={mobile ? 40 : 110} />
        {/* Depth of field — desktop only, keeps the subject sharp and blurs
            the depth. Skipped on mobile and when perf drops, to protect FPS. */}
        {!mobile && quality > 0.6 && (
          <EffectComposer enableNormalPass={false} multisampling={0}>
            <DepthOfField
              focusDistance={0.012}
              focalLength={0.06}
              bokehScale={2.2}
              height={420}
            />
            <Vignette eskil={false} offset={0.2} darkness={0.75} />
          </EffectComposer>
        )}
      </Suspense>
    </Canvas>
  );
}
