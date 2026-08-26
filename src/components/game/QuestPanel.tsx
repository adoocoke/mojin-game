import { useMemo, useState } from 'react'
import { engine, useUI } from '@/game/store'
import {
  QUESTS, loadSeason, seasonName, seasonDaysLeft,
  phaseUnlocked, safeLv, SAFE_CELLS, type QuestDef,
} from '@/game/quests'
import { currentSeasonStory, prevSeasonStory } from '@/game/story'

function QuestCard({ q, prog, done }: { q: QuestDef; prog: number; done: boolean }) {
  const p = Math.min(prog, q.target)
  const ratio = Math.min(1, p / q.target)
  const isValue = q.stat === 'raidValue' || q.stat === 'totalValue'
  return (
    <div className={`rounded-lg border px-3 py-2 ${done
      ? 'border-emerald-500/50 bg-emerald-500/10'
      : q.main ? 'border-amber-600/40 bg-zinc-900/70' : 'border-zinc-700 bg-zinc-900/50'}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-bold text-zinc-200">
          {q.icon} {q.name}
          {q.main
            ? <span className="ml-1.5 text-[10px] text-amber-400 border border-amber-600/40 rounded px-1">主线</span>
            : <span className="ml-1.5 text-[10px] text-zinc-500 border border-zinc-700 rounded px-1">支线</span>}
        </div>
        {done
          ? <span className="text-emerald-400 text-xs font-bold shrink-0">✓ 已完成</span>
          : <span className="text-yellow-300/90 text-xs font-mono shrink-0">+{q.reward.toLocaleString()} 金币</span>}
      </div>
      <div className="text-[11px] text-zinc-400 mt-0.5">{q.desc}</div>
      <div className="flex items-center gap-2 mt-1">
        <div className="flex-1 h-1.5 rounded bg-black/50 overflow-hidden">
          <div className={`h-full ${done ? 'bg-emerald-400' : 'bg-amber-400'}`} style={{ width: `${ratio * 100}%` }} />
        </div>
        <span className="text-[10px] font-mono text-zinc-400">
          {isValue ? `${p.toLocaleString()}/${q.target.toLocaleString()}` : `${p}/${q.target}`}
        </span>
      </div>
    </div>
  )
}

export function QuestPanel() {
  const ui = useUI()
  const [tab, setTab] = useState<number | null>(null)
  const season = useMemo(() => (ui.questOpen ? loadSeason() : null), [ui.questOpen])
  if (!ui.questOpen || !season) return null

  const lv = safeLv(season)
  const sel = tab ?? (() => { for (let p = 4; p >= 1; p--) if (phaseUnlocked(season, p)) return p; return 1 })()
  const quests = QUESTS.filter(q => q.phase === sel)
  const mains = quests.filter(q => q.main)
  const sides = quests.filter(q => !q.main)
  const mainsDone = mains.every(q => season.done[q.id])
  const nextSafe: Record<number, string | null> = { 1: '4 格', 2: null, 3: '9 格', 4: '12 格' }

  return (
    <div className="absolute inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-sm" onClick={() => engine.closeQuests()}>
      <div
        className="max-w-2xl w-full mx-auto my-8 rounded-xl border border-emerald-600/40 bg-zinc-950/95 p-5 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xl font-black text-emerald-300">📋 赛季任务</h2>
          <button onClick={() => engine.closeQuests()} className="text-zinc-500 hover:text-zinc-200 text-xl px-2">✕</button>
        </div>
        <div className="flex items-center justify-between text-xs text-zinc-400 mb-3 flex-wrap gap-2">
          <span>{seasonName()} · 剩余 <span className="text-emerald-300 font-mono">{seasonDaysLeft()}</span> 天（跨月自动重置）</span>
          <span>保险箱：<span className="text-cyan-300 font-bold">{SAFE_CELLS[lv]} 格</span>
            {lv < 4 && <span className="text-zinc-500">（完成第 {lv === 1 ? 1 : lv === 2 ? 3 : 4} 阶段主线可扩容）</span>}
          </span>
        </div>

        {/* ===== 本赛季剧情 ===== */}
        {(() => {
          const story = currentSeasonStory()
          const prev = prevSeasonStory()
          const phaseNow = (() => { for (let p = 4; p >= 1; p--) if (phaseUnlocked(season, p)) return p; return 1 })()
          return (
            <div className="mb-4 rounded-xl border border-purple-500/40 bg-purple-950/30 px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-black text-purple-300">{story.icon} 本赛季剧情 · {story.title}</div>
                <div className="text-[10px] text-purple-400/80">第 {phaseNow}/4 章已解锁</div>
              </div>
              <div className="text-[11px] text-zinc-300 mt-1.5 leading-relaxed">{story.intro}</div>
              <div className="mt-2 space-y-1.5">
                {story.chapters.map((c, i) => {
                  const unlocked = i + 1 <= phaseNow
                  return (
                    <div key={i} className={`text-[11px] leading-relaxed rounded px-2 py-1 ${unlocked ? 'text-zinc-200 bg-purple-500/10' : 'text-zinc-600 bg-black/30'}`}>
                      {unlocked ? c : `🔒 第 ${i + 1} 章 · 完成第 ${i + 1} 阶段主线后解锁`}
                    </div>
                  )
                })}
              </div>
              <div className="mt-2 border-t border-purple-500/20 pt-2 text-[10px] text-zinc-500 leading-relaxed">
                📖 上季回顾（{prev.title}）：{prev.outro}
              </div>
            </div>
          )
        })()}

        {/* 阶段页签 */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[1, 2, 3, 4].map(p => {
            const unlocked = phaseUnlocked(season, p)
            const active = sel === p
            const allMainDone = QUESTS.filter(q => q.phase === p && q.main).every(q => season.done[q.id])
            return (
              <button
                key={p}
                disabled={!unlocked}
                onClick={() => setTab(p)}
                className={`rounded-lg border-2 py-2 text-sm font-black transition-all ${active
                  ? 'border-emerald-400 bg-emerald-400/15 text-emerald-300'
                  : unlocked
                    ? 'border-zinc-700 bg-zinc-900/60 text-zinc-300 hover:border-zinc-500'
                    : 'border-zinc-800 bg-zinc-950 text-zinc-600 cursor-not-allowed'}`}
              >
                {unlocked ? (allMainDone ? '✅' : '📌') : '🔒'} 第 {p} 阶段
              </button>
            )
          })}
        </div>

        {mainsDone && nextSafe[sel] && (
          <div className="mb-3 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-200">
            🎉 本阶段主线全部完成，保险箱已扩容至 {nextSafe[sel]}！
          </div>
        )}

        <div className="text-xs font-bold text-amber-400 mb-1.5 tracking-widest">📕 主线任务（全部完成解锁下一阶段{nextSafe[sel] ? ` · 保险箱扩容至 ${nextSafe[sel]}` : ''}）</div>
        <div className="space-y-2 mb-4">
          {mains.map(q => <QuestCard key={q.id} q={q} prog={season.prog[q.id] ?? 0} done={!!season.done[q.id]} />)}
        </div>

        <div className="text-xs font-bold text-zinc-400 mb-1.5 tracking-widest">📗 支线任务（奖励金币）</div>
        <div className="space-y-2">
          {sides.map(q => <QuestCard key={q.id} q={q} prog={season.prog[q.id] ?? 0} done={!!season.done[q.id]} />)}
        </div>
      </div>
    </div>
  )
}
