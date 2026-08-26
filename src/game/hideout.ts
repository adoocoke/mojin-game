import { ITEMS } from './data'
import { currentEvent, currentSeasonTheme, SEASON_THEMES, type SeasonTheme } from './events'
import { removeItem } from './inventory'
import { loadStash, saveStash, saveMoney } from './stash'
import { loadCampaign, CAMPAIGN } from './campaign'
import { ACHIEVEMENTS, loadAchClaimed, loadStats } from './achievements'
import { uiState, notify } from './store'
import type { Rarity } from './types'

const KEY = 'mojin_hideout_v1'
const SAVE_VERSION = 1
export const DISPLAY_SLOTS = 6
export type HideoutBuildingId = 'bench' | 'med' | 'intel'

export interface HideoutSave {
  version: number
  lv: Record<HideoutBuildingId, number>
  display: (string | null)[]
}

const DEFAULT: HideoutSave = {
  version: SAVE_VERSION,
  lv: { bench: 0, med: 0, intel: 0 },
  display: Array.from({ length: DISPLAY_SLOTS }, () => null),
}

export interface UpgradeCost {
  gold: number
  itemId?: string
}

export interface BuildingDef {
  id: HideoutBuildingId
  icon: string
  name: string
  tag: string
  desc: string[]
  costs: [UpgradeCost, UpgradeCost, UpgradeCost]
}

export const BUILDINGS: BuildingDef[] = [
  {
    id: 'bench',
    icon: '🔧',
    name: '改装台',
    tag: '配件折扣',
    desc: [
      '闲置工作台。升级后，交易行武器配件打折。',
      'Lv.1 配件 9 折',
      'Lv.2 配件 82 折',
      'Lv.3 配件 72 折 · 满级',
    ],
    costs: [
      { gold: 2000 },
      { gold: 8000, itemId: 'v_compass' },
      { gold: 22000, itemId: 'v_sat' },
    ],
  },
  {
    id: 'med',
    icon: '🏥',
    name: '医疗站',
    tag: '开局满状态',
    desc: [
      '简陋担架。升级后，进入战区生命上限提高。',
      'Lv.1 开局生命 +15',
      'Lv.2 开局生命 +30',
      'Lv.3 开局生命 +50 · 满级',
    ],
    costs: [
      { gold: 1500 },
      { gold: 7500, itemId: 'v_ruby' },
      { gold: 20000, itemId: 'v_mask' },
    ],
  },
  {
    id: 'intel',
    icon: '📡',
    name: '情报桌',
    tag: '赛季预告',
    desc: [
      '几张旧报纸。升级后解锁下赛季主题与活动预告。',
      'Lv.1 下月赛季主题预告',
      'Lv.2 下一档限时活动预告',
      'Lv.3 高危简报 · 满级',
    ],
    costs: [
      { gold: 1200 },
      { gold: 6500, itemId: 'v_seal' },
      { gold: 18000, itemId: 'v_flute' },
    ],
  },
]

const BENCH_DISC = [0, 0.1, 0.18, 0.28]
const MED_HP = [0, 15, 30, 50]

function lsGet(key: string): string | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function loadHideout(): HideoutSave {
  try {
    const raw = lsGet(KEY)
    if (!raw) return { ...DEFAULT, lv: { ...DEFAULT.lv }, display: [...DEFAULT.display] }
    const parsed = JSON.parse(raw) as Partial<HideoutSave>
    const lv = { ...DEFAULT.lv, ...(parsed.lv ?? {}) }
    for (const k of Object.keys(lv) as HideoutBuildingId[]) {
      lv[k] = Math.max(0, Math.min(3, Number(lv[k]) || 0))
    }
    const display = Array.from({ length: DISPLAY_SLOTS }, (_, i) => parsed.display?.[i] ?? null)
    return { version: SAVE_VERSION, lv, display }
  } catch {
    return { ...DEFAULT, lv: { ...DEFAULT.lv }, display: [...DEFAULT.display] }
  }
}

export function saveHideout(h: HideoutSave) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...h, version: SAVE_VERSION }))
  } catch { /* quota / private mode */ }
}

export function pruneDisplay(h: HideoutSave): HideoutSave {
  const stash = loadStash()
  const have = new Set(stash.placed.map(p => p.item.defId))
  let dirty = false
  const display = h.display.map(id => {
    if (!id) return null
    const def = ITEMS[id]
    if (!def || def.rarity !== 'red' || !have.has(id)) {
      dirty = true
      return null
    }
    return id
  })
  if (!dirty) return h
  const next = { ...h, display }
  saveHideout(next)
  return next
}

export function benchDiscount(): number {
  return BENCH_DISC[loadHideout().lv.bench] ?? 0
}

export function hideoutMedHp(): number {
  return MED_HP[loadHideout().lv.med] ?? 0
}

/** 交易行实付：军火倾销半价后再叠改装台配件折扣 */
export function marketBuyPrice(base: number, defId: string): {
  price: number
  sale: boolean
  benchOff: number
} {
  const sale = currentEvent().event?.id === 'gunsale'
  let price = sale ? Math.round(base / 2) : base
  const isAtt = ITEMS[defId]?.kind === 'attachment'
  const benchOff = isAtt ? benchDiscount() : 0
  if (benchOff) price = Math.round(price * (1 - benchOff))
  return { price: Math.max(1, price), sale, benchOff }
}

export function nextSeasonTheme(d = new Date()): { theme: SeasonTheme; label: string } {
  const n = new Date(d.getFullYear(), d.getMonth() + 1, 1)
  return {
    theme: currentSeasonTheme(n),
    label: `${n.getFullYear()}年${n.getMonth() + 1}月`,
  }
}

