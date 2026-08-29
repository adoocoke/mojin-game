// @ts-check
/** Mirrors src/lib/explorer-name.ts — keep in sync. */

export const EXPLORER_NAME_MAX = 12

export function normalizeExplorerName(raw) {
  return String(raw ?? '').replace(/\s+/g, ' ').trim()
}

export function explorerNameKey(name) {
  return normalizeExplorerName(name).toLowerCase()
}

export function validateExplorerName(raw) {
  const name = normalizeExplorerName(raw)
  if (!name) return { ok: false, error: '先取一个摸金名' }
  if ([...name].length > EXPLORER_NAME_MAX) return { ok: false, error: `名字最多 ${EXPLORER_NAME_MAX} 个字` }
  if (/^[_\-·.\s]+$/.test(name)) return { ok: false, error: '名字需要有字' }
  if (/[\n\r\t]/.test(name)) return { ok: false, error: '名字不能换行' }
  return { ok: true, name, key: explorerNameKey(name) }
}
