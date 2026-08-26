import { useState, useEffect, useRef } from 'react'
import { useUI, engine } from '@/game/store'
import { GridView, DragGhost, gridTotalValue, type DragState, type GridId } from './GridView'
import { ITEMS } from '@/game/data'
import { RARITY_INFO, itemValue } from '@/game/types'
import { findPlaced } from '@/game/inventory'

const SLOT_NAME: Record<string, string> = { scope: '瞄具槽', muzzle: '枪口槽', mag: '弹匣槽', stock: '枪托槽', grip: '握把槽', laser: '镭射槽' }
const ATT_DESC: Record<string, string> = {
  at_rdot: '散布 -20% · 开镜更快',
  at_scope4: '四倍放大 · 散布 -30%',
  at_supp: '枪声惊动范围 42m→12m',
  at_comp: '后坐力 -30% · 散布 -15%',
  at_qmag: '换弹速度 +43%',
  at_emag: '弹容量 +50%',
  at_stock_s: '稳定向：后坐力 -25% · 散布 -8%',
  at_stock_l: '机动向：换弹 +14%，但后坐力 +6%',
  at_grip_v: '稳定向：后坐力 -18%，但散布 +4%',
  at_grip_l: '机动向：散布 -10%，但后坐力 +6%',
  at_laser: '腰射散布 -30%，但枪声惊动 +8m',
  at_laser_r: '腰射散布 -45%，但枪声惊动 +14m',
}

function useCellSize() {
  const calc = () => {
    const w = window.innerWidth
    if (w < 480) return 34
    if (w < 820) return 40
    return 52
  }
  const [cell, setCell] = useState(calc)
  useEffect(() => {
    const h = () => setCell(calc())
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])
  return cell
}

