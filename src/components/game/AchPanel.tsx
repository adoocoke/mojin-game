import { useMemo } from 'react'
import { engine, useUI } from '@/game/store'
import { ACHIEVEMENTS, loadAchClaimed, loadStats, type AchDef } from '@/game/achievements'

function AchCard({ a, cur, claimed }: { a: AchDef; cur: number; claimed: boolean }) {
  const p = Math.min(cur, a.target)
  const ratio = Math.min(1, p / a.target)
  const unlocked = cur >= a.target
  return (
    <div className={`rounded-lg border px-3 py-2 ${claimed
      ? 'border-zinc-800 bg-zinc-900/40 opacity-60'
      : unlocked
        ? 'border-amber-500/60 bg-amber-500/10'
        : 'border-zinc-700 bg-zinc-900/50'}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-bold text-zinc-200">{a.icon} {a.name}</div>
        {claimed
          ? <span className="text-zinc-600 text-xs shrink-0">已领取</span>
          : unlocked
            ? <button
                onClick={() => engine.claimAch(a.id)}
                className="text-xs font-black text-black bg-amber-400 hover:bg-amber-300 rounded px-2 py-0.5 shrink-0"
              >领取 +{a.reward.toLocaleString()}</button>
            : <span className="text-yellow-300/70 text-xs font-mono shrink-0">+{a.reward.toLocaleString()} 金币</span>}
      </div>
      <div className="text-[11px] text-zinc-400 mt-0.5">{a.desc}</div>
      <div className="flex items-center gap-2 mt-1">
        <div className="flex-1 h-1.5 rounded bg-black/50 overflow-hidden">
          <div className={`h-full ${claimed ? 'bg-zinc-600' : unlocked ? 'bg-amber-400' : 'bg-cyan-400'}`} style={{ width: `${ratio * 100}%` }} />
        </div>
        <span className="text-[10px] font-mono text-zinc-400">{p.toLocaleString()}/{a.target.toLocaleString()}</span>
      </div>
    </div>
  )
}

/** 成就面板（生涯统计 + 成就领取） */
export function AchPanel() {
  const ui = useUI()
  const data = useMemo(() => {
    if (!ui.achOpen) return null
    return { stats: loadStats(), claimed: loadAchClaimed() }
  }, [ui.achOpen, ui.money])
  if (!ui.achOpen || !data) return null
  const { stats, claimed } = data
  const doneCount = ACHIEVEMENTS.filter(a => claimed.includes(a.id)).length

  const statLine: [string, number][] = [
    ['对局', stats.raids], ['撤离', stats.extracts], ['击杀', stats.kills],
    ['Boss', stats.bossKills], ['专属任务', stats.missions], ['搜索', stats.searches],
  ]

  return (
    <div className="absolute inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-sm" onClick={() => engine.closeAch()}>
      <div
        className="max-w-2xl w-full mx-auto my-8 rounded-xl border border-amber-600/40 bg-zinc-950/95 p-5 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xl font-black text-amber-300">🏆 成就</h2>
          <button onClick={() => engine.closeAch()} className="text-zinc-500 hover:text-zinc-200 text-xl px-2">✕</button>
        </div>
        <div className="text-xs text-zinc-400 mb-3">生涯统计跨赛季永久累计 · 已领取 {doneCount}/{ACHIEVEMENTS.length}</div>

        {/* 生涯统计条 */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 mb-4 text-[11px] text-zinc-400">
          {statLine.map(([k, v]) => (
            <span key={k}>{k} <span className="text-zinc-200 font-mono font-bold">{v.toLocaleString()}</span></span>
          ))}
          <span>累计带出 <span className="text-yellow-300 font-mono font-bold">{stats.totalValue.toLocaleString()}</span></span>
          <span>单局最高 <span className="text-yellow-300 font-mono font-bold">{stats.maxRaidValue.toLocaleString()}</span></span>
        </div>

        <div className="flex flex-col gap-2">
          {ACHIEVEMENTS.map(a => (
            <AchCard key={a.id} a={a} cur={stats[a.stat]} claimed={claimed.includes(a.id)} />
          ))}
        </div>
      </div>
    </div>
  )
}
