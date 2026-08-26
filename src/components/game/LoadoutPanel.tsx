import { useUI, engine } from '@/game/store'
import { ITEMS } from '@/game/data'
import { RARITY_INFO } from '@/game/types'

/** 战前配装：从仓库勾选要带进对局的物资（开局时放入背包，阵亡会丢失） */
export function LoadoutPanel() {
  const ui = useUI()
  if (!ui.loadoutOpen || !ui.stash || ui.phase !== 'menu') return null
  const stash = ui.stash
  const items = [...stash.placed].sort((a, b) => a.y - b.y || a.x - b.x)
  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-xl border border-amber-600/40 bg-zinc-950/95 p-5 shadow-2xl max-h-[92vh] overflow-auto mx-4">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xl font-black text-amber-300">🎒 战前配装</h2>
          <span className="text-xs text-zinc-500">已选 <span className="text-amber-300 font-bold">{ui.carryDefs.length}</span> 件</span>
        </div>
        <p className="text-xs text-zinc-500 mb-3">
          勾选后，开局时这些物资会从仓库移入你的<span className="text-amber-300">背包</span>（枪要带进对局后才能装备）。
          <span className="text-red-400">注意：阵亡会丢失背包里的一切！</span>
        </p>

        {/* 护甲 / 头盔装备槽 */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {(['vest', 'helmet'] as const).map(kind => {
            const sel = ui.gearDefs[kind]
            const options = stash.placed.filter(p => ITEMS[p.item.defId].kind === kind)
            return (
              <div key={kind} className="rounded-lg border border-sky-700/40 bg-zinc-900/60 p-2.5">
                <div className="text-[11px] font-bold text-sky-300 mb-1.5">{kind === 'vest' ? '🦺 防弹衣' : '🪖 头盔'}（开局穿上，阵亡丢失）</div>
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => engine.selectGear(kind, null)}
                    className={`text-left text-xs rounded px-2 py-1 ${!sel ? 'bg-sky-500/20 border border-sky-500/50 text-sky-200' : 'text-zinc-500 hover:bg-zinc-800'}`}
                  >不装备</button>
                  {options.map(p => {
                    const d = ITEMS[p.item.defId]
                    const active = sel === p.item.defId
                    const dur = p.item.dur ?? d.durability ?? 50
                    return (
                      <button
                        key={p.item.uid}
                        onClick={() => engine.selectGear(kind, p.item.defId)}
                        className={`text-left text-xs rounded px-2 py-1 flex items-center gap-1.5 ${active ? 'bg-sky-500/20 border border-sky-500/50' : 'hover:bg-zinc-800 border border-transparent'}`}
                      >
                        <span>{d.icon}</span>
                        <span className="font-bold" style={{ color: RARITY_INFO[p.item.rarity].color }}>{d.name}</span>
                        <span className="text-[10px] text-zinc-500 ml-auto">{d.armorLv}级 · 耐久{Math.round(dur)}</span>
                      </button>
                    )
                  })}
                  {options.length === 0 && <div className="text-[10px] text-zinc-600 px-1">仓库里暂无（交易行有售）</div>}
                </div>
              </div>
            )
          })}
        </div>

        {/* 战术装备槽（与技能并列，T 键使用，消耗品） */}
        {(() => {
          const options = stash.placed.filter(p => ITEMS[p.item.defId].kind === 'tactical')
          const TAC_DESC: Record<string, string> = {
            t_drone: '抛出后标记 30m 范围敌人 10 秒',
            t_mine: '布置在门口/窄道，敌人踩中爆炸并全图标点',
            t_smoke: '掷出后封锁视线 8 秒',
          }
          return (
            <div className="rounded-lg border border-violet-700/40 bg-zinc-900/60 p-2.5 mb-3">
              <div className="text-[11px] font-bold text-violet-300 mb-1.5">🛰️ 战术装备（T 键使用 · 每局限 1 次 · 用掉就没）</div>
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => engine.selectTactical(null)}
                  className={`text-left text-xs rounded px-2 py-1 ${!ui.tacticalDef ? 'bg-violet-500/20 border border-violet-500/50 text-violet-200' : 'text-zinc-500 hover:bg-zinc-800'}`}
                >不携带</button>
                {options.map(p => {
                  const d = ITEMS[p.item.defId]
                  const active = ui.tacticalDef === p.item.defId
                  return (
                    <button
                      key={p.item.uid}
                      onClick={() => engine.selectTactical(p.item.defId)}
                      className={`text-left text-xs rounded px-2 py-1 flex items-center gap-1.5 ${active ? 'bg-violet-500/20 border border-violet-500/50' : 'hover:bg-zinc-800 border border-transparent'}`}
                    >
                      <span>{d.icon}</span>
                      <span className="font-bold" style={{ color: RARITY_INFO[p.item.rarity].color }}>{d.name}</span>
                      <span className="text-[10px] text-zinc-500 ml-auto">{TAC_DESC[p.item.defId] ?? ''}</span>
                    </button>
                  )
                })}
                {options.length === 0 && <div className="text-[10px] text-zinc-600 px-1">仓库里暂无战术装备（交易行「战术装备」分类有售）</div>}
              </div>
            </div>
          )
        })()}

        <div className="max-h-[55vh] overflow-auto rounded-lg border border-zinc-800 divide-y divide-zinc-800/60">
          {items.length === 0 && (
            <div className="p-6 text-center text-zinc-600 text-sm">仓库空空如也——先去对局里摸物资，或到交易行购买</div>
          )}
          {items.map(p => {
            const def = ITEMS[p.item.defId]
            const checked = ui.carryDefs.includes(p.item.defId)
            return (
              <button
                key={p.item.uid}
                onClick={() => engine.toggleCarry(p.item.defId)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${checked ? 'bg-amber-400/10' : 'hover:bg-zinc-900/80'}`}
              >
                <span className={`w-5 h-5 rounded border-2 flex items-center justify-center text-xs font-black ${checked ? 'border-amber-400 bg-amber-400 text-black' : 'border-zinc-600 text-transparent'}`}>✓</span>
                <span className="text-xl">{def.icon}</span>
                <span className="flex-1 min-w-0">
                  <span className="block font-bold text-sm truncate" style={{ color: RARITY_INFO[p.item.rarity].color }}>
                    {def.name}{p.item.count > 1 && <span className="text-zinc-400"> ×{p.item.count}</span>}
                  </span>
                  <span className="block text-[10px] text-zinc-500">
                    {RARITY_INFO[p.item.rarity].name} · {def.kind === 'weapon' ? '武器' : def.kind === 'med' ? '医疗' : def.kind === 'ammo' ? '弹药' : def.kind === 'key' ? '房卡' : def.kind === 'vest' ? '防弹衣' : def.kind === 'helmet' ? '头盔' : def.kind === 'attachment' ? '配件' : '变卖物'}
                  </span>
                </span>
                {checked && <span className="text-[10px] font-bold text-amber-300 shrink-0">带入对局</span>}
              </button>
            )
          })}
        </div>

        <div className="flex gap-3 mt-4">
          <button
            className="flex-1 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold"
            onClick={() => engine.closeLoadout()}
          >
            完成
          </button>
        </div>
      </div>
    </div>
  )
}
