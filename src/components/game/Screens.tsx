import { useUI, engine, uiState } from '@/game/store'
import { RARITY_INFO, RARITY_ORDER, type Rarity } from '@/game/types'
import { loadStash, stashValue } from '@/game/stash'
import { currentEvent, fmtCountdown, currentSeasonTheme } from '@/game/events'
import { OPERATORS } from '@/game/data'
import { opLevel, lvProgress, effDesc, MAX_OP_LV } from '@/game/oplevel'
import { QUALITY_META, QUALITY_TIER_LABEL, detectTier } from '@/game/quality'
import { useEffect, useMemo, useReducer } from 'react'

/** 定期活动横幅：每 2 小时轮换，主页面展示当前活动与倒计时 */
function EventBanner() {
  const [, force] = useReducer((x: number) => x + 1, 0)
  useEffect(() => {
    const t = setInterval(force, 1000)
    return () => clearInterval(t)
  }, [])
  const { event, endsAt } = currentEvent()
  const remain = fmtCountdown(endsAt - Date.now())
  if (!event) {
    return (
      <div className="mb-5 rounded-xl border border-zinc-700/60 bg-zinc-900/50 px-4 py-2.5 text-sm text-zinc-500 flex items-center justify-center gap-2">
        <span>🕐</span><span>本期暂无活动 · 下一场 {remain} 后开始</span>
      </div>
    )
  }
  return (
    <div className="mb-5 rounded-xl border border-fuchsia-500/50 bg-fuchsia-500/10 px-4 py-2.5 shadow-[0_0_20px_rgba(217,70,239,0.15)]">
      <div className="flex items-center justify-center gap-2 text-sm">
        <span className="text-lg">{event.icon}</span>
        <span className="font-black text-fuchsia-300">限时活动 · {event.name}</span>
        <span className="text-zinc-400">剩余 <span className="font-mono text-fuchsia-200">{remain}</span></span>
      </div>
      <div className="text-xs text-zinc-400 text-center mt-0.5">{event.desc}</div>
    </div>
  )
}

/** 赛季主题横幅（P3 #20）：每月轮换一个主题玩法 */
function ThemeBanner() {
  const t = currentSeasonTheme()
  return (
    <div className="mb-3 rounded-xl border border-orange-500/50 bg-orange-500/10 px-4 py-2.5 shadow-[0_0_20px_rgba(249,115,22,0.12)]">
      <div className="flex items-center justify-center gap-2 text-sm">
        <span className="text-lg">{t.icon}</span>
        <span className="font-black text-orange-300">本赛季主题 · {t.name}</span>
        <span className="text-[10px] text-zinc-500">每月轮换</span>
      </div>
      <div className="text-xs text-zinc-400 text-center mt-0.5">{t.desc}</div>
    </div>
  )
}

