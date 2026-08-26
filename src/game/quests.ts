// ====================== 赛季任务系统 ======================
// 每月一个赛季，分 4 个阶段；每阶段有主线与支线任务。
// 完成主线解锁下一阶段，并在第 1/3/4 阶段扩容保险箱：2 格 → 4 格 → 9 格 → 12 格。
// 支线任务奖励金币。赛季进度按月份存档，跨月自动重置。

// ====================== 仓库扩充任务系统（永久进度，不随赛季重置）======================
export interface StashQuestDef {
  id: string
  name: string
  desc: string
  stat: StatKey
  target: number
  cols: number
  rows: number
  icon: string
}

export const STASH_QUESTS: StashQuestDef[] = [
  { id: 'q_stash_1', name: '仓库升级 I',   desc: '累计击杀 30 名敌人',         stat: 'kills',      target: 30,     cols: 12, rows: 14, icon: '🔫' },
  { id: 'q_stash_2', name: '仓库升级 II',  desc: '累计成功撤离 15 次',         stat: 'extracts',   target: 15,     cols: 14, rows: 16, icon: '🚁' },
  { id: 'q_stash_3', name: '仓库升级 III', desc: '累计带出价值 100,000',       stat: 'totalValue', target: 100000, cols: 16, rows: 18, icon: '💰' },
  { id: 'q_stash_4', name: '仓库升级 IV',  desc: '累计击杀 10 名 Boss',        stat: 'bossKills',  target: 10,     cols: 18, rows: 20, icon: '👹' },
  { id: 'q_stash_5', name: '仓库升级 V',   desc: '累计带出 3 件红色物品',       stat: 'redPlus',    target: 3,      cols: 20, rows: 22, icon: '❤️' },
  { id: 'q_stash_6', name: '无限仓库',     desc: '累计搜索 100 个容器',         stat: 'searches',   target: 100,    cols: 99, rows: 99, icon: '♾️' },
]

const STASH_KEY = 'mojin_stash_quests_v1'

export interface StashProgress {
  prog: Record<string, number>
  done: Record<string, boolean>
}

export function loadStashProgress(): StashProgress {
  try {
    const raw = localStorage.getItem(STASH_KEY)
    if (raw) return JSON.parse(raw) as StashProgress
  } catch { /* 忽略 */ }
  return { prog: {}, done: {} }
}

export function saveStashProgress(sp: StashProgress) {
  try { localStorage.setItem(STASH_KEY, JSON.stringify(sp)) } catch { /* 忽略 */ }
}

/** 当前仓库等级（0=默认 10×12, 1~6=升级） */
export function stashLv(): number {
  const sp = loadStashProgress()
  let lv = 0
  for (let i = 0; i < STASH_QUESTS.length; i++) {
    if (sp.done[STASH_QUESTS[i].id]) lv = i + 1
  }
  return lv
}

/** 当前仓库尺寸 [cols, rows] */
export function stashDims(): [number, number] {
  const lv = stashLv()
  if (lv === 0) return [10, 12]
  return [STASH_QUESTS[lv - 1].cols, STASH_QUESTS[lv - 1].rows]
}

/** 是否已解锁无限仓库 */
export function isInfiniteStash(): boolean {
  return stashLv() >= STASH_QUESTS.length
}

/** 取进行中的仓库扩充任务 */
export function trackedStashQuests(): { q: StashQuestDef; cur: number }[] {
  const sp = loadStashProgress()
  const out: { q: StashQuestDef; cur: number }[] = []
  for (const q of STASH_QUESTS) {
    if (sp.done[q.id]) continue
    if (q.id === 'q_stash_6') {
      const prevDone = STASH_QUESTS.slice(0, 5).every(pq => sp.done[pq.id])
      if (!prevDone) continue
    }
    const cur = sp.prog[q.id] ?? 0
    out.push({ q, cur: Math.min(cur, q.target) })
  }
  return out
}

