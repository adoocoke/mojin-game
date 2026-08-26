import type { GunDef, ItemDef, ItemInstance } from './types'
import { RARITY_ORDER } from './types'

// ===================== 枪械库（种类丰富） =====================
export const GUNS: Record<string, GunDef> = {
  p92:    { id: 'p92',    name: 'P92 手枪',       type: '手枪',     damage: 18, headMult: 2.0, fireInterval: 220, mag: 15, reloadTime: 1100, auto: false, spread: 0.012, range: 60,  pellets: 1, zoom: 1.15, recoil: 0.011, color: 0x3a3f44, barrelLen: 0.28, bulky: 0.05 },
  deagle: { id: 'deagle', name: '沙漠之鹰',       type: '手枪',     damage: 38, headMult: 2.2, fireInterval: 330, mag: 7,  reloadTime: 1400, auto: false, spread: 0.014, range: 70,  pellets: 1, zoom: 1.15, recoil: 0.026, color: 0x8a8f96, barrelLen: 0.32, bulky: 0.055 },
  uzi:    { id: 'uzi',    name: 'UZI 冲锋枪',     type: '冲锋枪',   damage: 15, headMult: 1.8, fireInterval: 70,  mag: 32, reloadTime: 1500, auto: true,  spread: 0.030, range: 55,  pellets: 1, zoom: 1.2,  recoil: 0.008, color: 0x2f3438, barrelLen: 0.34, bulky: 0.06 },
  mp5:    { id: 'mp5',    name: 'MP5 冲锋枪',     type: '冲锋枪',   damage: 19, headMult: 1.8, fireInterval: 85,  mag: 30, reloadTime: 1600, auto: true,  spread: 0.024, range: 65,  pellets: 1, zoom: 1.25, recoil: 0.007, color: 0x23272b, barrelLen: 0.42, bulky: 0.06 },
  vector: { id: 'vector', name: 'Vector 冲锋枪',  type: '冲锋枪',   damage: 17, headMult: 1.8, fireInterval: 58,  mag: 33, reloadTime: 1700, auto: true,  spread: 0.027, range: 60,  pellets: 1, zoom: 1.25, recoil: 0.006, color: 0x4b4f35, barrelLen: 0.38, bulky: 0.065 },
  m870:   { id: 'm870',   name: 'M870 霰弹枪',    type: '霰弹枪',   damage: 11, headMult: 1.6, fireInterval: 780, mag: 6,  reloadTime: 2400, auto: false, spread: 0.055, range: 30,  pellets: 8, zoom: 1.15, recoil: 0.045, color: 0x5a4632, barrelLen: 0.62, bulky: 0.065 },
  s12k:   { id: 's12k',   name: 'S12K 霰弹枪',    type: '霰弹枪',   damage: 9,  headMult: 1.6, fireInterval: 260, mag: 8,  reloadTime: 2100, auto: false, spread: 0.065, range: 26,  pellets: 7, zoom: 1.15, recoil: 0.032, color: 0x3c3f43, barrelLen: 0.55, bulky: 0.065 },
  akm:    { id: 'akm',    name: 'AKM 突击步枪',   type: '突击步枪', damage: 30, headMult: 2.0, fireInterval: 108, mag: 30, reloadTime: 1900, auto: true,  spread: 0.020, range: 110, pellets: 1, zoom: 1.35, recoil: 0.018, color: 0x6b4a2f, barrelLen: 0.62, bulky: 0.06 },
  m4a1:   { id: 'm4a1',   name: 'M4A1 突击步枪',  type: '突击步枪', damage: 26, headMult: 2.0, fireInterval: 92,  mag: 30, reloadTime: 1700, auto: true,  spread: 0.016, range: 115, pellets: 1, zoom: 1.35, recoil: 0.012, color: 0x2b2e33, barrelLen: 0.60, bulky: 0.058 },
  scar:   { id: 'scar',   name: 'SCAR-L 突击步枪',type: '突击步枪', damage: 27, headMult: 2.0, fireInterval: 100, mag: 25, reloadTime: 1800, auto: true,  spread: 0.015, range: 120, pellets: 1, zoom: 1.4,  recoil: 0.013, color: 0x8f7a55, barrelLen: 0.60, bulky: 0.06 },
  aug:    { id: 'aug',    name: 'AUG 突击步枪',   type: '突击步枪', damage: 28, headMult: 2.0, fireInterval: 96,  mag: 30, reloadTime: 2000, auto: true,  spread: 0.014, range: 125, pellets: 1, zoom: 1.6,  recoil: 0.013, color: 0x46523f, barrelLen: 0.58, bulky: 0.07 },
  sks:    { id: 'sks',    name: 'SKS 射手步枪',   type: '射手步枪', damage: 42, headMult: 2.3, fireInterval: 240, mag: 20, reloadTime: 1900, auto: false, spread: 0.009, range: 160, pellets: 1, zoom: 2.2,  recoil: 0.024, color: 0x5d4527, barrelLen: 0.72, bulky: 0.055 },
  mini14: { id: 'mini14', name: 'Mini14 射手步枪',type: '射手步枪', damage: 36, headMult: 2.3, fireInterval: 190, mag: 20, reloadTime: 1800, auto: false, spread: 0.008, range: 150, pellets: 1, zoom: 2.0,  recoil: 0.018, color: 0x35383d, barrelLen: 0.68, bulky: 0.055 },
  m24:    { id: 'm24',    name: 'M24 狙击枪',     type: '狙击枪',   damage: 82, headMult: 2.6, fireInterval: 1400,mag: 5,  reloadTime: 2600, auto: false, spread: 0.002, range: 300, pellets: 1, zoom: 4.0,  recoil: 0.055, color: 0x2e3330, barrelLen: 0.85, bulky: 0.06 },
  awm:    { id: 'awm',    name: 'AWM 狙击枪',     type: '狙击枪',   damage: 118,headMult: 2.8, fireInterval: 1700,mag: 5,  reloadTime: 3000, auto: false, spread: 0.001, range: 400, pellets: 1, zoom: 6.0,  recoil: 0.075, color: 0x3d4a3a, barrelLen: 0.92, bulky: 0.062 },
  m249:   { id: 'm249',   name: 'M249 轻机枪',    type: '轻机枪',   damage: 24, headMult: 1.9, fireInterval: 80,  mag: 100,reloadTime: 3600, auto: true,  spread: 0.034, range: 130, pellets: 1, zoom: 1.3,  recoil: 0.015, color: 0x3f4436, barrelLen: 0.70, bulky: 0.085 },
}

/** 初始近战武器：战术匕首（永久装备，不掉落、不用弹药；捡到枪后按 1 随时切回） */
export const KNIFE: GunDef = {
  id: 'knife', name: '战术匕首', type: '近战武器', damage: 45, headMult: 1.5,
  fireInterval: 480, mag: 0, reloadTime: 0, auto: true, spread: 0,
  range: 2.9, pellets: 1, zoom: 1, recoil: 0, color: 0xa8b0ba, barrelLen: 0.42, bulky: 0.02,
  melee: true,
}

