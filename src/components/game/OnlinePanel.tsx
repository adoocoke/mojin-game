import { useEffect, useRef, useState } from 'react'
import { engine, uiState, useUI } from '@/game/store'
import { notify } from '@/game/store'
import { vsClient, roomShareUrl } from '@/game/net'
import type { MapId } from '@/game/world'

const MAPS: { id: MapId; icon: string; name: string }[] = [
  { id: 'wild', icon: '⛏️', name: '废弃矿区' },
  { id: 'tower', icon: '🗼', name: '高塔禁区' },
  { id: 'prison', icon: '🔒', name: '潮汐监狱' },
  { id: 'snow', icon: '❄️', name: '雪地雷达站' },
  { id: 'desert', icon: '🏜️', name: '沙海古城' },
]

interface RoomInfo {
  mode: 'pvp' | 'coop'
  mapId: string
  ai: boolean
  maxPlayers: number
  started: boolean
  hostId: string
  players: { id: string; name: string }[]
}

/**
 * 自定义联机房间（P4 #32）：房主选地图/模式/人数/AI 规则 → 发链接 → 好友进房 → 房主开局
 * - 组队摸金：2-6 人同图搜打撤，可选是否刷 AI 敌人
 * - 对战：2-6 人乱斗，无 AI，活到最后即胜
 */
