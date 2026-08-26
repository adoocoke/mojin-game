// ===================== 赛季通行证 =====================
// 每个赛季（按月份）一条 30 级的通行证：对局获得经验（与干员经验同源），
// 每 150 经验升 1 级。每级奖励金币（100×等级），第 5/10/15/20/25/30 级额外送物资（直接入仓库）。
// 奖励需要手动在通行证面板领取；赛季跨月自动重置。

import { ITEMS, makeItem } from './data'
import { loadStash, saveStash } from './stash'
import { autoPlace } from './inventory'
import { seasonKey, seasonName } from './quests'

export const BP_MAX_LV = 30
export const BP_XP_PER_LV = 150

export interface BpLevelReward {
  money: number
  item?: { defId: string; count: number }
}

/** 每级奖励：金币 100×等级；里程碑级别送稀有物资 */
export function bpReward(lv: number): BpLevelReward {
  const milestones: Record<number, { defId: string; count: number }> = {
    5: { defId: 'm_medkit', count: 2 },
    10: { defId: 'w_sks', count: 1 },
    15: { defId: 'v_goldbar', count: 1 },
    20: { defId: 'w_m4a1', count: 1 },
    25: { defId: 'v_diamond', count: 1 },
    30: { defId: 'w_awm', count: 1 },
  }
  return { money: 100 * lv, item: milestones[lv] }
}

export interface BpState {
  season: string
  xp: number
  claimed: number[] // 已领取的等级
}

const KEY = 'mojin_bp_v1'

export function loadBp(): BpState {
  const cur = seasonKey()
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const s = JSON.parse(raw) as BpState
      if (s.season === cur && Array.isArray(s.claimed)) return s
    }
  } catch { /* 忽略 */ }
  const fresh: BpState = { season: cur, xp: 0, claimed: [] }
  saveBp(fresh)
  return fresh
}

export function saveBp(s: BpState) {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* 忽略 */ }
}

export function bpLevel(xp: number): number {
  return Math.min(BP_MAX_LV, Math.floor(xp / BP_XP_PER_LV))
}

/** 当前等级进度 0~1 */
export function bpProgress(xp: number): number {
  if (bpLevel(xp) >= BP_MAX_LV) return 1
  return (xp % BP_XP_PER_LV) / BP_XP_PER_LV
}

/** 对局结算时加经验；返回 {before, after} 等级，after>before 表示升级了 */
export function gainBpXp(s: BpState, xp: number): { before: number; after: number } {
  const before = bpLevel(s.xp)
  s.xp += xp
  saveBp(s)
  return { before, after: bpLevel(s.xp) }
}

/** 可领取的等级列表 */
export function claimable(s: BpState): number[] {
  const lv = bpLevel(s.xp)
  const out: number[] = []
  for (let i = 1; i <= lv; i++) if (!s.claimed.includes(i)) out.push(i)
  return out
}

/**
 * 领取某级奖励：金币加到 money，物资入仓库（放不下的物资会丢弃并返回 false 中的 overflow）。
 * 返回实际发放内容描述；等级未到/已领返回 null。
 */
export function claimBp(s: BpState, lv: number): { money: number; itemName?: string; overflow: boolean } | null {
  if (lv > bpLevel(s.xp) || s.claimed.includes(lv)) return null
  const r = bpReward(lv)
  let overflow = false
  let itemName: string | undefined
  if (r.item) {
    const stash = loadStash()
    const it = makeItem(r.item.defId, r.item.count)
    if (autoPlace(stash, it)) {
      saveStash(stash)
      itemName = ITEMS[r.item.defId].name + (r.item.count > 1 ? ` ×${r.item.count}` : '')
    } else {
      overflow = true // 仓库满：物资放弃，但金币照发
    }
  }
  s.claimed.push(lv)
  saveBp(s)
  return { money: r.money, itemName, overflow }
}

export { seasonName as bpSeasonName }
