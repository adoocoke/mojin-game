import { engine, useUI } from '@/game/store'
import { ITEMS } from '@/game/data'
import { itemValue } from '@/game/types'

// ===================== 红色物品检视 =====================
// 每件红都有专属检视动作，动作贴合物品本身的特色

interface InspectStyle {
  anim: string        // 动画名（见下方 keyframes）
  dur?: string        // 时长
  glow: string        // 光晕颜色
  flavor: string      // 检视文案
}

const INSPECT: Record<string, InspectStyle> = {
  // ---- 普通红色变卖物 ----
  v_crown:  { anim: 'insp-coronate', glow: '#f5c518', flavor: '王冠缓缓升起，加冕于你——金光在齿冠间流转。' },
  v_super:  { anim: 'insp-scan',     glow: '#3ce0d2', flavor: '超算单元启动自检，数据流一遍遍扫过核心。' },
  v_safe:   { anim: 'insp-unlock',   glow: '#f5c518', flavor: '咔哒——锁栓弹开，箱门为你敞开一条缝。' },
  v_dragon: { anim: 'insp-soar',     glow: '#ff5a3c', flavor: '金龙腾空盘旋，鳞甲在火光里翻腾。' },
  v_phoenix:{ anim: 'insp-soar',     glow: '#ff7a18', flavor: '羽冠被风掀起，火光沿着翎羽一路烧到天际。' },
  v_amber:  { anim: 'insp-gaze',     glow: '#ff8c3c', flavor: '虫珀深处有东西在动——四千万年，它还没死透。' },
  v_scroll: { anim: 'insp-unfold',   glow: '#d4af37', flavor: '古卷一层层展开，墨迹遇光，竟自行游走。' },
  v_cup:    { anim: 'insp-raise',    glow: '#f5c518', flavor: '金瓯举起，杯沿一圈龙纹亮了又暗。' },
  v_meteor: { anim: 'insp-spin',     glow: '#c9c9c9', flavor: '陨铁核心自转起来，空气里有一股焦糊的星尘味。' },
  v_pearl:  { anim: 'insp-gaze',     glow: '#7ec8ff', flavor: '夜明珠由内而外亮起，像东海把月亮吞进了肚子。' },
  v_egg:    { anim: 'insp-pin',      glow: '#f5c518', flavor: '黄金鸟蛋微微一颤——壳里有心跳。' },
  // ---- 口袋红货 ----
  v_ruby:    { anim: 'insp-gaze',   glow: '#ff2d55', flavor: '鸽血红在掌心一跳一跳，像刚从活物身上剜下来。' },
  v_fang:    { anim: 'insp-bite',   glow: '#ff5a3c', flavor: '血珀狼牙猛地咬合，牙根还带着雪原的腥气。' },
  v_compass: { anim: 'insp-spin',   glow: '#f5c518', flavor: '罗盘指针疯转三圈，最后钉死在西南——沙海的方向。' },
  v_seal:    { anim: 'insp-pin',    glow: '#ffd700', flavor: '金印砸上桌面，暗河会的徽记烫出一道浅痕。' },
  v_flute:   { anim: 'insp-sway',   glow: '#7ec8ff', flavor: '玉箫横过唇边，无声，却有风从音孔里钻出来。' },
  v_mask:    { anim: 'insp-focus',  glow: '#ffd700', flavor: '金面覆上，视野变窄——法老的眼睛替你看这个世界。' },
  // ---- 巨型红货 ----
  v_tank:    { anim: 'insp-heave',  glow: '#f5c518', flavor: '坦克模型履带着地，炮塔缓缓转向你。' },
  v_engine:  { anim: 'insp-scan',   glow: '#7ec8ff', flavor: '发动机喷口亮起一圈冷焰，像随时要挣脱支架。' },
  v_reactor: { anim: 'insp-spin',   dur: '2.2s', glow: '#39ff14', flavor: '反应堆核心脉动，盖革计数器在脑子里响。' },
  v_bell:    { anim: 'insp-toll',   glow: '#d4af37', flavor: '朝钟无声一震，余波从肋骨里穿过去。' },
  v_warrior: { anim: 'insp-raise',  glow: '#c9a227', flavor: '武士俑抬矛，陶土关节咯吱作响，三千年的杀气没散。' },
  v_cannon:  { anim: 'insp-bolt',   glow: '#ff8c3c', flavor: '舰炮后坐一下，炮口还残留着硝石和海盐。' },
  v_piano:   { anim: 'insp-jingle', glow: '#f5c518', flavor: '琴盖掀开，几个金键自己落下去，弹出半句葬礼进行曲。' },
  v_sarc:    { anim: 'insp-unlock', glow: '#ffd700', flavor: '石棺盖缓缓错开一条缝，里面不是木乃伊——是空的，以及热气。' },
  v_sat:     { anim: 'insp-scan',   glow: '#5ab8ff', flavor: '抛物面天线一闪，定位灯钉死了你的坐标。' },
  // ---- Boss 专属掉落 ----
  v_core:      { anim: 'insp-spin',    dur: '2.5s', glow: '#ff8c3c', flavor: '铁爪的动力核心仍在转动，机油味混着铁锈味。' },
  v_blueprint: { anim: 'insp-unfold',  glow: '#3ca8e0', flavor: '蓝图徐徐展开，巴别塔的每一层都标着典狱长的手迹。' },
  v_scepter:   { anim: 'insp-raise',   glow: '#b06aff', flavor: '权杖举起又落下——三十年秩序，一声闷响。' },
  v_sharktooth:{ anim: 'insp-bite',    glow: '#5ab8ff', flavor: '鲨齿项链猛地一咬合，仿佛还能听见水下的咆哮。' },
  v_wolfcamo:  { anim: 'insp-stalk',   glow: '#bfe6ff', flavor: '雪地迷彩左潜右行，像白狼贴着雪坡呼吸。' },
  v_scarab:    { anim: 'insp-crawl',   glow: '#d4af37', flavor: '圣甲虫护符缓缓爬行，三千年没停下过脚步。' },
  // ---- 战役章节纪念物 ----
  c_claw:   { anim: 'insp-swipe',  glow: '#c9c9c9', flavor: '铁钩挥出两道寒光——它刨开过塌方，也刨开过人心。' },
  c_keys:   { anim: 'insp-jingle', glow: '#f5c518', flavor: '钥匙串叮当作响，每一把都开过塔里的一扇门。' },
  c_wolf:   { anim: 'insp-gaze',   glow: '#7ec8ff', flavor: '白狼之瞳静静凝视，瞳孔一缩一放，你还在它的射界里。' },
  c_scarab: { anim: 'insp-flutter',glow: '#d4af37', flavor: '圣甲虫振翅欲飞，祭司的嘱托随翅膀沙沙作响。' },
  // ---- 战役关卡夺取目标（红） ----
  g_c1l3: { anim: 'insp-swing',  glow: '#c9a227', flavor: '信物抡起又砸下，矿镐的刃口还留着岩层的碎屑。' },
  g_c2l3: { anim: 'insp-pin',    glow: '#f5c518', flavor: '旧秩序勋章端端正正别上胸口，弹了一下，归于沉寂。' },
  g_c3l3: { anim: 'insp-focus',  glow: '#7ec8ff', flavor: '测距仪的镜片由模糊到清晰——风雪千里，尽收眼底。' },
  g_c4l3: { anim: 'insp-cast',   glow: '#ffd700', flavor: '祭司杖凌空画符，金光如沙，从杖尖簌簌落下。' },
  // ---- 红色房卡 / 武器 / 弹药 ----
  k_w_core:   { anim: 'insp-flip', glow: '#ff4a3c', flavor: '核心区房卡在指间翻转，磁条泛着危险的红光。' },
  k_t_warden: { anim: 'insp-flip', glow: '#ff4a3c', flavor: '典狱长密卡翻面，塔顶门禁的徽记一闪而过。' },
  k_d_tomb:   { anim: 'insp-flip', glow: '#ffd700', flavor: '法老金卡翻转，陵寝深处的石门仿佛在回应。' },
  k_s_office: { anim: 'insp-flip', glow: '#7ec8ff', flavor: '站长办公室卡在雪中翻面，霜花在卡面上凝结。' },
  w_awm:      { anim: 'insp-bolt', glow: '#ff4a3c', flavor: '拉动枪栓，复进簧一声脆响——下一发已经上膛。' },
  a_ammo6:    { anim: 'insp-rattle', glow: '#ff3b30', flavor: '毁灭者弹在掌心一颠，弹壳相撞，杀气毕露。' },
}