// ===================== 物品库（每种物品固定一个稀有度） =====================
export const ITEMS: Record<string, ItemDef> = {
  // ---- 白 ----
  w_p92:    { id: 'w_p92',    name: 'P92 手枪',     kind: 'weapon', rarity: 'white', w: 2, h: 1, baseValue: 180,  icon: '🔫', gunId: 'p92' },
  w_uzi:    { id: 'w_uzi',    name: 'UZI 冲锋枪',   kind: 'weapon', rarity: 'white', w: 2, h: 2, baseValue: 380,  icon: '🔫', gunId: 'uzi' },
  w_m870:   { id: 'w_m870',   name: 'M870 霰弹枪',  kind: 'weapon', rarity: 'white', w: 4, h: 1, baseValue: 460,  icon: '🔫', gunId: 'm870' },
  v_coin:   { id: 'v_coin',   name: '金币',         kind: 'valuable', rarity: 'white', w: 1, h: 1, baseValue: 90,  icon: '🪙', stack: 5 },
  v_cigar:  { id: 'v_cigar',  name: '雪茄盒',       kind: 'valuable', rarity: 'white', w: 2, h: 1, baseValue: 220, icon: '📦' },
  m_bandage:{ id: 'm_bandage',name: '绷带',         kind: 'med', rarity: 'white', w: 1, h: 1, baseValue: 40, icon: '🩹', heal: 25, stack: 5 },
  // ===== 战术装备（P3 #22）：战前配装 1 件带入局内，T 键使用，用掉就没 =====
  t_drone: { id: 't_drone', name: '侦察无人机', kind: 'tactical', rarity: 'blue',  w: 2, h: 1, baseValue: 900, icon: '🛰️' },
  m_spray: { id: 'm_spray', name: '消毒喷雾',   kind: 'med',      rarity: 'green', w: 1, h: 1, baseValue: 260, icon: '🧴', stack: 3 }, // 感染爆发主题：使用后 60 秒免疫感染容器伤害
  // ===== 战役章节专属纪念变卖物（P3 #23）：只此一家，战役通关奖励 =====
  // ===== 战役关卡夺取目标（P3 #23）：只此一家，仅对应关卡的剧情盒子产出 =====
  g_c1l1: { id: 'g_c1l1', name: '铁爪的布防图',     kind: 'valuable', rarity: 'purple', w: 1, h: 2, baseValue: 1600, icon: '🗺️' },
  g_c1l2: { id: 'g_c1l2', name: '井下爆破记录',     kind: 'valuable', rarity: 'cyan',   w: 1, h: 2, baseValue: 3200, icon: '📋' },
  g_c1l3: { id: 'g_c1l3', name: '铁爪的随身信物',   kind: 'valuable', rarity: 'red',    w: 1, h: 1, baseValue: 6800, icon: '⛏️' },
  g_c2l1: { id: 'g_c2l1', name: '典狱长巡逻日志',   kind: 'valuable', rarity: 'purple', w: 1, h: 2, baseValue: 1800, icon: '📔' },
  g_c2l2: { id: 'g_c2l2', name: '封存的囚徒档案',   kind: 'valuable', rarity: 'cyan',   w: 2, h: 2, baseValue: 3500, icon: '🗃️' },
  g_c2l3: { id: 'g_c2l3', name: '旧秩序勋章',       kind: 'valuable', rarity: 'red',    w: 1, h: 1, baseValue: 7200, icon: '🎖️' },
  g_c3l1: { id: 'g_c3l1', name: '雷达站情报芯片',   kind: 'valuable', rarity: 'purple', w: 1, h: 1, baseValue: 1900, icon: '💾' },
  g_c3l2: { id: 'g_c3l2', name: '雪原狙击记录',     kind: 'valuable', rarity: 'cyan',   w: 1, h: 2, baseValue: 3800, icon: '🎯' },
  g_c3l3: { id: 'g_c3l3', name: '白狼的测距仪',     kind: 'valuable', rarity: 'red',    w: 2, h: 1, baseValue: 7600, icon: '🔭' },
  g_c4l1: { id: 'g_c4l1', name: '法老的金色圣物',   kind: 'valuable', rarity: 'purple', w: 1, h: 1, baseValue: 2200, icon: '🏺' },
  g_c4l2: { id: 'g_c4l2', name: '陪葬宝石面具',     kind: 'valuable', rarity: 'cyan',   w: 2, h: 2, baseValue: 4200, icon: '🎭' },
  g_c4l3: { id: 'g_c4l3', name: '伊姆霍特的祭司杖', kind: 'valuable', rarity: 'red',    w: 1, h: 3, baseValue: 8800, icon: '🪄' },
  c_claw:   { id: 'c_claw',   name: '铁爪徽记',         kind: 'valuable', rarity: 'red', w: 1, h: 1, baseValue: 8000,  icon: '🪝' },
  c_keys:   { id: 'c_keys',   name: '典狱长的钥匙串',   kind: 'valuable', rarity: 'red', w: 1, h: 1, baseValue: 9600,  icon: '🗝️' },
  c_wolf:   { id: 'c_wolf',   name: '白狼之瞳',         kind: 'valuable', rarity: 'red', w: 1, h: 1, baseValue: 11200, icon: '👁️' },
  c_scarab: { id: 'c_scarab', name: '伊姆霍特的圣甲虫', kind: 'valuable', rarity: 'red', w: 1, h: 1, baseValue: 13600, icon: '🪲' },
  t_mine:  { id: 't_mine',  name: '绊雷',       kind: 'tactical', rarity: 'blue',  w: 1, h: 1, baseValue: 700, icon: '🪤' },
  t_smoke: { id: 't_smoke', name: '烟雾弹',     kind: 'tactical', rarity: 'green', w: 1, h: 1, baseValue: 400, icon: '💨' },
  a_ammo:   { id: 'a_ammo',   name: '1级·普通弹',   kind: 'ammo', rarity: 'white',  w: 1, h: 1, baseValue: 30,   icon: '📦', stack: 4, pen: 1, dmgMul: 1,     weight: 0.3 },
  a_ammo2:  { id: 'a_ammo2',  name: '2级·加强弹',   kind: 'ammo', rarity: 'green',  w: 1, h: 1, baseValue: 80,   icon: '🟢', stack: 4, pen: 2, dmgMul: 1.05,  weight: 0.3 },
  a_ammo3:  { id: 'a_ammo3',  name: '3级·穿甲弹',   kind: 'ammo', rarity: 'blue',   w: 1, h: 1, baseValue: 200,  icon: '🔵', stack: 4, pen: 3, dmgMul: 1.1,   weight: 0.3 },
  a_ammo4:  { id: 'a_ammo4',  name: '4级·高速穿甲弹', kind: 'ammo', rarity: 'purple', w: 1, h: 1, baseValue: 480,  icon: '🟣', stack: 4, pen: 4, dmgMul: 1.16,  weight: 0.3 },
  a_ammo5:  { id: 'a_ammo5',  name: '5级·钨芯弹',   kind: 'ammo', rarity: 'cyan',   w: 1, h: 1, baseValue: 1100, icon: '🩵', stack: 4, pen: 5, dmgMul: 1.23,  weight: 0.3 },
  a_ammo6:  { id: 'a_ammo6',  name: '6级·毁灭者弹', kind: 'ammo', rarity: 'red',    w: 1, h: 1, baseValue: 2600, icon: '🔴', stack: 4, pen: 6, dmgMul: 1.32,  weight: 0.3 },

  // ===== 护甲 / 头盔（3 级，有耐久） =====
  armor1:   { id: 'armor1',   name: '轻型防弹衣',   kind: 'vest',   rarity: 'green',  w: 2, h: 2, baseValue: 900,  icon: '🦺', armorLv: 1, durability: 50,  weight: 4 },
  armor2:   { id: 'armor2',   name: '战术防弹衣',   kind: 'vest',   rarity: 'blue',   w: 2, h: 2, baseValue: 2600, icon: '🛡️', armorLv: 2, durability: 75,  weight: 6 },
  armor3:   { id: 'armor3',   name: '重型防弹衣',   kind: 'vest',   rarity: 'purple', w: 2, h: 3, baseValue: 6200, icon: '⚜️', armorLv: 3, durability: 100, weight: 9 },
  helmet1:  { id: 'helmet1',  name: '摩托头盔',     kind: 'helmet', rarity: 'green',  w: 2, h: 2, baseValue: 700,  icon: '🪖', armorLv: 1, durability: 40,  weight: 2 },
  helmet2:  { id: 'helmet2',  name: '战术头盔',     kind: 'helmet', rarity: 'blue',   w: 2, h: 2, baseValue: 2000, icon: '🎖️', armorLv: 2, durability: 60,  weight: 2.6 },
  helmet3:  { id: 'helmet3',  name: '重装头盔',     kind: 'helmet', rarity: 'purple', w: 2, h: 2, baseValue: 4800, icon: '👑', armorLv: 3, durability: 80,  weight: 3.2 },
  // ---- 绿 ----
  w_s12k:   { id: 'w_s12k',   name: 'S12K 霰弹枪',  kind: 'weapon', rarity: 'green', w: 3, h: 2, baseValue: 560,  icon: '🔫', gunId: 's12k' },
  w_sks:    { id: 'w_sks',    name: 'SKS 射手步枪', kind: 'weapon', rarity: 'green', w: 4, h: 2, baseValue: 700,  icon: '🔫', gunId: 'sks' },
  v_watch:  { id: 'v_watch',  name: '古董怀表',     kind: 'valuable', rarity: 'green', w: 1, h: 1, baseValue: 260, icon: '⌚' },
  v_scope:  { id: 'v_scope',  name: '军用望远镜',   kind: 'valuable', rarity: 'green', w: 2, h: 1, baseValue: 320, icon: '🔭' },
  m_medkit: { id: 'm_medkit', name: '急救包',       kind: 'med', rarity: 'green', w: 2, h: 2, baseValue: 150, icon: '💊', heal: 75 },
  // ---- 蓝 ----
  w_deagle: { id: 'w_deagle', name: '沙漠之鹰',     kind: 'weapon', rarity: 'blue', w: 2, h: 1, baseValue: 420,  icon: '🔫', gunId: 'deagle' },
  w_mp5:    { id: 'w_mp5',    name: 'MP5 冲锋枪',   kind: 'weapon', rarity: 'blue', w: 3, h: 2, baseValue: 560,  icon: '🔫', gunId: 'mp5' },
  w_mini14: { id: 'w_mini14', name: 'Mini14 射手步枪', kind: 'weapon', rarity: 'blue', w: 4, h: 2, baseValue: 720, icon: '🔫', gunId: 'mini14' },
  v_ring:   { id: 'v_ring',   name: '钻戒',         kind: 'valuable', rarity: 'blue', w: 1, h: 1, baseValue: 600, icon: '💍' },
  v_chip:   { id: 'v_chip',   name: '军用芯片',     kind: 'valuable', rarity: 'blue', w: 1, h: 1, baseValue: 780, icon: '💾' },
  // ---- 紫 ----
  w_vector: { id: 'w_vector', name: 'Vector 冲锋枪',kind: 'weapon', rarity: 'purple', w: 3, h: 2, baseValue: 1100, icon: '🔫', gunId: 'vector' },
  w_akm:    { id: 'w_akm',    name: 'AKM 突击步枪', kind: 'weapon', rarity: 'purple', w: 4, h: 2, baseValue: 1300, icon: '🔫', gunId: 'akm' },
  w_m4a1:   { id: 'w_m4a1',   name: 'M4A1 突击步枪',kind: 'weapon', rarity: 'purple', w: 4, h: 2, baseValue: 1400, icon: '🔫', gunId: 'm4a1' },
  w_scar:   { id: 'w_scar',   name: 'SCAR-L 突击步枪', kind: 'weapon', rarity: 'purple', w: 4, h: 2, baseValue: 1350, icon: '🔫', gunId: 'scar' },
  v_goldbar:{ id: 'v_goldbar',name: '金条',         kind: 'valuable', rarity: 'purple', w: 2, h: 1, baseValue: 1500, icon: '🥇' },
  v_intel:  { id: 'v_intel',  name: '机密情报',     kind: 'valuable', rarity: 'purple', w: 1, h: 2, baseValue: 1300, icon: '📄' },
  // ---- 青 ----
  w_aug:    { id: 'w_aug',    name: 'AUG 突击步枪', kind: 'weapon', rarity: 'cyan', w: 4, h: 2, baseValue: 2200, icon: '🔫', gunId: 'aug' },
  w_m24:    { id: 'w_m24',    name: 'M24 狙击枪',   kind: 'weapon', rarity: 'cyan', w: 5, h: 2, baseValue: 3000, icon: '🔫', gunId: 'm24' },
  w_m249:   { id: 'w_m249',   name: 'M249 轻机枪',  kind: 'weapon', rarity: 'cyan', w: 5, h: 2, baseValue: 3400, icon: '🔫', gunId: 'm249' },
  v_jade:   { id: 'v_jade',   name: '翡翠雕像',     kind: 'valuable', rarity: 'cyan', w: 2, h: 2, baseValue: 2800, icon: '🗿' },
  v_vase:   { id: 'v_vase',   name: '古董花瓶',     kind: 'valuable', rarity: 'cyan', w: 2, h: 2, baseValue: 3200, icon: '🏺' },
  // ---- 红 ----
  w_awm:    { id: 'w_awm',    name: 'AWM 狙击枪',   kind: 'weapon', rarity: 'red', w: 5, h: 2, baseValue: 8000,  icon: '🔫', gunId: 'awm' },
  v_crown:  { id: 'v_crown',  name: '黄金王冠',     kind: 'valuable', rarity: 'red', w: 2, h: 2, baseValue: 6000, icon: '👑' },
  v_super:  { id: 'v_super',  name: '曼德尔超算单元', kind: 'valuable', rarity: 'red', w: 2, h: 3, baseValue: 9000, icon: '🖥️' },
  // ===== 房卡：对局内任何容器都可能出，用于开对应地图的专属锁房 =====
  k_w_shed:   { id: 'k_w_shed',   name: '工棚房卡',   kind: 'key', rarity: 'green',  w: 1, h: 1, baseValue: 800,   icon: '💳' },
  k_w_cave:   { id: 'k_w_cave',   name: '矿洞房卡',   kind: 'key', rarity: 'blue',   w: 1, h: 1, baseValue: 2000,  icon: '💳' },
  k_w_store:  { id: 'k_w_store',  name: '仓储房卡',   kind: 'key', rarity: 'purple', w: 1, h: 1, baseValue: 5000,  icon: '💳' },
  k_w_core:   { id: 'k_w_core',   name: '核心区房卡', kind: 'key', rarity: 'red',    w: 1, h: 1, baseValue: 12000, icon: '💳' },
  k_t_dorm:   { id: 'k_t_dorm',   name: '宿舍房卡',   kind: 'key', rarity: 'green',  w: 1, h: 1, baseValue: 800,   icon: '💳' },
  k_t_arch:   { id: 'k_t_arch',   name: '档案室房卡', kind: 'key', rarity: 'blue',   w: 1, h: 1, baseValue: 2000,  icon: '💳' },
  k_t_arm:    { id: 'k_t_arm',    name: '军械库房卡', kind: 'key', rarity: 'purple', w: 1, h: 1, baseValue: 5000,  icon: '💳' },
  k_t_warden: { id: 'k_t_warden', name: '典狱长密卡', kind: 'key', rarity: 'red',    w: 1, h: 1, baseValue: 12000, icon: '💳' },
  k_d_gate:   { id: 'k_d_gate',   name: '陵寝外门卡', kind: 'key', rarity: 'purple', w: 1, h: 1, baseValue: 9000,  icon: '💳' },
  k_d_tomb:   { id: 'k_d_tomb',   name: '法老金卡',   kind: 'key', rarity: 'red',    w: 1, h: 1, baseValue: 13000, icon: '💳' },
  k_d_crypt:  { id: 'k_d_crypt',  name: '侧墓室房卡', kind: 'key', rarity: 'blue',   w: 1, h: 1, baseValue: 4000,  icon: '💳' },
  k_d_oasis:  { id: 'k_d_oasis',  name: '驿站库房卡', kind: 'key', rarity: 'green',  w: 1, h: 1, baseValue: 1800,  icon: '💳' },
  v_scarab:   { id: 'v_scarab',   name: '圣甲虫护符', kind: 'valuable', rarity: 'red', w: 1, h: 1, baseValue: 9800, icon: '🪲' },
  v_egg:    { id: 'v_egg',   name: '黄金鸟蛋',       kind: 'valuable', rarity: 'red',    w: 1, h: 1, baseValue: 5000,  icon: '🥚' },
  v_safe:   { id: 'v_safe',   name: '小型保险箱',   kind: 'valuable', rarity: 'red', w: 3, h: 3, baseValue: 12000, icon: '🧰' },
  // ===== 各品级新增变卖物 =====
  v_cigs:    { id: 'v_cigs',    name: '进口香烟',   kind: 'valuable', rarity: 'white',  w: 1, h: 1, baseValue: 130,  icon: '🚬' },
  v_bottle:  { id: 'v_bottle',  name: '陈年红酒',   kind: 'valuable', rarity: 'white',  w: 1, h: 2, baseValue: 260,  icon: '🍾' },
  v_camera:  { id: 'v_camera',  name: '老式相机',   kind: 'valuable', rarity: 'green',  w: 2, h: 1, baseValue: 380,  icon: '📷' },
  v_perfume: { id: 'v_perfume', name: '名贵香水',   kind: 'valuable', rarity: 'green',  w: 1, h: 1, baseValue: 310,  icon: '🧴' },
  v_gpu:     { id: 'v_gpu',     name: '显卡',       kind: 'valuable', rarity: 'blue',   w: 2, h: 1, baseValue: 950,  icon: '🎛️' },
  v_medal:   { id: 'v_medal',   name: '金质勋章',   kind: 'valuable', rarity: 'blue',   w: 1, h: 1, baseValue: 700,  icon: '🎖️' },
  v_necklace:{ id: 'v_necklace',name: '珍珠项链',   kind: 'valuable', rarity: 'purple', w: 1, h: 1, baseValue: 1600, icon: '📿' },
  v_relic:   { id: 'v_relic',   name: '青铜礼器',   kind: 'valuable', rarity: 'purple', w: 2, h: 2, baseValue: 1900, icon: '⚱️' },
  v_diamond: { id: 'v_diamond', name: '裸钻',       kind: 'valuable', rarity: 'cyan',   w: 1, h: 1, baseValue: 3600, icon: '💎' },
  v_painting:{ id: 'v_painting',name: '传世名画',   kind: 'valuable', rarity: 'cyan',   w: 2, h: 2, baseValue: 4200, icon: '🖼️' },
  v_dragon:  { id: 'v_dragon',  name: '金龙雕像',   kind: 'valuable', rarity: 'red',    w: 2, h: 2, baseValue: 7800, icon: '🐉' },
  // ===== 更多红色变卖物（绝世） =====
  v_phoenix:  { id: 'v_phoenix',  name: '火凤凰羽冠',   kind: 'valuable', rarity: 'red', w: 2, h: 2, baseValue: 8600,  icon: '🪶' },
  v_amber:    { id: 'v_amber',    name: '史前虫珀',     kind: 'valuable', rarity: 'red', w: 1, h: 1, baseValue: 6600,  icon: '🟠' },
  v_scroll:   { id: 'v_scroll',   name: '千年古卷',     kind: 'valuable', rarity: 'red', w: 1, h: 3, baseValue: 9200,  icon: '📜' },
  v_cup:      { id: 'v_cup',      name: '金瓯永固杯',   kind: 'valuable', rarity: 'red', w: 1, h: 2, baseValue: 10800, icon: '🏆' },
  v_meteor:   { id: 'v_meteor',   name: '陨铁核心',     kind: 'valuable', rarity: 'red', w: 2, h: 1, baseValue: 7300,  icon: '☄️' },
  v_pearl:    { id: 'v_pearl',    name: '东海夜明珠',   kind: 'valuable', rarity: 'red', w: 1, h: 1, baseValue: 11800, icon: '🔮' },
  // ===== 口袋红货（格数小、价值密度高，好塞保险箱） =====
  v_ruby:     { id: 'v_ruby',     name: '鸽血红宝石',   kind: 'valuable', rarity: 'red', w: 1, h: 1, baseValue: 7400,  icon: '♦️' },
  v_fang:     { id: 'v_fang',     name: '血珀狼牙',     kind: 'valuable', rarity: 'red', w: 1, h: 1, baseValue: 6500,  icon: '🦷' },
  v_compass:  { id: 'v_compass',  name: '黄金罗盘',     kind: 'valuable', rarity: 'red', w: 1, h: 1, baseValue: 6900,  icon: '🧭' },
  v_seal:     { id: 'v_seal',     name: '暗河金印',     kind: 'valuable', rarity: 'red', w: 1, h: 1, baseValue: 13200, icon: '🏵️' },
  v_flute:    { id: 'v_flute',    name: '金丝玉箫',     kind: 'valuable', rarity: 'red', w: 1, h: 2, baseValue: 8800,  icon: '🎵' },
  v_mask:     { id: 'v_mask',     name: '法老金面',     kind: 'valuable', rarity: 'red', w: 2, h: 1, baseValue: 9400,  icon: '✨' },
  // ===== 巨型红货（占格很大，搬运本身就是挑战） =====
  v_tank:     { id: 'v_tank',     name: '黄金坦克模型', kind: 'valuable', rarity: 'red', w: 4, h: 2, baseValue: 12800, icon: '🚜', weight: 14 },
  v_engine:   { id: 'v_engine',   name: '航天发动机',   kind: 'valuable', rarity: 'red', w: 4, h: 3, baseValue: 15800, icon: '🚀', weight: 22 },
  v_reactor:  { id: 'v_reactor',  name: '微型核反应堆', kind: 'valuable', rarity: 'red', w: 3, h: 3, baseValue: 16800, icon: '☢️', weight: 18 }, // 保险柜专属
  v_bell:     { id: 'v_bell',     name: '青铜朝钟',     kind: 'valuable', rarity: 'red', w: 3, h: 3, baseValue: 14600, icon: '🔔', weight: 16 },
  v_warrior:  { id: 'v_warrior',  name: '青铜武士俑',   kind: 'valuable', rarity: 'red', w: 2, h: 4, baseValue: 13900, icon: '💂', weight: 15 },
  v_cannon:   { id: 'v_cannon',   name: '锈蚀舰炮',     kind: 'valuable', rarity: 'red', w: 5, h: 2, baseValue: 15400, icon: '🧨', weight: 19 },
  v_piano:    { id: 'v_piano',    name: '鎏金三角钢琴', kind: 'valuable', rarity: 'red', w: 4, h: 3, baseValue: 16400, icon: '🎹', weight: 24 },
  v_sarc:     { id: 'v_sarc',     name: '黄金石棺',     kind: 'valuable', rarity: 'red', w: 4, h: 3, baseValue: 18600, icon: '⚰️', weight: 26 }, // 保险柜专属
  v_sat:      { id: 'v_sat',      name: '军用卫星组件', kind: 'valuable', rarity: 'red', w: 3, h: 4, baseValue: 17800, icon: '📡', weight: 21 }, // 航空箱专属
  // ===== Boss 专属掉落（仅对应 Boss 低概率掉落，不在普通容器池中） =====
  v_core:      { id: 'v_core',      name: '铁爪的动力核心', kind: 'valuable', rarity: 'red', w: 2, h: 2, baseValue: 15000, icon: '⚙️' },
  v_blueprint: { id: 'v_blueprint', name: '巴别塔蓝图',     kind: 'valuable', rarity: 'red', w: 1, h: 3, baseValue: 18000, icon: '🗼' },
  v_scepter:   { id: 'v_scepter',   name: '典狱长的权杖',   kind: 'valuable', rarity: 'red', w: 1, h: 3, baseValue: 16000, icon: '👑' },
  v_sharktooth:{ id: 'v_sharktooth',name: '狂鲨的牙齿项链', kind: 'valuable', rarity: 'red', w: 1, h: 2, baseValue: 13000, icon: '🦈' },
  v_wolfcamo:  { id: 'v_wolfcamo',  name: '白狼的雪地迷彩', kind: 'valuable', rarity: 'red', w: 2, h: 2, baseValue: 17000, icon: '🐺' },
  // ===== 武器配件（装到枪上改变手感） =====
  at_rdot:   { id: 'at_rdot',   name: '红点瞄具',   kind: 'attachment', rarity: 'green', w: 1, h: 1, baseValue: 800,  icon: '🔴', slot: 'scope' },
  at_scope4: { id: 'at_scope4', name: '四倍瞄准镜', kind: 'attachment', rarity: 'blue',  w: 1, h: 1, baseValue: 2200, icon: '🔭', slot: 'scope' },
  at_supp:   { id: 'at_supp',   name: '消音器',     kind: 'attachment', rarity: 'blue',  w: 2, h: 1, baseValue: 2600, icon: '🤫', slot: 'muzzle' },
  at_comp:   { id: 'at_comp',   name: '枪口补偿器', kind: 'attachment', rarity: 'green', w: 1, h: 1, baseValue: 900,  icon: '⚙️', slot: 'muzzle' },
  at_qmag:   { id: 'at_qmag',   name: '快速弹匣',   kind: 'attachment', rarity: 'green', w: 1, h: 1, baseValue: 850,  icon: '⚡', slot: 'mag' },
  at_emag:   { id: 'at_emag',   name: '扩容弹匣',   kind: 'attachment', rarity: 'blue',  w: 1, h: 1, baseValue: 2400, icon: '📥', slot: 'mag' },
  at_stock_s:{ id: 'at_stock_s',name: '稳定枪托',   kind: 'attachment', rarity: 'blue',  w: 2, h: 1, baseValue: 2100, icon: '🪵', slot: 'stock' },
  at_stock_l:{ id: 'at_stock_l',name: '轻型枪托',   kind: 'attachment', rarity: 'blue',  w: 2, h: 1, baseValue: 2000, icon: '🪶', slot: 'stock' },
  at_grip_v: { id: 'at_grip_v', name: '垂直握把',   kind: 'attachment', rarity: 'green', w: 1, h: 1, baseValue: 950,  icon: '✊', slot: 'grip' },
  at_grip_l: { id: 'at_grip_l', name: '轻型握把',   kind: 'attachment', rarity: 'green', w: 1, h: 1, baseValue: 900,  icon: '🤏', slot: 'grip' },
  at_laser:  { id: 'at_laser',  name: '战术镭射',   kind: 'attachment', rarity: 'purple', w: 1, h: 1, baseValue: 3200, icon: '🔦', slot: 'laser' },
  at_laser_r:{ id: 'at_laser_r',name: '毁灭镭射',   kind: 'attachment', rarity: 'red',   w: 1, h: 1, baseValue: 8800, icon: '⚡', slot: 'laser' },
  // ===== 潮汐监狱房卡 =====
  k_p_cell:   { id: 'k_p_cell',   name: '禁闭室房卡',     kind: 'key', rarity: 'green',  w: 1, h: 1, baseValue: 800,   icon: '💳' },
  k_p_med:    { id: 'k_p_med',    name: '医务室房卡',     kind: 'key', rarity: 'blue',   w: 1, h: 1, baseValue: 2000,  icon: '💳' },
  k_p_arm:    { id: 'k_p_arm',    name: '狱警军械库房卡', kind: 'key', rarity: 'purple', w: 1, h: 1, baseValue: 5000,  icon: '💳' },
  k_p_warden: { id: 'k_p_warden', name: '典狱长办公室卡', kind: 'key', rarity: 'red',    w: 1, h: 1, baseValue: 12000, icon: '💳' },
  // ===== 雪地雷达站房卡 =====
  k_s_post:   { id: 'k_s_post',   name: '哨所房卡',     kind: 'key', rarity: 'green',  w: 1, h: 1, baseValue: 800,   icon: '💳' },
  k_s_hangar: { id: 'k_s_hangar', name: '机库钥匙',     kind: 'key', rarity: 'blue',   w: 1, h: 1, baseValue: 2000,  icon: '💳' },
  k_s_ctrl:   { id: 'k_s_ctrl',   name: '雷达控制室卡', kind: 'key', rarity: 'purple', w: 1, h: 1, baseValue: 5000,  icon: '💳' },
  k_s_office: { id: 'k_s_office', name: '站长办公室卡', kind: 'key', rarity: 'red',    w: 1, h: 1, baseValue: 12000, icon: '💳' },
}

