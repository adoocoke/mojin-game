import { useSyncExternalStore } from 'react'
import type { Grid, GunDef, ItemInstance, AttSlot } from './types'
import type { MapId } from './world'
import type { QualityId } from './quality'
import { loadQuality, saveQuality } from './quality'

function lsGet(key: string): string | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

// 引擎 → UI 的共享状态
export interface UIState {
  phase: 'menu' | 'playing' | 'dead' | 'extracted'
  hp: number
  maxHp: number
  gun: GunDef | null
  gunRarity: string
  mag: number
  reloading: boolean
  gunAtts: { scope: ItemInstance | null; muzzle: ItemInstance | null; mag: ItemInstance | null; stock: ItemInstance | null; grip: ItemInstance | null; laser: ItemInstance | null }  // 当前武器配件
  kills: number
  prompt: string          // 交互提示
  searching: number       // 0-1 搜索进度，-1 无
  extractProgress: number // 0-1 撤离进度
  backpack: Grid | null
  safebox: Grid | null
  lootGrid: Grid | null   // 当前打开的容器
  lootTitle: string
  invOpen: boolean
  hitMarker: number       // 命中反馈时间戳
  damageFlash: number
  killFeed: string[]
  raidTime: number        // 秒
  resultValue: number
  resultItems: { name: string; rarity: string; value: number; count: number }[]
  resultOverflow: number
  resultOpen: boolean      // 战报弹窗（对局结束后盖在主页上）
  lastRaidExtracted: boolean
  best: number
  money: number          // 金币（仓库卖物品所得）
  stash: Grid | null
  stashOpen: boolean
  toast: string
  toastRarity: string
  toastTs: number
  mapId: MapId          // 当前选择的地图
  mapOpen: boolean      // 对局内地图查看
  playerX: number
  playerZ: number
  playerYaw: number
  mapMarkers: { x: number; z: number; kind: string; name?: string }[]
  mapExtract: { x: number; z: number }
  marketOpen: boolean     // 交易行
  loadoutOpen: boolean    // 战前配装
  carryDefs: string[]     // 选择带入对局的仓库物品 defId
  operator: string        // 当前选择的干员 id
  skillCd: number         // 技能剩余冷却（秒），0 可用
  skillActive: string     // 激活中的技能 kind（'' 无）
  revealEnemies: { x: number; z: number }[]  // 侦察脉冲：地图上显示的敌人位置
  questOpen: boolean      // 赛季任务面板
  passOpen: boolean       // 赛季通行证面板
  achOpen: boolean        // 成就面板
  vsOpen: boolean         // 联机面板（建房/加入）
  vsRoomUrl: string | null  // URL 带入的房间号（好友分享链接）
  vsSession: import('./net').VsSession | null
  vsEnd: 'win' | 'lose' | null  // 对战结算
  vsOpp: { name: string; hp: number } | null  // HUD 对手血条
  resultQuests: string[]  // 本局完成/解锁的任务提示（战报展示）
  lootReveal: Record<string, number>  // 当前战利品逐格揭示时间戳（>now 表示仍在扫描）
  opXp: Record<string, number>  // 各干员累计经验（技能升级）
  raidLive: { searches: number; doors: number; bossKills: number; scouts: string[] }  // 本局实时计数（任务追踪 HUD）
  questHudHide: boolean  // 任务追踪 HUD 折叠（持久化）
  night: boolean         // 夜战模式（持久化，重建世界生效）
  highRisk: boolean      // 高危禁区模式（持久化，敌人更强、出货更好、撤离更难）
  ammoTier: number       // 当前弹匣子弹等级 1-6
  weight: number         // 当前负重 kg
  weightTier: number     // 0 轻载 1 中载 2 重载 3 超载
  vest: { defId: string; dur: number } | null    // 已装备防弹衣
  helmet: { defId: string; dur: number } | null  // 已装备头盔
  gearDefs: { vest: string | null; helmet: string | null }  // 战前配装选择的护甲 defId（持久化）
  tacticalDef: string | null  // 战前配装选择的战术装备 defId（持久化）
  tacUsed: boolean            // 本局战术装备已使用（消耗品，用掉就没）
  tutorial: boolean      // 新手教学模式
  tutorialStep: number   // 教学步骤 0-4
  missionAccepted: boolean // 专属任务已在任务点接取
  missionTimer: number   // 引爆/坚守倒计时（整秒，-1 表示未在计时）
  missionDone: boolean   // 地图专属任务本局已完成
  campOpen: boolean      // 战役章节面板
  campLevelId: string | null // 即将/正在进行的战役关卡
  campObj: string        // 战役当前目标提示（HUD）
  campResult: { win: boolean; title: string; lines: string[] } | null // 战役结算
  inspectDef: string | null // 正在检视的红色物品 defId
  hideoutOpen: boolean      // 藏身处
  quality: QualityId        // 画质档（持久化，重建渲染器生效）
}

