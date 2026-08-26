import { useMemo } from 'react'
import { engine, useUI } from '@/game/store'
import {
  BP_MAX_LV, BP_XP_PER_LV, bpLevel, bpProgress, bpReward,
  claimable, loadBp, bpSeasonName,
} from '@/game/battlepass'
import { ITEMS } from '@/game/data'
import { RARITY_INFO } from '@/game/types'

/** 赛季通行证面板 */
export function PassPanel() {
  const ui = useUI()
  const bp = useMemo(() => (ui.passOpen ? loadBp() : null), [ui.passOpen, ui.money])
  if (!ui.passOpen || !bp) return null

  const lv = bpLevel(bp.xp)
  const prog = bpProgress(bp.xp)
  const canClaim = claimable(bp)

  return (
    <div className="absolute inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-sm" onClick={() => engine.closePass()}>
      <div
        className="max-w-2xl w-full mx-auto my-8 rounded-xl border border-violet-600/40 bg-zinc-950/95 p-5 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xl font-black text-violet-300">🎫 赛季通行证</h2>
          <button onClick={() => engine.closePass()} className="text-zinc-500 hover:text-zinc-200 text-xl px-2">✕</button>
        </div>
        <div className="text-xs text-zinc-400 mb-3">{bpSeasonName()} · 对局获得经验即可升级（与干员经验同源），跨月自动重置</div>

        {/* 等级与经验条 */}
        <div className="rounded-lg border border-violet-600/30 bg-zinc-900/70 p-3 mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-lg font-black text-violet-200">Lv.{lv}<span className="text-xs text-zinc-500 font-normal"> / {BP_MAX_LV}</span></span>
            <span className="text-xs font-mono text-zinc-400">
              {lv >= BP_MAX_LV ? '已满级' : `${bp.xp % BP_XP_PER_LV} / ${BP_XP_PER_LV} 经验`}
            </span>
          </div>
          <div className="h-2 rounded bg-black/50 overflow-hidden">
            <div className="h-full bg-violet-400" style={{ width: `${prog * 100}%` }} />
          </div>
          {canClaim.length > 0 && (
            <button
              onClick={() => engine.claimAllBp()}
              className="mt-2.5 w-full py-2 rounded-md bg-violet-500 hover:bg-violet-400 text-black text-sm font-black transition-all hover:scale-[1.01]"
            >
              一键领取 {canClaim.length} 级奖励
            </button>
          )}
        </div>

        {/* 等级列表 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {Array.from({ length: BP_MAX_LV }, (_, i) => i + 1).map(l => {
            const r = bpReward(l)
            const reached = l <= lv
            const claimed = bp.claimed.includes(l)
            const itemDef = r.item ? ITEMS[r.item.defId] : null
            return (
              <div
                key={l}
                className={`rounded-lg border px-2.5 py-2 ${claimed
                  ? 'border-zinc-800 bg-zinc-900/40 opacity-60'
                  : reached
                    ? 'border-violet-500/60 bg-violet-500/10'
                    : 'border-zinc-800 bg-zinc-900/40'}`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-black ${reached ? 'text-violet-300' : 'text-zinc-500'}`}>Lv.{l}</span>
                  {claimed
                    ? <span className="text-[10px] text-zinc-600">已领取</span>
                    : reached
                      ? <button
                          onClick={() => engine.claimBp(l)}
                          className="text-[10px] font-black text-black bg-violet-400 hover:bg-violet-300 rounded px-1.5 py-0.5"
                        >领取</button>
                      : <span className="text-[10px] text-zinc-600">未达成</span>}
                </div>
                <div className="text-[11px] text-yellow-300/90 font-mono mt-1">+{r.money.toLocaleString()} 金币</div>
                {itemDef && (
                  <div className="text-[11px] mt-0.5 truncate" style={{ color: RARITY_INFO[itemDef.rarity].color }}>
                    {itemDef.icon} {itemDef.name}{r.item!.count > 1 ? ` ×${r.item!.count}` : ''}
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
