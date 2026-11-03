import { useMemo, useRef, type MutableRefObject } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import Stage from './Stage'
import ModelSlot from './models/ModelSlot'
import IPhone from './models/IPhone'
import PhoneCase from './models/PhoneCase'
import ScreenGlass from './models/ScreenGlass'
import Charger from './models/Charger'
import PowerBank from './models/PowerBank'
import AirPods from './models/AirPods'
import { sampleTrack, damp, segment, type Track } from './lib/track'
import { getTracks, PODS_OPEN } from './scenes'

function apply(g: THREE.Object3D | null, track: Track, p: number) {
  if (!g) return
  const s = sampleTrack(track, p)
  g.position.set(s.pos[0], s.pos[1], s.pos[2])
  g.rotation.set(s.rot[0], s.rot[1], s.rot[2])
  g.scale.setScalar(Math.max(s.scale, 0.0001))
  // Fully hide parts that have not entered yet (no specks from near-zero scale).
  g.visible = s.scale > 0.02
}

interface Props {
  progressRef: MutableRefObject<number>
  reduced: boolean
  isMobile: boolean
}

export default function Scene({ progressRef, reduced, isMobile }: Props) {
  const phone = useRef<THREE.Group>(null)
  const caseG = useRef<THREE.Group>(null)
  const glassG = useRef<THREE.Group>(null)
  const chargerG = useRef<THREE.Group>(null)
  const powerG = useRef<THREE.Group>(null)
  const podsG = useRef<THREE.Group>(null)
  const podsReveal = useRef(reduced ? 1 : 0)

  const tracks = useMemo(() => getTracks(isMobile), [isMobile])
  const { camera } = useThree()
  const camTarget = useMemo(() => new THREE.Vector3(), [])
  const sp = useRef(reduced ? 1 : 0)

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    const target = reduced ? 1 : progressRef.current
    sp.current = damp(sp.current, target, 6, dt)
    const p = sp.current

    apply(phone.current, tracks.phone, p)
    apply(caseG.current, tracks.case, p)
    apply(glassG.current, tracks.glass, p)
    apply(chargerG.current, tracks.charger, p)
    apply(powerG.current, tracks.power, p)
    apply(podsG.current, tracks.pods, p)
    podsReveal.current = reduced ? 1 : segment(p, PODS_OPEN[0], PODS_OPEN[1])

    // Subtle living motion on the hero phone (studio "breathing"), not when reduced.
    if (!reduced && phone.current) {
      const t = state.clock.elapsedTime
      phone.current.position.y += Math.sin(t * 0.8) * 0.025
      phone.current.rotation.y += Math.sin(t * 0.5) * 0.03
    }

    const cp = sampleTrack(tracks.camPos, p).pos
    const ct = sampleTrack(tracks.camTarget, p).pos
    camera.position.set(cp[0], cp[1], cp[2])
    camTarget.set(ct[0], ct[1], ct[2])
    camera.lookAt(camTarget)
  })

  return (
    <>
      <Stage isMobile={isMobile} />

      {/* phone with parented case + glass (they assemble in the phone's own frame) */}
      <group ref={phone}>
        <ModelSlot kind="iphone" fallback={<IPhone />} />
        <group ref={caseG}>
          <ModelSlot kind="case" fallback={<PhoneCase />} />
        </group>
        <group ref={glassG}>
          <ModelSlot kind="glass" fallback={<ScreenGlass />} />
        </group>
      </group>

      {/* world-space accessories */}
      <group ref={chargerG}>
        <ModelSlot kind="charger" fallback={<Charger />} />
      </group>
      <group ref={powerG}>
        <ModelSlot kind="powerbank" fallback={<PowerBank />} />
      </group>
      <group ref={podsG}>
        <ModelSlot kind="airpods" fallback={<AirPods revealRef={podsReveal} />} />
      </group>
    </>
  )
}