export const uiState: UIState = {
  phase: 'menu', hp: 100, maxHp: 100, gun: null, gunRarity: 'white', mag: 0, reloading: false,
  gunAtts: { scope: null, muzzle: null, mag: null, stock: null, grip: null, laser: null },
  kills: 0, prompt: '', searching: -1, extractProgress: -1,
  backpack: null, safebox: null, lootGrid: null, lootTitle: '', invOpen: false,
  hitMarker: 0, damageFlash: 0, killFeed: [], raidTime: 0,
  resultValue: 0, resultItems: [], resultOverflow: 0, resultOpen: false, lastRaidExtracted: false,
  best: Number(lsGet('mojin_best') || 0),
  money: Number(lsGet('mojin_money') || 0),
  stash: null, stashOpen: false,
  toast: '', toastRarity: 'white', toastTs: 0,
  mapId: (lsGet('mojin_map') as MapId) || 'wild',
  mapOpen: false, playerX: 0, playerZ: 0, playerYaw: 0,
  mapMarkers: [], mapExtract: { x: 0, z: 0 },
  marketOpen: false, loadoutOpen: false,
  carryDefs: JSON.parse(lsGet('mojin_loadout') || '[]') as string[],
  operator: lsGet('mojin_operator') || 'assault',
  skillCd: 0, skillActive: '', revealEnemies: [],
  questOpen: false, passOpen: false, achOpen: false, resultQuests: [], lootReveal: {},
  opXp: JSON.parse(lsGet('mojin_op_xp') || '{}') as Record<string, number>,
  raidLive: { searches: 0, doors: 0, bossKills: 0, scouts: [] },
  questHudHide: lsGet('mojin_questhud_hide') === '1',
  night: lsGet('mojin_night') === '1',
  highRisk: lsGet('mojin_highrisk') === '1',
  ammoTier: 1, weight: 0, weightTier: 0, vest: null, helmet: null,
  gearDefs: JSON.parse(lsGet('mojin_gear') || '{"vest":null,"helmet":null}') as { vest: string | null; helmet: string | null },
  tacticalDef: lsGet('mojin_tactical') || null,
  tacUsed: false,
  tutorial: false, tutorialStep: 0,
  missionAccepted: false, missionTimer: -1, missionDone: false,
  vsOpen: false, vsRoomUrl: null, vsSession: null, vsEnd: null, vsOpp: null,
  campOpen: false, campLevelId: null, campObj: '', campResult: null,
  inspectDef: null,
  hideoutOpen: false,
  quality: loadQuality(),
}

type Listener = () => void
const listeners = new Set<Listener>()
let dirty = false
let version = 0

export function notify() {
  if (dirty) return
  dirty = true
  queueMicrotask(() => {
    dirty = false
    version++
    listeners.forEach(l => l())
  })
}

export function useUI(): UIState {
  useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb) } },
    () => version,
    () => version,
  )
  return uiState
}

// UI → 引擎 的指令
export interface EngineAPI {
  start: () => void
  pickupFromLoot: (uid: string) => void
  moveItem: (from: 'backpack' | 'loot' | 'safebox', uid: string, to: 'backpack' | 'loot' | 'safebox', x: number, y: number) => boolean
  takeAllLoot: () => void
  equipWeapon: (uid: string) => void
  useItem: (uid: string) => void
  dropItem: (uid: string) => void
  closeLoot: () => void
  toggleInventory: () => void
  restart: () => void
  toMenu: () => void
  closeResult: () => void
  openStash: () => void
  closeStash: () => void
  stashMove: (uid: string, x: number, y: number) => void
  stashClear: () => void
  sellStashItem: (uid: string) => void
  sortStash: () => void
  sellAllValuables: () => void
  claimBossReward: () => void
  toggleQuestHud: () => void
  // 触屏
  mobileMove: (x: number, y: number, sprint: boolean) => void
  mobileLook: (dx: number, dy: number) => void
  mobileFire: (on: boolean) => void
  mobileAdsToggle: () => void
  mobileReload: () => void
  mobileInteract: () => void
  mobileSwapWeapon: () => void
  selectMap: (id: MapId) => void
  toggleNight: () => void
  toggleHighRisk: () => void
  selectQuality: (id: QualityId) => void
  selectGear: (kind: 'vest' | 'helmet', defId: string | null) => void
  selectTactical: (defId: string | null) => void
  startTutorial: () => void
  toggleMap: () => void
  openMarket: () => void
  closeMarket: () => void
  buyItem: (defId: string) => void
  openLoadout: () => void
  closeLoadout: () => void
  toggleCarry: (defId: string) => void
  selectOperator: (id: string) => void
  useSkill: () => void
  openQuests: () => void
  closeQuests: () => void
  openVs: () => void
  closeVs: () => void
  openCampaign: () => void
  closeCampaign: () => void
  startCampaign: (levelId: string) => void
  closeCampResult: () => void
  inspectItem: (defId: string) => void
  closeInspect: () => void
  openHideout: () => void
  closeHideout: () => void
  vsExit: () => void   // 对战结算后返回大厅
  openPass: () => void
  closePass: () => void
  claimBp: (lv: number) => void
  claimAllBp: () => void
  openAch: () => void
  closeAch: () => void
  claimAch: (id: string) => void
  placeOrder: (defId: string) => void
  cancelOrder: (id: string) => void
  claimOrder: (id: string) => void
  attachMod: (uid: string) => void          // 把背包里的配件装到当前武器
  detachMod: (slot: AttSlot) => void  // 卸下当前武器某槽位配件
}