// 通用容器战利品池（weight 为基础权重，luck 会按稀有度档位放大高稀有度权重）
// 注意：枪械不在此池，全游戏只有「武器箱」会出枪
export const LOOT_POOL: { defId: string; weight: number }[] = [
  { defId: 'v_coin', weight: 20 }, { defId: 'v_cigar', weight: 12 }, { defId: 'm_bandage', weight: 16 }, { defId: 'a_ammo', weight: 14 }, { defId: 'm_spray', weight: 6 },
  { defId: 'v_cigs', weight: 15 }, { defId: 'v_bottle', weight: 11 },
  { defId: 'v_watch', weight: 12 }, { defId: 'v_scope', weight: 9 }, { defId: 'm_medkit', weight: 8 },
  { defId: 'v_camera', weight: 9 }, { defId: 'v_perfume', weight: 9 },
  { defId: 'v_ring', weight: 9 }, { defId: 'v_chip', weight: 7 }, { defId: 'v_gpu', weight: 5 }, { defId: 'v_medal', weight: 7 },
  { defId: 'v_goldbar', weight: 5 }, { defId: 'v_intel', weight: 6 }, { defId: 'v_necklace', weight: 4.5 }, { defId: 'v_relic', weight: 3.5 },
  { defId: 'v_jade', weight: 2.5 }, { defId: 'v_vase', weight: 2 }, { defId: 'v_diamond', weight: 1.8 }, { defId: 'v_painting', weight: 1.4 },
  { defId: 'v_crown', weight: 0.48 }, { defId: 'v_super', weight: 0.32 }, { defId: 'v_safe', weight: 0.2 }, { defId: 'v_dragon', weight: 0.32 },
  { defId: 'v_phoenix', weight: 0.28 }, { defId: 'v_amber', weight: 0.4 }, { defId: 'v_scroll', weight: 0.24 },
  { defId: 'v_cup', weight: 0.18 }, { defId: 'v_meteor', weight: 0.32 }, { defId: 'v_pearl', weight: 0.16 },
  { defId: 'v_ruby', weight: 0.38 }, { defId: 'v_fang', weight: 0.4 }, { defId: 'v_compass', weight: 0.36 },
  { defId: 'v_flute', weight: 0.26 }, { defId: 'v_mask', weight: 0.24 }, { defId: 'v_seal', weight: 0.14 },
  { defId: 'v_tank', weight: 0.12 }, { defId: 'v_engine', weight: 0.09 },
  { defId: 'v_bell', weight: 0.1 }, { defId: 'v_warrior', weight: 0.1 }, { defId: 'v_cannon', weight: 0.08 }, { defId: 'v_piano', weight: 0.07 },
  { defId: 'a_ammo2', weight: 3 }, { defId: 'a_ammo3', weight: 1 },
  { defId: 'at_grip_v', weight: 2.5 }, { defId: 'at_stock_l', weight: 1.5 },
]