const FALLBACK: InspectStyle = { anim: 'insp-spin', glow: '#ff4a3c', flavor: '红色珍品，值得细细端详。' }

const KEYFRAMES = `
@keyframes insp-coronate { 0%{transform:translateY(60px) scale(.6);opacity:.4} 45%{transform:translateY(-14px) scale(1.05)} 70%{transform:translateY(4px)} 100%{transform:translateY(0)} }
@keyframes insp-scan { 0%,100%{filter:brightness(1)} 20%{filter:brightness(1.8) hue-rotate(20deg)} 40%{filter:brightness(.85)} 60%{filter:brightness(1.6) hue-rotate(-15deg)} 80%{filter:brightness(.95)} }
@keyframes insp-unlock { 0%,55%{transform:translateX(0)} 8%{transform:translateX(-6px) rotate(-3deg)} 16%{transform:translateX(6px) rotate(3deg)} 24%{transform:translateX(-5px) rotate(-2deg)} 32%{transform:translateX(5px) rotate(2deg)} 40%{transform:translateX(-3px)} 62%{transform:scale(1)} 75%{transform:scale(1.12)} 100%{transform:scale(1)} }
@keyframes insp-soar { 0%{transform:translate(0,10px) rotate(-4deg)} 25%{transform:translate(14px,-16px) rotate(5deg)} 50%{transform:translate(0,-26px) rotate(0deg)} 75%{transform:translate(-14px,-16px) rotate(-5deg)} 100%{transform:translate(0,10px) rotate(-4deg)} }
@keyframes insp-spin { from{transform:rotateY(0)} to{transform:rotateY(360deg)} }
@keyframes insp-unfold { 0%{transform:scaleY(.15);opacity:.5} 60%{transform:scaleY(1.08)} 100%{transform:scaleY(1)} }
@keyframes insp-raise { 0%,100%{transform:translateY(0)} 35%{transform:translateY(-22px)} 55%{transform:translateY(-22px)} 75%{transform:translateY(3px)} }
@keyframes insp-bite { 0%,100%{transform:scale(1) rotate(0)} 10%{transform:scale(1.06) rotate(-4deg)} 20%{transform:scale(.96) rotate(4deg)} 30%{transform:scale(1.06) rotate(-3deg)} 40%{transform:scale(1) rotate(0)} }
@keyframes insp-stalk { 0%,100%{transform:translateX(0) scaleX(1)} 25%{transform:translateX(-16px) scaleX(1)} 50%{transform:translateX(0)} 75%{transform:translateX(16px) scaleX(-1)} }
@keyframes insp-crawl { 0%{transform:translate(0,0) rotate(0)} 20%{transform:translate(8px,-3px) rotate(6deg)} 40%{transform:translate(14px,2px) rotate(-4deg)} 60%{transform:translate(6px,5px) rotate(5deg)} 80%{transform:translate(-4px,2px) rotate(-5deg)} 100%{transform:translate(0,0)} }
@keyframes insp-swipe { 0%{transform:rotate(-25deg) translateX(-14px)} 30%{transform:rotate(18deg) translateX(14px)} 45%{transform:rotate(10deg) translateX(8px)} 65%{transform:rotate(-18deg) translateX(-10px)} 100%{transform:rotate(0) translateX(0)} }
@keyframes insp-jingle { 0%,100%{transform:rotate(0)} 15%{transform:rotate(9deg)} 30%{transform:rotate(-8deg)} 45%{transform:rotate(6deg)} 60%{transform:rotate(-5deg)} 75%{transform:rotate(3deg)} }
@keyframes insp-gaze { 0%,100%{transform:scale(1);filter:brightness(1)} 40%{transform:scale(1.18);filter:brightness(1.5)} 60%{transform:scale(.94);filter:brightness(.8)} }
@keyframes insp-flutter { 0%,100%{transform:scaleX(1)} 20%{transform:scaleX(.6)} 40%{transform:scaleX(1)} 60%{transform:scaleX(.65)} 80%{transform:scaleX(1)} }
@keyframes insp-swing { 0%{transform:rotate(0)} 25%{transform:rotate(-30deg) translateY(-8px)} 45%{transform:rotate(12deg) translateY(10px)} 60%{transform:rotate(-6deg)} 100%{transform:rotate(0)} }
@keyframes insp-pin { 0%{transform:scale(2.2);opacity:0} 55%{transform:scale(.92);opacity:1} 75%{transform:scale(1.06)} 100%{transform:scale(1)} }
@keyframes insp-focus { 0%{filter:blur(10px)} 55%{filter:blur(0)} 70%{filter:blur(3px)} 100%{filter:blur(0)} }
@keyframes insp-cast { 0%{transform:rotate(0) translateY(0)} 20%{transform:rotate(-14deg) translateY(-8px)} 45%{transform:rotate(12deg) translateY(-14px)} 70%{transform:rotate(-6deg) translateY(-4px)} 100%{transform:rotate(0)} }
@keyframes insp-flip { 0%{transform:rotateY(0)} 50%{transform:rotateY(180deg)} 100%{transform:rotateY(360deg)} }
@keyframes insp-bolt { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-18px)} 45%{transform:translateX(14px)} 65%{transform:translateX(0)} }
@keyframes insp-rattle { 0%,100%{transform:translateY(0)} 12%{transform:translateY(-8px)} 24%{transform:translateY(4px)} 36%{transform:translateY(-5px)} 48%{transform:translateY(2px)} 60%{transform:translateY(-2px)} }
@keyframes insp-sway { 0%,100%{transform:rotate(-8deg) translateY(0)} 50%{transform:rotate(8deg) translateY(-6px)} }
@keyframes insp-toll { 0%,100%{transform:scale(1) rotate(0)} 18%{transform:scale(1.12) rotate(-6deg)} 36%{transform:scale(.96) rotate(5deg)} 54%{transform:scale(1.08) rotate(-3deg)} 72%{transform:scale(1) rotate(0)} }
@keyframes insp-heave { 0%,100%{transform:translateY(0) rotate(0)} 30%{transform:translateY(-10px) rotate(-2deg)} 55%{transform:translateY(4px) rotate(2deg)} 75%{transform:translateY(-4px)} }
`

