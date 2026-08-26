// ===================== 剧情战役模式（P3 #23） =====================
// 4 章战役（对应 4 张图），每章 3 关：潜入 → 夺取 → 撤离。
// 每章讲一个 Boss 的故事；通关奖励章节专属纪念变卖物（只此一家）+ 大量金币，可重复刷但奖励递减。
// 战役独立存档进度，不影响摸金主模式经济（不计赛季任务/生涯统计）。

import type { MapId } from './world'

export interface CampaignLevel {
  id: string
  chapter: number     // 1-4
  level: number       // 1-3
  mapId: MapId
  name: string
  stageText: [string, string, string] // 潜入/夺取/撤离 三阶段提示（关卡内叙事）
  targetItem: string      // 本关夺取目标：剧情盒子里的真实变卖物 defId（拿出来、撤离成功就进仓库）
}

export interface CampaignChapter {
  chapter: number
  mapId: MapId
  icon: string
  title: string
  boss: string
  story: string           // 章节剧情简介
  rewardItem: string      // 章节专属纪念变卖物 defId
  rewardGold: number      // 基础金币奖励
  levels: CampaignLevel[]
}

export const CAMPAIGN: CampaignChapter[] = [
  {
    chapter: 1, mapId: 'wild', icon: '⛏️', title: '第一章 · 铁爪之陨', boss: '矿区霸主·铁爪',
    story: '铁爪曾是矿区最好的爆破手。塌方那天，他被埋在井下三天三夜，爬出来时右手换成了铁钩，人心也换成了铁。如今他盘踞废矿，把每一批闯入者当成当年见死不救的工友复仇。你奉命潜入矿区，夺取他的军用布防图。',
    rewardItem: 'c_claw', rewardGold: 3000,
    levels: [
      { id: 'c1l1', chapter: 1, level: 1, mapId: 'wild', name: '潜入矿区', stageText: ['【潜入】摸进矿区腹地，接近铁爪的巢穴。', '【夺取】铁爪的布防图就藏在他的老窝里，找到它。', '【撤离】拿到布防图了！快撤到撤离点！'], targetItem: 'g_c1l1' },
      { id: 'c1l2', chapter: 1, level: 2, mapId: 'wild', name: '井下旧账', stageText: ['【潜入】铁爪加强了戒备，再次潜入矿区。', '【夺取】夺回他私藏的第二份爆破记录。', '【撤离】拿到了！趁铁爪还没反应过来，撤！'], targetItem: 'g_c1l2' },
      { id: 'c1l3', chapter: 1, level: 3, mapId: 'wild', name: '铁爪之陨', stageText: ['【潜入】决战的时刻到了，潜入矿区心脏。', '【夺取】取走铁爪的随身信物，终结这段恩怨。', '【撤离】一切结束了。带着铁爪的故事离开这里。'], targetItem: 'g_c1l3' },
    ],
  },
  {
    chapter: 2, mapId: 'tower', icon: '🗼', title: '第二章 · 典狱长的塔', boss: '塔主·典狱长',
    story: '没有人记得典狱长的名字。高塔禁区曾是战时的最后秩序，他一个人守着整栋塔的犯人，直到外面的世界比塔里更乱。他把钥匙挂在腰上三十年，谁来拿，谁就是他的新犯人。你要登上塔顶，取下那串钥匙。',
    rewardItem: 'c_keys', rewardGold: 3600,
    levels: [
      { id: 'c2l1', chapter: 2, level: 1, mapId: 'tower', name: '塔底风声', stageText: ['【潜入】从高塔底层潜入，躲开巡逻上楼。', '【夺取】典狱长的钥匙串挂在塔顶他的身边。', '【撤离】钥匙到手！趁他拉响警报前撤出去！'], targetItem: 'g_c2l1' },
      { id: 'c2l2', chapter: 2, level: 2, mapId: 'tower', name: '囚徒档案', stageText: ['【潜入】再入高塔，塔里的"犯人"都认得你了。', '【夺取】取回塔顶封存的囚徒档案。', '【撤离】档案到手，快离开这座塔！'], targetItem: 'g_c2l2' },
      { id: 'c2l3', chapter: 2, level: 3, mapId: 'tower', name: '最后秩序', stageText: ['【潜入】最后一次登塔，直面典狱长。', '【夺取】取下那串挂了三十年的钥匙。', '【撤离】塔的门终于全部打开了。撤离！'], targetItem: 'g_c2l3' },
    ],
  },
  {
    chapter: 3, mapId: 'snow', icon: '❄️', title: '第三章 · 白狼的雪盲', boss: '「雪盲」·白狼',
    story: '白狼是雪原上最好的狙击手，直到一次任务中他在暴风雪里瞄准了七十二个小时，雪盲症带走了他大半视力——却留下了野兽般的听觉。雷达站的雪地上，他从不开第二枪。你要穿过他的射界，取回情报芯片。',
    rewardItem: 'c_wolf', rewardGold: 4200,
    levels: [
      { id: 'c3l1', chapter: 3, level: 1, mapId: 'snow', name: '雪原猎场', stageText: ['【潜入】压低身形潜入雷达站，白狼的听觉比眼睛更可怕。', '【夺取】情报芯片在雷达站主楼里，找到它。', '【撤离】芯片到手！在白狼锁定你之前撤离！'], targetItem: 'g_c3l1' },
      { id: 'c3l2', chapter: 3, level: 2, mapId: 'snow', name: '第二枪', stageText: ['【潜入】白狼记住了你的气味，再次潜入雪原。', '【夺取】取回他藏在主楼的第二块芯片。', '【撤离】他从不失手的第二枪就要来了——撤！'], targetItem: 'g_c3l2' },
      { id: 'c3l3', chapter: 3, level: 3, mapId: 'snow', name: '雪盲终章', stageText: ['【潜入】暴风雪之夜，最后的潜入。', '【夺取】取走白狼的测距仪，让他好好睡一觉。', '【撤离】雪原安静了。带着芯片回家。'], targetItem: 'g_c3l3' },
    ],
  },
  {
    chapter: 4, mapId: 'desert', icon: '🏜️', title: '第四章 · 沙之祭司', boss: '沙之祭司·伊姆霍特',
    story: '伊姆霍特为法老守了三千年陵寝，连死亡都没能让他离岗。盗墓者的火把照亮墓道时，他举起祭司杖，黄沙便吞没了整支驼队。如今古城重见天日，你要深入地下陵寝，请这位老祭司——安息。',
    rewardItem: 'c_scarab', rewardGold: 5000,
    levels: [
      { id: 'c4l1', chapter: 4, level: 1, mapId: 'desert', name: '沙海之门', stageText: ['【潜入】穿过神庙入口，潜入地下墓道。', '【夺取】主墓室里供奉着祭司的金色圣物，找到它。', '【撤离】圣物到手！从墓道或暗河撤离！'], targetItem: 'g_c4l1' },
      { id: 'c4l2', chapter: 4, level: 2, mapId: 'desert', name: '陵寝低语', stageText: ['【潜入】再探陵寝，祭司已经察觉了你的来意。', '【夺取】取回墓室深处的第二件圣物。', '【撤离】黄沙开始流动了——快撤！'], targetItem: 'g_c4l2' },
      { id: 'c4l3', chapter: 4, level: 3, mapId: 'desert', name: '祭司安息', stageText: ['【潜入】沙暴将至，最后一次深入陵寝。', '【夺取】取下祭司的圣甲虫护符，让他安息。', '【撤离】墓道在你身后坍塌。撤离，别回头！'], targetItem: 'g_c4l3' },
    ],
  },
]

export interface CampaignSave {
  cleared: Record<string, number> // levelId → 通关次数
  rewarded?: Record<number, boolean> // chapter → 纪念物已发放（整章通关才发）
}

const KEY = 'mojin_campaign_v1'

export function loadCampaign(): CampaignSave {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as CampaignSave
  } catch { /* 忽略 */ }
  return { cleared: {} }
}

export function saveCampaign(s: CampaignSave) {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* 忽略 */ }
}

export function findLevel(id: string): CampaignLevel | undefined {
  for (const ch of CAMPAIGN) for (const lv of ch.levels) if (lv.id === id) return lv
  return undefined
}

export function chapterOf(level: CampaignLevel): CampaignChapter {
  return CAMPAIGN[level.chapter - 1]
}

/** 重复刷奖励递减：首通 100%，之后每次 ×0.3（最低 10%） */
export function clearReward(times: number, gold: number): number {
  if (times <= 0) return gold
  return Math.max(Math.round(gold * 0.1), Math.round(gold * Math.pow(0.3, times)))
}
