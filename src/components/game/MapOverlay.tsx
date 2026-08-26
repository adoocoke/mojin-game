import { engine, useUI } from '@/game/store'

/** 对局内地图查看（M 键 / 触屏🗺️按钮）：俯视示意图 + 玩家位置 + 撤离点 + 锁房 */
export function MapOverlay() {
  const ui = useUI()
  if (ui.phase !== 'playing' || !ui.mapOpen) return null
  const S = 140 // 地图半径
  const mapName = ui.mapId === 'tower' ? '高塔禁区' : ui.mapId === 'prison' ? '潮汐监狱' : ui.mapId === 'snow' ? '雪地雷达站' : ui.mapId === 'desert' ? '沙海古城' : '废弃矿区'
  // 玩家朝向箭头（yaw 的前向为 (-sin, -cos)）
  const fx = -Math.sin(ui.playerYaw), fz = -Math.cos(ui.playerYaw)
  const ang = Math.atan2(fx, -fz) * 180 / Math.PI
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => engine.toggleMap()}>
      <div className="relative rounded-xl border border-zinc-600 bg-zinc-950/95 p-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-amber-300 font-black tracking-widest">🗺️ {mapName}</span>
          <span className="text-zinc-500 text-xs">按 M 关闭</span>
        </div>
        <svg viewBox={`${-S} ${-S} ${S * 2} ${S * 2}`} className="w-[min(70vh,520px)] h-[min(70vh,520px)]">
          {/* 边界与网格道路 */}
          <rect x={-S} y={-S} width={S * 2} height={S * 2} fill={ui.mapId === 'snow' ? '#c8d4e0' : ui.mapId === 'desert' ? '#c9b078' : '#3a4432'} stroke="#7a7568" strokeWidth="3" />
          {ui.mapId !== 'snow' && ui.mapId !== 'desert' && [-80, -40, 0, 40, 80].map(i => (
            <g key={i}>
              <rect x={-S} y={i - 3} width={S * 2} height="6" fill="#4a4f48" />
              <rect x={i - 3} y={-S} width="6" height={S * 2} fill="#4a4f48" />
            </g>
          ))}
          {/* 地标 */}
          {ui.mapMarkers.map((m, i) => {
            if (m.kind === 'tower') return (
              <g key={i}>
                <rect x={m.x - 36} y={m.z - 36} width="72" height="72" fill="#5d6167" stroke="#2ad6e8" strokeWidth="1.5" />
                <text x={m.x} y={m.z + 4} textAnchor="middle" fontSize="14" fill="#9be8f0" fontWeight="bold">塔</text>
              </g>
            )
            if (m.kind === 'block') return (
              <g key={i}>
                <rect x={m.x - 32} y={m.z - 17} width="64" height="34" fill="#5d6167" stroke="#9aa2ad" strokeWidth="1.5" />
                <text x={m.x} y={m.z + 4} textAnchor="middle" fontSize="11" fill="#d8dde4" fontWeight="bold">{m.name ?? ''}</text>
              </g>
            )
            if (m.kind === 'airdrop') return (
              <g key={i}>
                <circle cx={m.x} cy={m.z} r="7" fill="#0a2a3a" stroke="#22d3ee" strokeWidth="1.5">
                  <animate attributeName="opacity" values="1;0.5;1" dur="1.2s" repeatCount="indefinite" />
                </circle>
                <text x={m.x} y={m.z + 4} textAnchor="middle" fontSize="9">🪂</text>
              </g>
            )
            if (m.kind === 'gas') return (
              <g key={i}>
                <circle cx={m.x} cy={m.z} r="20" fill="#d8c81e33" stroke="#d8c81e" strokeWidth="2" />
                <text x={m.x} y={m.z + 4} textAnchor="middle" fontSize="11">☣️</text>
                {m.name && <text x={m.x} y={m.z - 24} textAnchor="middle" fontSize="8" fill="#d8c81e" fontWeight="bold">{m.name}</text>}
              </g>
            )
            if (m.kind === 'patrol') return (
              <g key={i}>
                <circle cx={m.x} cy={m.z} r="7" fill="#3a0a0a" stroke="#ef4444" strokeWidth="1.5">
                  <animate attributeName="opacity" values="1;0.5;1" dur="1s" repeatCount="indefinite" />
                </circle>
                <text x={m.x} y={m.z + 4} textAnchor="middle" fontSize="9">🎖️</text>
              </g>
            )
            if (m.kind === 'mission') return (
              <g key={i}>
                <circle cx={m.x} cy={m.z} r="7" fill="#2b1650" stroke="#a78bfa" strokeWidth="1.5" />
                <text x={m.x} y={m.z + 4} textAnchor="middle" fontSize="9">🎯</text>
                {m.name && <text x={m.x} y={m.z - 10} textAnchor="middle" fontSize="8" fill="#c4b5fd" fontWeight="bold">{m.name}</text>}
              </g>
            )
            if (m.kind === 'house') return (
              <g key={i}>
                <rect x={m.x - 3.5} y={m.z - 3.5} width="7" height="7" fill="#a89a80" stroke="#6a5f4a" strokeWidth="0.8" />
                {m.name && (ui.mapId === 'prison' || ui.mapId === 'snow') && (
                  <text x={m.x} y={m.z - 6} textAnchor="middle" fontSize="8" fill="#c9c2b4">{m.name}</text>
                )}
              </g>
            )
            return (
              <g key={i}>
                <rect x={m.x - 5} y={m.z - 5} width="10" height="10" fill="#3a2f12" stroke="#f5c518" strokeWidth="1.5" />
                <text x={m.x} y={m.z + 4} textAnchor="middle" fontSize="9">🔑</text>
              </g>
            )
          })}
          {/* 撤离点 */}
          <circle cx={ui.mapExtract.x} cy={ui.mapExtract.z} r="7" fill="#22d3ee33" stroke="#22d3ee" strokeWidth="2" />
          <text x={ui.mapExtract.x} y={ui.mapExtract.z - 10} textAnchor="middle" fontSize="10" fill="#22d3ee" fontWeight="bold">撤离</text>
          {/* 侦察脉冲：敌人位置 */}
          {ui.revealEnemies.map((e, i) => (
            <circle key={`e${i}`} cx={e.x} cy={e.z} r="4" fill="#ef4444" stroke="#7f1d1d" strokeWidth="1">
              <animate attributeName="opacity" values="1;0.4;1" dur="1s" repeatCount="indefinite" />
            </circle>
          ))}
          {/* 玩家 */}
          <g transform={`translate(${ui.playerX} ${ui.playerZ}) rotate(${ang})`}>
            <polygon points="0,-7 4.5,5 0,2.5 -4.5,5" fill="#fbbf24" stroke="#7c4a03" strokeWidth="1" />
          </g>
        </svg>
        <div className="flex justify-center gap-4 mt-2 text-xs text-zinc-400">
          <span><span className="text-amber-400">▲</span> 你</span>
          <span><span className="text-cyan-300">●</span> 撤离点</span>
          <span>🔑 锁房（需房卡）</span>
          <span><span className="text-[#a89a80]">■</span> 平房</span>
          {ui.revealEnemies.length > 0 && <span><span className="text-red-500">●</span> 敌人（侦察脉冲）</span>}
        </div>
      </div>
    </div>
  )
}
