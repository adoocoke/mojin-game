// ===================== 定期轮换活动系统 =====================
// 每 2 小时轮换一个活动（按时间窗口确定性选取，所有玩家同一时段看到同一个）
// 空档窗口由系统自动生成一个随机活动填补（随机效果 × 随机名字 × 随机强度），无需人工维护

export interface GameEvent {
  id: 'lucky' | 'goldrush' | 'airdrop' | 'bounty' | 'gunsale' | 'cards' | 'nests' | 'elite' | 'medic'
  icon: string
  name: string
  desc: string       // 主页面展示的效果说明
  power?: number     // 自动生成活动的强度倍率（0.8 / 1.15 / 1.5，手工活动为 1）
}

export const EVENTS: GameEvent[] = [
  { id: 'lucky',    icon: '🎉', name: '狂欢爆率', desc: '所有容器爆率大幅提升，高价值物资触手可得' },
  { id: 'goldrush', icon: '💰', name: '金市上涨', desc: '仓库出售物资获得双倍金币' },
  { id: 'airdrop',  icon: '✈️', name: '空投补给', desc: '每张地图额外出现一批航空箱' },
  { id: 'bounty',   icon: '👑', name: '首领悬赏', desc: '击杀 Boss 额外奖励 1500 金币' },
  { id: 'gunsale',  icon: '🔫', name: '军火倾销', desc: '交易行全场半价，囤枪的绝佳时机' },
  { id: 'cards',    icon: '💳', name: '门禁解禁', desc: '房卡掉落概率翻倍以上，锁房宝藏等你来开' },
  { id: 'nests',    icon: '🥚', name: '百鸟朝凤', desc: '鸟窝大丰收，黄金鸟蛋出现概率大幅提升' },
  { id: 'elite',    icon: '☠️', name: '精英出没', desc: '更强的精英敌人入场，击杀掉落也更加丰厚' },
  { id: 'medic',    icon: '💊', name: '战地医疗', desc: '医疗物资效果提升 50%，战场续航更持久' },
]

// 自动生成活动的名字库（每种效果多个备选名字，组合出“新活动”）
const GEN_NAMES: Record<GameEvent['id'], string[]> = {
  lucky:    ['好运狂潮', '天赐良机', '福星高照', '宝藏时刻'],
  goldrush: ['黄金风暴', '收购狂潮', '金商云集', '溢价时刻'],
  airdrop:  ['补给空投', '军援抵达', '天降补给', '运输航线'],
  bounty:   ['通缉令', '猎首行动', '悬赏翻倍', '围剿令'],
  gunsale:  ['军火大促', '枪械特卖', '清仓甩卖', '军购狂欢'],
  cards:    ['门禁泄露', '钥匙流通', '卡贩出没', '解禁时刻'],
  nests:    ['候鸟迁徙', '金蛋时节', '鸟巢繁盛', '百鸟归林'],
  elite:    ['强敌压境', '精英集结', '猎手对决', '硬核战区'],
  medic:    ['医疗驰援', '战地医院', '特效药剂', '生命线'],
}
// 自动活动的强度档位描述
const POWER_LABEL: Record<number, string> = { 0.8: '小幅', 1.15: '中幅', 1.5: '大幅' }

export const EVENT_WINDOW_MS = 2 * 60 * 60 * 1000 // 2 小时一轮

function mulberry(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 当前活动 + 结束时间戳。空档窗口自动生成一个活动填补，永远不断档 */
export function currentEvent(now = Date.now()): { event: GameEvent | null; endsAt: number; nextAt: number } {
  const win = Math.floor(now / EVENT_WINDOW_MS)
  const endsAt = (win + 1) * EVENT_WINDOW_MS
  // 约 70% 的窗口排手工活动，其余为「空档」→ 自动生成填补
  const handcrafted = mulberry(win * 7919)() < 0.7
  if (handcrafted) {
    const pick = Math.floor(mulberry(win * 104729 + 7)() * EVENTS.length)
    return { event: EVENTS[pick], endsAt, nextAt: endsAt }
  }
  // 自动生成：随机效果 × 随机名字 × 随机强度
  const g = mulberry(win * 524287 + 13)
  const tpl = EVENTS[Math.floor(g() * EVENTS.length)]
  const names = GEN_NAMES[tpl.id]
  const name = names[Math.floor(g() * names.length)]
  const power = [0.8, 1.15, 1.5][Math.floor(g() * 3)]
  return {
    event: {
      ...tpl,
      name,
      power,
      desc: `${tpl.desc}（${POWER_LABEL[power]}强化档）`,
    },
    endsAt, nextAt: endsAt,
  }
}

export function fmtCountdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = s % 60
  return h > 0 ? `${h}时${m}分${ss}秒` : `${m}分${String(ss).padStart(2, '0')}秒`
}

// ===================== 赛季主题玩法轮换（P3 #20） =====================
// 每个赛季（自然月）固定一个主题，按月轮换：感染爆发 → 武装押运 → 停电夜 → ……
export interface SeasonTheme {
  id: 'infection' | 'convoy' | 'blackout'
  icon: string
  name: string
  desc: string
}

export const SEASON_THEMES: SeasonTheme[] = [
  { id: 'infection', icon: '🦠', name: '感染爆发', desc: '部分容器被污染：开箱扣血但出货率翻倍；消毒喷雾可短暂免疫（当季任务围绕主题设计）' },
  { id: 'convoy',    icon: '🚚', name: '武装押运', desc: '局内随机刷 AI 押运车队：劫车得军用物资，但会惊动全图敌人（当季任务围绕主题设计）' },
  { id: 'blackout',  icon: '🌑', name: '停电夜',   desc: '全赛季固定夜战 + 爆率提升；找到配电室可恢复局部照明（当季任务围绕主题设计）' },
]

/** 当前赛季主题（按月份确定性轮换，所有玩家同一赛季同一主题） */
export function currentSeasonTheme(d = new Date()): SeasonTheme {
  const idx = (d.getFullYear() * 12 + d.getMonth()) % SEASON_THEMES.length
  return SEASON_THEMES[idx]
}
