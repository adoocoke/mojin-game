import * as THREE from 'three'
import { detectTier, loadQuality, type QualityId, type QualityTier } from './quality'

export type { QualityId, QualityTier }

export interface QualityPreset {
  id: QualityTier
  antialias: boolean
  dprCap: number
  shadows: boolean
  shadowType: THREE.ShadowMapType
  shadowMap: number
  shadowFollow: boolean
  shadowRadius: number
  far: number
  snow: number
  maxPointLights: number
  powerPreference: WebGLPowerPreference
  toneMapping: THREE.ToneMapping
  exposure: number
}

export const QUALITY_PRESETS: Record<QualityTier, QualityPreset> = {
  low: {
    id: 'low',
    antialias: false,
    dprCap: 1,
    shadows: false,
    shadowType: THREE.BasicShadowMap,
    shadowMap: 512,
    shadowFollow: false,
    shadowRadius: 90,
    far: 170,
    snow: 280,
    maxPointLights: 6,
    powerPreference: 'low-power',
    toneMapping: THREE.NoToneMapping,
    exposure: 1,
  },
  medium: {
    id: 'medium',
    antialias: false,
    dprCap: 1.25,
    shadows: true,
    shadowType: THREE.PCFShadowMap,
    shadowMap: 1024,
    shadowFollow: false,
    shadowRadius: 90,
    far: 280,
    snow: 700,
    maxPointLights: 12,
    powerPreference: 'default',
    toneMapping: THREE.ACESFilmicToneMapping,
    exposure: 1.02,
  },
  high: {
    id: 'high',
    antialias: true,
    dprCap: 2,
    shadows: true,
    shadowType: THREE.PCFSoftShadowMap,
    shadowMap: 2048,
    shadowFollow: true,
    shadowRadius: 48,
    far: 420,
    snow: 1800,
    maxPointLights: 99,
    powerPreference: 'high-performance',
    toneMapping: THREE.ACESFilmicToneMapping,
    exposure: 1.14,
  },
}

export function resolveQuality(id: QualityId = loadQuality()): QualityPreset {
  const tier = id === 'auto' ? detectTier() : id
  return QUALITY_PRESETS[tier]
}

export function applyRenderer(renderer: THREE.WebGLRenderer, p: QualityPreset) {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, p.dprCap))
  renderer.shadowMap.enabled = p.shadows
  renderer.shadowMap.type = p.shadowType
  renderer.toneMapping = p.toneMapping
  renderer.toneMappingExposure = p.exposure
  renderer.outputColorSpace = THREE.SRGBColorSpace
}

export function applySun(sun: THREE.DirectionalLight, p: QualityPreset) {
  sun.castShadow = p.shadows
  if (!p.shadows) return
  const r = p.shadowFollow ? p.shadowRadius : 90
  sun.shadow.mapSize.set(p.shadowMap, p.shadowMap)
  sun.shadow.camera.left = -r
  sun.shadow.camera.right = r
  sun.shadow.camera.top = r
  sun.shadow.camera.bottom = -r
  sun.shadow.camera.near = 1
  sun.shadow.camera.far = p.shadowFollow ? 180 : 250
  sun.shadow.bias = -0.00035
  sun.shadow.normalBias = 0.04
  sun.shadow.camera.updateProjectionMatrix()
}

/** 高清档：太阳阴影贴着玩家走，近处阴影更实。 */
export function updateFollowShadow(sun: THREE.DirectionalLight, x: number, z: number, p: QualityPreset) {
  if (!p.shadows || !p.shadowFollow) return
  sun.position.set(x + 55, 88, z + 28)
  sun.target.position.set(x, 0, z)
  sun.target.updateMatrixWorld()
}

export function applyLighting(
  hemi: THREE.HemisphereLight,
  sun: THREE.DirectionalLight,
  night: boolean,
  p: QualityPreset,
) {
  applySun(sun, p)
  if (night) return
  if (p.id === 'high') {
    sun.intensity = 1.85
    hemi.intensity = 0.7
  } else if (p.id === 'medium') {
    sun.intensity = 1.65
    hemi.intensity = 0.82
  }
}

export function applyFog(scene: THREE.Scene, p: QualityPreset) {
  const fog = scene.fog
  if (!(fog instanceof THREE.Fog)) return
  if (p.id === 'low') {
    fog.far = Math.min(fog.far, 150)
    fog.near = Math.min(fog.near, Math.max(8, fog.near * 0.75))
  } else if (p.id === 'high' && fog.far > 80) {
    fog.far = Math.min(fog.far * 1.18, 480)
  }
}

export function capPointLights(scene: THREE.Scene, max: number, keep: Iterable<THREE.Light> = []) {
  if (max >= 80) return
  const keepSet = new Set(keep)
  const pts: THREE.PointLight[] = []
  scene.traverse(o => {
    if (o instanceof THREE.PointLight && !keepSet.has(o)) pts.push(o)
  })
  pts.sort((a, b) => (b.intensity * (b.distance || 20)) - (a.intensity * (a.distance || 20)))
  for (let i = max; i < pts.length; i++) {
    pts[i].visible = false
    pts[i].intensity = 0
  }
}

export function stripMeshShadows(scene: THREE.Scene) {
  scene.traverse(o => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = false
      o.receiveShadow = false
    }
  })
}
