import { useMemo, useState } from 'react'
import { useUI, engine } from '@/game/store'
import { ITEMS, MARKET_GOODS } from '@/game/data'
import { RARITY_INFO } from '@/game/types'
import { marketBuyPrice } from '@/game/hideout'
import { loadOrders, orderableGoods, ARRIVE_RATE, MAX_ORDERS } from '@/game/orders'

/** 交易行：用卖物资所得的金币购买枪械与辅助物资，买入后直接进仓库 */
export function MarketPanel() {
  const ui = useUI()
  const [tab, setTab] = useState<'buy' | 'order'>('buy')
  const orders = useMemo(() => (ui.marketOpen ? loadOrders() : []), [ui.marketOpen, ui.money])
  if (!ui.marketOpen || ui.phase !== 'menu') return null
  const arrivedCount = orders.filter(o => o.state === 'arrived').length
  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-xl border border-cyan-600/40 bg-zinc-950/95 p-5 shadow-2xl max-h-[92vh] overflow-auto mx-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-black text-cyan-300">🏪 交易行</h2>
            <div className="text-xs text-zinc-500 mt-0.5">用金币购买装备，买入的物资会存入仓库；去「配装」勾选后就能带进对局</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-zinc-500">💰 金币</div>
            <div className="text-lg font-black font-mono text-yellow-300">{ui.money.toLocaleString()}</div>
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setTab('buy')}
            className={`px-4 py-1.5 rounded-md text-sm font-bold ${tab === 'buy' ? 'bg-cyan-500 text-black' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'}`}
          >🛒 购买</button>
          <button
            onClick={() => setTab('order')}
            className={`px-4 py-1.5 rounded-md text-sm font-bold ${tab === 'order' ? 'bg-cyan-500 text-black' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'}`}
          >📦 求购{arrivedCount > 0 && <span className="ml-1 text-emerald-300">({arrivedCount} 到货)</span>}</button>
        </div>

        {tab === 'order' ? <OrderTab orders={orders} /> : (
        <>
        {MARKET_GOODS.map(cat => (
          <div key={cat.category} className="mb-4">
            <div className="text-sm font-bold text-zinc-300 mb-2">{cat.icon} {cat.category}</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {cat.goods.map(g => {
                const def = ITEMS[g.defId]
                const { price, sale, benchOff } = marketBuyPrice(g.price, g.defId)
                const afford = ui.money >= price
                const tagged = sale || benchOff > 0
                return (
                  <div
                    key={g.defId}
                    className="rounded-lg border p-2.5 flex flex-col gap-1.5"
                    style={{ borderColor: RARITY_INFO[def.rarity].color + '55', backgroundColor: RARITY_INFO[def.rarity].bg }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{def.icon}</span>
                      <div className="min-w-0">
                        <div className="font-bold text-sm truncate" style={{ color: RARITY_INFO[def.rarity].color }}>{def.name}</div>
                        <div className="text-[10px] text-zinc-500">{RARITY_INFO[def.rarity].name}{def.kind === 'weapon' ? ' · 武器' : def.heal ? ` · 回复 ${def.heal}` : def.kind === 'attachment' ? ' · 配件' : ' · 弹药'}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => engine.buyItem(g.defId)}
                      disabled={!afford}
                      className={`w-full py-1.5 rounded-md text-sm font-black transition-all ${
                        afford
                          ? 'bg-yellow-500 hover:bg-yellow-400 text-black hover:scale-[1.02]'
                          : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                      }`}
                    >
                      💰 {tagged && <span className="line-through mr-1 opacity-60 font-normal">{g.price.toLocaleString()}</span>}
                      {price.toLocaleString()}
                      {sale && benchOff > 0 ? ' 半价+改装台' : sale ? ' 半价!' : benchOff > 0 ? ` 改装台 -${Math.round(benchOff * 100)}%` : ''}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        </>
        )}
        <button
          className="w-full mt-1 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold"
          onClick={() => engine.closeMarket()}
        >
          关闭
        </button>
      </div>
    </div>
  )
}

/** 求购页签：挂单列表 + 可求购物品 */
function OrderTab({ orders }: { orders: ReturnType<typeof loadOrders> }) {
  const ui = useUI()
  const goods = orderableGoods()
  return (
    <div>
      <div className="text-xs text-zinc-500 mb-3">
        溢价 30% 挂单预付；完成一场对局后每单约 {Math.round(ARRIVE_RATE * 100)}% 概率到货。最多同时 {MAX_ORDERS} 单，未到货可取消（返还一半）。
      </div>

      {orders.length > 0 && (
        <div className="mb-4">
          <div className="text-sm font-bold text-zinc-300 mb-2">📋 我的挂单（{orders.length}/{MAX_ORDERS}）</div>
          <div className="flex flex-col gap-2">
            {orders.map(o => {
              const def = ITEMS[o.defId]
              return (
                <div key={o.id} className="flex items-center gap-3 rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2">
                  <span className="text-2xl">{def.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm" style={{ color: RARITY_INFO[def.rarity].color }}>{def.name}</div>
                    <div className="text-[10px] text-zinc-500 font-mono">挂单价 {o.price.toLocaleString()} 金币</div>
                  </div>
                  {o.state === 'arrived' ? (
                    <button
                      onClick={() => engine.claimOrder(o.id)}
                      className="px-3 py-1.5 rounded-md bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-black"
                    >✓ 到货，领取入仓</button>
                  ) : (
                    <button
                      onClick={() => engine.cancelOrder(o.id)}
                      className="px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-sm font-bold"
                    >运输中 · 取消</button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="text-sm font-bold text-zinc-300 mb-2">🛰️ 可求购物品</div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {goods.map(g => {
          const def = ITEMS[g.defId]
          const afford = ui.money >= g.price
          const dup = orders.some(o => o.defId === g.defId)
          const full = orders.length >= MAX_ORDERS
          return (
            <div
              key={g.defId}
              className="rounded-lg border p-2.5 flex flex-col gap-1.5"
              style={{ borderColor: RARITY_INFO[def.rarity].color + '55', backgroundColor: RARITY_INFO[def.rarity].bg }}
            >
              <div className="flex items-center gap-2">
                <span className="text-2xl">{def.icon}</span>
                <div className="min-w-0">
                  <div className="font-bold text-sm truncate" style={{ color: RARITY_INFO[def.rarity].color }}>{def.name}</div>
                  <div className="text-[10px] text-zinc-500">{RARITY_INFO[def.rarity].name}</div>
                </div>
              </div>
              <button
                onClick={() => engine.placeOrder(g.defId)}
                disabled={!afford || dup || full}
                className={`w-full py-1.5 rounded-md text-sm font-black transition-all ${
                  afford && !dup && !full
                    ? 'bg-cyan-500 hover:bg-cyan-400 text-black hover:scale-[1.02]'
                    : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                }`}
              >
                {dup ? '已挂单' : full ? '挂单已满' : `💰 ${g.price.toLocaleString()}`}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
