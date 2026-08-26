import { engine, useUI } from '@/game/store'
import { CAMPAIGN, loadCampaign, clearReward } from '@/game/campaign'
import { ITEMS } from '@/game/data'
import { useState } from 'react'

/** 剧情战役模式（P3 #23）：4 章 × 3 关，潜入→夺取→撤离，讲 4 个 Boss 的故事 */
export function CampaignScreen() {
  const ui = useUI()
  const [open, setOpen] = useState<number | null>(1)
  if (!ui.campOpen || ui.phase !== 'menu') return null
  const save = loadCampaign()
  const totalCleared = Object.values(save.cleared).reduce((a, b) => a + b, 0)
  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-xl border border-amber-700/40 bg-zinc-950/95 p-5 shadow-2xl max-h-[92vh] overflow-auto mx-4">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xl font-black text-amber-300">📜 剧情战役</h2>
          <button onClick={() => engine.closeCampaign()} className="text-zinc-500 hover:text-zinc-300 text-sm">✕ 关闭</button>
        </div>
        <p className="text-xs text-zinc-500 mb-4">
          4 章战役，每章 3 关：<span className="text-amber-200">潜入 → 夺取 → 撤离</span>。
          每关通关得金币（可重复刷、奖励递减）；<span className="text-red-300">整章 3 关全通</span>才得<span className="text-red-300">章节专属纪念物（只此一家）</span>。
          战役独立存档，不影响摸金主模式经济。已通关 <span className="text-amber-300 font-bold">{totalCleared}</span> 关次。
        </p>
        <div className="flex flex-col gap-3">
          {CAMPAIGN.map(ch => {
            const clearedCount = ch.levels.filter(lv => (save.cleared[lv.id] ?? 0) > 0).length
            const expanded = open === ch.chapter
            return (
              <div key={ch.chapter} className="rounded-lg border border-zinc-700/70 bg-zinc-900/50 overflow-hidden">
                <button
                  onClick={() => setOpen(expanded ? null : ch.chapter)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-800/60"
                >
                  <span className="text-2xl">{ch.icon}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-black text-amber-200">{ch.title}</span>
                    <span className="block text-[11px] text-zinc-500">Boss：{ch.boss} · 进度 {clearedCount}/3</span>
                  </span>
                  <span className="text-xs text-zinc-500">{expanded ? '▲' : '▼'}</span>
                </button>
                {expanded && (
                  <div className="px-4 pb-4">
                    <p className="text-xs text-zinc-400 leading-relaxed border-l-2 border-amber-700/50 pl-3 my-2">{ch.story}</p>
                    <div className="text-[11px] text-zinc-500 mb-2">
                      每关奖励：<span className="text-amber-300">{ch.rewardGold.toLocaleString()} 金币</span>
                      <span className="text-zinc-600">（重复刷递减至 {clearReward(1, ch.rewardGold).toLocaleString()}…）</span>
                      ｜整章 3 关全通：{ITEMS[ch.rewardItem].icon} <span className="text-red-300 font-bold">{ITEMS[ch.rewardItem].name}</span><span className="text-red-400/70">（只此一家）</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {ch.levels.map(lv => {
                        const times = save.cleared[lv.id] ?? 0
                        const prevCleared = lv.level === 1 || (save.cleared[ch.levels[lv.level - 2].id] ?? 0) > 0
                        return (
                          <button
                            key={lv.id}
                            disabled={!prevCleared}
                            onClick={() => engine.startCampaign(lv.id)}
                            className={`rounded-lg border p-2.5 text-left transition-all ${times > 0
                              ? 'border-emerald-600/50 bg-emerald-950/30 hover:scale-[1.02]'
                              : prevCleared
                                ? 'border-amber-600/50 bg-zinc-800/60 hover:scale-[1.02] hover:border-amber-400'
                                : 'border-zinc-800 bg-zinc-900/40 opacity-50 cursor-not-allowed'}`}
                            title={prevCleared ? lv.stageText.join(' ') : '先通关上一关'}
                          >
                            <div className="text-[10px] text-zinc-500">第 {lv.level} 关</div>
                            <div className={`text-sm font-bold ${times > 0 ? 'text-emerald-300' : 'text-amber-200'}`}>{lv.name}</div>
                            <div className="text-[10px] mt-0.5">
                              {times > 0 ? <span className="text-emerald-400">✓ 已通关 ×{times}</span> : prevCleared ? <span className="text-zinc-500">未通关 · 点击出战</span> : <span className="text-zinc-600">🔒 未解锁</span>}
                            </div>
                            <div className="text-[10px] mt-0.5 text-zinc-400 truncate" title={`夺取目标：${ITEMS[lv.targetItem].name}`}>
                              夺取：{ITEMS[lv.targetItem].icon} {ITEMS[lv.targetItem].name}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/** 战役结算覆盖层 */
export function CampaignResultOverlay() {
  const ui = useUI()
  if (!ui.campResult) return null
  const r = ui.campResult
  return (
    <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/75 backdrop-blur-sm">
      <div className={`w-full max-w-md rounded-xl border p-6 shadow-2xl bg-zinc-950/95 ${r.win ? 'border-emerald-500/50' : 'border-red-500/50'}`}>
        <h2 className={`text-3xl font-black text-center mb-1 ${r.win ? 'text-emerald-300' : 'text-red-400'}`}>
          {r.win ? '战役胜利' : '战役失败'}
        </h2>
        <p className="text-center text-zinc-400 text-sm mb-4">{r.title}</p>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 divide-y divide-zinc-800/60 mb-4">
          {r.lines.map((l, i) => <div key={i} className="px-3 py-2 text-sm text-zinc-200">{l}</div>)}
        </div>
        <button
          onClick={() => engine.closeCampResult()}
          className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-black"
        >
          返回主页面
        </button>
      </div>
    </div>
  )
}
