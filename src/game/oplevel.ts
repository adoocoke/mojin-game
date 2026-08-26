// ===================== 干员技能升级系统 =====================
// 通过对局获得干员经验，提升干员等级（1-5 级），强化主动技能（减冷却/加效果/加时长）。
import type { OperatorDef } from './data'
import type { RaidStats } from './quests'

const KEY = 'mojin_op_xp'
export const MAX_OP_LV = 5
// 升到 2/3/4/5 级所需的累计经验
export const XP_THRESH = [100, 250, 500, 900]

export function loadOpXp(): Record<string, number> {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as Record<string, number>
  } catch { /* 忽略 */ }
  return {}
}

export function saveOpXp(xp: Record<string, number>) {
  try { localStorage.setItem(KEY, JSON.stringify(xp)) } catch { /* 忽略 */ }
}

/** 累计经验 → 等级（1-5） */
export function opLevel(xp: number): number {
  let lv = 1
  for (const t of XP_THRESH) if (xp >= t) lv++
  return Math.min(MAX_OP_LV, lv)
}

/** 等级进度：当前等级、级内进度、到下一级还差多少（满级 next=0） */
export function lvProgress(xp: number): { lv: number; cur: number; next: number } {
  const lv = opLevel(xp)
  if (lv >= MAX_OP_LV) return { lv, cur: 1, next: 0 }
  const base = lv === 1 ? 0 : XP_THRESH[lv - 2]
  const top = XP_THRESH[lv - 1]
  return { lv, cur: (xp - base) / (top - base), next: top - xp }
}

/** 按等级计算技能实际数值（cd 最少 15 秒，护甲减伤上限 85%） */
export function effActive(op: OperatorDef, lv: number): { cd: number; power: number; dur: number; kind: OperatorDef['active']['kind'] } {
  const g = op.growth ?? {}
  const k = lv - 1
  const cd = Math.max(15, op.active.cd + (g.cd ?? 0) * k)
  let power = op.active.power + (g.power ?? 0) * k
  if (op.active.kind === 'armor') power = Math.min(0.85, power)
  const dur = (op.active.dur ?? 0) + (g.dur ?? 0) * k
  return { cd: Math.round(cd), power: Math.round(power * 100) / 100, dur: Math.round(dur * 10) / 10, kind: op.active.kind }
}

/** 单局经验：击杀 +10，Boss +50，成功撤离 +40，带出价值每 1000 +2 */
export function xpForRaid(s: RaidStats): number {
  return s.kills * 10 + s.bossKills * 50 + (s.extracted ? 40 : 0) + Math.floor(s.raidValue / 1000) * 2
}

/** 技能数值的等级成长描述（用于界面预览，如「冷却 40→37s」） */
export function effDesc(op: OperatorDef, lv: number): string {
  const a = effActive(op, lv)
  const parts: string[] = []
  switch (op.active.kind) {
    case 'stun': parts.push(`眩晕 ${a.power}m 内敌人 ${a.dur}s`); break
    case 'heal': parts.push(`恢复 ${a.power} 点生命`); break
    case 'reveal': parts.push(`${a.dur}s 内地图显示敌人`); break
    case 'armor': parts.push(`${a.dur}s 内减伤 ${Math.round(a.power * 100)}%`); break
    case 'invis': parts.push(`隐身 ${a.dur}s`); break
    case 'charge': parts.push(`掷出炸药，${a.dur}s 后爆炸造成 ${a.power} 伤害`); break
    case 'mark': parts.push(`标记 30m 内敌人 ${a.dur}s，受伤 +${Math.round(a.power * 100)}%`); break
    case 'rally': parts.push(`${a.dur}s 内移速+20% 换弹+30% 射速+15%`); break
  }
  parts.push(`冷却 ${a.cd}s`)
  return parts.join(' · ')
}
