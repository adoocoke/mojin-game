/** 摸金名规则（#17）：纯函数，前后端共用同一套约束。 */

export const EXPLORER_NAME_MIN = 1
export const EXPLORER_NAME_MAX = 12
export const EXPLORER_LS_KEY = 'mojin_explorer_name'

export function normalizeExplorerName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim()
}

export function explorerNameKey(name: string): string {
  return normalizeExplorerName(name).toLowerCase()
}

export function validateExplorerName(raw: string): { ok: true; name: string; key: string } | { ok: false; error: string } {
  const name = normalizeExplorerName(raw)
  if (!name) return { ok: false, error: '先取一个摸金名' }
  if ([...name].length > EXPLORER_NAME_MAX) return { ok: false, error: `名字最多 ${EXPLORER_NAME_MAX} 个字` }
  if (/^[_\-·.\s]+$/.test(name)) return { ok: false, error: '名字需要有字' }
  if (/[\n\r\t]/.test(name)) return { ok: false, error: '名字不能换行' }
  return { ok: true, name, key: explorerNameKey(name) }
}

export function readSavedExplorerName(): string {
  try {
    if (typeof localStorage === 'undefined') return ''
    return normalizeExplorerName(localStorage.getItem(EXPLORER_LS_KEY) || '')
  } catch {
    return ''
  }
}

export function saveExplorerName(name: string): void {
  try {
    if (typeof localStorage === 'undefined') return
    const n = normalizeExplorerName(name)
    if (n) localStorage.setItem(EXPLORER_LS_KEY, n)
  } catch { /* private mode */ }
}

export function clearExplorerName(): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.removeItem(EXPLORER_LS_KEY)
  } catch { /* ignore */ }
}
