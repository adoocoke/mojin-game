// ===================== 稀有度 =====================
export type Rarity = 'white' | 'green' | 'blue' | 'purple' | 'cyan' | 'red'

export const RARITY_ORDER: Rarity[] = ['white', 'green', 'blue', 'purple', 'cyan', 'red']

export const RARITY_INFO: Record<Rarity, { name: string; color: string; bg: string; mult: number; label: string }> = {
  white:  { name: '普通', label: '白', color: '#e5e7eb', bg: 'rgba(229,231,235,0.10)', mult: 1 },
  green:  { name: '优良', label: '绿', color: '#4ade80', bg: 'rgba(74,222,128,0.13)',  mult: 1.9 },
  blue:   { name: '精良', label: '蓝', color: '#60a5fa', bg: 'rgba(96,165,250,0.14)',  mult: 3.6 },
  purple: { name: '史诗', label: '紫', color: '#c084fc', bg: 'rgba(192,132,252,0.15)', mult: 7 },
  cyan:   { name: '传说', label: '青', color: '#22d3ee', bg: 'rgba(34,211,238,0.16)',  mult: 14 },
  red:    { name: '绝世', label: '红', color: '#f87171', bg: 'rgba(248,113,113,0.17)', mult: 30 },
}

// ===================== 物品 =====================
export type ItemKind = 'weapon' | 'valuable' | 'med' | 'ammo' | 'key' | 'attachment' | 'helmet' | 'vest' | 'tactical'

export interface ItemDef {
  id: string
  name: string
  kind: ItemKind
  rarity: Rarity     // 每种物品固定的稀有度
  w: number          // 格子宽
  h: number          // 格子高
  baseValue: number  // 价值
  icon: string       // 图标字符
  gunId?: string     // kind === weapon 时关联枪械
  heal?: number      // kind === med
  stack?: number     // 最大堆叠
  slot?: AttSlot     // kind === attachment 时的配件槽位
  pen?: number       // kind === ammo：穿透等级 1-6
  dmgMul?: number    // kind === ammo：伤害倍率
  armorLv?: number   // kind === helmet/vest：护甲等级 1-3
  durability?: number// kind === helmet/vest：耐久上限
  weight?: number    // 重量 kg（默认按格子估算）
}

export type AttSlot = 'scope' | 'muzzle' | 'mag' | 'stock' | 'grip' | 'laser'

export interface ItemInstance {
  uid: string
  defId: string
  rarity: Rarity
  count: number
  atts?: Partial<Record<AttSlot, ItemInstance>>  // kind === weapon 时安装的配件
  dur?: number       // kind === helmet/vest：剩余耐久
}

export function itemValue(def: ItemDef, _rarity?: Rarity): number {
  return def.baseValue
}

/** 物品重量：显式定义优先，否则按占格估算 */
export function itemWeight(def: ItemDef): number {
  if (def.weight != null) return def.weight
  return def.w * def.h * 0.4
}

// ===================== 枪械 =====================
export interface GunDef {
  id: string
  name: string
  type: string       // 类型描述
  damage: number
  headMult: number
  fireInterval: number  // ms 射击间隔
  mag: number
  reloadTime: number    // ms
  auto: boolean
  spread: number        // 弧度散布
  range: number
  pellets: number       // 霰弹弹丸数
  zoom: number          // 开镜倍率
  recoil: number
  color: number         // 枪身主色
  barrelLen: number
  bulky: number         // 枪身粗细
  melee?: boolean       // 近战武器（匕首）：无需弹药、不能瞄准换弹
}

// ===================== 背包格子 =====================
export interface PlacedItem {
  item: ItemInstance
  x: number
  y: number
}

export interface Grid {
  cols: number
  rows: number
  placed: PlacedItem[]
}
