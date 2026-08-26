import { useEffect, useRef, useState } from 'react'
import { engine, useUI } from '@/game/store'
import { OPERATORS } from '@/game/data'

/** 手机触屏控件：左摇杆移动，右侧滑屏视角，右下按钮组 */
export function TouchControls() {
  const ui = useUI()
  const [joy, setJoy] = useState<{ x: number; y: number } | null>(null)
  const joyId = useRef<number | null>(null)
  const joyCenter = useRef({ x: 0, y: 0 })
  const lookId = useRef<number | null>(null)
  const lookLast = useRef({ x: 0, y: 0 })
  const [adsOn, setAdsOn] = useState(false)
  const visible = ui.phase === 'playing' && !ui.invOpen

  // 界面隐藏（开背包/阵亡/撤离）时强制复位，防止指针状态卡死
  useEffect(() => {
    if (!visible) {
      joyId.current = null
      lookId.current = null
      setJoy(null)
      engine.mobileMove(0, 0, false)
      engine.mobileFire(false)
    }
  }, [visible])

  // 切到匕首时复位瞄准按钮高亮
  useEffect(() => { if (ui.gun?.melee) setAdsOn(false) }, [ui.gun?.melee])

  // 全局兜底：即使事件被其他元素吞掉，也一定能释放摇杆/视角/开火
  useEffect(() => {
    const clear = (e: PointerEvent) => {
      if (e.pointerId === joyId.current) {
        joyId.current = null
        setJoy(null)
        engine.mobileMove(0, 0, false)
      }
      if (e.pointerId === lookId.current) lookId.current = null
      engine.mobileFire(false)
    }
    window.addEventListener('pointerup', clear)
    window.addEventListener('pointercancel', clear)
    return () => {
      window.removeEventListener('pointerup', clear)
      window.removeEventListener('pointercancel', clear)
    }
  }, [])

  if (!visible) return null

  const JOY_R = 55

  const onJoyStart = (e: React.PointerEvent) => {
    if (joyId.current !== null) return
    joyId.current = e.pointerId
    joyCenter.current = { x: e.clientX, y: e.clientY }
    setJoy({ x: 0, y: 0 })
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onJoyMove = (e: React.PointerEvent) => {
    if (e.pointerId !== joyId.current) return
    let dx = e.clientX - joyCenter.current.x
    let dy = e.clientY - joyCenter.current.y
    const len = Math.hypot(dx, dy)
    if (len > JOY_R) { dx = dx / len * JOY_R; dy = dy / len * JOY_R }
    setJoy({ x: dx, y: dy })
    const nx = dx / JOY_R, ny = dy / JOY_R
    engine.mobileMove(nx, ny, Math.hypot(nx, ny) > 0.92)
  }
  const onJoyEnd = (e: React.PointerEvent) => {
    if (e.pointerId !== joyId.current) return
    joyId.current = null
    setJoy(null)
    engine.mobileMove(0, 0, false)
  }

  const onLookStart = (e: React.PointerEvent) => {
    if (lookId.current !== null) return
    lookId.current = e.pointerId
    lookLast.current = { x: e.clientX, y: e.clientY }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onLookMove = (e: React.PointerEvent) => {
    if (e.pointerId !== lookId.current) return
    const dx = e.clientX - lookLast.current.x
    const dy = e.clientY - lookLast.current.y
    lookLast.current = { x: e.clientX, y: e.clientY }
    engine.mobileLook(dx, dy)
  }
  const onLookEnd = (e: React.PointerEvent) => {
    if (e.pointerId === lookId.current) lookId.current = null
  }

  const btn = 'flex items-center justify-center rounded-full bg-white/10 border border-white/25 text-white font-bold backdrop-blur-sm active:bg-white/30 select-none touch-none'

  return (
    <div className="absolute inset-0 z-30 select-none" style={{ touchAction: 'none' }}>
      {/* 左下：虚拟摇杆 */}
      <div
        className="absolute left-0 bottom-0 w-[45%] h-[65%]"
        onPointerDown={onJoyStart}
        onPointerMove={onJoyMove}
        onPointerUp={onJoyEnd}
        onPointerCancel={onJoyEnd}
      >
        <div
          className="absolute rounded-full border-2 border-white/20 bg-white/5"
          style={{
            width: JOY_R * 2, height: JOY_R * 2,
            left: joy ? joyCenter.current.x - JOY_R : 70,
            top: joy ? joyCenter.current.y - JOY_R : undefined,
            bottom: joy ? undefined : 110,
          }}
        >
          <div
            className="absolute rounded-full bg-white/30 border border-white/40"
            style={{
              width: 44, height: 44, left: JOY_R - 22 + (joy?.x ?? 0), top: JOY_R - 22 + (joy?.y ?? 0),
            }}
          />
        </div>
      </div>

      {/* 右侧：滑屏转视角 */}
      <div
        className="absolute right-0 top-0 w-[55%] h-full"
        onPointerDown={onLookStart}
        onPointerMove={onLookMove}
        onPointerUp={onLookEnd}
        onPointerCancel={onLookEnd}
      />

      {/* 右下按钮组 */}
      <div className="absolute right-4 bottom-24 flex flex-col items-end gap-3">
        <div className="flex gap-3">
          {/* 刀/枪切换（枪要在战局里捡到才能用） */}
          <button
            className={`${btn} w-14 h-14 text-xl`}
            onClick={() => engine.mobileSwapWeapon()}
          >{ui.gun?.melee ? '🔫' : '🔪'}</button>
          {!ui.gun?.melee && (
            <>
              <button
                className={`${btn} w-14 h-14 text-xs ${adsOn ? 'bg-cyan-500/40 border-cyan-300' : ''}`}
                onClick={() => { engine.mobileAdsToggle(); setAdsOn(!adsOn) }}
              >瞄准</button>
              <button
                className={`${btn} w-14 h-14 text-xs`}
                onClick={() => engine.mobileReload()}
              >换弹</button>
            </>
          )}
        </div>
        <div className="flex gap-3 items-end">
          <button
            className={`${btn} w-16 h-16 text-sm border-amber-400/50 text-amber-200`}
            onClick={() => engine.mobileInteract()}
          >搜索</button>
          <button
            className={`${btn} w-24 h-24 text-lg border-red-400/60 bg-red-500/20`}
            onPointerDown={(e) => { e.preventDefault(); engine.mobileFire(true) }}
            onPointerUp={() => engine.mobileFire(false)}
            onPointerCancel={() => engine.mobileFire(false)}
            onPointerLeave={() => engine.mobileFire(false)}
          >开火</button>
        </div>
      </div>

      {/* 背包按钮 */}
      <button
        className={`${btn} absolute top-16 right-4 w-12 h-12 text-xl`}
        onClick={() => engine.toggleInventory()}
      >🎒</button>

      {/* 地图按钮 */}
      <button
        className={`${btn} absolute top-32 right-4 w-12 h-12 text-xl`}
        onClick={() => engine.toggleMap()}
      >🗺️</button>

      {/* 技能按钮 */}
      <button
        className={`${btn} absolute top-48 right-4 w-12 h-12 text-xl ${ui.skillCd <= 0 ? 'border-cyan-300/70 bg-cyan-400/20' : ''}`}
        onClick={() => engine.useSkill()}
      >
        {(OPERATORS.find(o => o.id === ui.operator) ?? OPERATORS[0]).active.icon}
        {ui.skillCd > 0 && (
          <span className="absolute -bottom-1 -right-1 text-[10px] font-mono bg-black/70 rounded px-1 text-zinc-300">
            {Math.ceil(ui.skillCd)}
          </span>
        )}
      </button>
    </div>
  )
}

export function useIsTouch() {
  const [touch] = useState(() => ('ontouchstart' in window) || navigator.maxTouchPoints > 0)
  useEffect(() => {}, [])
  return touch
}