export function InventoryOverlay() {
  const ui = useUI()
  const CELL = useCellSize()
  const [drag, setDrag] = useState<DragState | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const gridEls = useRef<Partial<Record<GridId, HTMLDivElement | null>>>({})

  // 全局拖放落点判定（指针捕获会导致目标格子收不到事件，必须在窗口层判定）
  useEffect(() => {
    if (!drag) return
    const up = (e: PointerEvent) => {
      // 注意：单击选中物品时 drag 存在但 moved=false，此时绝不能清空选中，
      // 否则选中面板会瞬间消失（表现为“丢弃/使用按钮没了”）
      if (drag.moved) {
        const def = ITEMS[drag.item.defId]
        for (const [id, el] of Object.entries(gridEls.current) as [GridId, HTMLDivElement | null][]) {
          if (!el) continue
          const rect = el.getBoundingClientRect()
          if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
            const x = Math.round((e.clientX - rect.left) / CELL - def.w / 2)
            const y = Math.round((e.clientY - rect.top) / CELL - def.h / 2)
            engine.moveItem(drag.from, drag.uid, id, x, y)
            break
          }
        }
        setSelected(null)
      }
      setDrag(null)
    }
    window.addEventListener('pointerup', up)
    return () => window.removeEventListener('pointerup', up)
  }, [drag, CELL])

  if (!ui.invOpen || !ui.backpack) return null

  const handleItemClick = (uid: string, from: GridId) => {
    if (from === 'loot') engine.pickupFromLoot(uid)
    else setSelected(selected === uid ? null : uid)
  }

  const registerEl = (id: GridId, el: HTMLDivElement | null) => {
    gridEls.current[id] = el
  }

  const selPlaced = selected && ui.backpack ? findPlaced(ui.backpack, selected) : null
  const selDef = selPlaced ? ITEMS[selPlaced.item.defId] : null

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-[2px]">
      <div className="flex gap-5 items-start max-h-[92vh] overflow-auto p-2 flex-wrap justify-center">
        {/* 战利品栏 */}
        {ui.lootGrid && (
          <div className="rounded-lg border border-amber-600/40 bg-zinc-950/90 p-4 shadow-2xl">
            <GridView
              grid={ui.lootGrid}
              gridId="loot"
              cell={CELL}
              title={`📦 ${ui.lootTitle}（点击物品拾取）`}
              titleRight={
                <button
                  className="text-xs px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-black font-bold"
                  onClick={() => engine.takeAllLoot()}
                >
                  全部拿取
                </button>
              }
              drag={drag} setDrag={setDrag}
              onItemClick={handleItemClick}
              onEl={registerEl}
              reveal={ui.lootReveal}
            />
            <div className="mt-2 text-right text-xs text-amber-300/90 font-mono">
              估值 {gridTotalValue(ui.lootGrid).toLocaleString()} 金币
            </div>
          </div>
        )}

        {/* 背包 */}
        <div className="rounded-lg border border-zinc-600/60 bg-zinc-950/90 p-4 shadow-2xl">
          <GridView
            grid={ui.backpack}
            gridId="backpack"
            cell={CELL}
            title="🎒 背包 8×9"
            titleRight={<span className="text-xs text-zinc-500">拖动整理 · 点击选择</span>}
            drag={drag} setDrag={setDrag}
            onItemClick={handleItemClick}
            onEl={registerEl}
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-zinc-400 font-mono">背包估值 <span className="text-amber-300">{gridTotalValue(ui.backpack).toLocaleString()}</span> 金币</span>
          </div>

          {/* 选中物品操作 */}
          {selPlaced && selDef && (
            <div className="mt-3 rounded-md border border-zinc-700 bg-zinc-900 p-3 flex items-center gap-3">
              <div className="text-2xl">{selDef.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold" style={{ color: RARITY_INFO[selPlaced.item.rarity].color }}>
                  【{RARITY_INFO[selPlaced.item.rarity].name}】{selDef.name}
                  {selPlaced.item.count > 1 && <span className="text-zinc-400"> ×{selPlaced.item.count}</span>}
                </div>
                <div className="text-xs text-zinc-400">
                  {selDef.kind === 'weapon' && '点击装备替换当前武器（原武器放回背包）'}
                  {selDef.kind === 'med' && `恢复 ${selDef.heal} 点生命`}
                  {selDef.kind === 'valuable' && '贵重物品，撤离后结算'}
                  {selDef.kind === 'ammo' && '弹药补给，撤离后结算'}
                  {selDef.kind === 'attachment' && `${ATT_DESC[selDef.id] ?? '武器配件'}（${SLOT_NAME[selDef.slot!]}）`}
                  　价值 {(itemValue(selDef) * selPlaced.item.count).toLocaleString()}
                </div>
              </div>
              {(selDef.kind === 'weapon' || selDef.kind === 'med') && (
                <button
                  className="text-xs px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold"
                  onClick={() => { engine.useItem(selected!); setSelected(null) }}
                >
                  {selDef.kind === 'weapon' ? '装备' : '使用'}
                </button>
              )}
              {selDef.kind === 'attachment' && (
                <button
                  className="text-xs px-3 py-1.5 rounded bg-violet-600 hover:bg-violet-500 text-white font-bold"
                  onClick={() => { engine.attachMod(selected!); setSelected(null) }}
                >
                  安装
                </button>
              )}
              {selPlaced.item.rarity === 'red' && (
                <button
                  className="text-xs px-3 py-1.5 rounded bg-red-900/80 hover:bg-red-800 text-red-200 font-bold border border-red-500/50"
                  onClick={() => engine.inspectItem(selPlaced.item.defId)}
                >
                  🔍 检视
                </button>
              )}
              <button
                className="text-xs px-3 py-1.5 rounded bg-zinc-700 hover:bg-red-700 text-white"
                onClick={() => { engine.dropItem(selected!); setSelected(null) }}
              >
                丢弃
              </button>
            </div>
          )}
        </div>

        {/* 当前武器配件槽 */}
        {ui.gun && !ui.gun.melee && (
          <div className="rounded-lg border border-violet-700/50 bg-zinc-950/90 p-4 shadow-2xl w-44">
            <div className="text-xs font-bold tracking-widest text-violet-300 mb-2">🔧 {ui.gun.name} · 配件</div>
            <div className="space-y-2">
              {(['scope', 'muzzle', 'mag', 'stock', 'grip', 'laser'] as const).map(slot => {
                const att = ui.gunAtts[slot]
                const def = att ? ITEMS[att.defId] : null
                return (
                  <button
                    key={slot}
                    disabled={!att}
                    onClick={() => engine.detachMod(slot)}
                    title={att ? `${ATT_DESC[def!.id] ?? ''}（点击卸下）` : `${SLOT_NAME[slot]}：空（点击背包里的配件安装）`}
                    className={`w-full rounded-md border px-2 py-1.5 flex items-center gap-2 text-left transition-all ${att
                      ? 'border-violet-500/60 bg-violet-500/10 hover:border-red-400'
                      : 'border-dashed border-zinc-700 bg-zinc-900/40 cursor-default'}`}
                  >
                    <span className="text-lg">{def ? def.icon : '＋'}</span>
                    <div className="min-w-0">
                      <div className="text-[10px] text-zinc-500">{SLOT_NAME[slot]}</div>
                      <div className={`text-xs font-bold truncate ${att ? 'text-violet-200' : 'text-zinc-600'}`}>
                        {def ? def.name : '空'}
                      </div>
                    </div>
                    {att && <span className="ml-auto text-[10px] text-zinc-500">卸下</span>}
                  </button>
                )
              })}
            </div>
            <div className="mt-2 text-[10px] text-zinc-500 leading-snug">配件装在枪上随枪携带，换枪/阵亡都跟着枪走</div>
          </div>
        )}

        {/* 保险箱 */}
        {ui.safebox && (
          <div className="rounded-lg border border-cyan-700/50 bg-zinc-950/90 p-4 shadow-2xl">
            <GridView
              grid={ui.safebox}
              gridId="safebox"
              cell={CELL}
              title="🔒 保险箱 4×3"
              titleRight={<span className="text-[10px] text-cyan-400/80">阵亡也能带出</span>}
              drag={drag} setDrag={setDrag}
              onItemClick={handleItemClick}
              onEl={registerEl}
            />
          </div>
        )}
      </div>

      {/* 关闭按钮 */}
      <button
        className="absolute top-5 right-6 text-zinc-400 hover:text-white text-sm border border-zinc-600 rounded px-3 py-1.5 bg-zinc-900"
        onClick={() => engine.closeLoot()}
      >
        关闭 [Tab]
      </button>

      {drag && drag.moved && <DragGhost drag={drag} cell={CELL} />}
    </div>
  )
}
