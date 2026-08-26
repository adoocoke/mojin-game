import { useMemo, useState } from 'react'
import { engine, useUI } from '@/game/store'
import { ITEMS } from '@/game/data'
import { RARITY_INFO } from '@/game/types'
import { fmtCountdown } from '@/game/events'
import {
  BUILDINGS, DISPLAY_SLOTS, intelBrief, loadHideout, pruneDisplay, redsInStash,
  setDisplaySlot, stashHas, trophyCabinet, upgradeBuilding, weaponsOnWall,
  type HideoutBuildingId,
} from '@/game/hideout'

export function HideoutPanel() {
  const ui = useUI()
  const [pickSlot, setPickSlot] = useState<number | null>(null)
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null)
  const tick = ui.money
  const hideout = useMemo(() => pruneDisplay(loadHideout()), [tick, ui.hideoutOpen, ui.stash, pickSlot])
  const reds = useMemo(() => (ui.hideoutOpen ? redsInStash() : []), [ui.hideoutOpen, tick, ui.stash])
  const guns = useMemo(() => (ui.hideoutOpen ? weaponsOnWall() : []), [ui.hideoutOpen, tick, ui.stash])
  const trophies = useMemo(() => (ui.hideoutOpen ? trophyCabinet() : []), [ui.hideoutOpen, tick])
  const brief = useMemo(() => intelBrief(hideout.lv.intel), [hideout.lv.intel, tick])

  if (!ui.hideoutOpen || ui.phase !== 'menu') return null

  const say = (ok: boolean, text: string) => {
    setFlash({ ok, text })
    window.setTimeout(() => setFlash(cur => (cur?.text === text ? null : cur)), 2600)
  }

  const onUpgrade = (id: HideoutBuildingId) => {
    const r = upgradeBuilding(id)
    if (!r.ok) { say(false, r.err); return }
    const b = BUILDINGS.find(x => x.id === id)!
    say(true, `${b.name} 升至 Lv.${r.lv} · ${b.desc[r.lv]}`)
  }

  const onPlace = (defId: string) => {
    if (pickSlot == null) return
    const r = setDisplaySlot(pickSlot, defId)
    if (!r.ok) { say(false, r.err); return }
    setPickSlot(null)
    say(true, `已陈列 ${ITEMS[defId].name}`)
  }

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-black/85 backdrop-blur-sm">
      <div
        className="max-w-5xl w-full mx-auto my-6 rounded-2xl border border-amber-700/40 bg-zinc-950/95 p-4 sm:p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="text-[11px] tracking-[0.35em] text-amber-500/80 font-bold">HOME · HIDEOUT</div>
            <h2 className="text-2xl font-black text-amber-200 mt-0.5">藏身处</h2>
            <p className="text-xs text-zinc-500 mt-1">把红货摆上陈列架，升级工作台——这是你局外唯一的家。</p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[10px] text-zinc-500">金币</div>
            <div className="text-lg font-black font-mono text-yellow-300">{ui.money.toLocaleString()}</div>
            <button
              onClick={() => engine.closeHideout()}
              className="mt-2 min-h-11 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-bold"
            >关闭</button>
          </div>
        </div>

        {flash && (
          <div className={`mb-3 rounded-lg border px-3 py-2 text-sm font-bold ${flash.ok ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200' : 'border-red-500/40 bg-red-500/10 text-red-200'}`}>
            {flash.text}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          {BUILDINGS.map(b => {
            const lv = hideout.lv[b.id]
            const maxed = lv >= 3
            const cost = maxed ? null : b.costs[lv]
            const need = cost?.itemId ? ITEMS[cost.itemId] : null
            const haveItem = !need || stashHas(need.id)
            const can = !maxed && ui.money >= (cost?.gold ?? 0) && haveItem
            return (
              <div key={b.id} className="rounded-xl border border-zinc-700 bg-zinc-900/70 p-3 flex flex-col">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl">{b.icon}</span>
                  <div>
                    <div className="font-black text-zinc-100 leading-tight">{b.name}</div>
                    <div className="text-[10px] text-amber-400/90 font-bold">Lv.{lv} / 3 · {b.tag}</div>
                  </div>
                </div>
                <p className="text-xs text-zinc-400 mb-2 flex-1">{b.desc[lv]}</p>
                <div className="h-1.5 rounded bg-black/50 overflow-hidden mb-2">
                  <div className="h-full bg-amber-400" style={{ width: `${(lv / 3) * 100}%` }} />
                </div>
                {maxed ? (
                  <div className="text-center text-xs font-bold text-amber-300 py-1.5">已满级</div>
                ) : (
                  <button
                    disabled={!can}
                    onClick={() => onUpgrade(b.id)}
                    className={`w-full py-2 rounded-lg text-xs font-black ${can ? 'bg-amber-500 hover:bg-amber-400 text-black' : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'}`}
                  >
                    升级 Lv.{lv + 1} · {cost!.gold.toLocaleString()} 金
                    {need && <span className={haveItem ? 'text-emerald-800' : 'text-red-300'}> + {need.icon}{need.name}</span>}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        <section className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-black text-zinc-200">陈列架 · 红色珍品</h3>
            <span className="text-[10px] text-zinc-500">从仓库挑选红货炫耀，卖掉会自动撤展</span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {hideout.display.map((id, i) => {
              const def = id ? ITEMS[id] : null
              return (
                <button
                  key={i}
                  onClick={() => {
                    if (def) engine.inspectItem(def.id)
                    else setPickSlot(i)
                  }}
                  className="aspect-square rounded-xl border border-dashed border-zinc-700 bg-zinc-900/80 hover:border-amber-500/50 flex flex-col items-center justify-center gap-1 p-1"
                >
                  {def ? (
                    <>
                      <span className="text-3xl leading-none">{def.icon}</span>
                      <span className="text-[10px] font-bold truncate w-full text-center" style={{ color: RARITY_INFO.red.color }}>{def.name}</span>
                    </>
                  ) : (
                    <span className="text-[10px] text-zinc-600 font-bold">空位 {i + 1}</span>
                  )}
                </button>
              )
            })}
          </div>
          {hideout.display.some(Boolean) && (
            <button
              className="mt-2 text-[11px] text-zinc-500 hover:text-zinc-300"
              onClick={() => {
                hideout.display.forEach((id, i) => { if (id) setDisplaySlot(i, null) })
                say(true, '陈列架已清空')
              }}
            >撤下全部展品</button>
          )}
        </section>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          <section>
            <h3 className="text-sm font-black text-zinc-200 mb-2">武器墙</h3>
            {guns.length === 0 ? (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-xs text-zinc-500">仓库里还没有枪。摸一把回来，墙上就会挂上。</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {guns.map(g => (
                  <div
                    key={g.defId}
                    className="rounded-lg border px-2.5 py-1.5 text-sm font-bold"
                    style={{ borderColor: RARITY_INFO[g.rarity].color + '66', color: RARITY_INFO[g.rarity].color, backgroundColor: RARITY_INFO[g.rarity].bg }}
                  >
                    {g.icon} {g.name}
                  </div>
                ))}
              </div>
            )}
          </section>
          <section>
            <h3 className="text-sm font-black text-zinc-200 mb-2">赛季奖杯柜</h3>
            {trophies.length === 0 ? (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-xs text-zinc-500">通关战役章节、领取成就后，奖杯会摆在这里。</div>
            ) : (
              <div className="grid grid-cols-2 gap-1.5">
                {trophies.map(t => (
                  <div key={t.id} className={`rounded-lg border px-2 py-1.5 ${t.got ? 'border-amber-600/40 bg-amber-500/10' : 'border-zinc-800 bg-zinc-900/40 opacity-50'}`}>
                    <div className="text-sm font-bold text-zinc-100 truncate">{t.icon} {t.name}</div>
                    <div className="text-[10px] text-zinc-500 truncate">{t.hint}</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <section className="rounded-xl border border-cyan-700/30 bg-cyan-950/20 p-3">
          <h3 className="text-sm font-black text-cyan-200 mb-2">📡 情报桌</h3>
          <div className="text-sm text-zinc-300 mb-1">
            本赛季 {brief.now.icon} <span className="font-black text-cyan-200">{brief.now.name}</span>
            <span className="text-zinc-500 text-xs ml-2">{brief.now.desc}</span>
          </div>
          {brief.next ? (
            <div className="text-sm text-zinc-300 mb-1">
              下赛季 {brief.next.label} · {brief.next.theme.icon} <span className="font-black text-amber-200">{brief.next.theme.name}</span>
              <span className="text-zinc-500 text-xs ml-2">{brief.next.theme.desc}</span>
            </div>
          ) : (
            <div className="text-xs text-zinc-600 mb-1">升级情报桌 Lv.1 解锁下赛季主题预告</div>
          )}
          {brief.eventNext ? (
            <div className="text-sm text-zinc-300 mb-1">
              下一档活动 {brief.eventNext.event?.icon} <span className="font-black">{brief.eventNext.event?.name}</span>
              <span className="text-zinc-500 text-xs ml-2">{fmtCountdown(brief.eventNow.endsAt - Date.now())} 后轮换 · {brief.eventNext.event?.desc}</span>
            </div>
          ) : (
            <div className="text-xs text-zinc-600 mb-1">升级情报桌 Lv.2 解锁下一档限时活动</div>
          )}
          {brief.highRisk ? (
            <div className="text-xs text-red-300/90 mt-1">☠️ 高危简报：{brief.highRisk}</div>
          ) : (
            <div className="text-xs text-zinc-600">升级情报桌 Lv.3 解锁高危禁区简报</div>
          )}
        </section>
      </div>

      {pickSlot != null && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70">
          <div className="w-full max-w-md rounded-xl border border-amber-600/40 bg-zinc-950 p-4 mx-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-black text-amber-200">选择陈列 · 槽 {pickSlot + 1}</h3>
              <button onClick={() => setPickSlot(null)} className="text-zinc-500">✕</button>
            </div>
            {reds.length === 0 ? (
              <p className="text-sm text-zinc-500">仓库里没有红色变卖物。带出来再来摆。</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto">
                {reds.map(r => {
                  const shown = hideout.display.includes(r.defId)
                  return (
                    <button
                      key={r.defId}
                      disabled={shown}
                      onClick={() => onPlace(r.defId)}
                      className={`rounded-lg border p-2 text-left ${shown ? 'border-zinc-800 text-zinc-600' : 'border-red-500/40 hover:bg-red-500/10'}`}
                    >
                      <span className="text-xl mr-1">{r.icon}</span>
                      <span className="text-sm font-bold" style={{ color: RARITY_INFO.red.color }}>{r.name}</span>
                      {shown && <div className="text-[10px] text-zinc-600">已陈列</div>}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