export function intelBrief(lv: number) {
  const now = currentSeasonTheme()
  const next = nextSeasonTheme()
  const ev = currentEvent()
  const upcoming = currentEvent(ev.nextAt + 1)
  return {
    now,
    next: lv >= 1 ? next : null,
    eventNow: ev,
    eventNext: lv >= 2 ? upcoming : null,
    highRisk: lv >= 3 ? highRiskNote(now) : null,
    locked: {
      next: lv < 1,
      eventNext: lv < 2,
      highRisk: lv < 3,
    },
  }
}

function highRiskNote(theme: SeasonTheme): string {
  const extra: Record<SeasonTheme['id'], string> = {
    infection: '高危禁区本季污染容器更多，消毒喷雾优先带入。军用保险库仍是红货最快来源。',
    convoy: '高危押运车队护卫升编，劫车会拉全图仇恨——先清外围再拆箱。',
    blackout: '高危停电夜视野更差，先找配电室再搜刮。红色权重已翻倍，别恋战。',
  }
  return extra[theme.id] ?? SEASON_THEMES[0].desc
}

export function stashHas(defId: string): boolean {
  return loadStash().placed.some(p => p.item.defId === defId)
}

export function redsInStash(): { defId: string; name: string; icon: string }[] {
  const seen = new Set<string>()
  const out: { defId: string; name: string; icon: string }[] = []
  for (const p of loadStash().placed) {
    const def = ITEMS[p.item.defId]
    if (!def || def.rarity !== 'red' || def.kind !== 'valuable' || seen.has(def.id)) continue
    seen.add(def.id)
    out.push({ defId: def.id, name: def.name, icon: def.icon })
  }
  return out.sort((a, b) => ITEMS[b.defId].baseValue - ITEMS[a.defId].baseValue)
}

export function weaponsOnWall(): { defId: string; name: string; icon: string; rarity: Rarity }[] {
  const seen = new Set<string>()
  const out: { defId: string; name: string; icon: string; rarity: Rarity }[] = []
  for (const p of loadStash().placed) {
    const def = ITEMS[p.item.defId]
    if (!def || def.kind !== 'weapon' || seen.has(def.id)) continue
    seen.add(def.id)
    out.push({ defId: def.id, name: def.name, icon: def.icon, rarity: def.rarity })
  }
  const order = ['red', 'cyan', 'purple', 'blue', 'green', 'white']
  out.sort((a, b) => order.indexOf(a.rarity) - order.indexOf(b.rarity))
  return out.slice(0, 8)
}

export function trophyCabinet(): { id: string; icon: string; name: string; got: boolean; hint: string }[] {
  const stashIds = new Set(loadStash().placed.map(p => p.item.defId))
  const camp = loadCampaign()
  const claimed = new Set(loadAchClaimed())
  const stats = loadStats()
  const trophies = CAMPAIGN.map(ch => ({
    id: ch.rewardItem,
    icon: ITEMS[ch.rewardItem]?.icon ?? ch.icon,
    name: ITEMS[ch.rewardItem]?.name ?? ch.title,
    got: Boolean(camp.rewarded?.[ch.chapter]) || stashIds.has(ch.rewardItem),
    hint: ch.title,
  }))
  const achs = ACHIEVEMENTS.filter(a => (stats[a.stat] ?? 0) >= a.target || claimed.has(a.id))
    .slice(0, 6)
    .map(a => ({
      id: a.id,
      icon: a.icon,
      name: a.name,
      got: true,
      hint: a.desc,
    }))
  return [...trophies, ...achs]
}

export function upgradeBuilding(id: HideoutBuildingId): { ok: true; lv: number } | { ok: false; err: string } {
  const def = BUILDINGS.find(b => b.id === id)
  if (!def) return { ok: false, err: '未知建筑' }
  const h = loadHideout()
  const lv = h.lv[id]
  if (lv >= 3) return { ok: false, err: '已满级' }
  const cost = def.costs[lv]
  if (uiState.money < cost.gold) return { ok: false, err: `金币不足（需要 ${cost.gold.toLocaleString()}）` }
  if (cost.itemId) {
    const need = ITEMS[cost.itemId]
    const stash = loadStash()
    const placed = stash.placed.find(p => p.item.defId === cost.itemId)
    if (!placed) return { ok: false, err: `需要上缴 ${need?.icon ?? ''} ${need?.name ?? cost.itemId}` }
    if (placed.item.count > 1) placed.item.count -= 1
    else removeItem(stash, placed.item.uid)
    saveStash(stash)
    uiState.stash = stash
  }
  uiState.money -= cost.gold
  saveMoney(uiState.money)
  h.lv[id] = lv + 1
  saveHideout(pruneDisplay(h))
  notify()
  return { ok: true, lv: lv + 1 }
}

export function setDisplaySlot(slot: number, defId: string | null): { ok: true } | { ok: false; err: string } {
  if (slot < 0 || slot >= DISPLAY_SLOTS) return { ok: false, err: '无效槽位' }
  const h = pruneDisplay(loadHideout())
  if (defId) {
    const def = ITEMS[defId]
    if (!def || def.rarity !== 'red' || def.kind !== 'valuable') return { ok: false, err: '只能陈列红色变卖物' }
    if (!stashHas(defId)) return { ok: false, err: '仓库里没有这件' }
    if (h.display.includes(defId)) return { ok: false, err: '已经摆出来了' }
  }
  h.display[slot] = defId
  saveHideout(h)
  notify()
  return { ok: true }
}