// 武器箱专属池：枪的唯一来源（含少量弹药/绷带填充，高级枪权重压得很低）
export const WEAPON_LOOT_POOL: { defId: string; weight: number }[] = [
  { defId: 'a_ammo', weight: 16 }, { defId: 'm_bandage', weight: 6 },
  { defId: 'w_p92', weight: 13 }, { defId: 'w_uzi', weight: 11 }, { defId: 'w_m870', weight: 10 },
  { defId: 'w_s12k', weight: 7.5 }, { defId: 'w_sks', weight: 6.5 },
  { defId: 'w_deagle', weight: 7 }, { defId: 'w_mp5', weight: 6 }, { defId: 'w_mini14', weight: 4.5 },
  { defId: 'w_vector', weight: 3.6 }, { defId: 'w_akm', weight: 4 }, { defId: 'w_m4a1', weight: 3.6 }, { defId: 'w_scar', weight: 3.4 },
  { defId: 'w_aug', weight: 2 }, { defId: 'w_m24', weight: 1.4 }, { defId: 'w_m249', weight: 1.2 },
  { defId: 'w_awm', weight: 0.2 },
  // 配件（武器箱也出）
  { defId: 'at_rdot', weight: 4 }, { defId: 'at_comp', weight: 3.5 }, { defId: 'at_qmag', weight: 3.5 },
  { defId: 'at_scope4', weight: 1.8 }, { defId: 'at_supp', weight: 1.5 }, { defId: 'at_emag', weight: 1.8 },
  { defId: 'at_grip_v', weight: 2.8 }, { defId: 'at_grip_l', weight: 2.6 }, { defId: 'at_stock_s', weight: 1.6 }, { defId: 'at_stock_l', weight: 1.5 }, { defId: 'at_laser', weight: 0.8 },
  { defId: 'a_ammo2', weight: 5 }, { defId: 'a_ammo3', weight: 2 },
  { defId: 'armor1', weight: 2 }, { defId: 'helmet1', weight: 2 },
]

