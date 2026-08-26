import type { Grid, ItemInstance } from './types'
import { RARITY_ORDER } from './types'
import { itemValue } from './types'
import { ITEMS, makeItem } from './data'
import { makeGrid, autoPlace, defOf, removeItem } from './inventory'
import { stashDims } from './quests'

const KEY = 'mojin_stash_v1'
const SEED_KEY = 'mojin_seed_reds_20260824'
const NEW_REDS = [
  'v_ruby', 'v_fang', 'v_compass', 'v_seal', 'v_flute', 'v_mask',
  'v_bell', 'v_warrior', 'v_cannon', 'v_piano', 'v_sarc', 'v_sat',
] as const

interface StoredPlaced { defId: string; count: number; x: number; y: number; dur?: number }

export function loadStash(): Grid {
  const [curCols, curRows] = stashDims()
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return seedNewReds(makeGrid(curCols, curRows))

    const data = JSON.parse(raw) as { placed: StoredPlaced[]; cols?: number; rows?: number }
    // 取保存尺寸和当前尺寸的最大值（只扩不缩，防止物品丢失）
    const cols = Math.max(data.cols ?? curCols, curCols)
    const rows = Math.max(data.rows ?? curRows, curRows)
    const grid = makeGrid(cols, rows)
    let uid = 0

    for (const p of data.placed) {
      const def = ITEMS[p.defId]
      if (!def) continue
      if (p.x < 0 || p.y < 0 || p.x + def.w > cols || p.y + def.h > rows) continue
      grid.placed.push({
        item: { uid: `st${uid++}_${p.defId}`, defId: p.defId, rarity: def.rarity, count: p.count, ...(p.dur !== undefined ? { dur: p.dur } : {}) },
        x: p.x, y: p.y,
      })
    }
    return seedNewReds(grid)
  } catch {
    return seedNewReds(makeGrid(curCols, curRows))
  }
}

function seedNewReds(grid: Grid): Grid {
  try {
    if (localStorage.getItem(SEED_KEY) === '1') return grid
    let added = 0
    for (const id of NEW_REDS) {
      if (!ITEMS[id]) continue
      if (grid.placed.some(p => p.item.defId === id)) continue
      if (autoPlace(grid, makeItem(id))) added++
    }
    localStorage.setItem(SEED_KEY, '1')
    if (added) saveStash(grid)
  } catch { /* ignore */ }
  return grid
}

export function saveStash(grid: Grid) {
  const placed: StoredPlaced[] = grid.placed.map(p => ({
    defId: p.item.defId,
    count: p.item.count,
    x: p.x,
    y: p.y,
    ...(p.item.dur !== undefined ? { dur: p.item.dur } : {})
  }))
  // 保存时同时记录当前尺寸，用于加载时兼容
  localStorage.setItem(KEY, JSON.stringify({ placed, cols: grid.cols, rows: grid.rows }))
}

/** 战利品入库，返回放不下的数量 */
export function addToStash(grid: Grid, items: ItemInstance[]): number {
  let overflow = 0
  for (const item of items) {
    if (!autoPlace(grid, item)) overflow += item.count
  }
  saveStash(grid)
  return overflow
}

export function stashValue(grid: Grid): number {
  let sum = 0
  for (const p of grid.placed) sum += itemValue(defOf(p.item)) * p.item.count
  return sum
}

export function clearStash(): Grid {
  const [cols, rows] = stashDims()
  const g = makeGrid(cols, rows)
  saveStash(g)
  return g
}

// ====== 金币（卖物品所得，持久化）======
const MONEY_KEY = 'mojin_money'

export function loadMoney(): number {
  try { return Math.max(0, Number(localStorage.getItem(MONEY_KEY) || 0) || 0) } catch { return 0 }
}

export function saveMoney(v: number) {
  try { localStorage.setItem(MONEY_KEY, String(Math.round(v))) } catch {}
}

/** 从仓库卖掉一件物品（整组），返回卖得的金币；物品不存在返回 null */
export function sellFromStash(grid: Grid, uid: string): number | null {
  const p = removeItem(grid, uid)
  if (!p) return null
  saveStash(grid)
  return itemValue(defOf(p.item)) * p.item.count
}

/** 一键整理：按品级→价值从高到低重新紧凑摆放，返回新格子（放不下则原样返回） */
export function sortStash(grid: Grid): Grid {
  const g = makeGrid(grid.cols, grid.rows)
  const items = grid.placed.map(p => p.item)
  items.sort((a, b) => {
    const ra = RARITY_ORDER.indexOf(a.rarity), rb = RARITY_ORDER.indexOf(b.rarity)
    if (rb !== ra) return rb - ra
    return itemValue(defOf(b)) * b.count - itemValue(defOf(a)) * a.count
  })
  for (const it of items) if (!autoPlace(g, it)) return grid
  saveStash(g)
  return g
}

/** 批量出售全部变卖物，返回出售件数与总金币 */
export function sellAllValuables(grid: Grid): { n: number; value: number } {
  const targets = grid.placed.filter(p => defOf(p.item).kind === 'valuable').map(p => p.item.uid)
  let n = 0, value = 0
  for (const uid of targets) {
    const p = removeItem(grid, uid)
    if (p) { n++; value += itemValue(defOf(p.item)) * p.item.count }
  }
  if (targets.length) saveStash(grid)
  return { n, value }
}
