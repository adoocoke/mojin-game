import type { Grid, ItemInstance } from '@/game/types'
import { RARITY_INFO, itemValue } from '@/game/types'
import { ITEMS } from '@/game/data'

export type GridId = 'backpack' | 'loot' | 'safebox'

export interface DragState {
  uid: string
  from: GridId
  item: ItemInstance
  px: number  // 指针位置
  py: number
  startX: number
  startY: number
  moved: boolean
}

interface Props {
  grid: Grid
  gridId: GridId
  cell: number
  title?: string
  titleRight?: React.ReactNode
  drag: DragState | null
  setDrag: (d: DragState | null) => void
  onItemClick: (uid: string, from: GridId) => void
  onEl?: (id: GridId, el: HTMLDivElement | null) => void
  reveal?: Record<string, number>  // 逐格揭示：uid → 揭示时间戳（>now 为扫描中）
}

export function GridView({ grid, gridId, cell, title, titleRight, drag, setDrag, onItemClick, onEl, reveal }: Props) {
  return (
    <div className="select-none">
      {title && (
        <div className="flex items-center justify-between mb-1.5">
          <div className="text-xs font-bold tracking-widest text-zinc-400">{title}</div>
          <div>{titleRight}</div>
        </div>
      )}
      <div
        ref={(el) => onEl?.(gridId, el)}
        className="relative rounded-md border border-zinc-700/80 bg-zinc-900/70"
        style={{ width: grid.cols * cell, height: grid.rows * cell }}
        onPointerMove={(e) => {
          if (!drag) return
          const dx = e.clientX - drag.startX
          const dy = e.clientY - drag.startY
          if (!drag.moved && Math.hypot(dx, dy) > 6) drag.moved = true
          setDrag({ ...drag, px: e.clientX, py: e.clientY })
        }}
        onPointerUp={() => {
          if (!drag) return
          // 点击（未拖动）：拾取/选择；拖放的落点由上层全局判定
          if (!drag.moved) onItemClick(drag.uid, drag.from)
        }}
      >
        {/* 背景格 */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(255,255,255,0.055) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.055) 1px, transparent 1px)',
            backgroundSize: `${cell}px ${cell}px`,
          }}
        />
        {/* 物品 */}
        {grid.placed.map((p) => {
          const def = ITEMS[p.item.defId]
          const r = RARITY_INFO[p.item.rarity]
          const isDragging = drag?.uid === p.item.uid
          const hidden = reveal ? (reveal[p.item.uid] ?? 0) > Date.now() : false
          // 扫描中：只显示格子与旋转放大镜，不显示物品（可拖到但不能交互）
          if (hidden) {
            return (
              <div
                key={p.item.uid}
                className="absolute rounded-sm border flex items-center justify-center overflow-hidden"
                style={{
                  left: p.x * cell + 1, top: p.y * cell + 1,
                  width: def.w * cell - 2, height: def.h * cell - 2,
                  borderColor: r.color + '88', backgroundColor: '#0c0d10',
                  boxShadow: `inset 0 0 14px ${r.color}22`,
                }}
              >
                <span
                  className="animate-spin inline-block"
                  style={{ fontSize: Math.min(cell * 0.4 * Math.min(def.w, def.h), 22), animationDuration: '1.1s', filter: `drop-shadow(0 0 6px ${r.color})` }}
                >🔍</span>
              </div>
            )
          }
          return (
            <div
              key={p.item.uid}
              className="absolute rounded-sm border flex flex-col items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing transition-shadow hover:brightness-125"
              style={{
                left: p.x * cell + 1, top: p.y * cell + 1,
                width: def.w * cell - 2, height: def.h * cell - 2,
                borderColor: r.color, backgroundColor: r.bg,
                boxShadow: `inset 0 0 12px ${r.bg}, 0 0 6px ${r.bg}`,
                opacity: isDragging ? 0.25 : 1,
              }}
              onPointerDown={(e) => {
                e.preventDefault()
                ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
                setDrag({ uid: p.item.uid, from: gridId, item: p.item, px: e.clientX, py: e.clientY, startX: e.clientX, startY: e.clientY, moved: false })
              }}
            >
              <div style={{ fontSize: Math.min(cell * 0.42 * Math.min(def.w, def.h), 26) }}>{def.icon}</div>
              {(def.w * cell > 60) && (
                <div className="text-[10px] leading-tight px-0.5 text-center font-medium truncate w-full" style={{ color: r.color }}>
                  {def.name}
                </div>
              )}
              {p.item.count > 1 && (
                <div className="absolute bottom-0 right-0.5 text-[10px] font-bold text-white/90">×{p.item.count}</div>
              )}
              <div className="absolute top-0 left-0.5 text-[9px] font-bold" style={{ color: r.color }}>
                {r.label}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** 跟随鼠标的拖拽幽灵 */
export function DragGhost({ drag, cell }: { drag: DragState; cell: number }) {
  const def = ITEMS[drag.item.defId]
  const r = RARITY_INFO[drag.item.rarity]
  return (
    <div
      className="fixed pointer-events-none z-[100] rounded-sm border flex flex-col items-center justify-center"
      style={{
        left: drag.px - (def.w * cell) / 2, top: drag.py - (def.h * cell) / 2,
        width: def.w * cell - 2, height: def.h * cell - 2,
        borderColor: r.color, backgroundColor: r.bg, opacity: 0.9,
        boxShadow: `0 0 18px ${r.color}66`,
      }}
    >
      <div style={{ fontSize: Math.min(cell * 0.42 * Math.min(def.w, def.h), 26) }}>{def.icon}</div>
      <div className="text-[10px] font-medium truncate w-full text-center" style={{ color: r.color }}>{def.name}</div>
    </div>
  )
}

export function gridTotalValue(grid: Grid | null): number {
  if (!grid) return 0
  let sum = 0
  for (const p of grid.placed) sum += itemValue(ITEMS[p.item.defId], p.item.rarity) * p.item.count
  return sum
}