export type StatKey =
  | 'kills'        // 累计击杀
  | 'bossKills'    // 累计击杀 Boss
  | 'extracts'     // 累计成功撤离
  | 'raidValue'    // 单局带出价值（取最大值）
  | 'totalValue'   // 累计带出价值
  | 'searches'     // 累计搜索容器
  | 'doorsOpened'  // 累计刷卡开门
  | 'purplePlus'   // 累计带出紫色及以上物品件数
  | 'cyanPlus'     // 累计带出青色及以上
  | 'redPlus'      // 累计带出红色
  | 'themeActions' // 当季主题行动次数（消毒/劫车/复电）
  | 'scout'        // 跑图调查：抵达指定地图现场并按 F 交互（见 story.ts 的 SCOUT_SPOTS）

export interface QuestDef {
  id: string
  phase: 1 | 2 | 3 | 4
  main: boolean     // true 主线 / false 支线
  icon: string
  name: string
  desc: string
  stat: StatKey
  target: number
  reward: number    // 金币
}

export const QUESTS: QuestDef[] = [
  // ---------- 第一阶段（保险箱 2 格起步，完成主线 → 4 格） ----------
  { id: 'q_m1_1', phase: 1, main: true,  icon: '🏃', name: '初次撤离',   desc: '成功撤离 1 次',         stat: 'extracts',   target: 1,    reward: 500 },
  { id: 'q_m1_2', phase: 1, main: true,  icon: '🔫', name: '初露锋芒',   desc: '累计击杀 5 名敌人',      stat: 'kills',        target: 5,    reward: 500 },
  { id: 'q_m1_3', phase: 1, main: true,  icon: '💰', name: '小有收获',   desc: '单局带出价值 3,000',     stat: 'raidValue',    target: 3000,  reward: 800 },
  { id: 'q_s1_1', phase: 1, main: false, icon: '📦', name: '勤快搜刮',   desc: '累计搜索 10 个容器',     stat: 'searches',     target: 10,    reward: 300 },
  { id: 'q_s1_2', phase: 1, main: false, icon: '💵', name: '万元户',     desc: '累计带出价值 10,000',    stat: 'totalValue',   target: 10000, reward: 400 },

  // ---------- 第二阶段（完成主线解锁第三阶段） ----------
  { id: 'q_m2_1', phase: 2, main: true,  icon: '⚔️', name: '老练猎手',   desc: '累计击杀 12 名敌人',     stat: 'kills',        target: 12,   reward: 600 },
  { id: 'q_m2_2', phase: 2, main: true,  icon: '👹', name: '首领挑战',   desc: '击杀 1 名 Boss',         stat: 'bossKills',    target: 1,    reward: 1000 },
  { id: 'q_m2_3', phase: 2, main: true,  icon: '🎒', name: '满载而归',   desc: '单局带出价值 8,000',     stat: 'raidValue',    target: 8000,  reward: 800 },
  { id: 'q_m2_4', phase: 2, main: true,  icon: '🚁', name: '稳定发挥',   desc: '累计成功撤离 3 次',      stat: 'extracts',     target: 3,    reward: 600 },
  { id: 'q_s2_1', phase: 2, main: false, icon: '🔑', name: '门禁破解',   desc: '刷卡开门 2 次',          stat: 'doorsOpened',  target: 2,    reward: 300 },
  { id: 'q_s2_2', phase: 2, main: false, icon: '💜', name: '紫色运气',   desc: '带出 2 件紫色及以上物品', stat: 'purplePlus',   target: 2,    reward: 500 },
  { id: 'q_m2_5', phase: 2, main: true,  icon: '📁', name: '黑市中转站', desc: '【剧情】潜入潮汐监狱的「办公楼」，寻找地图的另一半',   stat: 'scout', target: 1, reward: 1000 },
  { id: 'q_s2_3', phase: 2, main: false, icon: '🐫', name: '驿站见闻',   desc: '【剧情】前往沙海古城的「驿站」，打探货物的去向',     stat: 'scout', target: 1, reward: 600 },

  // ---------- 第三阶段（完成主线 → 保险箱 9 格） ----------
  { id: 'q_m3_1', phase: 3, main: true,  icon: '🌾', name: '战场收割',   desc: '累计击杀 25 名敌人',     stat: 'kills',        target: 25,   reward: 800 },
  { id: 'q_m3_2', phase: 3, main: true,  icon: '👹', name: 'Boss 猎手',  desc: '累计击杀 3 名 Boss',     stat: 'bossKills',    target: 3,    reward: 1500 },
  { id: 'q_m3_3', phase: 3, main: true,  icon: '💎', name: '一票大的',   desc: '单局带出价值 15,000',    stat: 'raidValue',    target: 15000, reward: 1000 },
  { id: 'q_s3_1', phase: 3, main: false, icon: '📦', name: '深度搜刮',   desc: '累计搜索 40 个容器',     stat: 'searches',     target: 40,   reward: 400 },
  { id: 'q_s3_2', phase: 3, main: false, icon: '💠', name: '传说之光',   desc: '带出 1 件青色及以上物品', stat: 'cyanPlus',     target: 1,    reward: 800 },
  { id: 'q_m3_4', phase: 3, main: true,  icon: '🏺', name: '沙漠祭坛',   desc: '【剧情】前往沙海古城的「雕像群」，查明暗河会在挖掘什么', stat: 'scout', target: 1, reward: 1200 },
  { id: 'q_s3_3', phase: 3, main: false, icon: '🚚', name: '伏击现场',   desc: '【剧情】勘查雪地南路的「车队残骸」，寻找幸存的运单',   stat: 'scout', target: 1, reward: 700 },

  // ---------- 第四阶段（完成主线 → 保险箱 12 格） ----------
  { id: 'q_m4_1', phase: 4, main: true,  icon: '🏆', name: '战区传奇',   desc: '累计击杀 50 名敌人',     stat: 'kills',        target: 50,   reward: 1000 },
  { id: 'q_m4_2', phase: 4, main: true,  icon: '💰', name: '巨富之路',   desc: '累计带出价值 80,000',    stat: 'totalValue',   target: 80000, reward: 1200 },
  { id: 'q_m4_3', phase: 4, main: true,  icon: '🌟', name: '终极一票',   desc: '单局带出价值 30,000',    stat: 'raidValue',    target: 30000, reward: 1500 },
  { id: 'q_m4_4', phase: 4, main: true,  icon: '🚁', name: '常胜将军',   desc: '累计成功撤离 8 次',      stat: 'extracts',     target: 8,    reward: 1000 },
  { id: 'q_s4_1', phase: 4, main: false, icon: '❤️', name: '绝世珍品',   desc: '带出 1 件红色物品',      stat: 'redPlus',      target: 1,    reward: 1000 },
  { id: 'q_s4_2', phase: 4, main: false, icon: '🔑', name: '门禁大师',   desc: '累计刷卡开门 6 次',      stat: 'doorsOpened',  target: 6,    reward: 500 },
  { id: 'q_m4_5', phase: 4, main: true,  icon: '⚱️', name: '法老的字迹', desc: '【剧情】深入沙海古城地下「主墓室」，查看石棺上的刻字', stat: 'scout', target: 1, reward: 1500 },
  { id: 'q_s4_3', phase: 4, main: false, icon: '📡', name: '加密频道',   desc: '【剧情】登上雪地「雷达站」二层主控台，监听加密频道',   stat: 'scout', target: 1, reward: 900 },
]

