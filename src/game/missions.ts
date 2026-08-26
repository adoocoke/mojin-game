import type { MapId } from './world'

/** 局内地图专属任务：到任务点接取 → 在局内执行目标行动 → 成功撤离后领奖（三角洲烽火地带式） */
export interface MapMission {
  mapId: MapId
  icon: string
  name: string
  desc: string                                   // 目标行动描述
  acceptPos: { x: number; z: number }            // 接取点（电台终端）
  objPos: { x: number; z: number; floorY?: number } // 目标执行点
  type: 'breach' | 'defend' | 'lamps'            // 破壁爆破 / 启动装置坚守 / 点灯开门
  lamps?: { x: number; z: number; floorY?: number }[]  // lamps 型：需要点燃的灯座位置
  holdTime: number                               // breach=引爆秒数；defend=坚守秒数
  wave: number                                   // defend 启动后刷出的敌人数
  reward: number                                 // 成功撤离后金币奖励
}

export const MAP_MISSIONS: Record<MapId, MapMission> = {
  wild: {
    mapId: 'wild', icon: '🧨', name: '破壁行动',
    desc: '在矿区碎石堆安放炸药，炸开掩体取出里面的物资',
    acceptPos: { x: 8, z: -80 }, objPos: { x: -15, z: -32.4 },
    type: 'breach', holdTime: 3, wave: 0, reward: 2200,
  },
  tower: {
    mapId: 'tower', icon: '📶', name: '塔顶信号',
    desc: '登上高塔顶层启动信号发射器，坚守 20 秒直到传输完成',
    acceptPos: { x: -95, z: 6 }, objPos: { x: 5, z: 5, floorY: 10.2 },
    type: 'defend', holdTime: 20, wave: 4, reward: 3000,
  },
  prison: {
    mapId: 'prison', icon: '🛰️', name: '空投引导',
    desc: '在操场启动引导信标召唤空投，坚守 25 秒等它落地',
    acceptPos: { x: 8, z: 100 }, objPos: { x: -52, z: 24 },
    type: 'defend', holdTime: 25, wave: 5, reward: 3000,
  },
  snow: {
    mapId: 'snow', icon: '📡', name: '重启雷达',
    desc: '登上雷达楼二层重启主控台，坚守 20 秒直到雷达上线',
    acceptPos: { x: 8, z: 100 }, objPos: { x: 2, z: -74, floorY: 3.4 },
    type: 'defend', holdTime: 20, wave: 5, reward: 3500,
  },
  desert: {
    mapId: 'desert', icon: '🏺', name: '点亮长明灯',
    desc: '进入地下墓道，点燃四座长明灯，法老墓室的石门将为你打开',
    acceptPos: { x: 4, z: -18 }, objPos: { x: 0, z: -116, floorY: -4 },
    type: 'lamps', holdTime: 0, wave: 0, reward: 4000,
    lamps: [
      { x: 0, z: -57, floorY: -4 },   // 主墓道十字路口
      { x: -36, z: -57, floorY: -4 }, // 西耳室深处
      { x: 36, z: -57, floorY: -4 },  // 东耳室深处
      { x: 0, z: -84, floorY: -4 },   // 陪葬殿十字口
    ],
  },
}
