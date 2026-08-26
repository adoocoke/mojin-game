import { useEffect, useRef, useState } from 'react'
import { useUI, engine } from '@/game/store'
import { GridView, DragGhost, type DragState, type GridId } from './GridView'
import { ITEMS, BOSS_DROPS, BOSS_COLLECT_REWARD, loadBossDrops } from '@/game/data'
import { RARITY_INFO, itemValue, type ItemKind } from '@/game/types'
import { stashValue } from '@/game/stash'

const FILTERS: { id: string; name: string; kinds: ItemKind[] }[] = [
  { id: 'all', name: '全部', kinds: [] },
  { id: 'weapon', name: '🔫 武器', kinds: ['weapon'] },
  { id: 'attachment', name: '🧩 配件', kinds: ['attachment'] },
  { id: 'valuable', name: '💎 变卖物', kinds: ['valuable'] },
  { id: 'key', name: '🗝️ 钥匙卡', kinds: ['key'] },
  { id: 'supply', name: '💊 医疗弹药', kinds: ['med', 'ammo'] },
]

/** 主页面仓库：展示已带出的物资，可拖拽整理 */
export function WarehousePanel() {
  const ui = useUI()
  const [drag, setDrag] = useState<DragState | null>(null)
  const [sel, setSel] = useState<string | null>(null) // 选中的物品（待出售）
  const [confirming, setConfirming] = useState(false)
  const [filter, setFilter] = useState('all')
  const [confirmSell, setConfirmSell] = useState(false)
  const confirmTimer = useRef<number>(0)
  const sellTimer = useRef<number>(0)
  const gridEl = useRef<HTMLDivElement | null>(null)
  const CELL = 42

  // 网页预览环境里浏览器原生 confirm 弹窗会被拦截（静默返回“取消”），
  // 所以用两段式按钮代替：第一次点击进入确认态，3 秒内再点一次才真正清空。
  const clickClear = () => {
    if (!confirming) {
      setConfirming(true)
      window.clearTimeout(confirmTimer.current)
      confirmTimer.current = window.setTimeout(() => setConfirming(false), 3000)
      return
    }
    window.clearTimeout(confirmTimer.current)
    setConfirming(false)
    engine.stashClear()
  }

  useEffect(() => {
    if (!drag) return
    const up = (e: PointerEvent) => {
      const el = gridEl.current
      if (el) {
        const rect = el.getBoundingClientRect()
        if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
          const def = ITEMS[drag.item.defId]
          const x = Math.round((e.clientX - rect.left) / CELL - def.w / 2)
          const y = Math.round((e.clientY - rect.top) / CELL - def.h / 2)
          engine.stashMove(drag.uid, x, y)
        }
      }
      setDrag(null)
    }
    window.addEventListener('pointerup', up)
    return () => window.removeEventListener('pointerup', up)
  }, [drag])

  if (!ui.stashOpen || !ui.stash) return null
  const stash = ui.stash
  const selPlaced = sel ? stash.placed.find(p => p.item.uid === sel) ?? null : null
  const selDef = selPlaced ? ITEMS[selPlaced.item.defId] : null
  const selValue = selPlaced && selDef ? itemValue(selDef) * selPlaced.item.count : 0

  // 筛选：只影响显示，拖拽坐标仍基于原仓库格子
  const f = FILTERS.find(x => x.id === filter) ?? FILTERS[0]
  const view = filter === 'all' ? stash : { ...stash, placed: stash.placed.filter(p => f.kinds.includes(ITEMS[p.item.defId]?.kind)) }
  const valuableCount = stash.placed.filter(p => ITEMS[p.item.defId]?.kind === 'valuable').length
  const bossGot = loadBossDrops()
  const bossGotCount = BOSS_DROPS.filter(d => bossGot[d.defId]).length
  const bossClaimed = localStorage.getItem('mojin_boss_claim') === '1'

  // 批量出售变卖物（两段式确认，避免误触）
  const clickSellAll = () => {
    if (!confirmSell) {
      setConfirmSell(true)
      window.clearTimeout(sellTimer.current)
      sellTimer.current = window.setTimeout(() => setConfirmSell(false), 3000)
      return
    }
    window.clearTimeout(sellTimer.current)
    setConfirmSell(false)
    setSel(null)
    engine.sellAllValuables()
  }

  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="rounded-xl border border-amber-600/40 bg-zinc-950/95 p-5 shadow-2xl max-h-[92vh] overflow-auto">
        <div className="flex items-center justify-between mb-3 gap-6">
          <div>
            <h2 className="text-xl font-black text-amber-300">🏦 仓库</h2>
            <div className="text-xs text-zinc-500 mt-0.5">撤离带出的物资都存放在这里（{stash.placed.length} 件）</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-zinc-500">💰 金币</div>
            <div className="text-lg font-black font-mono text-yellow-300">{ui.money.toLocaleString()}</div>
            <div className="text-[10px] text-zinc-500 mt-0.5">存货估值 {stashValue(stash).toLocaleString()}</div>
          </div>
        </div>

        {/* 筛选 + 整理工具栏 */}
        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
          {FILTERS.map(x => (
            <button
              key={x.id}
              onClick={() => setFilter(x.id)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition-colors ${filter === x.id
                ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}
            >
              {x.name}
            </button>
          ))}
          <div className="flex-1" />
          <button
            onClick={() => { setSel(null); engine.sortStash() }}
            className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-cyan-900/60 border border-cyan-700/60 text-cyan-300 hover:bg-cyan-800/60 transition-colors"
          >
            🧹 一键整理
          </button>
          {valuableCount > 0 && (
            <button
              onClick={clickSellAll}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition-colors ${confirmSell
                ? 'bg-yellow-500 text-black border-yellow-300 animate-pulse'
                : 'bg-yellow-900/50 border-yellow-700/60 text-yellow-300 hover:bg-yellow-800/50'}`}
            >
              {confirmSell ? '再点一次确认全卖！' : `💰 全卖变卖物(${valuableCount})`}
            </button>
          )}
        </div>

        <GridView
          grid={view}
          gridId={'stash' as GridId}
          cell={CELL}
          drag={drag}
          setDrag={setDrag}
          onItemClick={(uid) => setSel(s => (s === uid ? null : uid))}
          onEl={(_id, el) => { gridEl.current = el }}
        />
        {filter !== 'all' && view.placed.length === 0 && (
          <div className="text-center text-zinc-600 text-xs py-3">这个分类下没有物品</div>
        )}

        {/* Boss 专属图鉴 */}
        <div className="mt-3 rounded-lg border border-red-900/50 bg-zinc-900/70 p-2.5">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[11px] font-black text-red-300">👑 Boss 专属图鉴</span>
            <span className="text-[10px] text-zinc-500">{bossGotCount}/{BOSS_DROPS.length} · 击杀 Boss 有 1% 概率掉落，带出后点亮</span>
            <div className="flex-1" />
            {bossGotCount === BOSS_DROPS.length && !bossClaimed && (
              <button
                onClick={() => engine.claimBossReward()}
                className="px-2.5 py-1 rounded-md text-[11px] font-black bg-amber-500 text-black hover:bg-amber-400 animate-pulse"
              >
                🏆 领取集齐奖励 +{BOSS_COLLECT_REWARD.toLocaleString()}
              </button>
            )}
            {bossClaimed && <span className="text-[10px] text-amber-500/80">🏆 集齐奖励已领取</span>}
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {BOSS_DROPS.map(d => {
              const def = ITEMS[d.defId]
              const got = !!bossGot[d.defId]
              return (
                <div
                  key={d.defId}
                  title={`${d.boss} 掉落`}
                  className={`rounded-md border px-1.5 py-1 text-center ${got ? 'border-red-500/60 bg-red-950/40' : 'border-zinc-800 bg-zinc-950/60'}`}
                >
                  <div className={`text-base leading-tight ${got ? '' : 'grayscale opacity-30'}`}>{def.icon}</div>
                  <div className={`text-[10px] leading-tight truncate ${got ? 'text-red-200' : 'text-zinc-600'}`}>{def.name}</div>
                  <div className="text-[9px] text-zinc-600 truncate">{d.boss}</div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="mt-2 text-[11px] text-zinc-500">点击物品可出售换金币 · 拖拽可整理位置</div>

        {/* 出售栏 */}
        {selPlaced && selDef && (
          <div className="mt-2 flex items-center gap-3 rounded-lg border border-yellow-600/40 bg-zinc-900/90 p-2.5">
            <div className="text-2xl">{selDef.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="font-bold truncate" style={{ color: RARITY_INFO[selPlaced.item.rarity].color }}>
                {selDef.name}{selPlaced.item.count > 1 && <span className="text-zinc-400"> ×{selPlaced.item.count}</span>}
              </div>
              <div className="text-[10px] text-zinc-500">
                {RARITY_INFO[selPlaced.item.rarity].name} · 单价 {itemValue(selDef).toLocaleString()} 金币
              </div>
            </div>
            <button
              className="px-4 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black font-black text-sm transition-colors"
              onClick={() => { engine.sellStashItem(selPlaced.item.uid); setSel(null) }}
            >
              💰 出售 +{selValue.toLocaleString()}
            </button>
            {selPlaced.item.rarity === 'red' && (
              <button
                className="px-4 py-2 rounded-lg bg-red-900/80 hover:bg-red-800 text-red-200 font-black text-sm border border-red-500/50"
                onClick={() => engine.inspectItem(selPlaced.item.defId)}
              >
                🔎 检视
              </button>
            )}
            <button
              className="px-2.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm"
              onClick={() => setSel(null)}
            >
              ✕
            </button>
          </div>
        )}

        <div className="flex gap-3 mt-4">
          <button
            className="flex-1 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold"
            onClick={() => engine.closeStash()}
          >
            关闭
          </button>
          <button
            className={`py-2.5 px-4 rounded-lg text-sm border transition-colors ${
              confirming
                ? 'bg-red-600 hover:bg-red-500 text-white font-bold border-red-400 animate-pulse'
                : 'bg-red-900/60 hover:bg-red-800 text-red-200 border-red-700/50'
            }`}
            onClick={clickClear}
          >
            {confirming ? '再点一次确认清空！' : '清空仓库'}
          </button>
        </div>
      </div>
      {drag && drag.moved && <DragGhost drag={drag} cell={CELL} />}
    </div>
  )
}