// ===== 赛季主题任务（P3 #20）：与当前赛季主题联动 =====
import { currentSeasonTheme } from './events'
export function themeQuests(): QuestDef[] {
  const t = currentSeasonTheme()
  const name = t.id === 'infection' ? '消杀行动' : t.id === 'convoy' ? '劫镖行动' : '光明行动'
  const desc = t.id === 'infection' ? '开启 6 个被感染的容器' : t.id === 'convoy' ? '劫掠 2 辆押运车' : '修复 3 个电力装置'
  const target = t.id === 'infection' ? 6 : t.id === 'convoy' ? 2 : 3
  return [
    { id: `q_th_${t.id}_1`, phase: 1, main: false, icon: t.icon, name: `【主题】${name}`, desc, stat: 'themeActions', target, reward: 600 },
    { id: `q_th_${t.id}_2`, phase: 2, main: false, icon: '🏅', name: `【主题】${name}·进阶`, desc: `${desc}（累计）`, stat: 'themeActions', target: target * 3, reward: 1000 },
  ]
}

function allQuests(): QuestDef[] { return [...QUESTS, ...themeQuests()] }

// 保险箱等级 → 格子尺寸与格数: 1=2格 2=4格 3=9格 4=12格
export const SAFE_DIMS: Record<number, [number, number]> = { 1: [2, 1], 2: [2, 2], 3: [3, 3], 4: [4, 3] }
export const SAFE_CELLS: Record<number, number> = { 1: 2, 2: 4, 3: 9, 4: 12 }
// 完成第 N 阶段全部主线后升到哪个保险箱等级
const PHASE_SAFE_LV: Record<number, number> = { 1: 2, 3: 3, 4: 4 }