// 保险柜专属池：锁房高价值变卖物（无枪无垃圾）
export const VAULT_LOOT_POOL: { defId: string; weight: number }[] = [
  { defId: 'v_watch', weight: 12 }, { defId: 'v_ring', weight: 10 }, { defId: 'v_chip', weight: 9 }, { defId: 'v_goldbar', weight: 8 },
  { defId: 'v_intel', weight: 8 }, { defId: 'v_necklace', weight: 7 }, { defId: 'v_relic', weight: 6 },
  { defId: 'v_jade', weight: 5 }, { defId: 'v_vase', weight: 4 }, { defId: 'v_diamond', weight: 4 }, { defId: 'v_painting', weight: 3 },
  { defId: 'v_crown', weight: 1.0 }, { defId: 'v_dragon', weight: 0.8 }, { defId: 'v_phoenix', weight: 0.72 }, { defId: 'v_super', weight: 0.6 },
  { defId: 'v_ruby', weight: 0.7 }, { defId: 'v_seal', weight: 0.5 }, { defId: 'v_mask', weight: 0.55 }, { defId: 'v_bell', weight: 0.35 },
  { defId: 'v_reactor', weight: 0.4 }, // ☢️ 微型核反应堆：全游戏唯一出处
  { defId: 'v_sarc', weight: 0.32 }, // ⚰️ 黄金石棺：保险柜专属巨型红货
]

