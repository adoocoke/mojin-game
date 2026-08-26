/** 菜单选项。auto 在运行时解析成 low/medium/high。 */
export type QualityId = 'auto' | 'low' | 'medium' | 'high'
export type QualityTier = 'low' | 'medium' | 'high'

export const QUALITY_TIER_LABEL: Record<QualityTier, string> = {
  low: '流畅',
  medium: '均衡',
  high: '高清',
}

export const QUALITY_META: { id: QualityId; label: string; icon: string; hint: string }[] = [
  { id: 'auto', label: '自动', icon: '🎯', hint: '按显卡/内存/触屏自动选择档位' },
  { id: 'low', label: '流畅', icon: '📶', hint: '关抗锯齿与阴影，适合核显和手机' },
  { id: 'medium', label: '均衡', icon: '⚖️', hint: '硬阴影折中，大多数浏览器推荐' },
  { id: 'high', label: '高清', icon: '✨', hint: '抗锯齿、跟随柔影、电影色调' },
]

const KEY = 'mojin_quality'
let detected: QualityTier | null = null

export function loadQuality(): QualityId {
  try {
    if (typeof localStorage === 'undefined') return 'auto'
    const v = localStorage.getItem(KEY)
    if (v === 'auto' || v === 'low' || v === 'medium' || v === 'high') return v
  } catch { /* 隐私模式 */ }
  return 'auto'
}

export function saveQuality(id: QualityId) {
  try { localStorage.setItem(KEY, id) } catch { /* 忽略 */ }
}

/** 根据硬件粗估一档。结果缓存，避免菜单每帧探测 WebGL。 */
export function detectTier(): QualityTier {
  if (detected) return detected
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    detected = 'medium'
    return detected
  }
  const cores = navigator.hardwareConcurrency || 4
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  const touch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0
  const dpr = window.devicePixelRatio || 1
  const gpu = gpuRenderer()

  if (gpu && /swiftshader|llvmpipe|softpipe|software|microsoft basic render/i.test(gpu)) {
    detected = 'low'
    return detected
  }
  if (mem !== undefined && mem <= 2) {
    detected = 'low'
    return detected
  }
  if (gpu && touch && /mali-|adreno [234]|powervr|intel(r)? (u?hd|iris)/i.test(gpu)) {
    detected = 'low'
    return detected
  }
  if (touch && (cores <= 4 || (mem !== undefined && mem <= 4) || dpr >= 3)) {
    detected = 'medium'
    return detected
  }
  if (touch) {
    detected = 'medium'
    return detected
  }
  if (cores >= 8 && (mem === undefined || mem >= 8) && dpr <= 2.5) {
    detected = 'high'
    return detected
  }
  detected = 'medium'
  return detected
}

function gpuRenderer(): string {
  try {
    const c = document.createElement('canvas')
    const gl = c.getContext('webgl') || c.getContext('experimental-webgl')
    if (!gl || !(gl instanceof WebGLRenderingContext)) return ''
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    if (!ext) return ''
    return String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '')
  } catch {
    return ''
  }
}
