import { useMemo, useRef, type MutableRefObject } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import Stage from './Stage'
import ModelSlot from './models/ModelSlot'
import IPhone from './models/IPhone'
import PhoneCase from './models/PhoneCase'
import ScreenGlass from './models/ScreenGlass'
import LensGlass from './models/LensGlass'
import { sampleTrack, damp, type Track } from './lib/track'
import { getTracks } from './scenes'

function apply(g: THREE.Object3D | null, track: Track, p: number) {
  if (!g) return
  const s = sampleTrack(track, p)
  g.position.set(s.pos[0], s.pos[1], s.pos[2])
  g.rotation.set(s.rot[0], s.rot[1], s.rot[2])
  g.scale.setScalar(Math.max(s.scale, 0.0001))
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
  const lensG = useRef<THREE.Group>(null)

  const tracks = useMemo(() => getTracks(isMobile), [isMobile])
  const { camera } = useThree()
  const camTarget = useMemo(() => new THREE.Vector3(), [])
  const sp = useRef(reduced ? 1 : 0)

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    sp.current = damp(sp.current, reduced ? 1 : progressRef.current, 6, dt)
    const p = sp.current

    apply(phone.current, tracks.phone, p)
    apply(glassG.current, tracks.glass, p)
    apply(lensG.current, tracks.lens, p)
    apply(caseG.current, tracks.case, p)

    if (!reduced && phone.current) {
      const t = state.clock.elapsedTime
      phone.current.position.y += Math.sin(t * 0.8) * 0.02
      phone.current.rotation.y += Math.sin(t * 0.5) * 0.025
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
      <group ref={phone}>
        <ModelSlot kind="iphone" fallback={<IPhone />} />
        <group ref={glassG}>
          <ModelSlot kind="glass" fallback={<ScreenGlass />} />
        </group>
        <group ref={lensG}>
          <ModelSlot kind="lens" fallback={<LensGlass />} />
        </group>
        <group ref={caseG}>
          <ModelSlot kind="case" fallback={<PhoneCase />} />
        </group>
      </group>
    </>
  )
}