export const engine: EngineAPI = {
  start: () => {}, vsExit: () => {}, pickupFromLoot: () => {}, moveItem: () => false, takeAllLoot: () => {},
  equipWeapon: () => {}, useItem: () => {}, dropItem: () => {}, closeLoot: () => {},
  toggleInventory: () => {}, restart: () => {},
  toMenu: () => {}, closeResult: () => {}, openStash: () => {}, closeStash: () => {}, stashMove: () => {}, stashClear: () => {}, sellStashItem: () => {}, sortStash: () => {}, sellAllValuables: () => {}, claimBossReward: () => {}, toggleQuestHud: () => {},
  mobileMove: () => {}, mobileLook: () => {}, mobileFire: () => {},
  mobileAdsToggle: () => {}, mobileReload: () => {}, mobileInteract: () => {}, mobileSwapWeapon: () => {},
  selectMap: (id) => {
    if (uiState.phase !== 'menu') return
    localStorage.setItem('mojin_map', id)
    uiState.mapId = id
    notify()
  },
  toggleMap: () => { uiState.mapOpen = !uiState.mapOpen; notify() },
  toggleNight: () => {
    if (uiState.phase !== 'menu') return
    uiState.night = !uiState.night
    localStorage.setItem('mojin_night', uiState.night ? '1' : '0')
    notify()
  },
  toggleHighRisk: () => {
    if (uiState.phase !== 'menu') return
    uiState.highRisk = !uiState.highRisk
    localStorage.setItem('mojin_highrisk', uiState.highRisk ? '1' : '0')
    notify()
  },
  selectQuality: (id) => {
    if (uiState.phase !== 'menu') return
    if (uiState.quality === id) return
    uiState.quality = id
    saveQuality(id)
    notify()
  },
  openMarket: () => {}, closeMarket: () => {}, buyItem: () => {},
  openLoadout: () => {}, closeLoadout: () => {},
  toggleCarry: (defId) => {
    const i = uiState.carryDefs.indexOf(defId)
    if (i >= 0) uiState.carryDefs.splice(i, 1)
    else uiState.carryDefs.push(defId)
    localStorage.setItem('mojin_loadout', JSON.stringify(uiState.carryDefs))
    notify()
  },
  selectOperator: (id) => {
    if (uiState.phase !== 'menu') return
    localStorage.setItem('mojin_operator', id)
    uiState.operator = id
    notify()
  },
  useSkill: () => {},
  selectGear: (kind, defId) => {
    uiState.gearDefs[kind] = defId
    localStorage.setItem('mojin_gear', JSON.stringify(uiState.gearDefs))
    notify()
  },
  selectTactical: (defId) => {
    uiState.tacticalDef = defId
    if (defId) localStorage.setItem('mojin_tactical', defId)
    else localStorage.removeItem('mojin_tactical')
    notify()
  },
  startTutorial: () => {},
  openQuests: () => { uiState.questOpen = true; notify() },
  closeQuests: () => { uiState.questOpen = false; notify() },
  openVs: () => { uiState.vsOpen = true; notify() },
  closeVs: () => { uiState.vsOpen = false; notify() },
  openCampaign: () => { uiState.campOpen = true; notify() },
  closeCampaign: () => { uiState.campOpen = false; notify() },
  startCampaign: () => {},
  closeCampResult: () => { uiState.campResult = null; uiState.campLevelId = null; notify() },
  inspectItem: (defId) => { uiState.inspectDef = defId; notify() },
  closeInspect: () => { uiState.inspectDef = null; notify() },
  openHideout: () => { if (uiState.phase !== 'menu') return; uiState.hideoutOpen = true; notify() },
  closeHideout: () => { uiState.hideoutOpen = false; notify() },
  openPass: () => { uiState.passOpen = true; notify() },
  closePass: () => { uiState.passOpen = false; notify() },
  claimBp: () => {}, claimAllBp: () => {},
  openAch: () => { uiState.achOpen = true; notify() },
  closeAch: () => { uiState.achOpen = false; notify() },
  claimAch: () => {},
  placeOrder: () => {}, cancelOrder: () => {}, claimOrder: () => {},
  attachMod: () => {}, detachMod: () => {},
}
