import { Component, Suspense, useMemo, type ReactNode } from 'react'
import { useGLTF } from '@react-three/drei'
import { GLB_FILES, type ModelKind } from './glb'

class GLBErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch() {
    /* a missing/invalid GLB simply falls back to the procedural model */
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

function GLBModel({ url }: { url: string }) {
  const { scene } = useGLTF(url)
  const object = useMemo(() => scene.clone(true), [scene])
  return <primitive object={object} />
}

/**
 * Renders a real GLB model when one is configured in `glb.ts`, otherwise the
 * procedural fallback. A GLB that fails to load degrades to the fallback.
 */
export default function ModelSlot({
  kind,
  fallback,
}: {
  kind: ModelKind
  fallback: ReactNode
}) {
  const url = GLB_FILES[kind]
  if (!url) return <>{fallback}</>
  return (
    <GLBErrorBoundary fallback={fallback}>
      <Suspense fallback={null}>
        <GLBModel url={url} />
      </Suspense>
    </GLBErrorBoundary>
  )
}