// 弹药箱专属池：六级子弹的主要产出（高级弹权重极低）
export const AMMO_BOX_POOL: { defId: string; weight: number }[] = [
  { defId: 'a_ammo', weight: 30 }, { defId: 'a_ammo2', weight: 22 }, { defId: 'a_ammo3', weight: 12 },
  { defId: 'a_ammo4', weight: 5 }, { defId: 'a_ammo5', weight: 1.8 }, { defId: 'a_ammo6', weight: 0.5 },
  { defId: 'm_bandage', weight: 6 },
]

// 售货机专属池：补给品（投币购买）
export const VENDOR_LOOT_POOL: { defId: string; weight: number }[] = [
  { defId: 'm_bandage', weight: 30 }, { defId: 'a_ammo', weight: 30 }, { defId: 'm_medkit', weight: 22 }, { defId: 'v_coin', weight: 8 },
]

// 敌人掉落池（不掉枪）
export const ENEMY_LOOT_POOL: { defId: string; weight: number }[] = [
  { defId: 'v_coin', weight: 16 }, { defId: 'm_bandage', weight: 18 }, { defId: 'a_ammo', weight: 18 },
  { defId: 'v_watch', weight: 10 }, { defId: 'm_medkit', weight: 6 },
  { defId: 'v_ring', weight: 6 }, { defId: 'v_chip', weight: 5 }, { defId: 'v_goldbar', weight: 3 },
]

let uidCounter = 1
/** 创建物品实例，稀有度由物品定义固定 */
export function makeItem(defId: string, count = 1): ItemInstance {
  const def = ITEMS[defId]
  return { uid: `it${uidCounter++}_${Math.random().toString(36).slice(2, 7)}`, defId, rarity: def.rarity, count }
}


// 鸟窝专属池：黄金鸟蛋只在这里出，概率压得很低（约 1%）
export const NEST_LOOT_POOL: { defId: string; weight: number }[] = [
  { defId: 'a_ammo', weight: 10 }, { defId: 'm_bandage', weight: 8 },
  { defId: 'v_coin', weight: 6 }, { defId: 'v_cigar', weight: 5 }, { defId: 'v_watch', weight: 2 },
  { defId: 'v_egg', weight: 0.06 },
]