export function MenuScreen() {
  const ui = useUI()
  const stashInfo = useMemo(() => {
    if (ui.phase !== 'menu') return { value: 0, count: 0 }
    const s = loadStash()
    return { value: stashValue(s), count: s.placed.length }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui.phase, ui.stashOpen])
  if (ui.phase !== 'menu') return null
  return (
    <div className="absolute inset-0 z-50 overflow-y-auto bg-gradient-to-b from-zinc-950 via-zinc-900/95 to-zinc-950">
      <div className="max-w-2xl w-full text-center px-6 mx-auto py-8 min-h-full flex flex-col justify-center">
        <div className="text-amber-400 tracking-[0.5em] text-sm mb-3">LOOT · SHOOT · EXTRACT</div>
        <h1 className="text-6xl font-black text-white mb-2" style={{ textShadow: '0 0 40px rgba(251,191,36,0.35)' }}>
          摸金<span className="text-amber-400">枪战</span>
        </h1>
        <p className="text-zinc-400 mb-6">潜入战区，搜索物资，击毙敌人，带着财富活着撤离。开局一把匕首——枪可以搜<span className="text-amber-300">武器箱/航空箱</span>，也能在<span className="text-cyan-300">交易行</span>买好配装带进去！阵亡将失去背包中的一切！</p>

        {/* 定期活动 */}
        <ThemeBanner />
        <EventBanner />

        {/* 稀有度说明 */}
        <div className="flex justify-center gap-2 mb-6 flex-wrap">
          {RARITY_ORDER.map(r => (
            <div key={r} className="px-3 py-1.5 rounded border text-sm font-bold" style={{ color: RARITY_INFO[r].color, borderColor: RARITY_INFO[r].color + '66', backgroundColor: RARITY_INFO[r].bg }}>
              {RARITY_INFO[r].label} · {RARITY_INFO[r].name}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm text-zinc-400 mb-8 text-left max-w-md mx-auto">
          {('ontouchstart' in window) || navigator.maxTouchPoints > 0 ? (
            <>
              <span>左侧摇杆 移动（推满疾跑）</span><span>右侧滑屏 转视角</span>
              <span>开火键 攻击（可按住）</span><span>🔪/🔫键 切换武器</span>
              <span>搜索键 搜容器 / 刷门卡</span><span>🎒背包 · 🗺️地图</span>
              <span>开局匕首，武器箱找枪</span><span>保险箱物品阵亡不丢失</span>
              <span>限时 10 分钟</span><span>青色光柱撤离</span>
            </>
          ) : (
            <>
              <span>W A S D 移动</span><span>鼠标 攻击 / 右键瞄准</span>
              <span>Shift 疾跑</span><span>R 换弹 · 1 刀 2 轮换枪</span>
              <span>F 搜索 / 刷门卡开门</span><span>Tab 背包 · M 地图</span>
              <span>Q 释放干员技能</span><span>L 折叠/展开任务追踪</span><span>保险箱物品阵亡不丢失</span>
              <span>开局匕首，武器箱找枪</span><span>青色光柱撤离 · 限时 10 分钟</span>
            </>
          )}
        </div>

        {/* 地图选择 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mx-auto mb-7">
          {([
            { id: 'wild' as const, icon: '🏚️', name: '废弃矿区', tags: '物资一般 · 敌人分散', desc: '开阔矿区，稳扎稳打积累财富' },
            { id: 'tower' as const, icon: '🗼', name: '高塔禁区', tags: '四层高塔 · Boss 镇守', desc: '塔内物资极品，整体爆率更高' },
            { id: 'prison' as const, icon: '⛓️', name: '潮汐监狱', tags: '双 Boss · 航空箱', desc: '重兵把守的海边监狱，风险与宝藏并存' },
            { id: 'snow' as const, icon: '❄️', name: '雪地雷达站', tags: '低能见度 · 狙击 Boss', desc: '冰封雷达站，白狼在雾中等你' },
            { id: 'desert' as const, icon: '🏜️', name: '沙海古城', tags: '双层墓道 · 沙暴机制', desc: '沙海之下的法老陵寝，点亮四座长明灯开启石门' },
          ]).map(m => {
            const active = ui.mapId === m.id
            return (
              <button
                key={m.id}
                onClick={() => engine.selectMap(m.id)}
                className={`rounded-xl border-2 p-3 text-left transition-all hover:scale-[1.02] ${active
                  ? 'border-amber-400 bg-amber-400/10 shadow-[0_0_24px_rgba(251,191,36,0.25)]'
                  : 'border-zinc-700 bg-zinc-900/60 hover:border-zinc-500'}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">{m.icon}</span>
                  <span className={`text-base font-black ${active ? 'text-amber-300' : 'text-zinc-200'}`}>{m.name}</span>
                </div>
                <div className={`text-xs font-bold mb-1 ${active ? 'text-amber-200/90' : 'text-zinc-400'}`}>{m.tags}</div>
                <div className="text-[11px] text-zinc-500">{m.desc}</div>
                {active && <div className="text-amber-400 text-xs font-bold mt-1">✓ 已选择</div>}
              </button>
            )
          })}
        </div>

        {/* 难度模式：常规 / 高危禁区 */}
        <div className="flex justify-center mb-3">
          <button
            onClick={() => engine.toggleHighRisk()}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-bold transition-all ${ui.highRisk
              ? 'border-red-500 bg-red-950/60 text-red-200 shadow-[0_0_18px_rgba(239,68,68,0.4)]'
              : 'border-zinc-700 bg-zinc-900/60 text-zinc-400 hover:border-zinc-500'}`}
            title="敌人血量×1.5、数量×1.5、Boss 必刷；出货品级升一档、红色权重翻倍、新增军用保险库；撤离点减半、读条 +3 秒"
          >
            {ui.highRisk ? '☠️ 高危禁区 · 已开启' : '🛡️ 常规模式 · 点击切换高危禁区'}
            {ui.highRisk && <span className="text-[10px] text-red-300/80">高危高回报</span>}
          </button>
        </div>

        {/* 夜战模式开关 */}
        <div className="flex justify-center mb-3">
          <button
            onClick={() => engine.toggleNight()}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-bold transition-all ${ui.night
              ? 'border-indigo-400 bg-indigo-950/60 text-indigo-200 shadow-[0_0_18px_rgba(99,102,241,0.35)]'
              : 'border-zinc-700 bg-zinc-900/60 text-zinc-400 hover:border-zinc-500'}`}
            title="全图变暗、手电照明；夜战容器爆率 +15%"
          >
            {ui.night ? '🌙 夜战模式 · 已开启' : '☀️ 白天作战 · 点击切换夜战'}
            {ui.night && <span className="text-[10px] text-indigo-300/80">爆率 +15%</span>}
          </button>
        </div>

        {/* 画质：抗锯齿/阴影/粒子随档位缩放，兼容核显与手机 */}
        <div className="flex flex-col items-center mb-7 gap-1.5">
          <div className="text-zinc-300 text-sm font-bold tracking-widest">🖥️ 画质</div>
          <div className="flex flex-wrap justify-center rounded-lg border border-zinc-700 bg-zinc-900/60 overflow-hidden">
            {QUALITY_META.map(q => {
              const active = ui.quality === q.id
              return (
                <button
                  key={q.id}
                  onClick={() => engine.selectQuality(q.id)}
                  title={q.hint}
                  className={`px-3.5 py-2 text-xs sm:text-sm font-bold transition-all ${active
                    ? 'bg-amber-400/15 text-amber-200 shadow-[inset_0_0_12px_rgba(251,191,36,0.12)]'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80'}`}
                >
                  {q.icon} {q.label}
                </button>
              )
            })}
          </div>
          <div className="text-[10px] text-zinc-500">
            {ui.quality === 'auto'
              ? `自动适配 · 当前按「${QUALITY_TIER_LABEL[detectTier()]}」渲染`
              : QUALITY_META.find(q => q.id === ui.quality)?.hint}
          </div>
        </div>

        {/* 干员选择 */}
        <div className="mb-7">
          <div className="text-zinc-300 text-sm font-bold mb-2 tracking-widest">👤 选择干员</div>
          <div className="grid grid-cols-4 gap-2 max-w-2xl mx-auto">
            {OPERATORS.map(op => {
              const active = ui.operator === op.id
              return (
                <button
                  key={op.id}
                  onClick={() => engine.selectOperator(op.id)}
                  className={`rounded-xl border-2 p-2.5 text-left transition-all hover:scale-[1.03] ${active
                    ? 'border-cyan-400 bg-cyan-400/10 shadow-[0_0_20px_rgba(34,211,238,0.25)]'
                    : 'border-zinc-700 bg-zinc-900/60 hover:border-zinc-500'}`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-xl">{op.icon}</span>
                    <div>
                      <div className={`text-sm font-black leading-tight ${active ? 'text-cyan-300' : 'text-zinc-200'}`}>{op.name}</div>
                      <div className="text-[10px] text-zinc-500">{op.title}</div>
                    </div>
                  </div>
                  <div className={`mt-1.5 text-[10px] leading-snug rounded px-1 py-0.5 ${active ? 'bg-cyan-400/15 text-cyan-200' : 'bg-zinc-800/80 text-zinc-400'}`}>
                    Q·{op.active.icon}{op.active.name}
                  </div>
                  <div className="mt-0.5 space-y-0.5">
                    {op.passives.map(p => (
                      <div key={p.name} className="text-[10px] text-zinc-500 leading-tight" title={p.desc}>
                        {p.icon}{p.name}
                      </div>
                    ))}
                  </div>
                  {(() => {
                    const xp = ui.opXp[op.id] ?? 0
                    const prog = lvProgress(xp)
                    return (
                      <div className="mt-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className={`font-black ${prog.lv >= MAX_OP_LV ? 'text-amber-400' : 'text-violet-300'}`}>Lv.{prog.lv}{prog.lv >= MAX_OP_LV ? ' MAX' : ''}</span>
                          {prog.next > 0 && <span className="text-zinc-600">差{prog.next}经验</span>}
                        </div>
                        <div className="h-1 rounded bg-zinc-800 overflow-hidden">
                          <div className="h-full bg-violet-400" style={{ width: `${Math.round(prog.cur * 100)}%` }} />
                        </div>
                      </div>
                    )
                  })()}
                  {active && <div className="text-cyan-400 text-[10px] font-bold mt-1">✓ 出战</div>}
                </button>
              )
            })}
          </div>
          {/* 当前干员技能详情 */}
          {(() => {
            const op = OPERATORS.find(o => o.id === ui.operator) ?? OPERATORS[0]
            const lv = opLevel(ui.opXp[op.id] ?? 0)
            return (
              <div className="mt-2 text-[11px] text-zinc-400 flex justify-center gap-4 flex-wrap">
                <span>
                  {op.active.icon} <span className="text-cyan-300 font-bold">{op.active.name}</span>
                  <span className="text-violet-300 font-bold"> Lv.{lv}</span>（Q）：{effDesc(op, lv)}
                  {lv < MAX_OP_LV && <span className="text-zinc-600">｜下一级：{effDesc(op, lv + 1)}</span>}
                </span>
                {op.passives.map(p => (
                  <span key={p.name}>{p.icon} <span className="text-zinc-300 font-bold">{p.name}</span>：{p.desc}</span>
                ))}
              </div>
            )
          })()}
        </div>

        <div className="flex justify-center gap-4">
          <button
            onClick={() => { uiState.campLevelId = null; engine.start() }}
            className="px-12 py-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xl font-black tracking-widest shadow-[0_0_30px_rgba(251,191,36,0.4)] transition-all hover:scale-105"
          >
            开始行动
          </button>
          <button
            onClick={() => engine.openStash()}
            className="px-8 py-4 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-300 text-lg font-black tracking-widest border border-amber-600/40 transition-all hover:scale-105"
          >
            🏦 仓库
            {stashInfo.count > 0 && (
              <span className="block text-xs font-normal text-zinc-400 mt-0.5">
                {stashInfo.count} 件 · {stashInfo.value.toLocaleString()} 金币
              </span>
            )}
            <span className="block text-[10px] font-normal text-red-300/80 mt-0.5">新红货已放入，点选后可检视</span>
          </button>
          <button
            onClick={() => engine.openHideout()}
            className="px-8 py-4 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-100 text-lg font-black tracking-widest border border-amber-500/50 transition-all hover:scale-105"
          >
            🏠 藏身处
            <span className="block text-xs font-normal text-zinc-400 mt-0.5">陈列 · 改装 · 医疗 · 情报</span>
          </button>
        </div>
        <div className="flex justify-center gap-4 mt-3">
          <button
            onClick={() => engine.openMarket()}
            className="px-6 py-2.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-cyan-300 font-bold border border-cyan-600/40 transition-all hover:scale-105"
          >
            🏪 交易行
          </button>
          <button
            onClick={() => engine.startTutorial()}
            className="px-6 py-2.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-teal-300 font-bold border border-teal-600/40 transition-all hover:scale-105"
            title="无敌人的引导局，学会搜索/换弹/保险箱/撤离"
          >
            🎓 新手教学
          </button>
          <button
            onClick={() => engine.openLoadout()}
            className="px-6 py-2.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-amber-200 font-bold border border-amber-600/30 transition-all hover:scale-105"
          >
            🎒 战前配装
            {ui.carryDefs.length > 0 && <span className="ml-1.5 text-xs text-amber-400">已选 {ui.carryDefs.length}</span>}
          </button>
          <button
            onClick={() => engine.openQuests()}
            className="px-6 py-2.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-emerald-300 font-bold border border-emerald-600/40 transition-all hover:scale-105"
          >
            📋 赛季任务
          </button>
          <button
            onClick={() => engine.openCampaign()}
            className="px-6 py-2.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-amber-300 font-bold border border-amber-600/40 transition-all hover:scale-105"
          >
            📜 战役
          </button>
          <button
            onClick={() => engine.openVs()}
            className="px-6 py-2.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-cyan-300 font-bold border border-cyan-600/40 transition-all hover:scale-105"
          >
            👥 联机
          </button>
          <button
            onClick={() => engine.openPass()}
            className="px-6 py-2.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-violet-300 font-bold border border-violet-600/40 transition-all hover:scale-105"
          >
            🎫 通行证
          </button>
          <button
            onClick={() => engine.openAch()}
            className="px-6 py-2.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-amber-300 font-bold border border-amber-600/40 transition-all hover:scale-105"
          >
            🏆 成就
          </button>
        </div>
        <div className="mt-4 text-zinc-500 text-sm flex justify-center gap-5">
          <span>💰 金币：<span className="text-yellow-300 font-mono font-bold">{ui.money.toLocaleString()}</span></span>
          {ui.best > 0 && <span>历史最高收获：<span className="text-amber-300 font-mono">{ui.best.toLocaleString()}</span></span>}
        </div>
      </div>
    </div>
  )
}

export function ResultScreen() {
  const ui = useUI()
  if (!ui.resultOpen) return null
  const ok = ui.lastRaidExtracted
  return (
    <div className="absolute inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm">
      <div className="max-w-lg w-full mx-auto my-8 rounded-xl border bg-zinc-950/95 p-6 shadow-2xl" style={{ borderColor: ok ? '#22d3ee55' : '#ef444455' }}>
        <h2 className={`text-4xl font-black text-center mb-1 ${ok ? 'text-cyan-300' : 'text-red-400'}`}>
          {ok ? '撤离成功' : '行动失败'}
        </h2>
        {ui.highRisk && (
          <div className="flex justify-center mb-2">
            <span className="rounded-full border border-red-500/60 bg-red-950/70 px-3 py-0.5 text-xs font-bold text-red-300">☠️ 高危禁区</span>
          </div>
        )}
        <p className="text-center text-zinc-500 text-sm mb-4">
          {ok ? '你带着财富全身而退' : '你阵亡了，背包物资全部丢失（保险箱保留）'}
        </p>
        <div className="flex justify-center gap-6 mb-4 text-sm">
          <span className="text-zinc-400">击杀 <span className="text-red-400 font-bold">{ui.kills}</span></span>
          <span className="text-zinc-400">带出 <span className="text-amber-300 font-bold font-mono">{ui.resultValue.toLocaleString()}</span> 金币</span>
          <span className="text-zinc-400">最佳 <span className="text-amber-200 font-mono">{ui.best.toLocaleString()}</span></span>
        </div>
        <div className="max-h-64 overflow-auto rounded border border-zinc-800 divide-y divide-zinc-800/60 mb-2">
          {ui.resultItems.length === 0 && <div className="p-4 text-center text-zinc-600 text-sm">没有带出任何物品</div>}
          {ui.resultItems.map((it, i) => (
            <div key={i} className="flex items-center justify-between px-3 py-1.5 text-sm" style={{ backgroundColor: RARITY_INFO[it.rarity as Rarity].bg }}>
              <span style={{ color: RARITY_INFO[it.rarity as Rarity].color }}>
                【{RARITY_INFO[it.rarity as Rarity].name}】{it.name}{it.count > 1 ? ` ×${it.count}` : ''}
              </span>
              <span className="font-mono text-zinc-300">{it.value.toLocaleString()}</span>
            </div>
          ))}
        </div>
        <div className="text-center text-xs mb-4">
          {ui.resultItems.length > 0 && <span className="text-amber-400/80">已存入仓库</span>}
          {ui.resultOverflow > 0 && <span className="text-red-400 ml-2">仓库已满，{ui.resultOverflow} 件未能入库</span>}
        </div>
        {ui.resultQuests.length > 0 && (
          <div className="rounded-lg border border-emerald-600/40 bg-emerald-500/10 px-3 py-2 mb-4 space-y-1">
            <div className="text-xs font-bold text-emerald-300">📋 赛季任务进展</div>
            {ui.resultQuests.map((l, i) => (
              <div key={i} className="text-xs text-emerald-200/90">{l}</div>
            ))}
          </div>
        )}
        <div className="flex gap-3">
          <button
            onClick={() => engine.closeResult()}
            className="flex-1 py-3 rounded-lg font-black text-lg tracking-widest bg-zinc-800 hover:bg-zinc-700 text-zinc-100 transition-all hover:scale-[1.02]"
          >
            好的
          </button>
          <button
            onClick={() => { engine.closeResult(); engine.restart() }}
            className={`flex-1 py-3 rounded-lg font-black text-lg tracking-widest transition-all hover:scale-[1.02] ${ok ? 'bg-cyan-500 hover:bg-cyan-400 text-black' : 'bg-red-500 hover:bg-red-400 text-black'}`}
          >
            再来一局
          </button>
        </div>
      </div>
    </div>
  )
}
