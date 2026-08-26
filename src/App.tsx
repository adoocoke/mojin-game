import { useEffect, useRef, useState } from 'react'
import { engine, uiState, useUI } from '@/game/store'
import { HUD } from '@/components/game/HUD'
import { InventoryOverlay } from '@/components/game/InventoryOverlay'
import { MenuScreen, ResultScreen } from '@/components/game/Screens'
import { TouchControls, useIsTouch } from '@/components/game/TouchControls'
import { WarehousePanel } from '@/components/game/WarehousePanel'
import { MapOverlay } from '@/components/game/MapOverlay'
import { MarketPanel } from '@/components/game/MarketPanel'
import { LoadoutPanel } from '@/components/game/LoadoutPanel'
import { QuestPanel } from '@/components/game/QuestPanel'
import { PassPanel } from '@/components/game/PassPanel'
import { AchPanel } from '@/components/game/AchPanel'
import { OnlinePanel } from '@/components/game/OnlinePanel'
import { CampaignScreen, CampaignResultOverlay } from '@/components/game/CampaignScreen'
import { InspectOverlay } from '@/components/game/InspectOverlay'
import { HideoutPanel } from '@/components/game/HideoutPanel'
import { roomFromUrl } from '@/game/net'
import { TRPCProvider } from '@/providers/trpc'

export default function App() {
  return (
    <TRPCProvider>
      <div className="fixed inset-0 bg-black overflow-hidden">
        <GameStage />
      </div>
    </TRPCProvider>
  )
}

/** 画布 + 引擎实例；切换地图时整体重建 */
function GameStage() {
  const ui = useUI()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const rid = roomFromUrl()
    if (rid) { uiState.vsRoomUrl = rid; uiState.vsOpen = true }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let cancelled = false
    let game: { run: () => void; dispose: () => void } | null = null
    void import('@/game/engine').then(({ Game }) => {
      if (cancelled || canvasRef.current !== canvas) return
      game = new Game(canvas, ui.mapId)
      game.run()
      setReady(true)
    })
    return () => {
      cancelled = true
      setReady(false)
      game?.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui.mapId, ui.night, ui.highRisk, ui.quality]) // 画质/夜战/高危都要重建渲染器

  return (
    <>
      <canvas ref={canvasRef} className="block w-full h-full" />
      {ready ? <GameUI /> : <BootOverlay />}
    </>
  )
}

function BootOverlay() {
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-zinc-950 text-center px-6">
      <div className="text-amber-400 tracking-[0.5em] text-sm mb-3">LOOT · SHOOT · EXTRACT</div>
      <h1 className="text-5xl font-black text-white mb-3">
        摸金<span className="text-amber-400">枪战</span>
      </h1>
      <p className="text-zinc-400 max-w-md">潜入战区，搜索物资，击毙敌人，带着财富活着撤离。</p>
      <div className="mt-8 text-amber-300/80 text-sm tracking-widest animate-pulse">战区装载中…</div>
    </div>
  )
}

/** 联机对战结算覆盖层 */
function VsEndOverlay() {
  const ui = useUI()
  if (!ui.vsEnd) return null
  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/75">
      <div className="text-center rounded-xl border border-zinc-600 bg-zinc-950/95 p-8 shadow-2xl">
        <div className="text-6xl mb-4">{ui.vsEnd === 'win' ? '🏆' : '💀'}</div>
        <div className={`text-3xl font-black tracking-widest mb-2 ${ui.vsEnd === 'win' ? 'text-amber-300' : 'text-red-400'}`}>
          {ui.vsEnd === 'win' ? '胜利！你击倒了对手' : '战败……被对手击倒'}
        </div>
        <div className="text-zinc-500 text-sm mb-6">与 {ui.vsSession?.players.filter(p => p.id !== ui.vsSession?.playerId).map(p => p.name).join('、') ?? '对手'} 的对局已结束</div>
        <button onClick={() => engine.vsExit()}
          className="px-8 py-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-black font-black tracking-widest">
          返回大厅
        </button>
      </div>
    </div>
  )
}

function GameUI() {
  const ui = useUI()
  const isTouch = useIsTouch()
  return (
    <>
      <HUD />
      {isTouch && <TouchControls />}
      <InventoryOverlay />
      <MenuScreen />
      <ResultScreen />
      <WarehousePanel />
      <MarketPanel />
      <LoadoutPanel />
      <QuestPanel />
      <PassPanel />
      <AchPanel />
      <OnlinePanel />
        <CampaignScreen />
        <CampaignResultOverlay />
        <InspectOverlay />
      <HideoutPanel />
      <VsEndOverlay />
      <MapOverlay />
      {/* 点击锁定鼠标提示（仅 PC） */}
      {!isTouch && ui.phase === 'playing' && !ui.invOpen && (
        <ClickToLockHint />
      )}
    </>
  )
}

function ClickToLockHint() {
  const [locked, setLocked] = useState(false)
  useEffect(() => {
    const h = () => setLocked(!!document.pointerLockElement)
    h()
    document.addEventListener('pointerlockchange', h)
    return () => document.removeEventListener('pointerlockchange', h)
  }, [])
  if (locked) return null
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/50 pointer-events-none">
      <div className="text-zinc-200 text-lg font-bold bg-zinc-900/90 border border-zinc-600 rounded-lg px-6 py-3">
        点击画面锁定鼠标，继续行动
      </div>
    </div>
  )
}