// 房卡掉落池：每张图 4 种，稀有度越高级权重越低
export const CARD_POOLS: Record<string, { defId: string; weight: number }[]> = {
  wild: [
    { defId: 'k_w_shed', weight: 10 }, { defId: 'k_w_cave', weight: 5 },
    { defId: 'k_w_store', weight: 2 }, { defId: 'k_w_core', weight: 0.24 },
  ],
  desert: [
    { defId: 'k_d_oasis', weight: 10 }, { defId: 'k_d_crypt', weight: 5 },
    { defId: 'k_d_gate', weight: 3.5 }, { defId: 'k_d_tomb', weight: 0.9 },
  ],
  tower: [
    { defId: 'k_t_dorm', weight: 10 }, { defId: 'k_t_arch', weight: 5 },
    { defId: 'k_t_arm', weight: 2 }, { defId: 'k_t_warden', weight: 0.24 },
  ],
  prison: [
    { defId: 'k_p_cell', weight: 10 }, { defId: 'k_p_med', weight: 5 },
    { defId: 'k_p_arm', weight: 2 }, { defId: 'k_p_warden', weight: 0.24 },
  ],
  snow: [
    { defId: 'k_s_post', weight: 10 }, { defId: 'k_s_hangar', weight: 5 },
    { defId: 'k_s_ctrl', weight: 2 }, { defId: 'k_s_office', weight: 0.24 },
  ],
}

// 航空箱专属池：军用物资，中高端枪械 + 高价值变卖物，整体质量高于通用池
export const AIR_LOOT_POOL: { defId: string; weight: number }[] = [
  { defId: 'a_ammo', weight: 12 }, { defId: 'm_medkit', weight: 10 }, { defId: 'm_bandage', weight: 6 },
  { defId: 'w_mp5', weight: 8 }, { defId: 'w_mini14', weight: 6 }, { defId: 'w_vector', weight: 5.5 },
  { defId: 'w_akm', weight: 5 }, { defId: 'w_m4a1', weight: 4.5 }, { defId: 'w_scar', weight: 4.5 },
  { defId: 'w_aug', weight: 2.5 }, { defId: 'w_m24', weight: 1.5 },
  { defId: 'v_gpu', weight: 6 }, { defId: 'v_goldbar', weight: 5 }, { defId: 'v_intel', weight: 5 },
  { defId: 'v_necklace', weight: 3.5 }, { defId: 'v_jade', weight: 2 }, { defId: 'v_diamond', weight: 1.4 },
  { defId: 'v_phoenix', weight: 0.36 }, { defId: 'v_meteor', weight: 0.32 }, { defId: 'v_pearl', weight: 0.14 },
  { defId: 'v_compass', weight: 0.28 }, { defId: 'v_flute', weight: 0.22 }, { defId: 'v_ruby', weight: 0.2 },
  { defId: 'v_tank', weight: 0.1 }, { defId: 'v_cannon', weight: 0.12 }, { defId: 'v_piano', weight: 0.08 },
  { defId: 'v_sat', weight: 0.1 }, // 📡 军用卫星组件：航空箱专属
  { defId: 'a_ammo3', weight: 3 }, { defId: 'a_ammo4', weight: 1.6 }, { defId: 'a_ammo5', weight: 0.5 },
  { defId: 'at_scope4', weight: 1.2 }, { defId: 'at_supp', weight: 1 }, { defId: 'at_emag', weight: 1.2 },
  { defId: 'at_stock_s', weight: 1.4 }, { defId: 'at_grip_v', weight: 1.6 }, { defId: 'at_laser', weight: 0.7 },
  { defId: 'armor2', weight: 1.2 }, { defId: 'helmet2', weight: 1.2 }, { defId: 'armor3', weight: 0.4 }, { defId: 'helmet3', weight: 0.4 },
]

// ===================== Boss 专属掉落表（稀有爆率 1%） =====================
export const BOSS_DROP_RATE = 0.01
export const BOSS_DROPS: { boss: string; defId: string }[] = [
  { boss: '矿区霸主·铁爪', defId: 'v_core' },
  { boss: '塔主·典狱长', defId: 'v_blueprint' },
  { boss: '监狱长·洛克', defId: 'v_scepter' },
  { boss: '狱警队长·狂鲨', defId: 'v_sharktooth' },
  { boss: '「雪盲」·白狼', defId: 'v_wolfcamo' },
  { boss: '沙之祭司·伊姆霍特', defId: 'v_scarab' },
]
export const BOSS_COLLECT_REWARD = 20000
const BOSS_KEY = 'mojin_boss_drops'
export function loadBossDrops(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(BOSS_KEY) || '{}') as Record<string, boolean> } catch { return {} }
}
export function saveBossDrops(d: Record<string, boolean>) {
  try { localStorage.setItem(BOSS_KEY, JSON.stringify(d)) } catch { /* 忽略 */ }
}