export function OnlinePanel() {
  const ui = useUI()
  const [name, setName] = useState(localStorage.getItem('mojin_vs_name') || '')
  const [mode, setMode] = useState<'pvp' | 'coop'>('coop')
  const [mapId, setMapId] = useState<MapId>('wild')
  const [ai, setAi] = useState(true)
  const [maxPlayers, setMaxPlayers] = useState(2)
  const [roomId, setRoomId] = useState<string | null>(null)
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [room, setRoom] = useState<RoomInfo | null>(null)
  const [joined, setJoined] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isGuest = !!ui.vsRoomUrl && !roomId

  const saveName = (n: string) => { setName(n); localStorage.setItem('mojin_vs_name', n) }
  const stopPoll = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null } }

  /** 进入对局：写 session → 需要时切图 → 启动 */
  const startGame = (r: RoomInfo, rid: string, pid: string) => {
    stopPoll()
    uiState.vsSession = {
      roomId: rid, playerId: pid, mode: r.mode, mapId: r.mapId as MapId,
      ai: r.ai, isHost: r.hostId === pid,
      players: r.players.map(p => ({ id: p.id, name: p.name })),
    }
    uiState.vsOpen = false
    const targetMap = r.mapId as MapId
    if (uiState.mapId !== targetMap) {
      engine.selectMap(targetMap)
      setTimeout(() => engine.start(), 600) // 等 Game 重建
    } else {
      notify()
      setTimeout(() => engine.start(), 80)
    }
  }

  /** 大厅轮询（房主与好友共用）：刷新成员列表，开始后进局 */
  const pollLobby = (rid: string, pid: string) => {
    stopPoll()
    pollRef.current = setInterval(async () => {
      try {
        const res = await vsClient.versus.state.query({ roomId: rid, playerId: pid, sinceId: 0 })
        if (!res.ok) { setError('房间已过期'); stopPoll(); return }
        const info: RoomInfo = {
          mode: res.mode ?? 'coop', mapId: res.mapId ?? 'wild', ai: res.ai ?? true,
          maxPlayers: res.maxPlayers ?? 2, started: !!res.started, hostId: res.hostId ?? '',
          players: res.players.map(p => ({ id: p.id, name: p.name })),
        }
        setRoom(info)
        if (info.started) startGame(info, rid, pid)
      } catch { /* 网络抖动忽略 */ }
    }, 1500)
  }

  useEffect(() => () => stopPoll(), [])

  if (!ui.vsOpen) return null

  const doCreate = async () => {
    if (!name.trim()) { setError('先输入你的昵称'); return }
    setBusy(true); setError('')
    try {
      const res = await vsClient.versus.create.mutate({
        name: name.trim(), mode, mapId, ai: mode === 'coop' ? ai : false, maxPlayers,
      })
      setRoomId(res.roomId)
      setPlayerId(res.playerId)
      pollLobby(res.roomId, res.playerId)
    } catch { setError('创建失败：联机服务未就绪（需发布后使用）') }
    setBusy(false)
  }

  const doJoin = async () => {
    if (!name.trim()) { setError('先输入你的昵称'); return }
    setBusy(true); setError('')
    try {
      const res = await vsClient.versus.join.mutate({ roomId: ui.vsRoomUrl!, name: name.trim() })
      if (!res.ok) { setError(res.error); setBusy(false); return }
      setPlayerId(res.playerId)
      setJoined(true)
      pollLobby(ui.vsRoomUrl!, res.playerId)
    } catch { setError('加入失败：房间不存在或网络异常') }
    setBusy(false)
  }

  const doStart = async () => {
    if (!roomId || !playerId) return
    setBusy(true)
    try { await vsClient.versus.start.mutate({ roomId, playerId }) } catch { setError('开始失败') }
    setBusy(false)
  }

  const doCancel = async () => {
    stopPoll()
    const rid = roomId ?? ui.vsRoomUrl
    if (rid && playerId) { try { await vsClient.versus.leave.mutate({ roomId: rid, playerId }) } catch { /* 忽略 */ } }
    if (ui.vsRoomUrl) {
      uiState.vsRoomUrl = null
      history.replaceState(null, '', location.pathname)
    }
    setRoomId(null); setPlayerId(null); setRoom(null); setJoined(false)
    engine.closeVs()
  }

  const mapName = (id: string) => MAPS.find(m => m.id === id)?.name ?? id
  const mapIcon = (id: string) => MAPS.find(m => m.id === id)?.icon ?? '🗺️'

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-[min(92vw,460px)] rounded-xl border border-cyan-700/50 bg-zinc-950/95 p-5 shadow-2xl max-h-[92vh] overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <span className="text-cyan-300 font-black tracking-widest text-lg">👥 自定义联机房间</span>
          <button onClick={doCancel} className="text-zinc-500 hover:text-zinc-300 text-xl">×</button>
        </div>

        {/* 昵称 */}
        <div className="mb-4">
          <div className="text-zinc-400 text-xs mb-1">你的昵称</div>
          <input
            value={name} onChange={e => saveName(e.target.value)} maxLength={12}
            placeholder="输入昵称（好友能看到）"
            className="w-full px-3 py-2 rounded bg-zinc-900 border border-zinc-700 text-zinc-100 outline-none focus:border-cyan-500"
          />
        </div>

        {/* 好友加入流程 */}
        {isGuest && !joined && (
          <>
            <div className="text-zinc-300 text-sm mb-3">好友邀你联机！输入昵称后加入房间：</div>
            <button disabled={busy} onClick={doJoin}
              className="w-full py-3.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-black font-black tracking-widest">
              🚪 加入房间
            </button>
          </>
        )}

        {/* 已加入：房间大厅（房主与好友共用） */}
        {(roomId || joined) && room && (
          <div className="rounded-lg border border-zinc-700 bg-zinc-900/60 p-3 mb-3">
            <div className="flex items-center gap-2 text-sm mb-2">
              <span>{mapIcon(room.mapId)}</span>
              <span className="font-bold text-zinc-200">{mapName(room.mapId)}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded ${room.mode === 'pvp' ? 'bg-red-900/60 text-red-300' : 'bg-emerald-900/60 text-emerald-300'}`}>
                {room.mode === 'pvp' ? '⚔️ 对战乱斗' : '🤝 组队摸金'}
              </span>
              <span className="text-xs text-zinc-500">{room.mode === 'coop' ? (room.ai ? '有 AI 敌人' : '无 AI 敌人') : '无 AI'}</span>
            </div>
            <div className="text-xs text-zinc-400 mb-1.5">房间成员（{room.players.length}/{room.maxPlayers}）：</div>
            <div className="flex flex-wrap gap-1.5">
              {room.players.map(p => (
                <span key={p.id} className={`text-xs px-2 py-1 rounded border ${p.id === room.hostId ? 'border-amber-500/60 text-amber-300' : 'border-zinc-700 text-zinc-300'}`}>
                  {p.id === room.hostId ? '👑 ' : ''}{p.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 房主：房间设置 */}
        {!isGuest && !roomId && (
          <>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button onClick={() => setMode('coop')}
                className={`py-2.5 rounded-lg border font-bold text-sm ${mode === 'coop' ? 'border-emerald-500 bg-emerald-950/50 text-emerald-300' : 'border-zinc-700 text-zinc-400'}`}>
                🤝 组队摸金
              </button>
              <button onClick={() => setMode('pvp')}
                className={`py-2.5 rounded-lg border font-bold text-sm ${mode === 'pvp' ? 'border-red-500 bg-red-950/50 text-red-300' : 'border-zinc-700 text-zinc-400'}`}>
                ⚔️ 对战乱斗
              </button>
            </div>
            <div className="text-zinc-400 text-xs mb-1">地图</div>
            <div className="grid grid-cols-5 gap-1.5 mb-3">
              {MAPS.map(m => (
                <button key={m.id} onClick={() => setMapId(m.id)}
                  className={`py-2 rounded-lg border text-center ${mapId === m.id ? 'border-cyan-500 bg-cyan-950/40' : 'border-zinc-700'}`}
                  title={m.name}>
                  <div className="text-lg">{m.icon}</div>
                  <div className={`text-[9px] ${mapId === m.id ? 'text-cyan-300' : 'text-zinc-500'}`}>{m.name}</div>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 mb-3">
              <div>
                <div className="text-zinc-400 text-xs mb-1">人数上限</div>
                <div className="flex gap-1">
                  {[2, 3, 4, 5, 6].map(n => (
                    <button key={n} onClick={() => setMaxPlayers(n)}
                      className={`w-8 h-8 rounded border text-sm font-bold ${maxPlayers === n ? 'border-cyan-500 bg-cyan-950/40 text-cyan-300' : 'border-zinc-700 text-zinc-500'}`}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              {mode === 'coop' && (
                <div>
                  <div className="text-zinc-400 text-xs mb-1">AI 敌人</div>
                  <button onClick={() => setAi(!ai)}
                    className={`px-3 h-8 rounded border text-sm font-bold ${ai ? 'border-emerald-500 bg-emerald-950/40 text-emerald-300' : 'border-zinc-700 text-zinc-500'}`}>
                    {ai ? '刷 AI' : '不刷 AI'}
                  </button>
                </div>
              )}
            </div>
            <button disabled={busy} onClick={doCreate}
              className="w-full py-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-black font-black tracking-widest">
              🏠 创建房间
            </button>
          </>
        )}

        {/* 房主：分享链接 + 开始 */}
        {roomId && (
          <>
            <div className="text-zinc-400 text-xs mb-1">把链接发给微信好友，TA 打开即可加入</div>
            <div className="flex gap-2 mb-3">
              <input readOnly value={roomShareUrl(roomId)} onFocus={e => e.target.select()}
                className="flex-1 px-2 py-2 rounded bg-zinc-900 border border-zinc-700 text-cyan-300 text-xs" />
              <button onClick={() => { navigator.clipboard?.writeText(roomShareUrl(roomId)).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }).catch(() => undefined) }}
                className="px-3 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm whitespace-nowrap">
                {copied ? '✓ 已复制' : '📋 复制'}
              </button>
            </div>
            <button disabled={busy || !room || room.players.length < 2} onClick={doStart}
              className="w-full py-3 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-black tracking-widest">
              🚀 开始游戏{room && room.players.length < 2 ? '（至少 2 人）' : ''}
            </button>
          </>
        )}

        {/* 好友：等待开始 */}
        {joined && (
          <div className="text-center py-3">
            <div className="text-zinc-500 text-sm animate-pulse">已加入房间，等待房主开始游戏……</div>
          </div>
        )}

        {error && <div className="text-red-400 text-sm mt-3">{error}</div>}
        <div className="text-zinc-600 text-[11px] mt-4 leading-relaxed">
          自定义房间不计入生涯统计与排行。对战乱斗：无 AI，活到最后即胜；组队摸金：同图搜打撤，位置实时可见。需网站发布后联机才可用。
        </div>
      </div>
    </div>
  )
}