export interface SeasonProgress {
  season: string
  prog: Record<string, number>
  done: Record<string, boolean>
}

export function loadSeason(): SeasonProgress {
  const cur = seasonKey()
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const s = JSON.parse(raw) as SeasonProgress
      if (s.season === cur && s.prog && s.done) return s
    }
  } catch { /* 忽略 */ }
  // 新赛季（或首次）：清零重来
  const fresh: SeasonProgress = { season: cur, prog: {}, done: {} }
  saveSeason(fresh)
  return fresh
}

export function saveSeason(s: SeasonProgress) {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* 忽略 */ }
}

function mainsOf(phase: number): QuestDef[] {
  return QUESTS.filter(q => q.phase === phase && q.main)
}

/** 某阶段是否已解锁：第一阶段默认解锁，其余需完成上一阶段全部主线 */
export function phaseUnlocked(s: SeasonProgress, phase: number): boolean {
  if (phase <= 1) return true
  return mainsOf(phase - 1).every(q => s.done[q.id])
}

/** 当前推进到的阶段（已解锁的最高阶段） */
export function currentPhase(s: SeasonProgress): number {
  let p = 1
  for (let i = 2; i <= 4; i++) if (phaseUnlocked(s, i)) p = i
  return p
}

/** 当前保险箱等级（1=2格 ... 4=12格） */
export function safeLv(s: SeasonProgress): number {
  let lv = 1
  for (const [ph, target] of Object.entries(PHASE_SAFE_LV)) {
    if (mainsOf(Number(ph)).every(q => s.done[q.id])) lv = Math.max(lv, target)
  }
  return lv
}

export interface RaidStats {
  kills: number
  bossKills: number
  extracted: boolean
  raidValue: number    // 本局带出价值（含保险箱）
  searches: number
  doorsOpened: number
  purplePlus: number
  cyanPlus: number
  redPlus: number
  themeActions: number
  scouts: string[]      // 本局完成交互的调查任务 id 列表（跑图任务）
}

export interface RaidQuestResult {
  completed: QuestDef[]
  newPhase: number | null    // 新解锁的阶段
  safeUp: number | null       // 保险箱扩容到的新等级
  stashUp: number | null     // 仓库扩容到的新等级
}

