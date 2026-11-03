// ──────────────────────────────────────────────────────────────────────────
// Real GLB/GLTF drop-in.
// Put your exported models in `public/models/` and set the matching path below.
// When a path is provided it is loaded and REPLACES the procedural model; if it
// fails to load, the procedural model is used so the scene never breaks.
//
//   public/models/iphone.glb
//   public/models/case.glb
//   public/models/glass.glb
//   public/models/lens.glb
//
// Example: enable the iPhone GLB →  iphone: '/models/iphone.glb',
// ──────────────────────────────────────────────────────────────────────────

export type ModelKind = 'iphone' | 'case' | 'glass' | 'lens'

export const GLB_FILES: Record<ModelKind, string | undefined> = {
  iphone: undefined,
  case: undefined,
  glass: undefined,
  lens: undefined,
}
