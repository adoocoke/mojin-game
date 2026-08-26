// ===================== 成就系统 =====================
// 生涯统计（跨赛季永久累计）+ 成就定义。达成后可在成就面板领取金币奖励，每项只能领一次。

export interface CareerStats {
  raids: number        // 总对局数
  extracts: number     // 成功撤离
  kills: number        // 总击杀
  bossKills: number    // Boss 击杀
  missions: number     // 完成地图专属任务次数（需成功撤离）
  searches: number     // 搜索容器
  totalValue: number   // 累计带出价值
  maxRaidValue: number // 单局最高带出
  nightRaids: number   // 夜间对局数
  highRiskRaids: number    // 高危禁区对局数
  highRiskExtracts: number // 高危禁区成功撤离
  highRiskBossKills: number// 高危禁区击杀 Boss
}

export const EMPTY_STATS: CareerStats = {
  raids: 0, extracts: 0, kills: 0, bossKills: 0, missions: 0,
  searches: 0, totalValue: 0, maxRaidValue: 0, nightRaids: 0,
  highRiskRaids: 0, highRiskExtracts: 0, highRiskBossKills: 0,
}

const STATS_KEY = 'mojin_stats_v1'
const CLAIM_KEY = 'mojin_ach_claimed'

export function loadStats(): CareerStats {
  try {
    const raw = localStorage.getItem(STATS_KEY)
    if (raw) return { ...EMPTY_STATS, ...(JSON.parse(raw) as Partial<CareerStats>) }
  } catch { /* 忽略 */ }
  return { ...EMPTY_STATS }
}

export function saveStats(s: CareerStats) {
  try { localStorage.setItem(STATS_KEY, JSON.stringify(s)) } catch { /* 忽略 */ }
}

export function loadAchClaimed(): string[] {
  try {
    const raw = localStorage.getItem(CLAIM_KEY)
    if (raw) return JSON.parse(raw) as string[]
  } catch { /* 忽略 */ }
  return []
}

export function saveAchClaimed(ids: string[]) {
  try { localStorage.setItem(CLAIM_KEY, JSON.stringify(ids)) } catch { /* 忽略 */ }
}

export interface AchDef {
  id: string
  icon: string
  name: string
  desc: string
  stat: keyof CareerStats
  target: number
  reward: number
}

export const ACHIEVEMENTS: AchDef[] = [
  { id: 'a_raid1',    icon: '🎖️', name: '初入战区',   desc: '完成 1 场对局',           stat: 'raids',        target: 1,      reward: 300 },
  { id: 'a_raid20',   icon: '🪖', name: '身经百战',   desc: '完成 20 场对局',          stat: 'raids',        target: 20,     reward: 2000 },
  { id: 'a_ext5',     icon: '🚁', name: '撤离专家',   desc: '成功撤离 5 次',           stat: 'extracts',     target: 5,      reward: 1200 },
  { id: 'a_ext15',    icon: '🛩️', name: '逃生大师',   desc: '成功撤离 15 次',          stat: 'extracts',     target: 15,     reward: 3000 },
  { id: 'a_kill30',   icon: '🔫', name: '火力压制',   desc: '累计击杀 30 名敌人',      stat: 'kills',        target: 30,     reward: 2000 },
  { id: 'a_kill100',  icon: '💀', name: '战场死神',   desc: '累计击杀 100 名敌人',     stat: 'kills',        target: 100,    reward: 5000 },
  { id: 'a_boss3',    icon: '👹', name: '巨兽猎手',   desc: '击杀 3 名 Boss',          stat: 'bossKills',    target: 3,      reward: 3500 },
  { id: 'a_mission3', icon: '🎯', name: '任务达人',   desc: '完成 3 次地图专属任务',   stat: 'missions',     target: 3,      reward: 2500 },
  { id: 'a_search50', icon: '📦', name: '搜刮成癖',   desc: '累计搜索 50 个容器',      stat: 'searches',     target: 50,     reward: 2000 },
  { id: 'a_val50k',   icon: '💰', name: '小富即安',   desc: '累计带出价值 50,000',     stat: 'totalValue',   target: 50000,  reward: 4000 },
  { id: 'a_raid20k',  icon: '💎', name: '一夜暴富',   desc: '单局带出价值 20,000',     stat: 'maxRaidValue', target: 20000,  reward: 5000 },
  { id: 'a_night5',   icon: '🌙', name: '夜行者',     desc: '完成 5 场夜间对局',       stat: 'nightRaids',   target: 5,      reward: 2500 },
  // ===== 高危禁区系列 =====
  { id: 'a_hr_ext1',  icon: '☠️', name: '禁区初探',   desc: '高危禁区成功撤离 1 次',   stat: 'highRiskExtracts', target: 1,  reward: 4000 },
  { id: 'a_hr_ext5',  icon: '💀', name: '禁区常客',   desc: '高危禁区成功撤离 5 次',   stat: 'highRiskExtracts', target: 5,  reward: 9000 },
  { id: 'a_hr_boss1', icon: '👑', name: '禁区屠龙',   desc: '高危禁区击杀 1 名 Boss',  stat: 'highRiskBossKills', target: 1, reward: 6000 },
]

export interface RaidRecord {
  extracted: boolean
  kills: number
  bossKills: number
  missionDone: boolean
  searches: number
  raidValue: number
  night: boolean
  highRisk: boolean
}

/** 对局结算时累计生涯统计 */
export function recordCareer(s: CareerStats, r: RaidRecord): CareerStats {
  s.raids += 1
  if (r.extracted) s.extracts += 1
  s.kills += r.kills
  s.bossKills += r.bossKills
  if (r.missionDone && r.extracted) s.missions += 1
  s.searches += r.searches
  if (r.extracted) {
    s.totalValue += r.raidValue
    s.maxRaidValue = Math.max(s.maxRaidValue, r.raidValue)
  }
  if (r.night) s.nightRaids += 1
  if (r.highRisk) {
    s.highRiskRaids += 1
    if (r.extracted) s.highRiskExtracts += 1
    s.highRiskBossKills += r.bossKills
  }
  saveStats(s)
  return s
}

/** 已达成但尚未领取的成就 */
export function unlockedUnclaimed(s: CareerStats, claimed: string[]): AchDef[] {
  return ACHIEVEMENTS.filter(a => !claimed.includes(a.id) && s[a.stat] >= a.target)
}