/** 对局结算时推进任务进度；返回本场新完成的任务与解锁 */
export function recordRaid(s: SeasonProgress, stats: RaidStats): RaidQuestResult {
  const completed: QuestDef[] = []
  const phaseBefore = currentPhase(s)
  const safeBefore = safeLv(s)

  const delta = (q: QuestDef): number => {
    switch (q.stat) {
      case 'kills':        return stats.kills
      case 'bossKills':    return stats.bossKills
      case 'extracts':     return stats.extracted ? 1 : 0
      case 'totalValue':   return stats.extracted ? stats.raidValue : 0
      case 'searches':     return stats.searches
      case 'doorsOpened':  return stats.doorsOpened
      case 'purplePlus':   return stats.purplePlus
      case 'cyanPlus':     return stats.cyanPlus
      case 'redPlus':      return stats.redPlus
      case 'themeActions': return stats.themeActions
      case 'scout':        return (stats.scouts ?? []).includes(q.id) ? 1 : 0
      case 'raidValue':    return 0 // raidValue 用 max 语义，单独处理
    }
    return 0
  }

  for (const q of allQuests()) {
    if (s.done[q.id] || !phaseUnlocked(s, q.phase)) continue
    if (q.stat === 'raidValue') {
      // 只有成功撤离才算「带出」
      const v = stats.extracted ? stats.raidValue : 0
      s.prog[q.id] = Math.max(s.prog[q.id] ?? 0, v)
    } else {
      s.prog[q.id] = (s.prog[q.id] ?? 0) + delta(q)
    }
    if ((s.prog[q.id] ?? 0) >= q.target) {
      s.done[q.id] = true
      completed.push(q)
    }
  }

  const phaseAfter = currentPhase(s)
  const safeAfter = safeLv(s)
  saveSeason(s)

  // ===== 仓库扩充任务进度（永久保存，不随赛季重置）=====
  const sp = loadStashProgress()
  const stashBefore = stashLv()
  for (const q of STASH_QUESTS) {
    if (sp.done[q.id]) continue
    // 最后一个"无限仓库"需先完成前5个
    if (q.id === 'q_stash_6') {
      const prevDone = STASH_QUESTS.slice(0, 5).every(pq => sp.done[pq.id])
      if (!prevDone) continue
    }

    let d = 0
    switch (q.stat) {
      case 'kills':        d = stats.kills; break
      case 'bossKills':    d = stats.bossKills; break
      case 'extracts':     d = stats.extracted ? 1 : 0; break
      case 'totalValue':   d = stats.extracted ? stats.raidValue : 0; break
      case 'searches':     d = stats.searches; break
      case 'doorsOpened':  d = stats.doorsOpened; break
      case 'purplePlus':   d = stats.purplePlus; break
      case 'cyanPlus':     d = stats.cyanPlus; break
      case 'redPlus':      d = stats.redPlus; break
      case 'themeActions': d = stats.themeActions; break
      case 'scout':        d = 0; break
      case 'raidValue':    d = 0; break
    }
    sp.prog[q.id] = (sp.prog[q.id] ?? 0) + d
    if ((sp.prog[q.id] ?? 0) >= q.target) {
      sp.done[q.id] = true
    }
  }
  saveStashProgress(sp)
  const stashAfter = stashLv()

  return {
    completed,
    newPhase: phaseAfter > phaseBefore ? phaseAfter : null,
    safeUp: safeAfter > safeBefore ? safeAfter : null,
    stashUp: stashAfter > stashBefore ? stashAfter : null,
  }
}

// ====================== 对局内任务追踪（HUD 实时进度）======================
export interface LiveRaid {
  kills: number
  bossKills: number
  searches: number
  doorsOpened: number
  raidValue: number
  purplePlus: number
  cyanPlus: number
  redPlus: number
  themeActions: number
  scouts: string[]      // 本局已完成交互的调查任务 id
}

/** 取进行中的任务（已解锁阶段、未完成），叠加本局实时数据，主线优先、阶段优先 */
export function trackedQuests(s: SeasonProgress, live: LiveRaid, max = 4): { q: QuestDef; cur: number }[] {
  const out: { q: QuestDef; cur: number }[] = []
  for (const q of allQuests()) {
    if (s.done[q.id] || !phaseUnlocked(s, q.phase)) continue
    const saved = s.prog[q.id] ?? 0
    let cur: number
    switch (q.stat) {
      case 'kills':        cur = saved + live.kills; break
      case 'bossKills':    cur = saved + live.bossKills; break
      case 'searches':     cur = saved + live.searches; break
      case 'doorsOpened':  cur = saved + live.doorsOpened; break
      case 'purplePlus':   cur = saved + live.purplePlus; break
      case 'cyanPlus':     cur = saved + live.cyanPlus; break
      case 'redPlus':      cur = saved + live.redPlus; break
      case 'themeActions': cur = saved + live.themeActions; break
      case 'scout':        cur = saved + ((live.scouts ?? []).includes(q.id) ? 1 : 0); break
      case 'raidValue':    cur = Math.max(saved, live.raidValue); break // max 语义
      case 'extracts':     cur = saved; break    // 撤离成功才算，局内不预支
      case 'totalValue':   cur = saved; break    // 同上
    }
    out.push({ q, cur: Math.min(cur, q.target) })
  }
  out.sort((a, b) => a.q.phase - b.q.phase || Number(b.q.main) - Number(a.q.main))
  return out.slice(0, max)
}

const KEY = 'mojin_season_v1'

export function seasonKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function seasonName(d = new Date()): string {
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月赛季`
}

/** 本赛季剩余天数 */
export function seasonDaysLeft(d = new Date()): number {
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 1)
  return Math.max(1, Math.ceil((end.getTime() - d.getTime()) / 86400000))
}
