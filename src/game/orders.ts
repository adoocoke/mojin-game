// ===================== 交易行求购单 =====================
// 玩家溢价挂单求购装备/物资；完成一场对局后每张挂单有约 70% 概率到货，
// 到货后在交易行「求购」页签领取入仓库。最多同时挂 4 单。

import { ITEMS, MARKET_GOODS, makeItem } from './data'
import { autoPlace } from './inventory'
import { loadStash, saveStash } from './stash'

export interface BuyOrder {
  id: string
  defId: string
  price: number          // 挂单价（预付，到货不退）
  state: 'pending' | 'arrived'
}

const KEY = 'mojin_orders_v1'
export const MAX_ORDERS = 4
export const ARRIVE_RATE = 0.7

export function loadOrders(): BuyOrder[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as BuyOrder[]
  } catch { /* 忽略 */ }
  return []
}

export function saveOrders(o: BuyOrder[]) {
  try { localStorage.setItem(KEY, JSON.stringify(o)) } catch { /* 忽略 */ }
}

/** 可求购的物品清单：交易行在售品 + 高价值收藏品（平时买不到的） */
export function orderableGoods(): { defId: string; price: number }[] {
  const out: { defId: string; price: number }[] = []
  const seen = new Set<string>()
  for (const cat of MARKET_GOODS) {
    for (const g of cat.goods) {
      if (seen.has(g.defId)) continue
      seen.add(g.defId)
      out.push({ defId: g.defId, price: Math.round(Math.max(g.price, ITEMS[g.defId].baseValue) * 1.3) })
    }
  }
  // 稀有收藏品（求购专属渠道）
  for (const defId of ['v_goldbar', 'v_diamond', 'v_intel', 'v_vase', 'v_watch']) {
    const def = ITEMS[defId]
    if (!def || seen.has(defId)) continue
    seen.add(defId)
    out.push({ defId, price: Math.round(def.baseValue * 1.3) })
  }
  return out
}

/** 查询某物品的求购价 */
export function orderPrice(defId: string): number | null {
  return orderableGoods().find(g => g.defId === defId)?.price ?? null
}

/** 挂单（不处理扣款，由调用方预付）；返回 null 成功，否则是失败原因 */
export function placeOrder(defId: string): string | null {
  const orders = loadOrders()
  if (orders.length >= MAX_ORDERS) return `最多同时挂 ${MAX_ORDERS} 张求购单`
  const price = orderPrice(defId)
  if (price == null) return '该物品不支持求购'
  if (orders.some(o => o.defId === defId)) return '该物品已有挂单'
  orders.push({ id: `o${Date.now()}${Math.floor(Math.random() * 999)}`, defId, price, state: 'pending' })
  saveOrders(orders)
  return null
}

/** 取消未到货的挂单，返还一半金币 */
export function cancelOrder(id: string): number {
  const orders = loadOrders()
  const i = orders.findIndex(o => o.id === id)
  if (i < 0 || orders[i].state !== 'pending') return 0
  const refund = Math.floor(orders[i].price / 2)
  orders.splice(i, 1)
  saveOrders(orders)
  return refund
}

/** 对局结束结算：pending 单按概率到货；返回新到货数量 */
export function arriveOrders(): number {
  const orders = loadOrders()
  let n = 0
  for (const o of orders) {
    if (o.state === 'pending' && Math.random() < ARRIVE_RATE) { o.state = 'arrived'; n++ }
  }
  if (n > 0) saveOrders(orders)
  return n
}

/** 领取到货物品入仓库；返回 true 成功 */
export function claimOrder(id: string): boolean {
  const orders = loadOrders()
  const i = orders.findIndex(o => o.id === id)
  if (i < 0 || orders[i].state !== 'arrived') return false
  const stash = loadStash()
  if (!autoPlace(stash, makeItem(orders[i].defId, 1))) return false
  saveStash(stash)
  orders.splice(i, 1)
  saveOrders(orders)
  return true
}