// ===================== 干员系统（开局前选择，每个干员 1 主动技 + 2 被动技） =====================
export interface OpMods {
  speed?: number    // 移速倍率
  reload?: number   // 换弹时间倍率
  search?: number   // 搜索速度倍率
  extract?: number  // 撤离速度倍率
  med?: number      // 医疗效果倍率
  maxHp?: number    // 生命上限加成
  reduce?: number   // 受伤减免（0-1）
  luck?: number     // 容器爆率加成
  seeRange?: number // 敌人发现距离倍率（越小越隐蔽）
}
export interface OperatorDef {
  id: string
  name: string
  icon: string
  title: string
  desc: string
  active: { icon: string; name: string; desc: string; cd: number; kind: 'stun' | 'heal' | 'reveal' | 'armor' | 'invis' | 'charge' | 'mark' | 'rally'; power: number; dur?: number }
  /** 每升 1 级的技能成长（cd 负值=减冷却，power/dur 为增量） */
  growth?: { cd?: number; power?: number; dur?: number }
  passives: { icon: string; name: string; desc: string; mods: OpMods }[]
}
export const OPERATORS: OperatorDef[] = [
  {
    id: 'assault', name: '雷枪', icon: '🛡️', title: '突击手', desc: '正面突破的专家，越是交火越兴奋。',
    active: { icon: '💥', name: '震撼弹', desc: '眩晕 20 米内所有敌人 4 秒', cd: 40, kind: 'stun', power: 20, dur: 4 },
    growth: { cd: -3, power: 2, dur: 0.4 },
    passives: [
      { icon: '⚡', name: '快速装填', desc: '换弹速度提升 30%', mods: { reload: 0.7 } },
      { icon: '🏃', name: '战场机动', desc: '移动速度提升 12%', mods: { speed: 1.12 } },
    ],
  },
  {
    id: 'medic', name: '白鸽', icon: '💉', title: '战地医师', desc: '只要她还站着，队伍就不会倒下。',
    active: { icon: '❤️', name: '急救针', desc: '立即恢复 50 点生命', cd: 45, kind: 'heal', power: 50 },
    growth: { cd: -3, power: 10 },
    passives: [
      { icon: '🧪', name: '药理精通', desc: '医疗物资效果提升 40%', mods: { med: 1.4 } },
      { icon: '💪', name: '坚韧体魄', desc: '生命上限 +25', mods: { maxHp: 25 } },
    ],
  },
  {
    id: 'recon', name: '夜莺', icon: '🦅', title: '侦察兵', desc: '战场对她来说没有迷雾。',
    active: { icon: '📡', name: '侦察脉冲', desc: '10 秒内地图（M）上显示所有敌人位置', cd: 50, kind: 'reveal', power: 0, dur: 10 },
    growth: { cd: -4, dur: 1.5 },
    passives: [
      { icon: '🔍', name: '敏锐搜索', desc: '搜索容器速度提升 40%', mods: { search: 1.4 } },
      { icon: '🍀', name: '幸运星', desc: '所有容器爆率小幅提升', mods: { luck: 0.2 } },
    ],
  },
  {
    id: 'engineer', name: '铁壁', icon: '🔧', title: '工程兵', desc: '把防御工事穿在身上的人。',
    active: { icon: '🛡️', name: '能量护甲', desc: '8 秒内受到伤害降低 60%', cd: 50, kind: 'armor', power: 0.6, dur: 8 },
    growth: { cd: -4, power: 0.05, dur: 0.5 },
    passives: [
      { icon: '🦾', name: '重型装甲', desc: '受到伤害降低 15%', mods: { reduce: 0.15 } },
      { icon: '🎒', name: '负重训练', desc: '生命上限 +15', mods: { maxHp: 15 } },
    ],
  },
  {
    id: 'ghost', name: '幽灵', icon: '🥷', title: '潜伏者', desc: '她来无影去无踪，只留下被搜空的容器。',
    active: { icon: '👻', name: '光学迷彩', desc: '7 秒内隐身，敌人无法发现你', cd: 50, kind: 'invis', power: 0, dur: 7 },
    growth: { cd: -4, dur: 1 },
    passives: [
      { icon: '🤫', name: '消音步伐', desc: '敌人发现你的距离缩短 30%', mods: { seeRange: 0.7 } },
      { icon: '🚁', name: '撤离专家', desc: '撤离速度提升 50%', mods: { extract: 1.5 } },
    ],
  },
  {
    id: 'blaster', name: '雷管', icon: '💣', title: '爆破手', desc: '他信奉的真理只有一个：没有什么墙是一包炸药解决不了的。',
    active: { icon: '🧨', name: '遥控炸药', desc: '向前掷出炸药包，1.5 秒后爆炸，重创 8 米内所有敌人', cd: 45, kind: 'charge', power: 120, dur: 1.5 },
    growth: { cd: -3, power: 15 },
    passives: [
      { icon: '🦺', name: '防爆服', desc: '受到伤害降低 10%', mods: { reduce: 0.1 } },
      { icon: '⚡', name: '熟练双手', desc: '换弹速度提升 15%', mods: { reload: 0.85 } },
    ],
  },
  {
    id: 'marksman', name: '鹰眼', icon: '🎯', title: '神射手', desc: '被她盯上的人，连影子都会出卖自己。',
    active: { icon: '🔴', name: '死亡标记', desc: '标记 30 米内所有敌人 8 秒，被标记者受伤 +35%', cd: 45, kind: 'mark', power: 0.35, dur: 8 },
    growth: { cd: -3, power: 0.04, dur: 0.5 },
    passives: [
      { icon: '🔭', name: '鹰眼视觉', desc: '敌人发现你的距离缩短 20%', mods: { seeRange: 0.8 } },
      { icon: '🎯', name: '稳手', desc: '换弹速度提升 10%', mods: { reload: 0.9 } },
    ],
  },
  {
    id: 'commander', name: '战吼', icon: '🎖️', title: '指挥官', desc: '他的声音就是战场上最可靠的火力支援。',
    active: { icon: '📣', name: '战术号令', desc: '10 秒内移速 +20%、换弹 +30%、射速 +15%', cd: 50, kind: 'rally', power: 0.2, dur: 10 },
    growth: { cd: -3, dur: 1 },
    passives: [
      { icon: '💪', name: '鼓舞士气', desc: '生命上限 +10', mods: { maxHp: 10 } },
      { icon: '🧭', name: '战场嗅觉', desc: '搜索容器速度提升 20%', mods: { search: 1.2 } },
    ],
  },
]

// ===================== 交易行商品（用金币购买，价格比卖价高不少） =====================
export interface MarketGood { defId: string; price: number }
const gunPrice = (defId: string, mult = 3) => ({ defId, price: Math.round(ITEMS[defId].baseValue * mult / 10) * 10 })
export const MARKET_GOODS: { category: string; icon: string; goods: MarketGood[] }[] = [
  {
    category: '手枪 / 冲锋枪', icon: '🔫',
    goods: [gunPrice('w_p92'), gunPrice('w_deagle'), gunPrice('w_uzi'), gunPrice('w_mp5'), gunPrice('w_vector')],
  },
  {
    category: '霰弹枪 / 步枪', icon: '💥',
    goods: [gunPrice('w_m870'), gunPrice('w_s12k'), gunPrice('w_sks'), gunPrice('w_mini14'), gunPrice('w_akm'), gunPrice('w_m4a1'), gunPrice('w_scar'), gunPrice('w_aug')],
  },
  {
    category: '狙击 / 机枪', icon: '🎯',
    goods: [gunPrice('w_m24', 3.5), gunPrice('w_awm', 3.5), gunPrice('w_m249', 3.5)],
  },
  {
    category: '辅助物资', icon: '🩹',
    goods: [
      { defId: 'm_bandage', price: 150 },
      { defId: 'm_medkit', price: 520 },
      { defId: 'a_ammo', price: 120 },
      { defId: 'a_ammo2', price: 300 },
      { defId: 'a_ammo3', price: 750 },
      { defId: 'm_spray', price: 300 },
    ],
  },
  {
    category: '战术装备', icon: '🛰️',
    goods: [
      { defId: 't_drone', price: 1500 },
      { defId: 't_mine', price: 1200 },
      { defId: 't_smoke', price: 600 },
    ],
  },
  {
    category: '护甲 / 头盔', icon: '🛡️',
    goods: [
      { defId: 'armor1', price: 2700 }, { defId: 'armor2', price: 7800 }, { defId: 'armor3', price: 18600 },
      { defId: 'helmet1', price: 2100 }, { defId: 'helmet2', price: 6000 }, { defId: 'helmet3', price: 14400 },
    ],
  },
  {
    category: '武器配件', icon: '🔧',
    goods: [
      { defId: 'at_rdot', price: 2400 },
      { defId: 'at_comp', price: 2700 },
      { defId: 'at_qmag', price: 2550 },
      { defId: 'at_scope4', price: 6600 },
      { defId: 'at_supp', price: 7800 },
      { defId: 'at_emag', price: 7200 },
      { defId: 'at_grip_v', price: 2850 },
      { defId: 'at_grip_l', price: 2700 },
      { defId: 'at_stock_s', price: 6300 },
      { defId: 'at_stock_l', price: 6000 },
      { defId: 'at_laser', price: 9600 },
    ],
  },
]

export function rollLootItem(pool: { defId: string; weight: number }[], luck = 0, redBoost = 1) {
  // luck 提升高稀有度物品的权重；redBoost 额外放大红色（高危禁区模式 ×2）
  const weighted = pool.map(e => {
    const idx = RARITY_ORDER.indexOf(ITEMS[e.defId].rarity)
    const rb = ITEMS[e.defId].rarity === 'red' ? redBoost : 1
    return { ...e, w: e.weight * (1 + luck * idx * 1.1) * rb }
  })
  const total = weighted.reduce((s, e) => s + e.w, 0)
  let roll = Math.random() * total
  let picked = weighted[0]
  for (const e of weighted) { roll -= e.w; if (roll <= 0) { picked = e; break } }
  const def = ITEMS[picked.defId]
  const count = def.stack ? 1 + Math.floor(Math.random() * Math.min(3, def.stack)) : 1
  return makeItem(picked.defId, count)
}
