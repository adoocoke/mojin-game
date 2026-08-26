import type { Grid, ItemInstance, PlacedItem } from './types'
import { itemValue } from './types'
import { ITEMS } from './data'

export function makeGrid(cols: number, rows: number): Grid {
  return { cols, rows, placed: [] }
}

export function defOf(item: ItemInstance) {
  return ITEMS[item.defId]
}

/** 检查 (x,y) 放置 w×h 是否与已有物品重叠、是否越界 */
export function canPlace(grid: Grid, w: number, h: number, x: number, y: number, ignoreUid?: string): boolean {
  if (x < 0 || y < 0 || x + w > grid.cols || y + h > grid.rows) return false
  for (const p of grid.placed) {
    if (ignoreUid && p.item.uid === ignoreUid) continue
    const d = defOf(p.item)
    const overlap = x < p.x + d.w && x + w > p.x && y < p.y + d.h && y + h > p.y
    if (overlap) return false
  }
  return true
}

/** 自动寻找第一个可放位置 */
export function findSpot(grid: Grid, w: number, h: number): { x: number; y: number } | null {
  for (let y = 0; y <= grid.rows - h; y++) {
    for (let x = 0; x <= grid.cols - w; x++) {
      if (canPlace(grid, w, h, x, y)) return { x, y }
    }
  }
  return null
}

/** 尝试合并堆叠，返回剩余数量 */
export function mergeStacks(grid: Grid, item: ItemInstance): number {
  const def = defOf(item)
  if (!def.stack) return item.count
  let remaining = item.count
  for (const p of grid.placed) {
    if (remaining <= 0) break
    if (p.item.defId === item.defId && p.item.rarity === item.rarity && p.item.count < def.stack) {
      const add = Math.min(def.stack - p.item.count, remaining)
      p.item.count += add
      remaining -= add
    }
  }
  return remaining
}

/** 自动放入：先堆叠再寻位。成功返回 true */
export function autoPlace(grid: Grid, item: ItemInstance): boolean {
  const def = defOf(item)
  const remaining = mergeStacks(grid, item)
  if (remaining <= 0) return true
  if (remaining !== item.count) {
    // 部分堆叠后剩余作为新物品
    const rest: ItemInstance = { ...item, count: remaining }
    const spot = findSpot(grid, def.w, def.h)
    if (!spot) return true // 已尽量堆叠，剩余丢弃视为成功部分
    grid.placed.push({ item: rest, x: spot.x, y: spot.y })
    return true
  }
  const spot = findSpot(grid, def.w, def.h)
  if (!spot) return false
  grid.placed.push({ item, x: spot.x, y: spot.y })
  return true
}

export function placeAt(grid: Grid, item: ItemInstance, x: number, y: number): boolean {
  const def = defOf(item)
  if (!canPlace(grid, def.w, def.h, x, y, item.uid)) return false
  const existing = grid.placed.find(p => p.item.uid === item.uid)
  if (existing) { existing.x = x; existing.y = y }
  else grid.placed.push({ item, x, y })
  return true
}

export function removeItem(grid: Grid, uid: string): PlacedItem | null {
  const idx = grid.placed.findIndex(p => p.item.uid === uid)
  if (idx < 0) return null
  return grid.placed.splice(idx, 1)[0]
}

export function findPlaced(grid: Grid, uid: string): PlacedItem | null {
  return grid.placed.find(p => p.item.uid === uid) ?? null
}

/** 点击格子 (x,y) 命中哪个物品 */
export function hitTest(grid: Grid, x: number, y: number): PlacedItem | null {
  for (const p of grid.placed) {
    const d = defOf(p.item)
    if (x >= p.x && x < p.x + d.w && y >= p.y && y < p.y + d.h) return p
  }
  return null
}

/** 计算网格总价值 */
export function gridValue(grid: Grid): number {
  let sum = 0
  for (const p of grid.placed) {
    const d = defOf(p.item)
    sum += itemValue(d, p.item.rarity) * p.item.count
  }
  return sum
}

export function cloneGrid(g: Grid): Grid {
  return { cols: g.cols, rows: g.rows, placed: g.placed.map(p => ({ item: { ...p.item }, x: p.x, y: p.y })) }
}
