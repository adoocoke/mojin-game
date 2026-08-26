import { useEffect, useState } from 'react'
import { useUI, engine } from '@/game/store'
import { RARITY_INFO, RARITY_ORDER, itemValue, type Rarity } from '@/game/types'
import { gridTotalValue } from './GridView'
import { OPERATORS, ITEMS } from '@/game/data'
import { loadSeason, trackedQuests, currentPhase } from '@/game/quests'
import { MAP_MISSIONS } from '@/game/missions'

function useNow(interval = 100) {
  const [, setT] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setT(t => t + 1), interval)
    return () => clearInterval(id)
  }, [interval])
}

export function HUD() {
  const ui = useUI()
  useNow(100)
  if (ui.phase !== 'playing') return null
  const now = performance.now()

  const mm = Math.floor(ui.raidTime / 60)
  const ss = Math.floor(ui.raidTime % 60)
  const timeColor = ui.raidTime < 60 ? 'text-red-400 animate-pulse' : 'text-zinc-200'
  const bpValue = gridTotalValue(ui.backpack) + gridTotalValue(ui.safebox)
  const hpRatio = ui.hp / ui.maxHp
  const hpColor = hpRatio > 0.5 ? 'bg-emerald-500' : hpRatio > 0.25 ? 'bg-amber-500' : 'bg-red-500'
  const showHit = now - ui.hitMarker < 120
  const showDmg = now - ui.damageFlash < 250
  const showToast = now - ui.toastTs < 2200 && ui.toast

  return (
    <div className="absolute inset-0 z-30 pointer-events-none select-none">
      {/* 联机对手血条 */}
      {ui.vsOpp && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-56 pointer-events-none">
          <div className="text-center text-xs font-bold text-red-400 mb-1 drop-shadow">⚔️ {ui.vsOpp.name}</div>
          <div className="h-2 rounded bg-zinc-800/80 border border-zinc-600 overflow-hidden">
            <div className="h-full bg-red-500 transition-all" style={{ width: `${Math.max(0, Math.min(100, ui.vsOpp.hp))}%` }} />
          </div>
        </div>
      )}

      {/* 准星 */}
      {!ui.invOpen && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="relative">
            <div className="absolute w-1.5 h-1.5 -left-[3px] -top-[3px] rounded-full bg-white/90 shadow" />
            <div className="absolute w-3 h-[2px] -left-[26px] -top-[1px] bg-white/80" />
            <div className="absolute w-3 h-[2px] left-[14px] -top-[1px] bg-white/80" />
            <div className="absolute h-3 w-[2px] -left-[1px] -top-[26px] bg-white/80" />
            <div className="absolute h-3 w-[2px] -left-[1px] top-[14px] bg-white/80" />
          </div>
        </div>
      )}
      {/* 命中标记 */}
      {showHit && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-red-400 text-3xl font-black" style={{ textShadow: '0 0 8px #f00' }}>✕</div>
      )}
      {/* 受击红闪 */}
      {showDmg && <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 40%, rgba(220,38,38,0.45) 100%)' }} />}

      {/* 顶部：时间 / 撤离 */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5">
        <div className={`font-mono text-xl font-bold ${timeColor} bg-black/45 rounded px-3 py-1 border border-white/10`}>
          ⏱ {mm}:{String(ss).padStart(2, '0')}
        </div>
        {ui.extractProgress >= 0 && (
          <div className="w-56">
            <div className="text-center text-cyan-300 text-sm font-bold mb-1">撤离中… {(ui.extractProgress * 100).toFixed(0)}%</div>
            <div className="h-2 rounded bg-black/50 border border-cyan-700">
              <div className="h-full rounded bg-cyan-400 transition-all" style={{ width: `${ui.extractProgress * 100}%` }} />
            </div>
          </div>
        )}
        {ui.searching >= 0 && (
          <div className="w-48">
            <div className="text-center text-amber-300 text-sm font-bold mb-1">搜索中…</div>
            <div className="h-2 rounded bg-black/50 border border-amber-700">
              <div className="h-full rounded bg-amber-400 transition-all" style={{ width: `${ui.searching * 100}%` }} />
            </div>
          </div>
        )}
        {showToast && (
          <div
            className="mt-1 px-4 py-1.5 rounded bg-black/70 border font-bold text-sm"
            style={{ color: RARITY_INFO[ui.toastRarity as Rarity].color, borderColor: RARITY_INFO[ui.toastRarity as Rarity].color + '88' }}
          >
            {ui.toast}
          </div>
        )}
      </div>

      {/* 左上：赛季任务追踪 */}
      {(() => {
        const season = loadSeason()
        // 背包+保险箱实时聚合：价值与紫色/青色/红色件数
        let raidValue = 0, purple = 0, cyan = 0, red = 0
        for (const g of [ui.backpack, ui.safebox]) {
          if (!g) continue
          for (const p of g.placed) {
            const def = ITEMS[p.item.defId]
            if (!def) continue
            raidValue += itemValue(def) * p.item.count
            const ord = RARITY_ORDER.indexOf(p.item.rarity)
            if (ord >= 3) purple += p.item.count
            if (ord >= 4) cyan += p.item.count
            if (ord >= 5) red += p.item.count
          }
        }
        const list = trackedQuests(season, {
          themeActions: 0,
          kills: ui.kills,
          bossKills: ui.raidLive.bossKills,
          searches: ui.raidLive.searches,
          doorsOpened: ui.raidLive.doors,
          raidValue, purplePlus: purple, cyanPlus: cyan, redPlus: red,
          scouts: ui.raidLive.scouts ?? [],
        })
        const mission = MAP_MISSIONS[ui.mapId]
        if (list.length === 0 && !mission) return null
        return (
          <>
          {ui.tutorial && (
            <div className="absolute left-5 top-64 z-30 rounded-lg border border-emerald-500/50 bg-black/60 backdrop-blur-sm px-3 py-2 w-60 pointer-events-none">
              <div className="text-xs font-black text-emerald-300">🎓 新手教学 {ui.tutorialStep + 1}/5</div>
              <div className="text-[11px] text-zinc-300 mt-1">
                {['用 W/A/S/D 移动，鼠标环顾四周', '找到任意容器，按 F 搜索物资', '按 2 装备 P92 手枪，然后按 R 换弹', '打开背包（Tab），把一件物资拖进保险箱', '前往小地图（M）标记的撤离点，站着等读条'][ui.tutorialStep]}
              </div>
              <div className="flex gap-1 mt-1.5">
                {[0, 1, 2, 3, 4].map(i => (
                  <div key={i} className={`h-1 flex-1 rounded ${i < ui.tutorialStep ? 'bg-emerald-400' : i === ui.tutorialStep ? 'bg-emerald-300 animate-pulse' : 'bg-zinc-700'}`} />
                ))}
              </div>
            </div>
          )}
          <div className="absolute top-4 left-5 w-60 pointer-events-auto">
            <div className="flex items-center gap-2 bg-black/45 rounded-t-lg px-2.5 py-1.5 border border-white/10">
              <span className="text-[11px] font-black text-amber-300">📋 任务追踪</span>
              <span className="text-[10px] text-zinc-500">第 {currentPhase(season)} 阶段</span>
              <div className="flex-1" />
              <button
                onClick={() => engine.toggleQuestHud()}
                className="text-zinc-400 hover:text-zinc-200 text-xs px-1"
                title={ui.questHudHide ? '展开任务追踪' : '收起任务追踪'}
              >
                {ui.questHudHide ? '👁' : '▾'}
              </button>
            </div>
            {!ui.questHudHide && (
              <div className="bg-black/45 rounded-b-lg border border-t-0 border-white/10 px-2.5 py-1.5 space-y-1.5">
                {/* 地图专属任务（任务点接取 → 局内目标行动） */}
                {mission && (
                  <div className="rounded border border-violet-500/40 bg-violet-950/40 px-1.5 py-1" title={mission.desc}>
                    <div className="flex items-center justify-between text-[10px] leading-tight">
                      <span className={ui.missionDone ? 'text-emerald-300 font-bold' : 'text-violet-200 font-bold'}>
                        🎯 {mission.icon} {mission.name}
                      </span>
                      <span className={'font-mono ' + (ui.missionDone ? 'text-emerald-300 font-bold' : 'text-violet-300')}>
                        {ui.missionDone ? '✓' : ui.missionTimer >= 0 ? `${ui.missionTimer}s` : ui.missionAccepted ? '已接取' : '未接取'}
                      </span>
                    </div>
                    <div className="text-[9px] text-violet-300/70 leading-tight mt-0.5">
                      {ui.missionDone
                        ? `完成！成功撤离后 +${mission.reward} 金币`
                        : !ui.missionAccepted
                          ? `前往小地图 🎯 任务点接取 · 撤离 +${mission.reward}`
                          : ui.missionTimer >= 0
                            ? mission.type === 'breach' ? '炸药引爆倒计时，远离掩体！' : '坚守阵地，击退来犯敌人！'
                            : mission.desc}
                    </div>
                  </div>
                )}
                {list.map(({ q, cur }) => {
                  const done = cur >= q.target
                  return (
                    <div key={q.id}>
                      <div className="flex items-center justify-between text-[10px] leading-tight">
                        <span className={done ? 'text-emerald-300' : 'text-zinc-300'}>
                          {q.main ? '📕' : '📗'} {q.icon} {q.name}
                        </span>
                        <span className={`font-mono ${done ? 'text-emerald-300 font-bold' : 'text-zinc-400'}`}>
                          {done ? '✓' : `${cur}/${q.target}`}
                        </span>
                      </div>
                      <div className="h-0.5 rounded bg-zinc-800 overflow-hidden mt-0.5">
                        <div
                          className={`h-full ${done ? 'bg-emerald-400' : 'bg-amber-400'}`}
                          style={{ width: `${Math.min(100, (cur / q.target) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          </>
        )
      })()}

      {/* 右上：击杀信息 */}
      <div className="absolute top-4 right-5 text-right">
        <div className="text-zinc-300 text-sm bg-black/45 rounded px-3 py-1 border border-white/10 font-mono">
          击杀 <span className="text-red-400 font-bold">{ui.kills}</span>　收获 <span className="text-amber-300 font-bold">{bpValue.toLocaleString()}</span>
        </div>
        <div className="mt-2 space-y-1">
          {ui.killFeed.map((k, i) => (
            <div key={i} className="text-xs text-zinc-400 bg-black/35 rounded px-2 py-0.5">💀 {k}</div>
          ))}
        </div>
      </div>

      {/* 左下：生命 */}
      <div className="absolute bottom-6 left-6 w-64">
        <div className="flex items-end justify-between mb-1">
          <span className="text-xs text-zinc-400 tracking-widest">生命值</span>
          <span className="font-mono text-lg font-bold text-white">{Math.ceil(ui.hp)}<span className="text-zinc-500 text-sm">/{ui.maxHp}</span></span>
        </div>
        {ui.maxHp > 100 && (
          <div className="text-[10px] text-emerald-400/90 font-bold mb-0.5">医疗站增益 · 上限 {ui.maxHp}</div>
        )}
        <div className="h-3 rounded bg-black/60 border border-white/15 overflow-hidden">
          <div className={`h-full ${hpColor} transition-all duration-200`} style={{ width: `${hpRatio * 100}%` }} />
        </div>
      </div>

      {/* 护甲/头盔耐久 */}
      {(ui.vest || ui.helmet) && (
        <div className="absolute bottom-[4.2rem] left-6 flex flex-col gap-1">
          {ui.helmet && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs">{ITEMS[ui.helmet.defId].icon}</span>
              <div className="w-20 h-1.5 rounded bg-black/60 border border-white/10 overflow-hidden">
                <div className="h-full bg-sky-400" style={{ width: `${Math.min(100, ui.helmet.dur / (ITEMS[ui.helmet.defId].durability ?? 50) * 100)}%` }} />
              </div>
            </div>
          )}
          {ui.vest && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs">{ITEMS[ui.vest.defId].icon}</span>
              <div className="w-20 h-1.5 rounded bg-black/60 border border-white/10 overflow-hidden">
                <div className="h-full bg-indigo-400" style={{ width: `${Math.min(100, ui.vest.dur / (ITEMS[ui.vest.defId].durability ?? 50) * 100)}%` }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* 负重指示 */}
      {ui.weightTier > 0 && (
        <div className={`absolute bottom-[7.6rem] left-6 text-[11px] font-bold ${ui.weightTier === 3 ? 'text-red-400' : ui.weightTier === 2 ? 'text-amber-300' : 'text-zinc-400'}`}>
          🎒 {ui.weight}kg {['', '· 中载', '· 重载 -15%', '· 超载！'][ui.weightTier]}
        </div>
      )}

      {/* 战役目标 */}
      {ui.campObj && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 max-w-md rounded-lg border border-amber-500/50 bg-black/55 px-4 py-1.5 text-center">
          <span className="text-xs font-bold text-amber-200">📜 {ui.campObj}</span>
        </div>
      )}

      {/* 左下偏中：干员技能 */}
      {(() => {
        const op = OPERATORS.find(o => o.id === ui.operator) ?? OPERATORS[0]
        const ready = ui.skillCd <= 0
        const active = ui.skillActive !== '' && ui.skillCd > 0
        return (
          <div className="absolute bottom-6 left-[17.5rem] hidden sm:block">
            <div className={`rounded-lg px-3 py-2 border text-center min-w-[6.5rem] ${ready
              ? 'bg-cyan-400/15 border-cyan-400/60 shadow-[0_0_14px_rgba(34,211,238,0.3)]'
              : 'bg-black/45 border-white/10'}`}>
              <div className="text-xl leading-none">{op.active.icon}</div>
              <div className={`text-[11px] font-bold mt-0.5 ${ready ? 'text-cyan-300' : 'text-zinc-400'}`}>
                {op.active.name}
              </div>
              <div className="text-[10px] font-mono mt-0.5">
                {ready
                  ? <span className="text-cyan-200 font-bold">Q 就绪</span>
                  : <span className="text-zinc-500">{active ? '生效中 · ' : ''}{Math.ceil(ui.skillCd)}s</span>}
              </div>
            </div>
          </div>
        )
      })()}

      {/* 战术装备（T） */}
      {ui.tacticalDef && (
        <div className="absolute bottom-6 left-[26rem] hidden sm:block">
          <div className={`rounded-lg px-3 py-2 border text-center min-w-[5.5rem] ${!ui.tacUsed
            ? 'bg-violet-400/15 border-violet-400/60'
            : 'bg-black/45 border-white/10 opacity-50'}`}>
            <div className="text-xl leading-none">{ITEMS[ui.tacticalDef].icon}</div>
            <div className={`text-[11px] font-bold mt-0.5 ${!ui.tacUsed ? 'text-violet-300' : 'text-zinc-500'}`}>
              {ITEMS[ui.tacticalDef].name}
            </div>
            <div className="text-[10px] font-mono mt-0.5">
              {!ui.tacUsed ? <span className="text-violet-200 font-bold">T 就绪</span> : <span className="text-zinc-500">已用完</span>}
            </div>
          </div>
        </div>
      )}

      {/* 右下：武器（小屏移到左上） */}
      <div className="absolute bottom-6 right-6 text-right max-sm:bottom-auto max-sm:top-14 max-sm:left-4 max-sm:right-auto max-sm:text-left max-sm:scale-90 max-sm:origin-top-left">
        {ui.gun && (
          <div className="bg-black/45 rounded-lg px-4 py-2.5 border border-white/10">
            <div className="text-sm font-bold" style={{ color: RARITY_INFO[ui.gunRarity as Rarity].color }}>
              {ui.gun.melee ? '🔪 ' : `【${RARITY_INFO[ui.gunRarity as Rarity].name}】`}{ui.gun.name}
            </div>
            <div className="text-[11px] text-zinc-500">
              {ui.gun.melee ? '近战 · 无需弹药' : <>{ui.gun.type} · {ui.gun.auto ? '全自动' : '半自动'}</>}
              {!ui.gun.melee && Object.values(ui.gunAtts).some(Boolean) && (
                <span className="ml-1.5">
                  {Object.values(ui.gunAtts).filter(Boolean).map(a => (
                    <span key={a!.uid} title={ITEMS[a!.defId].name}>{ITEMS[a!.defId].icon}</span>
                  ))}
                </span>
              )}
            </div>
            <div className="font-mono text-2xl font-black text-white mt-0.5">
              {ui.gun.melee
                ? <span className="text-lg text-zinc-300">∞</span>
                : ui.reloading
                  ? <span className="text-amber-400 text-lg">换弹中…</span>
                  : <>{ui.mag}<span className="text-zinc-500 text-base">/{ui.gun.mag}</span>
                    {ui.ammoTier > 1 && <span className="ml-1.5 text-xs align-middle" title={`${ui.ammoTier} 级子弹`}>{['','📦','🟢','🔵','🟣','🩵','🔴'][ui.ammoTier]}</span>}
                  </>}
            </div>
          </div>
        )}
        <div className="text-[11px] text-zinc-500 mt-1.5 hidden sm:block">
          {ui.gun?.melee ? '左键挥砍 · 2 轮换武器' : 'R 换弹 · 右键瞄准 · 1 切刀 · 2 换下一把'}
        </div>
      </div>

      {/* 交互提示 */}
      {ui.prompt && !ui.invOpen && (
        <div className="absolute bottom-[22%] left-1/2 -translate-x-1/2 px-5 py-2 rounded-lg bg-black/70 border border-amber-500/60 text-amber-200 font-bold text-lg shadow-lg">
          {ui.prompt}
        </div>
      )}

      {/* 撤离倒计时（大屏幕中央） */}
      {ui.extractProgress >= 0 && (
        <div className="absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
          <div className="text-6xl font-black text-cyan-300" style={{ textShadow: '0 0 24px rgba(34,211,238,0.8)' }}>
            {Math.ceil((1 - ui.extractProgress) * 4)}
          </div>
          <div className="text-cyan-200 font-bold tracking-widest mt-1">正在撤离…</div>
        </div>
      )}
    </div>
  )
}