export function InspectOverlay() {
  const ui = useUI()
  if (!ui.inspectDef) return null
  const def = ITEMS[ui.inspectDef]
  if (!def) return null
  const st = INSPECT[ui.inspectDef] ?? FALLBACK
  return (
    <div
      className="absolute inset-0 z-[80] flex items-center justify-center bg-black/85 backdrop-blur-sm"
      onClick={() => engine.closeInspect()}
    >
      <style>{KEYFRAMES}</style>
      <div className="text-center select-none" onClick={e => e.stopPropagation()}>
        {/* 展台光晕 */}
        <div
          className="mx-auto mb-6 flex items-center justify-center rounded-full"
          style={{
            width: 220, height: 220,
            background: `radial-gradient(circle, ${st.glow}33 0%, transparent 70%)`,
            boxShadow: `0 0 80px ${st.glow}44, inset 0 0 60px ${st.glow}22`,
          }}
        >
          <div
            style={{
              fontSize: '7rem', lineHeight: 1,
              animation: `${st.anim} ${st.dur ?? '3.2s'} ease-in-out infinite`,
              filter: `drop-shadow(0 0 18px ${st.glow})`,
              transformStyle: 'preserve-3d',
            }}
          >
            {def.icon}
          </div>
        </div>
        <div className="text-red-300 text-2xl font-black tracking-widest mb-1">【红】{def.name}</div>
        <div className="text-amber-300 font-mono text-sm mb-3">价值 {itemValue(def).toLocaleString()} 金币</div>
        <div className="text-zinc-400 text-sm max-w-xs mx-auto leading-relaxed mb-6">{st.flavor}</div>
        <button
          onClick={() => engine.closeInspect()}
          className="px-8 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold border border-zinc-600"
        >
          收起
        </button>
      </div>
    </div>
  )
}
