import * as THREE from 'three'
import type { Grid } from './types'
import { makeGrid, autoPlace } from './inventory'
import { makeItem } from './data'
import { currentEvent } from './events'
import { MAP_MISSIONS } from './missions'

export interface AABB { minX: number; maxX: number; minZ: number; maxZ: number; top: number; base?: number }

/** 可行走面：平台（y0===y1）或坡道（沿 axis 从 y0 爬到 y1） */
export interface Walkable {
  minX: number; maxX: number; minZ: number; maxZ: number
  y0: number; y1: number
  axis?: 'x' | 'z'  // 坡道爬升方向所在轴；缺省为平台
}

export interface Container {
  id: string
  mesh: THREE.Object3D
  pos: THREE.Vector3
  grid: Grid
  searched: boolean
  title: string
  luck: number        // 高价值区幸运加成
  tag?: string        // 地图专属任务统计标签
  hidden?: boolean    // 任务奖励箱：目标完成前不可见、不可搜索
  enemyDrop?: boolean
  reveal?: Record<string, number>  // 逐格揭示：uid → 揭示时间戳（三角洲式放大镜扫描）
}

export type MapId = 'wild' | 'tower' | 'prison' | 'snow' | 'desert'

/** 可推开的门：铰链在门扇一侧，openT 0→1 旋开；lockedBy 为所需房卡 */
export interface Door {
  id: string
  pivot: THREE.Group
  x: number; z: number   // 门中心
  rot: number            // 关闭时朝向（沿门方向的 rotation.y）
  w: number              // 门宽
  base: number           // 所在楼层脚底高度
  open: boolean
  openT: number
  lockedBy?: string      // 房卡 defId
  lockedName?: string    // 房卡名称（提示用）
}

export interface MapMarker { x: number; z: number; kind: 'tower' | 'house' | 'locked' | 'block' | 'mission' | 'airdrop' | 'gas' | 'patrol'; name?: string }

export interface World {
  scene: THREE.Scene
  colliders: AABB[]
  obstacleMeshes: THREE.Object3D[]
  containers: Container[]
  extractPos: THREE.Vector3
  extractPos2?: THREE.Vector3   // 第二撤离点（沙海古城地下暗河）
  extractMesh: THREE.Mesh
  size: number
  walkables: Walkable[]        // 高处的可行走面（楼梯/楼层），地面默认 y=0
  playerSpawn: THREE.Vector3   // 出生点（脚底位置）
  playerYaw: number
  spawnPoints: THREE.Vector3[] // 敌人出没点；为空则全图随机
  bossSpawns: { pos: THREE.Vector3; name: string }[]
  doors: Door[]
  mapId: MapId
  mapMarkers: MapMarker[]
  slowZones: { x: number; z: number; r: number }[]  // 减速区（冰湖）
  missionWall?: { meshes: THREE.Object3D[]; aabb: AABB }  // 破壁任务的可爆破掩体
  missionGuides: THREE.Object3D[]  // 任务目标引导光柱（任务完成后移除）
  lampStands?: { x: number; z: number; floorY: number; flame: THREE.Object3D; light: THREE.PointLight; lit: boolean }[]  // 长明灯灯座
  sun: THREE.DirectionalLight
  hemi: THREE.HemisphereLight
}

const crateColors: Record<string, number> = {
  '收纳盒': 0xd9a41f, '武器箱': 0x5a4a3a, '保险箱': 0x6a6a72,
  '医疗物资': 0xdde1e4, '高级旅行箱': 0xc7b28a, '战利品': 0x555555,
}

/** 保险箱精细模型：深色金属箱体 + 黄色包边 + 绿色电子屏 + 圆形转盘 + 投递口（原点在箱体中心） */
function buildSafeMesh(): THREE.Group {
  const g = new THREE.Group()
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3a3f45, roughness: 0.48, metalness: 0.65 })
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x23262b, roughness: 0.55, metalness: 0.6 })
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.35, metalness: 0.85, emissive: 0x3a2800, emissiveIntensity: 0.5 })
  const screenMat = new THREE.MeshStandardMaterial({ color: 0x061206, emissive: 0x2bff62, emissiveIntensity: 1.3, roughness: 0.3 })
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(geo, mat)
    m.position.set(x, y, z)
    m.castShadow = true
    m.receiveShadow = true
    g.add(m)
    return m
  }
  const FRONT = 0.57 // 箱体前面 z

  // 主体 + 顶盖 + 底座
  add(new THREE.BoxGeometry(1.3, 1.42, 1.14), bodyMat, 0, 0, 0)
  add(new THREE.BoxGeometry(1.44, 0.12, 1.26), darkMat, 0, 0.77, 0)
  add(new THREE.BoxGeometry(1.44, 0.16, 1.26), darkMat, 0, -0.79, 0)
  // 侧面板缝线
  add(new THREE.BoxGeometry(0.02, 1.2, 0.9), darkMat, -0.66, 0, 0)
  // 黄色包边：前面左右竖条 + 底部横条
  add(new THREE.BoxGeometry(0.05, 1.36, 0.03), goldMat, -0.62, -0.02, FRONT + 0.015)
  add(new THREE.BoxGeometry(0.05, 1.36, 0.03), goldMat, 0.62, -0.02, FRONT + 0.015)
  add(new THREE.BoxGeometry(1.3, 0.055, 0.03), goldMat, 0, -0.68, FRONT + 0.015)
  // 右侧面板凹槽柱
  add(new THREE.BoxGeometry(0.56, 1.08, 0.05), darkMat, 0.18, 0.13, FRONT + 0.01)
  // 电子屏：金属框 + 绿屏 + 屏上两个字符格
  add(new THREE.BoxGeometry(0.5, 0.34, 0.06), bodyMat, 0.18, 0.42, FRONT + 0.04)
  add(new THREE.BoxGeometry(0.4, 0.24, 0.02), screenMat, 0.18, 0.42, FRONT + 0.075)
  add(new THREE.BoxGeometry(0.07, 0.12, 0.012), darkMat, 0.08, 0.42, FRONT + 0.085)
  add(new THREE.BoxGeometry(0.16, 0.05, 0.012), darkMat, 0.26, 0.46, FRONT + 0.085)
  // 圆形转盘 + 中心旋钮
  const dial = add(new THREE.CylinderGeometry(0.125, 0.125, 0.07, 24), darkMat, 0.18, 0.05, FRONT + 0.05)
  dial.rotation.x = Math.PI / 2
  const knob = add(new THREE.CylinderGeometry(0.05, 0.05, 0.1, 16), bodyMat, 0.18, 0.05, FRONT + 0.06)
  knob.rotation.x = Math.PI / 2
  // 底部投递口
  add(new THREE.BoxGeometry(0.38, 0.32, 0.05), bodyMat, 0.18, -0.35, FRONT + 0.03)
  add(new THREE.BoxGeometry(0.28, 0.21, 0.03), darkMat, 0.18, -0.35, FRONT + 0.055)
  return g
}

/** 武器箱精细模型：黑色军用器材箱——金腰带、顶盖加强筋、锁扣、内凹提手（原点在箱体中心，正面朝 +z） */
function buildWeaponCrateMesh(): THREE.Group {
  const g = new THREE.Group()
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1d2124, roughness: 0.5, metalness: 0.35 })
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x0f1214, roughness: 0.6, metalness: 0.3 })
  const lidMat = new THREE.MeshStandardMaterial({ color: 0x24282c, roughness: 0.45, metalness: 0.4 })
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xa87c2e, roughness: 0.38, metalness: 0.78, emissive: 0x2a1c00, emissiveIntensity: 0.45 })
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(geo, mat)
    m.position.set(x, y, z)
    m.castShadow = true
    m.receiveShadow = true
    g.add(m)
    return m
  }
  const W = 1.7, D = 1.05, F = D / 2

  // 下箱体（拉高）+ 上盖（盖略大一圈）
  add(new THREE.BoxGeometry(W, 0.9, D), bodyMat, 0, -0.25, 0)
  add(new THREE.BoxGeometry(W + 0.08, 0.36, D + 0.07), lidMat, 0, 0.38, 0)
  // 盖顶加强筋（前后走向，沿宽度排 7 条）
  for (let i = 0; i < 7; i++) {
    const x = -W / 2 + 0.18 + (i * (W - 0.36)) / 6
    add(new THREE.BoxGeometry(0.09, 0.075, D + 0.06), darkMat, x, 0.6, 0)
  }
  // 金腰带（上下接缝一圈）
  add(new THREE.BoxGeometry(W + 0.1, 0.09, 0.035), goldMat, 0, 0.2, F + 0.02)
  add(new THREE.BoxGeometry(W + 0.1, 0.09, 0.035), goldMat, 0, 0.2, -F - 0.02)
  add(new THREE.BoxGeometry(0.035, 0.09, D + 0.09), goldMat, W / 2 + 0.02, 0.2, 0)
  add(new THREE.BoxGeometry(0.035, 0.09, D + 0.09), goldMat, -W / 2 - 0.02, 0.2, 0)
  // 正面内凹提手面板 ×2 + 把手横条
  add(new THREE.BoxGeometry(0.36, 0.48, 0.035), darkMat, -0.45, -0.25, F + 0.01)
  add(new THREE.BoxGeometry(0.36, 0.48, 0.035), darkMat, 0.45, -0.25, F + 0.01)
  add(new THREE.BoxGeometry(0.2, 0.06, 0.045), bodyMat, -0.45, -0.11, F + 0.03)
  add(new THREE.BoxGeometry(0.2, 0.06, 0.045), bodyMat, 0.45, -0.11, F + 0.03)
  // 锁扣 ×2（骑跨接缝）
  add(new THREE.BoxGeometry(0.1, 0.2, 0.05), lidMat, -0.14, 0.16, F + 0.03)
  add(new THREE.BoxGeometry(0.1, 0.2, 0.05), lidMat, 0.14, 0.16, F + 0.03)
  // 底部前角金色护角
  add(new THREE.BoxGeometry(0.12, 0.1, 0.045), goldMat, -W / 2 + 0.07, -0.64, F + 0.01)
  add(new THREE.BoxGeometry(0.12, 0.1, 0.045), goldMat, W / 2 - 0.07, -0.64, F + 0.01)
  // 右端小铭牌
  add(new THREE.BoxGeometry(0.035, 0.1, 0.2), goldMat, W / 2 + 0.02, 0.38, 0.2)
  return g
}

/** 高级旅行箱：立式行李箱——米色硬壳、黑色束带、橙色侧条、银白护角、提手、滚轮（原点在中心，正面朝 +z） */
function buildSuitcaseMesh(): THREE.Group {
  const g = new THREE.Group()
  const shellMat = new THREE.MeshStandardMaterial({ color: 0xc7b28a, roughness: 0.42, metalness: 0.28 })
  const ribMat = new THREE.MeshStandardMaterial({ color: 0xb09a70, roughness: 0.5, metalness: 0.2 })
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x17191b, roughness: 0.55, metalness: 0.4 })
  const orangeMat = new THREE.MeshStandardMaterial({ color: 0xd06a1f, roughness: 0.42, metalness: 0.35, emissive: 0x2a0f00, emissiveIntensity: 0.45 })
  const cornerMat = new THREE.MeshStandardMaterial({ color: 0xdcdcdc, roughness: 0.28, metalness: 0.65 })
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(geo, mat)
    m.position.set(x, y, z)
    m.castShadow = true
    m.receiveShadow = true
    g.add(m)
    return m
  }
  const W = 0.95, H = 1.28, D = 0.55, F = D / 2

  // 箱体
  add(new THREE.BoxGeometry(W, H, D), shellMat, 0, 0, 0)
  // 壳面加强棱：正面两条竖棱 + 一条横棱
  add(new THREE.BoxGeometry(0.055, H * 0.9, 0.03), ribMat, -0.28, 0, F + 0.005)
  add(new THREE.BoxGeometry(0.055, H * 0.9, 0.03), ribMat, 0.28, 0, F + 0.005)
  add(new THREE.BoxGeometry(W * 0.9, 0.05, 0.03), ribMat, 0, -H * 0.27, F + 0.005)
  // 黑色束带：正面竖带 + 绕过顶面 + 扣具
  add(new THREE.BoxGeometry(0.16, H + 0.02, 0.035), darkMat, 0, 0, F + 0.01)
  add(new THREE.BoxGeometry(0.16, 0.035, D + 0.03), darkMat, 0, H / 2 + 0.006, 0)
  add(new THREE.BoxGeometry(0.19, 0.11, 0.05), darkMat, 0, 0.12, F + 0.03)
  // 橙色侧条（左侧面前沿）
  add(new THREE.BoxGeometry(0.025, H * 0.96, 0.15), orangeMat, -W / 2 - 0.004, 0, F * 0.35)
  // 银白护角（前后共 8 个）
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    add(new THREE.BoxGeometry(0.13, 0.13, 0.06), cornerMat, sx * (W / 2 - 0.02), sy * (H / 2 - 0.02), sz * (F - 0.0))
  }
  // 顶部提手（两根立柱 + 横把）
  add(new THREE.BoxGeometry(0.05, 0.08, 0.06), darkMat, 0.2, H / 2 + 0.03, 0)
  add(new THREE.BoxGeometry(0.05, 0.08, 0.06), darkMat, 0.36, H / 2 + 0.03, 0)
  add(new THREE.BoxGeometry(0.26, 0.05, 0.07), darkMat, 0.28, H / 2 + 0.075, 0)
  // 底部滚轮
  add(new THREE.BoxGeometry(0.12, 0.1, 0.1), darkMat, -0.26, -H / 2 - 0.04, 0.08)
  add(new THREE.BoxGeometry(0.12, 0.1, 0.1), darkMat, 0.26, -H / 2 - 0.04, 0.08)
  return g
}

/** 医疗物资：托盘上的医疗箱堆——白身红盖医疗箱（红十字）、叠放小箱、后方蓝灰高箱（原点在堆体中心） */
function buildMedPileMesh(): THREE.Group {
  const g = new THREE.Group()
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xdde1e4, roughness: 0.5, metalness: 0.2 })
  const redMat = new THREE.MeshStandardMaterial({ color: 0xa83232, roughness: 0.5, metalness: 0.25 })
  const crossMat = new THREE.MeshStandardMaterial({ color: 0xc02828, roughness: 0.45, metalness: 0.2, emissive: 0x2a0505, emissiveIntensity: 0.5 })
  const blueMat = new THREE.MeshStandardMaterial({ color: 0x5e6f7c, roughness: 0.55, metalness: 0.3 })
  const strapMat = new THREE.MeshStandardMaterial({ color: 0xe8ecef, roughness: 0.5, metalness: 0.15 })
  const palletMat = new THREE.MeshStandardMaterial({ color: 0x9a8468, roughness: 0.85, metalness: 0.05 })
  const slatMat = new THREE.MeshStandardMaterial({ color: 0xb09a7c, roughness: 0.85, metalness: 0.05 })
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x2a2d30, roughness: 0.6, metalness: 0.35 })
  const yellowMat = new THREE.MeshStandardMaterial({ color: 0xd8a020, roughness: 0.5, metalness: 0.3 })
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(geo, mat)
    m.position.set(x, y, z)
    m.castShadow = true
    m.receiveShadow = true
    g.add(m)
    return m
  }
  const B = -0.45 // 托盘顶面高度

  // 托盘 + 面板条
  add(new THREE.BoxGeometry(1.6, 0.1, 1.25), palletMat, 0, B - 0.05, 0)
  for (const z of [-0.45, -0.15, 0.15, 0.45]) {
    add(new THREE.BoxGeometry(1.56, 0.03, 0.2), slatMat, 0, B + 0.015, z)
  }
  // 后方蓝灰高箱（拉高到近人高）+ 两条白色竖束带
  add(new THREE.BoxGeometry(0.62, 1.45, 0.55), blueMat, -0.35, B + 0.725, -0.32)
  add(new THREE.BoxGeometry(0.09, 1.43, 0.02), strapMat, -0.51, B + 0.725, -0.035)
  add(new THREE.BoxGeometry(0.09, 1.43, 0.02), strapMat, -0.19, B + 0.725, -0.035)
  // 左侧三个叠放的白身红盖小箱
  add(new THREE.BoxGeometry(0.58, 0.34, 0.55), whiteMat, -0.42, B + 0.17, 0.28)
  add(new THREE.BoxGeometry(0.62, 0.07, 0.59), redMat, -0.42, B + 0.375, 0.28)
  add(new THREE.BoxGeometry(0.58, 0.22, 0.55), whiteMat, -0.42, B + 0.52, 0.28)
  add(new THREE.BoxGeometry(0.62, 0.06, 0.59), redMat, -0.42, B + 0.66, 0.28)
  add(new THREE.BoxGeometry(0.58, 0.3, 0.55), whiteMat, -0.42, B + 0.81, 0.28)
  add(new THREE.BoxGeometry(0.62, 0.06, 0.59), redMat, -0.42, B + 0.995, 0.28)
  // 小箱锁扣 + 编号贴
  add(new THREE.BoxGeometry(0.06, 0.09, 0.03), darkMat, -0.42, B + 0.36, 0.575)
  add(new THREE.BoxGeometry(0.13, 0.08, 0.02), yellowMat, -0.42, B + 0.79, 0.565)
  // 右侧大医疗箱（加高，白身红盖）
  add(new THREE.BoxGeometry(0.7, 0.9, 0.9), whiteMat, 0.45, B + 0.45, 0.1)
  add(new THREE.BoxGeometry(0.75, 0.09, 0.95), redMat, 0.45, B + 0.945, 0.1)
  // 大箱顶再叠一个小医疗箱
  add(new THREE.BoxGeometry(0.58, 0.32, 0.7), whiteMat, 0.45, B + 1.15, 0.1)
  add(new THREE.BoxGeometry(0.62, 0.07, 0.74), redMat, 0.45, B + 1.345, 0.1)
  // 大箱锁扣 ×2
  add(new THREE.BoxGeometry(0.06, 0.09, 0.03), darkMat, 0.25, B + 0.9, 0.565)
  add(new THREE.BoxGeometry(0.06, 0.09, 0.03), darkMat, 0.65, B + 0.9, 0.565)
  // 红十字（正面）
  add(new THREE.BoxGeometry(0.2, 0.07, 0.02), crossMat, 0.45, B + 0.4, 0.555)
  add(new THREE.BoxGeometry(0.07, 0.2, 0.02), crossMat, 0.45, B + 0.4, 0.555)
  // 顶箱提手
  add(new THREE.BoxGeometry(0.18, 0.05, 0.04), darkMat, 0.45, B + 1.41, 0.1)
  return g
}

/** 收纳盒：黑色塑料箱体 + 黄色凸边盖子（原点在箱体中心，正面朝 +z） */
function buildStorageBoxMesh(): THREE.Group {
  const g = new THREE.Group()
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x17181a, roughness: 0.55, metalness: 0.2 })
  const ridgeMat = new THREE.MeshStandardMaterial({ color: 0x242629, roughness: 0.55, metalness: 0.2 })
  const yellowMat = new THREE.MeshStandardMaterial({ color: 0xd9a41f, roughness: 0.45, metalness: 0.25, emissive: 0x332200, emissiveIntensity: 0.35 })
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(geo, mat)
    m.position.set(x, y, z)
    m.castShadow = true
    m.receiveShadow = true
    g.add(m)
    return m
  }
  const W = 1.5, D = 1.0, F = D / 2

  // 箱体 + 微收的底座
  add(new THREE.BoxGeometry(W, 0.62, D), bodyMat, 0, -0.11, 0)
  add(new THREE.BoxGeometry(W - 0.1, 0.08, D - 0.08), bodyMat, 0, -0.44, 0)
  // 侧面竖筋（前 3 后 3）
  for (const x of [-0.5, 0, 0.5]) {
    add(new THREE.BoxGeometry(0.06, 0.56, 0.02), ridgeMat, x, -0.1, F + 0.005)
    add(new THREE.BoxGeometry(0.06, 0.56, 0.02), ridgeMat, x, -0.1, -F - 0.005)
  }
  // 盖下黑沿
  add(new THREE.BoxGeometry(W + 0.06, 0.07, D + 0.05), bodyMat, 0, 0.235, 0)
  // 黄色盖体
  add(new THREE.BoxGeometry(W + 0.12, 0.12, D + 0.1), yellowMat, 0, 0.32, 0)
  // 盖顶凸边（四边 + 四角凸块）
  add(new THREE.BoxGeometry(W + 0.12, 0.06, 0.1), yellowMat, 0, 0.41, F + 0.02)
  add(new THREE.BoxGeometry(W + 0.12, 0.06, 0.1), yellowMat, 0, 0.41, -F - 0.02)
  add(new THREE.BoxGeometry(0.1, 0.06, D + 0.1), yellowMat, W / 2 + 0.03, 0.41, 0)
  add(new THREE.BoxGeometry(0.1, 0.06, D + 0.1), yellowMat, -W / 2 - 0.03, 0.41, 0)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    add(new THREE.BoxGeometry(0.18, 0.085, 0.18), yellowMat, sx * (W / 2 + 0.02), 0.425, sz * (F + 0.01))
  }
  // 盖顶中脊
  add(new THREE.BoxGeometry(0.08, 0.05, D - 0.2), yellowMat, 0, 0.405, 0)
  return g
}

function buildNestMesh(): THREE.Group {
  const g = new THREE.Group()
  const twigMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.95, metalness: 0 })
  const twigMat2 = new THREE.MeshStandardMaterial({ color: 0x8a6338, roughness: 0.95, metalness: 0 })
  const innerMat = new THREE.MeshStandardMaterial({ color: 0x4a3018, roughness: 1, metalness: 0 })
  const eggMat = new THREE.MeshStandardMaterial({ color: 0xf3e9d2, roughness: 0.5, metalness: 0.05 })
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x5a7a3a, roughness: 0.9, metalness: 0 })
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(geo, mat)
    m.position.set(x, y, z)
    m.castShadow = true
    m.receiveShadow = true
    g.add(m)
    return m
  }
  // 碗底（压扁的半球）
  const bowl = add(new THREE.SphereGeometry(0.5, 20, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), innerMat, 0, 0.16, 0)
  bowl.scale.set(1, 0.55, 1)
  // 边缘枝条圈（两圈交错细枝）
  for (let ring = 0; ring < 2; ring++) {
    const R = 0.42 + ring * 0.07, y = 0.12 + ring * 0.07
    const n = 14
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + ring * 0.22
      const twig = add(new THREE.CylinderGeometry(0.018, 0.024, 0.46, 5), (i + ring) % 2 ? twigMat : twigMat2,
        Math.cos(a) * R, y + ((i % 3) - 1) * 0.02, Math.sin(a) * R)
      twig.rotation.set(Math.sin(a) * 0.35, 0, Math.cos(a) * -0.35)
      twig.rotateY(-a + Math.PI / 2 + ((i % 5) - 2) * 0.12)
      twig.rotateX(Math.PI / 2 - 0.28 + ((i % 4) - 1.5) * 0.09)
    }
  }
  // 三根斜出的长枝
  for (const [a, tilt] of [[0.5, 0.7], [2.4, 0.55], [4.4, 0.8]] as [number, number][]) {
    const t = add(new THREE.CylinderGeometry(0.015, 0.022, 0.62, 5), twigMat, Math.cos(a) * 0.45, 0.2, Math.sin(a) * 0.45)
    t.rotation.set(Math.sin(a) * tilt, 0, Math.cos(a) * -tilt)
  }
  // 三枚鸟蛋
  for (const [x, z, ry] of [[-0.09, 0.05, 0.3], [0.1, 0.08, -0.4], [0.0, -0.11, 0.9]] as [number, number, number][]) {
    const egg = add(new THREE.SphereGeometry(0.085, 14, 12), eggMat, x, 0.14, z)
    egg.scale.set(0.82, 1.1, 0.82)
    egg.rotation.z = ry * 0.2
  }
  // 两片落叶点缀
  const leaf1 = add(new THREE.BoxGeometry(0.16, 0.01, 0.1), leafMat, 0.34, 0.05, 0.3)
  leaf1.rotation.y = 0.7
  const leaf2 = add(new THREE.BoxGeometry(0.14, 0.01, 0.09), leafMat, -0.36, 0.04, -0.28)
  leaf2.rotation.y = -0.5
  return g
}

/** 航空箱：HAVIK 高级航空箱——浅灰折角科技柜、深色顶段、橙色侧板、黄黑警示条、橙色箭头、菱形徽标（约一人高，原点在底面中心，正面朝 +z） */
function buildAirCrateMesh(): THREE.Group {
  const g = new THREE.Group()
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xb9bdc4, roughness: 0.42, metalness: 0.45 })
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x3b4046, roughness: 0.5, metalness: 0.5 })
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x878d95, roughness: 0.45, metalness: 0.55 })
  const orangeMat = new THREE.MeshStandardMaterial({ color: 0xd88a28, roughness: 0.45, metalness: 0.3 })
  const yellowMat = new THREE.MeshStandardMaterial({ color: 0xe0b62a, roughness: 0.5, metalness: 0.2 })
  const blackMat = new THREE.MeshStandardMaterial({ color: 0x1e2125, roughness: 0.55, metalness: 0.4 })
  const screenMat = new THREE.MeshStandardMaterial({ color: 0x222622, emissive: 0xd8ffe8, emissiveIntensity: 0.9, roughness: 0.3 })
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(geo, mat)
    m.position.set(x, y, z)
    m.castShadow = true
    m.receiveShadow = true
    g.add(m)
    return m
  }
  const W = 1.25, H = 1.7, D = 1.0, F = D / 2
  // 主箱体 + 深色顶段
  add(new THREE.BoxGeometry(W, H, D), bodyMat, 0, H / 2, 0)
  add(new THREE.BoxGeometry(W + 0.04, 0.5, D + 0.04), darkMat, 0, H - 0.25 + 0.02, 0)
  // 八个折角护件
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const sy of [0.1, H - 0.55]) {
    add(new THREE.BoxGeometry(0.2, 0.34, 0.2), trimMat, sx * (W / 2 - 0.05), sy + 0.14, sz * (D / 2 - 0.05))
  }
  // 左侧橙色面板（整面）
  add(new THREE.BoxGeometry(0.05, H * 0.62, D * 0.55), orangeMat, -W / 2 - 0.01, H * 0.42, 0)
  // 正面左缘橙色饰条 + 把手
  add(new THREE.BoxGeometry(0.09, H * 0.6, 0.06), orangeMat, -W / 2 + 0.1, H * 0.42, F + 0.01)
  add(new THREE.BoxGeometry(0.08, 0.5, 0.1), darkMat, -W / 2 + 0.1, H * 0.42, F + 0.05)
  // 顶部黄黑警示条（交替小块）
  for (let i = 0; i < 8; i++) {
    const x = -W / 2 + 0.12 + (i * (W - 0.24)) / 7
    add(new THREE.BoxGeometry(0.12, 0.03, 0.1), i % 2 === 0 ? yellowMat : blackMat, x, H + 0.03, F - 0.06)
    add(new THREE.BoxGeometry(0.12, 0.03, 0.1), i % 2 === 0 ? yellowMat : blackMat, x, H + 0.03, -F + 0.06)
  }
  // 底部正面警示条
  for (let i = 0; i < 8; i++) {
    const x = -W / 2 + 0.12 + (i * (W - 0.24)) / 7
    add(new THREE.BoxGeometry(0.12, 0.08, 0.03), i % 2 === 0 ? yellowMat : blackMat, x, 0.1, F + 0.01)
  }
  // 底部两角橙色箭头（45° 斜块）
  for (const sx of [-1, 1]) {
    const arrow = add(new THREE.BoxGeometry(0.22, 0.1, 0.03), orangeMat, sx * (W / 2 - 0.18), 0.24, F + 0.012)
    arrow.rotation.z = sx * -0.785
  }
  // 正面两块小显示屏
  add(new THREE.BoxGeometry(0.16, 0.1, 0.03), screenMat, -0.3, H * 0.72, F + 0.015)
  add(new THREE.BoxGeometry(0.16, 0.1, 0.03), screenMat, 0.3, H * 0.72, F + 0.015)
  // 正面菱形徽标（两片旋转方块）
  const d1 = add(new THREE.BoxGeometry(0.26, 0.26, 0.025), blackMat, -0.08, H * 0.45, F + 0.012)
  d1.rotation.z = Math.PI / 4
  const d2 = add(new THREE.BoxGeometry(0.26, 0.26, 0.025), blackMat, 0.08, H * 0.45, F + 0.012)
  d2.rotation.z = Math.PI / 4
  // 徽标下方饰条
  add(new THREE.BoxGeometry(0.4, 0.05, 0.025), blackMat, 0, H * 0.33, F + 0.012)
  return g
}

/** 战利品盒（人机阵亡掉落）：卡其色 GTI 防护箱——圆弧箱盖、四颗圆形锁扣鼓包、正面锁扣、白色徽标（原点在中心，正面朝 +z） */
export function buildDeathCrateMesh(): THREE.Group {
  const g = new THREE.Group()
  const tanMat = new THREE.MeshStandardMaterial({ color: 0xa8946f, roughness: 0.6, metalness: 0.15 })
  const tanDark = new THREE.MeshStandardMaterial({ color: 0x8a7a5c, roughness: 0.65, metalness: 0.12 })
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xe8e6dd, roughness: 0.4, metalness: 0.2 })
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(geo, mat)
    m.position.set(x, y, z)
    m.castShadow = true
    m.receiveShadow = true
    g.add(m)
    return m
  }
  const W = 1.25, D = 0.95, F = D / 2
  // 下箱体
  add(new THREE.BoxGeometry(W, 0.34, D), tanDark, 0, -0.16, 0)
  // 圆弧箱盖（压扁半圆柱）
  const lid = add(new THREE.CylinderGeometry(D / 2, D / 2, W - 0.04, 18, 1, false, 0, Math.PI), tanMat, 0, 0.02, 0)
  lid.rotation.z = Math.PI / 2
  lid.rotation.y = Math.PI / 2
  lid.scale.set(1, 1, 0.62)
  // 盖上四颗圆形锁扣鼓包
  for (const bx of [-0.45, -0.15, 0.15, 0.45]) {
    const dome = add(new THREE.SphereGeometry(0.13, 14, 10), tanMat, bx, 0.24, F * 0.45)
    dome.scale.set(1, 0.75, 1)
    add(new THREE.BoxGeometry(0.1, 0.1, 0.14), tanDark, bx, 0.1, F * 0.5)
  }
  // 正面两个锁扣
  add(new THREE.BoxGeometry(0.12, 0.16, 0.05), tanDark, -0.3, -0.02, F + 0.02)
  add(new THREE.BoxGeometry(0.12, 0.16, 0.05), tanDark, 0.3, -0.02, F + 0.02)
  // 盖顶白色圆形徽标 + 深色三角芯
  const badge = add(new THREE.CylinderGeometry(0.17, 0.17, 0.02, 20), whiteMat, 0, 0.315, -0.08)
  badge.rotation.x = 0.12
  const tri = add(new THREE.ConeGeometry(0.09, 0.022, 3), tanDark, 0, 0.332, -0.08)
  tri.rotation.x = 0.12
  // 侧面凹槽提手
  add(new THREE.BoxGeometry(0.03, 0.08, 0.3), tanDark, W / 2 + 0.01, -0.05, 0)
  add(new THREE.BoxGeometry(0.03, 0.08, 0.3), tanDark, -W / 2 - 0.01, -0.05, 0)
  // 边角护件
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    add(new THREE.BoxGeometry(0.12, 0.3, 0.12), tanDark, sx * (W / 2 - 0.05), -0.1, sz * (D / 2 - 0.05))
  }
  return g
}


export function buildWorld(mapId: MapId = 'wild', night = false, highRisk = false): World {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x87a8c8)
  scene.fog = new THREE.Fog(0x87a8c8, 60, 220)

  const size = 140
  const colliders: AABB[] = []
  const obstacleMeshes: THREE.Object3D[] = []
  const containers: Container[] = []
  const walkables: Walkable[] = []
  const doors: Door[] = []
  const mapMarkers: MapMarker[] = []

  // 光照
  const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x5a6a4a, 0.9)
  scene.add(hemi)
  const sun = new THREE.DirectionalLight(0xfff2dd, 1.6)
  sun.position.set(60, 90, 30)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.camera.left = -90; sun.shadow.camera.right = 90
  sun.shadow.camera.top = 90; sun.shadow.camera.bottom = -90
  sun.shadow.camera.far = 250
  scene.add(sun)

  // 地面
  const groundGeo = new THREE.PlaneGeometry(size * 2, size * 2, 40, 40)
  const groundMat = new THREE.MeshStandardMaterial({ color: mapId === 'snow' ? 0xdde6ef : mapId === 'desert' ? 0xd8b878 : 0x6f7d5a, roughness: 1 })
  const ground = new THREE.Mesh(groundGeo, groundMat)
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  scene.add(ground)
  // 网格道路（雪地图被积雪覆盖，不铺路）
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x555a52, roughness: 0.95 })
  for (let i = -2; i <= 2 && mapId !== 'snow' && mapId !== 'desert'; i++) {
    const road = new THREE.Mesh(new THREE.PlaneGeometry(size * 2, 6), roadMat)
    road.rotation.x = -Math.PI / 2
    road.position.set(0, 0.02, i * 40)
    road.receiveShadow = true
    scene.add(road)
    const road2 = new THREE.Mesh(new THREE.PlaneGeometry(6, size * 2), roadMat)
    road2.rotation.x = -Math.PI / 2
    road2.position.set(i * 40, 0.02, 0)
    road2.receiveShadow = true
    scene.add(road2)
  }

  // 边界墙
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x7a7568, roughness: 0.9 })
  const mkWall = (x: number, z: number, w: number, d: number, h = 6) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat)
    m.position.set(x, h / 2, z)
    m.castShadow = true; m.receiveShadow = true
    scene.add(m); obstacleMeshes.push(m)
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, top: h })
    return m
  }
  mkWall(0, -size, size * 2 + 8, 4, 8)
  mkWall(0, size, size * 2 + 8, 4, 8)
  mkWall(-size, 0, 4, size * 2 + 8, 8)
  mkWall(size, 0, 4, size * 2 + 8, 8)

  // ===== 容器工厂（floorY 为所在楼层高度） =====
  let cid = 0
  const mkContainer = (x: number, z: number, title: string, luck: number, floorY = 0, rng2?: () => number, tag?: string) => {
    const isSafe = title === '保险箱'
    let m: THREE.Object3D
    if (isSafe) {
      m = buildSafeMesh()
      m.position.set(x, floorY + 0.82, z)
      m.rotation.y = Math.atan2(-x, -z) // 电子屏正面朝向地图中心
    } else if (title === '武器箱') {
      m = buildWeaponCrateMesh()
      m.position.set(x, floorY + 0.72, z)
      m.rotation.y = Math.atan2(-x, -z) // 锁扣正面朝向地图中心
    } else if (title === '高级旅行箱') {
      m = buildSuitcaseMesh()
      m.position.set(x, floorY + 0.73, z)
      m.rotation.y = Math.atan2(-x, -z) // 束带正面朝向地图中心
    } else if (title === '医疗物资') {
      m = buildMedPileMesh()
      m.position.set(x, floorY + 0.66, z)
      m.rotation.y = Math.atan2(-x, -z) // 红十字正面朝向地图中心
    } else if (title === '鸟窝') {
      m = buildNestMesh()
      m.position.set(x, floorY + 0.05, z)
      m.rotation.y = (rng2 ? rng2() : Math.random()) * Math.PI * 2 // 鸟窝是圆的，随机朝向即可
    } else if (title === '航空箱') {
      m = buildAirCrateMesh()
      m.position.set(x, floorY + 0.04, z)
      m.rotation.y = (rng2 ? rng2() : Math.random()) * Math.PI * 2 // 随机朝向
    } else if (title === '收纳盒') {
      m = buildStorageBoxMesh()
      m.position.set(x, floorY + 0.5, z)
      m.rotation.y = Math.atan2(-x, -z) // 正面朝向地图中心
    } else if (title === '保险柜') {
      // 重型保险柜：深色钢体 + 金色转盘锁（锁房高价值）
      const g = new THREE.Group()
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.5, 1.0),
        new THREE.MeshStandardMaterial({ color: 0x2e3238, roughness: 0.35, metalness: 0.7 }))
      body.position.y = 0.75
      const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.08, 16),
        new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.3, metalness: 0.9, emissive: 0x6a4a00, emissiveIntensity: 0.5 }))
      dial.rotation.x = Math.PI / 2
      dial.position.set(0, 0.95, 0.52)
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.06),
        new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.3, metalness: 0.9 }))
      handle.position.set(0, 0.6, 0.53)
      g.add(body, dial, handle)
      g.position.set(x, floorY, z)
      g.rotation.y = Math.atan2(-x, -z)
      g.traverse(o => { o.castShadow = true })
      m = g
    } else if (title === '军用保险库') {
      // 高危专属：重型军用保险库——军绿钢体 + 红色五角星 + 金色锁梁
      const g = new THREE.Group()
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.7, 1.1),
        new THREE.MeshStandardMaterial({ color: 0x3d4a33, roughness: 0.4, metalness: 0.65 }))
      body.position.y = 0.85
      const band = new THREE.Mesh(new THREE.BoxGeometry(1.64, 0.18, 1.14),
        new THREE.MeshStandardMaterial({ color: 0x2a3322, roughness: 0.35, metalness: 0.7 }))
      band.position.y = 1.45
      const star = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 5),
        new THREE.MeshStandardMaterial({ color: 0xb01a1a, roughness: 0.35, metalness: 0.4, emissive: 0x7a0a0a, emissiveIntensity: 0.8 }))
      star.rotation.x = Math.PI / 2
      star.position.set(0, 1.05, 0.58)
      const lock = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.08),
        new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.3, metalness: 0.9 }))
      lock.position.set(0, 0.62, 0.58)
      g.add(body, band, star, lock)
      g.position.set(x, floorY, z)
      g.rotation.y = Math.atan2(-x, -z)
      g.traverse(o => { o.castShadow = true })
      m = g
    } else if (title === '售货机') {
      // 自动售货机：发光饮料橱窗
      const g = new THREE.Group()
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.0, 0.8),
        new THREE.MeshStandardMaterial({ color: 0x8a2a2a, roughness: 0.4, metalness: 0.3 }))
      body.position.y = 1.0
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.2),
        new THREE.MeshStandardMaterial({ color: 0x081014, emissive: 0x3ce0d2, emissiveIntensity: 1.6 }))
      win.position.set(0, 1.25, 0.41)
      const slot = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.18, 0.06),
        new THREE.MeshStandardMaterial({ color: 0x1a1d20, roughness: 0.5, metalness: 0.5 }))
      slot.position.set(0, 0.4, 0.42)
      g.add(body, win, slot)
      g.position.set(x, floorY, z)
      g.rotation.y = Math.atan2(-x, -z)
      g.traverse(o => { o.castShadow = true })
      m = g
    } else if (title === '弹药箱') {
      // 军用弹药箱：军绿铁盒 + 黄色弹匣标记
      const g = new THREE.Group()
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.7, 0.8),
        new THREE.MeshStandardMaterial({ color: 0x3a4a2a, roughness: 0.45, metalness: 0.5 }))
      body.position.y = 0.35
      const lid = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.12, 0.82),
        new THREE.MeshStandardMaterial({ color: 0x2e3a22, roughness: 0.4, metalness: 0.55 }))
      lid.position.y = 0.72
      const mark = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.3),
        new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xf5c518, emissiveIntensity: 1.2 }))
      mark.position.set(0, 0.4, 0.41)
      g.add(body, lid, mark)
      g.position.set(x, floorY, z)
      g.rotation.y = Math.atan2(-x, -z)
      g.traverse(o => { o.castShadow = true })
      m = g
    } else if (title === '石棺') {
      // 法老石棺：石质棺身 + 金色棺盖与人面浮雕
      const g = new THREE.Group()
      const stone = new THREE.MeshStandardMaterial({ color: 0x9a8a68, roughness: 0.85 })
      const gold = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.3, metalness: 0.8, emissive: 0x4a3200, emissiveIntensity: 0.55 })
      const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 1.1), stone)
      body.position.y = 0.45
      const lid = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.35, 1.2), gold)
      lid.position.y = 1.05
      const face = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), gold)
      face.position.set(-0.7, 1.28, 0)
      face.scale.set(1, 0.6, 0.8)
      g.add(body, lid, face)
      g.position.set(x, floorY, z)
      g.rotation.y = Math.atan2(-x, -z)
      g.traverse(o => { o.castShadow = true })
      m = g
    } else {
      const geo = new THREE.BoxGeometry(1.6, 1.0, 1.1)
      const mat = new THREE.MeshStandardMaterial({
        color: crateColors[title] ?? 0x555555, roughness: 0.6, metalness: 0.15,
      })
      const box = new THREE.Mesh(geo, mat)
      box.position.set(x, floorY + 1.0 / 2, z)
      box.castShadow = true
      m = box
    }
    m.userData.containerId = `c${cid}`
    scene.add(m)
    const c: Container = {
      id: `c${cid++}`, mesh: m, pos: new THREE.Vector3(x, floorY + 0.8, z),
      grid: title === '保险柜' || title === '军用保险库' ? makeGrid(5, 4) : title === '售货机' ? makeGrid(4, 2) : makeGrid(6, 4),
      searched: false, title, luck, tag,
    }
    containers.push(c)
    return c
  }

  // ===== 局内专属任务：接取电台终端 + 隐藏奖励箱 =====
  const mkTerminal = (x: number, z: number) => {
    const g = new THREE.Group()
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.1, 0.7),
      new THREE.MeshStandardMaterial({ color: 0x3a4148, roughness: 0.5, metalness: 0.5 }))
    body.position.y = 0.55
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x061114, emissive: 0x2ad6e8, emissiveIntensity: 1.7 }))
    screen.position.set(0, 0.72, 0.36)
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.4),
      new THREE.MeshStandardMaterial({ color: 0x222528, roughness: 0.4, metalness: 0.6 }))
    antenna.position.set(0.4, 1.6, -0.2)
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.07),
      new THREE.MeshStandardMaterial({ color: 0x1a0500, emissive: 0xff5a3c, emissiveIntensity: 2.2 }))
    tip.position.set(0.4, 2.32, -0.2)
    g.add(body, screen, antenna, tip)
    g.position.set(x, 0, z)
    g.rotation.y = Math.atan2(-x, -z)
    g.traverse(o => { o.castShadow = true })
    scene.add(g); obstacleMeshes.push(g)
    colliders.push({ minX: x - 0.7, maxX: x + 0.7, minZ: z - 0.5, maxZ: z + 0.5, top: 1.2 })
    mapMarkers.push({ x, z, kind: 'mission', name: '任务点' })
  }
  const mkRewardCrate = (x: number, z: number, floorY = 0) => {
    const c = mkContainer(x, z, '航空箱', 1.6, floorY, rng)
    c.hidden = true
    c.mesh.visible = false
    return c
  }
  // 任务目标装置：操作台 + 紫色引导光柱（穿雾可见，任务完成后由引擎移除）
  const mkObjective = (x: number, z: number, floorY = 0) => {
    const g = new THREE.Group()
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.9, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.6, metalness: 0.4 }))
    base.position.y = 0.45
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.42),
      new THREE.MeshStandardMaterial({ color: 0x140a00, emissive: 0xffb13c, emissiveIntensity: 1.9 }))
    screen.position.set(0, 0.62, 0.31)
    g.add(base, screen)
    g.position.set(x, floorY, z)
    g.rotation.y = Math.atan2(-x, -z)
    g.traverse(o => { o.castShadow = true })
    scene.add(g); obstacleMeshes.push(g)
    colliders.push({ minX: x - 0.6, maxX: x + 0.6, minZ: z - 0.4, maxZ: z + 0.4, top: floorY + 1.0, base: floorY })
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.5, 14, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xb58cff, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false }))
    beam.position.set(x, floorY + 7, z)
    scene.add(beam)
    missionGuides.push(beam)
  }

  // ===== 门工厂：铰链门，rot 为门延伸方向，可上房卡锁 =====
  let did = 0
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x6a5a40, roughness: 0.6, metalness: 0.4 })
  const doorMatDark = new THREE.MeshStandardMaterial({ color: 0x4a3f2d, roughness: 0.6, metalness: 0.4 })
  const readerMat = new THREE.MeshStandardMaterial({ color: 0x220a00, emissive: 0xff3b30, emissiveIntensity: 1.8 })
  const mkDoor = (cx: number, cz: number, w: number, h: number, base: number, rot: number, lockedBy?: string, lockedName?: string) => {
    const pivot = new THREE.Group()
    const dirX = Math.cos(rot), dirZ = -Math.sin(rot)
    pivot.position.set(cx - dirX * w / 2, base, cz - dirZ * w / 2)
    pivot.rotation.y = rot
    const panel = new THREE.Mesh(new THREE.BoxGeometry(w - 0.08, h, 0.12), doorMat)
    panel.position.set(w / 2, h / 2 + 0.04, 0)
    panel.castShadow = true
    pivot.add(panel)
    // 门框中缝 + 把手
    const slit = new THREE.Mesh(new THREE.BoxGeometry(w - 0.2, 0.06, 0.14), doorMatDark)
    slit.position.set(w / 2, h * 0.55, 0)
    pivot.add(slit)
    const knob = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.2), doorMatDark)
    knob.position.set(w - 0.35, h * 0.48, 0)
    pivot.add(knob)
    if (lockedBy) {
      // 门侧红色刷卡器
      const reader = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.24, 0.18), readerMat)
      reader.position.set(w - 0.3, h * 0.55, 0.12)
      pivot.add(reader)
    }
    scene.add(pivot)
    pivot.traverse(o => { obstacleMeshes.push(o) })
    doors.push({ id: `d${did++}`, pivot, x: cx, z: cz, rot, w, base, open: false, openT: 0, lockedBy, lockedName })
  }

  const rng = mulberry32(mapId === 'wild' ? 20260806 : mapId === 'snow' ? 20260810 : mapId === 'desert' ? 20260813 : 20260807)
  const spawnPoints: THREE.Vector3[] = []
  const bossSpawns: World['bossSpawns'] = []
  let missionWall: World['missionWall'] = undefined
  const missionGuides: THREE.Object3D[] = []
  let playerSpawn = new THREE.Vector3(0, 0, -100)
  let playerYaw = Math.PI
  const extractPos = mapId === 'wild' ? new THREE.Vector3(0, 0, size - 14) : mapId === 'snow' ? new THREE.Vector3(0, 0, -size + 14) : new THREE.Vector3(size - 14, 0, 0)
  const slowZones: World['slowZones'] = []
  let extractPos2: THREE.Vector3 | undefined = undefined
  let lampStands: World['lampStands'] = undefined

  if (mapId === 'wild') {
    // ================= 地图一：废弃矿区（爆率下调） =================
    const buildingColors = [0x8a8578, 0x9a8f7d, 0x7d8a94, 0x94857a, 0x808a78]
    const buildingSpots: { x: number; z: number }[] = []
    for (let gx = -2; gx <= 2; gx++) {
      for (let gz = -2; gz <= 2; gz++) {
        if (gx === 0 && gz === 0) continue // 中央留空
        buildingSpots.push({ x: gx * 40 + (rng() - 0.5) * 16, z: gz * 40 + (rng() - 0.5) * 16 })
      }
    }
    for (const s of buildingSpots) {
      const n = 1 + Math.floor(rng() * 2)
      for (let i = 0; i < n; i++) {
        const w = 8 + rng() * 10, d = 8 + rng() * 10, h = 5 + rng() * 12
        const x = s.x + (rng() - 0.5) * 14, z = s.z + (rng() - 0.5) * 14
        if (Math.hypot(x, z) < 18) continue
        const mat = new THREE.MeshStandardMaterial({ color: buildingColors[Math.floor(rng() * buildingColors.length)], roughness: 0.85 })
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
        b.position.set(x, h / 2, z)
        b.castShadow = true; b.receiveShadow = true
        scene.add(b); obstacleMeshes.push(b)
        colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, top: h })
        const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 0.3, 1.2, d * 0.3), wallMat)
        roof.position.set(x + (rng() - 0.5) * w * 0.3, h + 0.6, z + (rng() - 0.5) * d * 0.3)
        roof.castShadow = true
        scene.add(roof)
      }
    }

    // 掩体箱子
    const crateMat = new THREE.MeshStandardMaterial({ color: 0x8a6f4d, roughness: 0.9 })
    for (let i = 0; i < 55; i++) {
      const s = 1 + rng() * 1.6
      const x = (rng() - 0.5) * (size * 2 - 20)
      const z = (rng() - 0.5) * (size * 2 - 20)
      if (Math.hypot(x, z) < 12) continue
      const c = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), crateMat)
      c.position.set(x, s / 2, z)
      c.castShadow = true; c.receiveShadow = true
      scene.add(c); obstacleMeshes.push(c)
      colliders.push({ minX: x - s / 2, maxX: x + s / 2, minZ: z - s / 2, maxZ: z + s / 2, top: s })
    }

    // 矿区 Boss：坐镇中央空地（建筑/箱子生成时已避开中心 18m）
    bossSpawns.push({ pos: new THREE.Vector3(0, 0, -10), name: '矿区霸主·铁爪' })

    // 油桶
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x6a4a3a, roughness: 0.7, metalness: 0.3 })
    for (let i = 0; i < 24; i++) {
      const x = (rng() - 0.5) * (size * 2 - 24)
      const z = (rng() - 0.5) * (size * 2 - 24)
      if (Math.hypot(x, z) < 10) continue
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.7, 10), barrelMat)
      b.position.set(x, 0.85, z)
      b.castShadow = true
      scene.add(b); obstacleMeshes.push(b)
      colliders.push({ minX: x - 0.6, maxX: x + 0.6, minZ: z - 0.6, maxZ: z + 0.6, top: 1.7 })
    }

    // 摸金容器（爆率整体下调）
    const containerTypes = [
      { title: '收纳盒', luck: 0.15 }, { title: '武器箱', luck: 0.25 }, { title: '高级旅行箱', luck: 0.08 },
      { title: '医疗物资', luck: 0.08 }, { title: '鸟窝', luck: 0.15 }, { title: '保险箱', luck: 1.2 },
    ]
    for (let i = 0; i < 26; i++) {
      const x = (rng() - 0.5) * (size * 2 - 30)
      const z = (rng() - 0.5) * (size * 2 - 30)
      if (Math.hypot(x, z) < 10) continue
      const t = containerTypes[Math.floor(rng() * (containerTypes.length - 1))]
      mkContainer(x, z, t.title, t.luck, 0, rng)
    }
    // 高价值区（四个角落的保险箱，爆率也降一些）
    mkContainer(90, 90, '保险箱', 1.1)
    mkContainer(-90, 90, '保险箱', 1.1)
    mkContainer(90, -90, '保险箱', 1.1)
    mkContainer(-90, -90, '保险箱', 1.1)

    // 四个专属锁棚（矿区房卡才能进，里面有高级保险箱）
    const shackMat = new THREE.MeshStandardMaterial({ color: 0x8a7a5f, roughness: 0.9 })
    const shackRoofMat = new THREE.MeshStandardMaterial({ color: 0x6a5a45, roughness: 0.9 })
    const shack = (sx: number, sz: number, cardId: string, cardName: string, roomName: string, luck: number) => {
      const W = 8, D = 7, H = 2.8
      const mkS = (w: number, d: number, dx: number, dz: number) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, H, d), shackMat)
        m.position.set(sx + dx, H / 2, sz + dz)
        m.castShadow = true; m.receiveShadow = true
        scene.add(m); obstacleMeshes.push(m)
        colliders.push({ minX: sx + dx - w / 2, maxX: sx + dx + w / 2, minZ: sz + dz - d / 2, maxZ: sz + dz + d / 2, top: H })
      }
      mkS(W, 0.3, 0, -D / 2) // 北墙
      mkS(0.3, D, -W / 2, 0) // 西墙
      mkS(0.3, D, W / 2, 0)  // 东墙
      // 南墙带门洞（面向地图中心一侧：sz>0 时门在南，反之在北——这里统一开在南墙）
      mkS((W - 2) / 2, 0.3, -(1 + (W - 2) / 4), D / 2)
      mkS((W - 2) / 2, 0.3, 1 + (W - 2) / 4, D / 2)
      const roofS = new THREE.Mesh(new THREE.BoxGeometry(W + 0.5, 0.25, D + 0.5), shackRoofMat)
      roofS.position.set(sx, H + 0.12, sz)
      roofS.castShadow = true
      scene.add(roofS); obstacleMeshes.push(roofS)
      mkDoor(sx, sz + D / 2, 2.0, 2.2, 0, sz > 0 ? 0 : 0, cardId, cardName)
      mkContainer(sx, sz - 1.2, '保险箱', luck, 0, rng, 'safe_locked')
      mkContainer(sx + 1.6, sz + 1.0, '保险柜', 1.8, 0, rng) // 锁房高价值
      mapMarkers.push({ x: sx, z: sz, kind: 'locked', name: roomName })
    }
    shack(55, 55, 'k_w_shed', '工棚房卡', '工棚', 1.4)
    shack(-55, 55, 'k_w_cave', '矿洞房卡', '矿洞', 1.7)
    shack(55, -55, 'k_w_store', '仓储房卡', '仓储室', 2.0)
    shack(-55, -55, 'k_w_core', '核心区房卡', '核心区', 2.5)

    // 售货机：出生点与撤离点附近
    mkContainer(6, -92, '售货机', 0.2, 0, rng)
    mkContainer(10, -88, '弹药箱', 0.5, 0, rng)   // 矿区弹药箱（出生路旁）
    mkContainer(-40, 30, '弹药箱', 0.7, 0, rng)   // 矿区深处
    mkContainer(4, 118, '售货机', 0.2, 0, rng)

    // ---- 专属任务「破壁行动」：任务终端 + 碎石掩埋点（可爆破挡板） ----
    // 选址 (-15,-30)：经建筑碰撞体验证为空旷带，不会嵌进楼里
    mkTerminal(8, -80)
    {
      const MXC = -15, MZC = -30
      const rockMat2 = new THREE.MeshStandardMaterial({ color: 0x7a756c, roughness: 1 })
      for (const [rx2, rz2, rs] of [[-1.7, 0, 1.4], [1.7, 0, 1.3], [0, 1.6, 1.5], [-1.1, 1.2, 1.0], [1.1, 1.2, 1.1]] as const) {
        const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(rs, 0), rockMat2)
        rock.position.set(MXC + rx2, rs * 0.55, MZC + rz2)
        rock.castShadow = true
        scene.add(rock); obstacleMeshes.push(rock)
        colliders.push({ minX: MXC + rx2 - rs * 0.75, maxX: MXC + rx2 + rs * 0.75, minZ: MZC + rz2 - rs * 0.75, maxZ: MZC + rz2 + rs * 0.75, top: rs * 1.3 })
      }
      const slab = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.3, 0.8), rockMat2)
      slab.position.set(MXC, 1.15, MZC - 1.7)
      slab.castShadow = true
      scene.add(slab); obstacleMeshes.push(slab)
      const slabAABB: AABB = { minX: MXC - 1.8, maxX: MXC + 1.8, minZ: MZC - 2.1, maxZ: MZC - 1.3, top: 2.3 }
      colliders.push(slabAABB)
      missionWall = { meshes: [slab], aabb: slabAABB }
      mkObjective(MXC - 1.6, MZC - 2.6) // 炸药安放操作台（挡板正前方）
      mkRewardCrate(MXC, MZC) // 炸开挡板后现身
      mapMarkers.push({ x: MXC, z: MZC, kind: 'mission', name: '掩埋点' })
    }
  } else if (mapId === 'snow') {
    // ================= 地图四：雪地雷达站 =================
    // 低温低能见度：60m 雪雾、积雪地面、冰湖减速区，主打中距离交战
    scene.background = new THREE.Color(0xc9d5e2)
    scene.fog = new THREE.Fog(0xc9d5e2, 16, 66)
    playerSpawn = new THREE.Vector3(0, 0, 110)
    playerYaw = 0 // 南门进，面向北侧雷达站

    const concSnow = new THREE.MeshStandardMaterial({ color: 0x9fa9b4, roughness: 0.9 })
    const darkSteel = new THREE.MeshStandardMaterial({ color: 0x59616a, roughness: 0.65, metalness: 0.45 })
    const rustSteel = new THREE.MeshStandardMaterial({ color: 0x6e5a4a, roughness: 0.75, metalness: 0.3 })
    const tentMat = new THREE.MeshStandardMaterial({ color: 0x5c6b52, roughness: 0.95 })
    const fenceMat = new THREE.MeshStandardMaterial({ color: 0x7d858d, roughness: 0.6, metalness: 0.5 })
    const iceMat = new THREE.MeshStandardMaterial({ color: 0xbfe0f2, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.92 })
    const glowOrange = new THREE.MeshStandardMaterial({ color: 0x2a1505, emissive: 0xff9a3c, emissiveIntensity: 1.4 })
    const FH2 = 3.4

    const sbox = (mat: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, solid = true) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
      m.position.set(x, y, z)
      m.castShadow = true; m.receiveShadow = true
      scene.add(m); obstacleMeshes.push(m)
      if (solid) colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, top: y + h / 2, base: y - h / 2 })
      return m
    }

    // ---- 冰湖（减速区，冰面微反光） ----
    const LAKE = { x: -25, z: 5, r: 20 }
    const lake = new THREE.Mesh(new THREE.CircleGeometry(LAKE.r, 48), iceMat)
    lake.rotation.x = -Math.PI / 2
    lake.position.set(LAKE.x, 0.03, LAKE.z)
    lake.receiveShadow = true
    scene.add(lake)
    // 湖心裂纹装饰
    for (let i = 0; i < 5; i++) {
      const a = rng() * Math.PI * 2, l = 4 + rng() * 9
      const crack = new THREE.Mesh(new THREE.PlaneGeometry(l, 0.18), new THREE.MeshBasicMaterial({ color: 0x8fbcd8, transparent: true, opacity: 0.5 }))
      crack.rotation.x = -Math.PI / 2
      crack.rotation.z = rng() * Math.PI
      crack.position.set(LAKE.x + Math.cos(a) * LAKE.r * 0.5, 0.045, LAKE.z + Math.sin(a) * LAKE.r * 0.5)
      scene.add(crack)
    }
    slowZones.push(LAKE)
    mapMarkers.push({ x: LAKE.x, z: LAKE.z, kind: 'block', name: '冰湖' })

    // ---- 雪松点缀（白顶针叶树） ----
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.9 })
    const pineMat = new THREE.MeshStandardMaterial({ color: 0x3d5a45, roughness: 0.9 })
    const pineSnowMat = new THREE.MeshStandardMaterial({ color: 0xe8eef4, roughness: 0.95 })
    const noTree = (x: number, z: number) =>
      Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 4 ||
      (Math.abs(x) < 20 && z > -85 && z < -55) ||          // 雷达楼
      (x > 38 && x < 82 && z > 20 && z < 50) ||            // 机库
      (x > -80 && x < -40 && z > 24 && z < 56) ||          // 营地
      Math.hypot(x, z - 110) < 14                          // 出生点
    let trees = 0
    while (trees < 46) {
      const x = (rng() - 0.5) * (size * 2 - 24)
      const z = (rng() - 0.5) * (size * 2 - 24)
      if (noTree(x, z)) continue
      const h = 3.5 + rng() * 3
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 1.2, 6), trunkMat)
      trunk.position.set(x, 0.6, z)
      scene.add(trunk); obstacleMeshes.push(trunk)
      for (let li = 0; li < 3; li++) {
        const rr = 1.6 - li * 0.42, cone = new THREE.Mesh(new THREE.ConeGeometry(rr, h / 2.2, 8), li === 2 ? pineSnowMat : pineMat)
        cone.position.set(x, 1.2 + (li + 0.5) * (h / 2.6), z)
        cone.castShadow = true
        scene.add(cone); obstacleMeshes.push(cone)
      }
      colliders.push({ minX: x - 0.5, maxX: x + 0.5, minZ: z - 0.5, maxZ: z + 0.5, top: h })
      trees++
    }

    // ================= 雷达主楼（2 层，顶层旋转雷达） =================
    const RX = 0, RZ = -70, RW = 26, RD = 18 // x∈[-13,13] z∈[-79,-61]
    // F1 外墙（南墙开 3.2m 大门）
    sbox(concSnow, RW, FH2, 0.5, RX, FH2 / 2, RZ - RD / 2 + 0.25)                       // 北墙
    sbox(concSnow, (RW - 3.2) / 2, FH2, 0.5, RX - (1.6 + (RW - 3.2) / 4), FH2 / 2, RZ + RD / 2 - 0.25) // 南墙左
    sbox(concSnow, (RW - 3.2) / 2, FH2, 0.5, RX + (1.6 + (RW - 3.2) / 4), FH2 / 2, RZ + RD / 2 - 0.25) // 南墙右
    sbox(concSnow, 0.5, FH2, RD - 0.5, RX - RW / 2 + 0.25, FH2 / 2, RZ)                // 西墙
    sbox(concSnow, 0.5, FH2, RD - 0.5, RX + RW / 2 - 0.25, FH2 / 2, RZ)                // 东墙
    mkDoor(RX, RZ + RD / 2 - 0.25, 3.2, 2.8, 0, 0)                                     // 南门（不上锁）
    // F1 控制室隔断（西侧 9m，紫色卡门；隔断留 2m 门洞）
    sbox(concSnow, 0.4, FH2, 9.5, RX - RW / 2 + 9, FH2 / 2, RZ - 3.75) // 北段 z∈[-78.5,-69]
    sbox(concSnow, 0.4, FH2, 5.5, RX - RW / 2 + 9, FH2 / 2, RZ + 5.75) // 南段 z∈[-67,-61.5]
    mkDoor(RX - RW / 2 + 9, RZ + 2, 2.0, 2.6, 0, Math.PI / 2, 'k_s_ctrl', '雷达控制室卡')
    // 控制室操作台（发光屏幕）
    sbox(darkSteel, 3.6, 1.1, 0.8, RX - 10, 0.55, RZ - 6, true)
    sbox(glowOrange, 3.2, 0.7, 0.12, RX - 10, 1.45, RZ - 6.2, false)
    // F2 楼板 + F2 外墙
    sbox(concSnow, RW - 0.6, 0.25, RD - 0.6, RX, FH2 - 0.02, RZ, false)
    walkables.push({ minX: RX - RW / 2 + 0.5, maxX: RX + RW / 2 - 3.2, minZ: RZ - RD / 2 + 0.5, maxZ: RZ + RD / 2 - 0.5, y0: FH2, y1: FH2 }) // 主楼面（让出坡道条）
    walkables.push({ minX: RX + RW / 2 - 3.2, maxX: RX + RW / 2 - 0.8, minZ: RZ - RD / 2 + 0.5, maxZ: RZ + RD / 2 - 0.7 - 13, y0: FH2, y1: FH2 }) // 坡道顶衔接条
    sbox(concSnow, RW, FH2, 0.5, RX, FH2 + FH2 / 2, RZ - RD / 2 + 0.25)
    sbox(concSnow, RW, FH2, 0.5, RX, FH2 + FH2 / 2, RZ + RD / 2 - 0.25)
    sbox(concSnow, 0.5, FH2, RD - 0.5, RX - RW / 2 + 0.25, FH2 + FH2 / 2, RZ)
    sbox(concSnow, 0.5, FH2, RD - 0.5, RX + RW / 2 - 0.25, FH2 + FH2 / 2, RZ)
    // F2 站长办公室隔断（东侧 9m，红色卡门；隔断留 2m 门洞）
    sbox(concSnow, 0.4, FH2, 5.5, RX + RW / 2 - 9, FH2 + FH2 / 2, RZ - 5.75) // 北段 z∈[-78.5,-73]
    sbox(concSnow, 0.4, FH2, 9.5, RX + RW / 2 - 9, FH2 + FH2 / 2, RZ + 3.75) // 南段 z∈[-71,-61.5]
    mkDoor(RX + RW / 2 - 9, RZ - 2, 2.0, 2.6, FH2, Math.PI / 2, 'k_s_office', '站长办公室卡')
    // 屋顶 + 旋转雷达天线
    sbox(darkSteel, RW + 0.8, 0.3, RD + 0.8, RX, FH2 * 2 + 0.15, RZ, false)
    const radarBase = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 2.2, 10), rustSteel)
    radarBase.position.set(RX, FH2 * 2 + 1.3, RZ)
    radarBase.castShadow = true
    scene.add(radarBase); obstacleMeshes.push(radarBase)
    const radarDish = new THREE.Group()
    const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 3.2, 1.4, 12, 1, true), darkSteel)
    dish.rotation.z = Math.PI / 2.6
    radarDish.add(dish)
    const bar = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.22, 0.5), rustSteel)
    bar.position.y = 0.9
    radarDish.add(bar)
    radarDish.position.set(RX, FH2 * 2 + 3.2, RZ)
    radarDish.userData.spinRadar = true // 引擎里持续旋转
    scene.add(radarDish); obstacleMeshes.push(radarDish)
    // 室内直跑坡道（沿东墙，南侧上）
    const rampMat = new THREE.MeshStandardMaterial({ color: 0x8f96a0, roughness: 0.9 })
    const rampLen = 13
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.22, Math.hypot(rampLen, FH2)), rampMat)
    ramp.position.set(RX + RW / 2 - 2, FH2 / 2 - 0.05, RZ + RD / 2 - 0.7 - rampLen / 2)
    ramp.rotation.x = Math.atan2(FH2, rampLen) // 南端贴地、北端接上二楼（与 walkable 一致）
    ramp.castShadow = true
    scene.add(ramp); obstacleMeshes.push(ramp)
    walkables.push({ minX: RX + RW / 2 - 3.2, maxX: RX + RW / 2 - 0.8, minZ: RZ + RD / 2 - 0.7 - rampLen, maxZ: RZ + RD / 2 - 0.7, y0: FH2, y1: 0, axis: 'z' })
    // 雷达楼容器
    mkContainer(RX - 4, RZ + 5, '收纳盒', 0.35, 0, rng)
    mkContainer(RX + 4, RZ + 5, '医疗物资', 0.3, 0, rng)
    mkContainer(RX - 10.5, RZ + 4, '保险箱', 2.0, 0, rng, 'safe_locked') // 控制室（紫卡）
    mkContainer(RX - 10.5, RZ - 5, '武器箱', 0.9, 0, rng)        // 控制室
    mkContainer(RX + 10.5, RZ - 4, '保险箱', 2.8, FH2, rng, 'safe_locked') // 站长办公室（红卡）
    mkContainer(RX + 10.5, RZ + 4, '高级旅行箱', 1.2, FH2, rng)  // 站长办公室
    mkContainer(RX - 6, RZ - 5, '收纳盒', 0.5, FH2, rng)         // F2 开放区
    mapMarkers.push({ x: RX, z: RZ, kind: 'block', name: '雷达站' })
    mapMarkers.push({ x: RX - 10, z: RZ, kind: 'locked', name: '控制室' })
    mapMarkers.push({ x: RX + 10, z: RZ, kind: 'locked', name: '站长室' })
    // Boss：巡逻雷达楼南侧广场的狙击精英
    bossSpawns.push({ pos: new THREE.Vector3(RX, 0, RZ + RD / 2 + 16), name: '「雪盲」·白狼' })

    // ================= 哨塔 ×3 =================
    const watchtower = (tx: number, tz: number, cTitle: string, cLuck: number) => {
      for (const [lx, lz] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]] as const) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 5, 6), rustSteel)
        leg.position.set(tx + lx, 2.5, tz + lz)
        leg.castShadow = true
        scene.add(leg); obstacleMeshes.push(leg)
      }
      colliders.push({ minX: tx - 1.4, maxX: tx + 1.4, minZ: tz - 1.4, maxZ: tz + 1.4, top: 5 })
      sbox(darkSteel, 3.6, 0.25, 3.6, tx, 5.1, tz, false)      // 台板
      sbox(rustSteel, 3.2, 2.0, 3.2, tx, 6.2, tz, false)       // 哨舱
      sbox(darkSteel, 3.8, 0.2, 3.8, tx, 7.3, tz, false)       // 顶盖
      mkContainer(tx + 2.6, tz + 2.2, cTitle, cLuck, 0, rng)
      mapMarkers.push({ x: tx, z: tz, kind: 'house', name: '哨塔' })
    }
    watchtower(-85, -35, '武器箱', 0.45)
    watchtower(85, -35, '收纳盒', 0.3)
    watchtower(-90, 60, '医疗物资', 0.3)

    // ================= 机库（大型容器点 + 蓝卡内间） =================
    const HX = 60, HZ = 35, HW = 34, HD = 22, HH = 7 // x∈[43,77] z∈[24,46]
    sbox(concSnow, HW, HH, 0.6, HX, HH / 2, HZ - HD / 2 + 0.3)                     // 北墙
    sbox(concSnow, HW, HH, 0.6, HX, HH / 2, HZ + HD / 2 - 0.3)                     // 南墙
    // 西墙开 12m 大门洞
    sbox(concSnow, 0.6, HH, (HD - 12) / 2, HX - HW / 2 + 0.3, HH / 2, HZ - (6 + (HD - 12) / 4))
    sbox(concSnow, 0.6, HH, (HD - 12) / 2, HX - HW / 2 + 0.3, HH / 2, HZ + (6 + (HD - 12) / 4))
    sbox(concSnow, 0.6, HH, HD, HX + HW / 2 - 0.3, HH / 2, HZ)                     // 东墙
    sbox(darkSteel, HW + 1, 0.35, HD + 1, HX, HH + 0.17, HZ, false)                // 屋顶
    // 门楣
    sbox(concSnow, 0.6, HH - 4.5, 12, HX - HW / 2 + 0.3, 4.5 + (HH - 4.5) / 2, HZ, false)
    // 内间（东北角 14×12，蓝卡门；西墙留 2m 门洞）
    sbox(concSnow, 0.4, HH, 4.7, HX + HW / 2 - 14, HH / 2, HZ - HD / 2 + 2.65 + 0.3)   // 北段
    sbox(concSnow, 0.4, HH, 5.3, HX + HW / 2 - 14, HH / 2, HZ - HD / 2 + 9.35 + 0.3)   // 南段
    sbox(concSnow, 14, HH, 0.4, HX + HW / 2 - 7, HH / 2, HZ - HD / 2 + 12 + 0.3)
    mkDoor(HX + HW / 2 - 14, HZ - HD / 2 + 6, 2.2, 2.8, 0, Math.PI / 2, 'k_s_hangar', '机库钥匙')
    // 停机位：退役直升机残骸（装饰掩体）
    sbox(rustSteel, 6.5, 2.2, 2.4, HX - 8, 1.1, HZ + 3, true)
    sbox(rustSteel, 0.5, 0.5, 7, HX - 5, 1.6, HZ + 3, true)
    // 机库容器：武器箱密集 + 航空箱
    mkContainer(HX - 10, HZ - 6, '武器箱', 0.5, 0, rng)
    mkContainer(HX - 3, HZ + 8, '武器箱', 0.5, 0, rng)
    mkContainer(HX + 2, HZ - 2, '航空箱', 1.0, 0, rng)
    mkContainer(HX + HW / 2 - 5, HZ - HD / 2 + 4, '保险箱', 1.8, 0, rng)           // 内间（蓝卡）
    mkContainer(HX + HW / 2 - 5, HZ - HD / 2 + 9, '高级旅行箱', 0.8, 0, rng)       // 内间
    mapMarkers.push({ x: HX, z: HZ, kind: 'block', name: '机库' })
    mapMarkers.push({ x: HX + HW / 2 - 7, z: HZ - HD / 2 + 6, kind: 'locked', name: '机库内间' })

    // ================= 围栏营地（绿卡哨所） =================
    const CX = -60, CZ = 40, CW = 30, CD = 24 // x∈[-75,-45] z∈[28,52]
    const fence = (x: number, z: number, w: number, d: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 2.2, d), fenceMat)
      m.position.set(x, 1.1, z)
      m.castShadow = true
      scene.add(m); obstacleMeshes.push(m)
      colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, top: 2.2 })
    }
    fence(CX, CZ - CD / 2, CW, 0.15)                                  // 北
    fence(CX, CZ + CD / 2, CW, 0.15)                                  // 南
    fence(CX - CW / 2, CZ, 0.15, CD)                                  // 西
    fence(CX + CW / 2, CZ - CD / 4 - 1, 0.15, CD / 2 - 2)             // 东北段（留 4m 门）
    fence(CX + CW / 2, CZ + CD / 4 + 1, 0.15, CD / 2 - 2)             // 东南段
    // 帐篷（三棱形小屋）
    for (const [tx, tz] of [[CX - 8, CZ - 6], [CX - 8, CZ + 6], [CX + 8, CZ - 6]] as const) {
      const tent = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 2.4, 2.2, 4), tentMat)
      tent.rotation.y = Math.PI / 4
      tent.position.set(tx, 1.1, tz)
      tent.castShadow = true
      scene.add(tent); obstacleMeshes.push(tent)
      colliders.push({ minX: tx - 1.6, maxX: tx + 1.6, minZ: tz - 1.6, maxZ: tz + 1.6, top: 2.2 })
    }
    // 哨所小屋（绿卡）
    const SX = CX + 8, SZ = CZ + 7
    sbox(tentMat, 6, 2.8, 0.3, SX, 1.4, SZ - 2.5)                     // 北墙
    sbox(tentMat, 0.3, 2.8, 5, SX - 3, 1.4, SZ)                       // 西墙
    sbox(tentMat, 0.3, 2.8, 5, SX + 3, 1.4, SZ)                       // 东墙
    sbox(tentMat, 2, 2.8, 0.3, SX - 2, 1.4, SZ + 2.5)                 // 南墙左（留 2m 门）
    sbox(tentMat, 2, 2.8, 0.3, SX + 2, 1.4, SZ + 2.5)                 // 南墙右
    sbox(darkSteel, 6.6, 0.25, 5.6, SX, 2.95, SZ, false)              // 顶
    mkDoor(SX, SZ + 2.5, 2.0, 2.2, 0, 0, 'k_s_post', '哨所房卡')
    mkContainer(SX, SZ - 1, '保险箱', 1.4, 0, rng)                    // 哨所内
    mkContainer(SX - 1.6, SZ + 1.2, '保险柜', 1.8, 0, rng)             // 哨所保险柜
    mkContainer(SX + 1.5, SZ + 1, '高级旅行箱', 0.5, 0, rng)          // 哨所内
    // 营地容器（武器箱密集区之一）
    mkContainer(CX - 11, CZ, '武器箱', 0.45, 0, rng)
    mkContainer(CX + 4, CZ - 9, '武器箱', 0.45, 0, rng)
    mkContainer(CX - 3, CZ + 9, '收纳盒', 0.3, 0, rng)
    mapMarkers.push({ x: CX, z: CZ, kind: 'block', name: '营地' })
    mapMarkers.push({ x: SX, z: SZ, kind: 'locked', name: '哨所' })

    // ================= 固定航空箱 ×4（其余 3 个） =================
    mkContainer(-30, -95, '航空箱', 1.0, 0, rng)
    mkContainer(100, -60, '航空箱', 1.0, 0, rng)
    mkContainer(-110, 80, '航空箱', 1.0, 0, rng)

    // ================= 燃料库（围栏油罐区） =================
    const FX = 110, FZ = -10
    for (let i = 0; i < 3; i++) {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 6, 16), rustSteel)
      tank.rotation.z = Math.PI / 2
      tank.position.set(FX, 1.7, FZ - 5 + i * 5)
      tank.castShadow = true
      scene.add(tank); obstacleMeshes.push(tank)
      colliders.push({ minX: FX - 3, maxX: FX + 3, minZ: FZ - 6.6 + i * 5, maxZ: FZ - 3.4 + i * 5, top: 3.3 })
    }
    fence(FX, FZ - 10.5, 16, 0.15)                     // 北
    fence(FX, FZ + 10.5, 16, 0.15)                     // 南
    fence(FX - 8, FZ, 0.15, 21)                        // 西
    fence(FX + 8, FZ - 7, 0.15, 7)                     // 东北段（留 7m 门）
    fence(FX + 8, FZ + 7, 0.15, 7)                     // 东南段
    mkContainer(FX - 5, FZ + 7, '武器箱', 0.5, 0, rng)
    mkContainer(FX + 5, FZ + 7, '收纳盒', 0.35, 0, rng)
    mapMarkers.push({ x: FX, z: FZ, kind: 'block', name: '燃料库' })

    // ================= 车队残骸（南路伏击点） =================
    for (const [vx, vz, va] of [[16, 82, 0.4], [28, 90, -0.3], [-8, 76, 0.9]] as const) {
      const truck = new THREE.Group()
      const cab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 2.2), darkSteel)
      cab.position.set(0, 1.3, 2.6)
      const cargo = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.6, 4.4), rustSteel)
      cargo.position.set(0, 1.5, -1)
      truck.add(cab, cargo)
      truck.position.set(vx, 0, vz)
      truck.rotation.y = va
      truck.rotation.z = (rng() - 0.5) * 0.2 // 翻覆歪斜
      truck.traverse(o => { o.castShadow = true })
      scene.add(truck); obstacleMeshes.push(truck as unknown as THREE.Mesh)
      colliders.push({ minX: vx - 3, maxX: vx + 3, minZ: vz - 3.4, maxZ: vz + 3.4, top: 2.8 })
    }
    mkContainer(20, 78, '高级旅行箱', 0.4, 0, rng)
    mkContainer(-14, 82, '收纳盒', 0.3, 0, rng)
    mapMarkers.push({ x: 10, z: 82, kind: 'block', name: '车队残骸' })

    // ================= 气象站（偏远小屋 + 风杆） =================
    const WX = -118, WZ = -88
    sbox(concSnow, 5, 2.8, 0.3, WX, 1.4, WZ - 2.5)          // 北墙
    sbox(concSnow, 0.3, 2.8, 5, WX - 2.5, 1.4, WZ)          // 西墙
    sbox(concSnow, 0.3, 2.8, 5, WX + 2.5, 1.4, WZ)          // 东墙
    sbox(concSnow, 1.5, 2.8, 0.3, WX - 1.75, 1.4, WZ + 2.5) // 南墙左（留 2m 门）
    sbox(concSnow, 1.5, 2.8, 0.3, WX + 1.75, 1.4, WZ + 2.5)
    sbox(darkSteel, 5.6, 0.25, 5.6, WX, 2.95, WZ, false)    // 顶
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 11, 8), fenceMat)
    mast.position.set(WX + 5, 5.5, WZ - 2)
    mast.castShadow = true
    scene.add(mast); obstacleMeshes.push(mast)
    colliders.push({ minX: WX + 4.7, maxX: WX + 5.3, minZ: WZ - 2.3, maxZ: WZ - 1.7, top: 11 })
    const vane = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.14, 0.3), glowOrange)
    vane.position.set(WX + 5, 10.4, WZ - 2)
    scene.add(vane)
    mkContainer(WX, WZ - 1, '医疗物资', 0.5, 0, rng)
    mkContainer(WX + 1.2, WZ + 1, '收纳盒', 0.3, 0, rng)
    mapMarkers.push({ x: WX, z: WZ, kind: 'block', name: '气象站' })

    // ================= 碉堡 ×2（半墙掩体） =================
    for (const [bx, bz] of [[-40, -112], [70, 88]] as const) {
      sbox(concSnow, 8, 1.6, 0.5, bx, 0.8, bz - 3)          // 北墙
      sbox(concSnow, 0.5, 1.6, 6, bx - 4, 0.8, bz)          // 西墙
      sbox(concSnow, 0.5, 1.6, 6, bx + 4, 0.8, bz)          // 东墙
      sbox(concSnow, 2.5, 1.6, 0.5, bx - 2.75, 0.8, bz + 3) // 南墙左（留 3m 口）
      sbox(concSnow, 2.5, 1.6, 0.5, bx + 2.75, 0.8, bz + 3)
      mkContainer(bx, bz, '武器箱', 0.45, 0, rng)
      mapMarkers.push({ x: bx, z: bz, kind: 'block', name: '碉堡' })
    }

    // ================= 电线杆（雷达楼 → 南门沿路，装饰） =================
    for (let i = 0; i < 6; i++) {
      const px = 8 + i * 0.6, pz = -48 + i * 28
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 9, 8), darkSteel)
      pole.position.set(px, 4.5, pz)
      pole.castShadow = true
      scene.add(pole); obstacleMeshes.push(pole)
      colliders.push({ minX: px - 0.3, maxX: px + 0.3, minZ: pz - 0.3, maxZ: pz + 0.3, top: 9 })
      const cross = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.14, 0.14), darkSteel)
      cross.position.set(px, 8.2, pz)
      scene.add(cross)
    }

    // ================= 18 个普通容器（雪地散落） =================
    const snowTypes = [
      { title: '收纳盒', luck: 0.3 }, { title: '武器箱', luck: 0.45 }, { title: '高级旅行箱', luck: 0.25 },
      { title: '医疗物资', luck: 0.25 },
    ]
    const blocked = (x: number, z: number) =>
      Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 3 ||
      (Math.abs(x - RX) < RW / 2 + 4 && Math.abs(z - RZ) < RD / 2 + 4) ||
      (x > HX - HW / 2 - 3 && x < HX + HW / 2 + 3 && z > HZ - HD / 2 - 3 && z < HZ + HD / 2 + 3) ||
      (x > CX - CW / 2 - 3 && x < CX + CW / 2 + 3 && z > CZ - CD / 2 - 3 && z < CZ + CD / 2 + 3) ||
      Math.hypot(x - FX, z - FZ) < 14 ||                                    // 燃料库
      (x > -20 && x < 36 && z > 68 && z < 98) ||                            // 车队残骸
      Math.hypot(x - WX, z - WZ) < 9 ||                                     // 气象站
      Math.hypot(x + 40, z + 112) < 8 || Math.hypot(x - 70, z - 88) < 8 ||  // 碉堡 ×2
      Math.hypot(x, z - 110) < 16 || Math.hypot(x, z + 126) < 10
    let placedN = 0
    while (placedN < 18) {
      const x = (rng() - 0.5) * (size * 2 - 26)
      const z = (rng() - 0.5) * (size * 2 - 26)
      if (blocked(x, z)) continue
      const t = snowTypes[Math.floor(rng() * snowTypes.length)]
      mkContainer(x, z, t.title, t.luck, 0, rng)
      placedN++
    }
    // 3 个雪窝（鸟窝变体）
    mkContainer(-15, -20, '鸟窝', 0.35, 0, rng)
    mkContainer(40, 70, '鸟窝', 0.35, 0, rng)
    mkContainer(-95, -60, '鸟窝', 0.35, 0, rng)

    // 保险柜：控制室 / 站长办公室 / 机库内间
    mkContainer(-8, -63.5, '保险柜', 1.8, 0, rng)
    mkContainer(-4, -60, '弹药箱', 0.6, 0, rng)              // 雪地雷达楼旁弹药箱
    mkContainer(HX - HW / 2 + 4, HZ + HD / 2 - 4, '弹药箱', 0.7, 0, rng) // 机库弹药箱
    mkContainer(10.5, -71, '保险柜', 1.8, FH2, rng)
    mkContainer(HX + HW / 2 - 3.5, HZ - HD / 2 + 4, '保险柜', 1.8, 0, rng)
    // 售货机：南门出生点与北侧撤离点
    mkContainer(6, 104, '售货机', 0.2, 0, rng)
    mkContainer(2, -118, '售货机', 0.2, 0, rng)

    // ---- 专属任务「重启雷达」：南门任务终端 + 二层主控台奖励箱 ----
    mkTerminal(8, 100)
    mkObjective(2, -74, FH2)  // 二层主控台
    mkRewardCrate(4, -72, FH2) // 二层，雷达重启后解锁
    mapMarkers.push({ x: 2, z: -74, kind: 'mission', name: '主控台' })

    // 敌人出没点：地图南侧（玩家北侧推进，南侧接敌）
    for (const [ex, ez] of [[-40, 70], [40, 70], [0, 60], [-80, 90], [80, 90], [-20, 95], [60, 20], [-60, -20]] as const) {
      spawnPoints.push(new THREE.Vector3(ex, 0, ez))
    }
  } else if (mapId === 'desert') {
    // ================= 地图五：沙海古城（双层：地表遗迹 + 大型地下陵墓群） =================
    scene.background = new THREE.Color(0xdfc088)
    scene.fog = new THREE.Fog(0xdfc088, 50, 190)
    sun.color.setHex(0xffe2a8)
    hemi.groundColor.setHex(0x9a7a48)
    playerSpawn = new THREE.Vector3(0, 0, 112)
    playerYaw = 0 // 面向 -z（地图中心）

    const sandStone = new THREE.MeshStandardMaterial({ color: 0xcbb083, roughness: 0.95 })
    const sandDark = new THREE.MeshStandardMaterial({ color: 0xb08d55, roughness: 0.95 })
    const tombStone = new THREE.MeshStandardMaterial({ color: 0x8a7a5c, roughness: 0.92 })
    const tombDark = new THREE.MeshStandardMaterial({ color: 0x6a5c44, roughness: 0.95 })
    const goldMat2 = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.3, metalness: 0.8, emissive: 0x4a3200, emissiveIntensity: 0.6 })
    const UY = -4 // 地下陵墓地面高度

    // 地表/地下结构辅助：带 base 的碰撞盒
    const dbox = (mat: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, solid = true) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
      m.position.set(x, y, z)
      m.castShadow = true; m.receiveShadow = true
      scene.add(m); obstacleMeshes.push(m)
      if (solid) colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, top: y + h / 2, base: y - h / 2 })
      return m
    }
    // 地下墙：base -4，top -1（地表玩家不会被挡）
    const uwall = (x: number, z: number, w: number, d: number) => dbox(tombStone, w, 3, d, x, UY + 1.5, z)
    // 地下顶板：仅视觉（天花板碰撞体会挡住地下玩家，故不加碰撞）
    const uceil = (x: number, z: number, w: number, d: number) => dbox(tombDark, w, 0.3, d, x, -0.85, z, false)

    // ================= 地表：神庙（地下主入口，方尖碑标识） =================
    // 神庙台基：左/右两块石板，中央留出下行坡道口（仅视觉 + walkable 0.5m 台面）
    dbox(sandStone, 8.4, 0.5, 18, -5.8, 0.25, -39, false)
    dbox(sandStone, 8.4, 0.5, 18, 5.8, 0.25, -39, false)
    walkables.push({ minX: -10, maxX: -1.6, minZ: -48, maxZ: -30, y0: 0.5, y1: 0.5 })
    walkables.push({ minX: 1.6, maxX: 10, minZ: -48, maxZ: -30, y0: 0.5, y1: 0.5 })
    // 神庙石柱（一根断柱）+ 门楣
    const colGeo = new THREE.CylinderGeometry(0.55, 0.7, 4.6, 10)
    for (const [cx, cz, ch] of [[-8, -33, 4.6], [8, -33, 4.6], [-8, -45, 4.6], [8, -45, 2.2], [-4.5, -47, 4.6], [4.5, -47, 4.6]] as const) {
      const col = new THREE.Mesh(colGeo, sandStone)
      col.scale.y = ch / 4.6
      col.position.set(cx, 0.5 + ch / 2, cz)
      col.castShadow = true
      scene.add(col); obstacleMeshes.push(col)
      colliders.push({ minX: cx - 0.7, maxX: cx + 0.7, minZ: cz - 0.7, maxZ: cz + 0.7, top: 0.5 + ch })
    }
    dbox(sandStone, 18, 0.8, 1.4, 0, 5.5, -47, false) // 后门楣（纯视觉）
    // 入口两侧方尖碑 + 金色引导光柱（远远就能看见地下入口）
    for (const ox of [-3.2, 3.2]) {
      const ob = new THREE.Mesh(new THREE.ConeGeometry(0.7, 5.2, 4), sandDark)
      ob.position.set(ox, 3.1, -31)
      ob.castShadow = true
      scene.add(ob); obstacleMeshes.push(ob)
      colliders.push({ minX: ox - 0.7, maxX: ox + 0.7, minZ: -31.7, maxZ: -30.3, top: 5.7 })
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), goldMat2)
      tip.position.set(ox, 5.9, -31)
      scene.add(tip)
    }
    const entranceBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.1, 26, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffc46a, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }))
    entranceBeam.position.set(0, 13, -38)
    scene.add(entranceBeam)
    dbox(sandStone, 1.2, 4.2, 14, -1.9, -1.6, -41)    // 坡道西壁（深入地下的石壁）
    dbox(sandStone, 1.2, 4.2, 14, 1.9, -1.6, -41)     // 坡道东壁
    // 下行坡道：从台基 0.5m 降到地下 -4m（加长到 14m）
    walkables.push({ minX: -1.6, maxX: 1.6, minZ: -48, maxZ: -34, y0: UY, y1: 0.5, axis: 'z' })
    const rampLen = Math.hypot(14, 4.5)
    const rampMesh = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.3, rampLen), tombStone)
    rampMesh.position.set(0, -1.9, -41)
    rampMesh.rotation.x = Math.atan2(4.5, 14)
    scene.add(rampMesh); obstacleMeshes.push(rampMesh)
    // 神庙容器（保险柜必出陵寝外殿门卡，保证玩家能体验到锁房）
    mkContainer(3, -36, '高级旅行箱', 0.9, 0.5, rng)
    mkContainer(-5, -42, '武器箱', 0.8, 0.5, rng)
    const templeSafe = mkContainer(6, -45, '保险柜', 1.5, 0.5, rng)
    autoPlace(templeSafe.grid, makeItem('k_d_gate'))
    mkContainer(-6, -33, '收纳盒', 0.5, 0.5, rng)
    mapMarkers.push({ x: 0, z: -40, kind: 'block', name: '神庙·地下入口' })

    // ================= 地表：驿站（东侧） =================
    for (const [tx, tz] of [[56, 26], [64, 30], [58, 35]] as const) {
      const tent = new THREE.Mesh(new THREE.ConeGeometry(2.4, 2.8, 6), sandDark)
      tent.position.set(tx, 1.4, tz)
      tent.castShadow = true
      scene.add(tent); obstacleMeshes.push(tent)
      colliders.push({ minX: tx - 2, maxX: tx + 2, minZ: tz - 2, maxZ: tz + 2, top: 2.8 })
    }
    dbox(sandStone, 10, 1.1, 0.5, 60, 0.55, 22)   // 驿站矮墙
    dbox(sandStone, 0.5, 1.1, 8, 68, 0.55, 30)
    mkContainer(60, 26, '弹药箱', 0.7, 0, rng)
    mkContainer(63, 32, '高级旅行箱', 0.6, 0, rng)
    mkContainer(57, 33, '收纳盒', 0.45, 0, rng)
    mapMarkers.push({ x: 60, z: 30, kind: 'block', name: '驿站' })

    // ================= 地表：雕像群（西侧） =================
    for (let i = 0; i < 6; i++) {
      const sx = -66 + (i % 3) * 6, sz = -16 + Math.floor(i / 3) * 10
      dbox(sandDark, 1.8, 0.8, 1.8, sx, 0.4, sz)                       // 基座
      const body = dbox(sandStone, 1.0, 2.4, 0.8, sx, 2.0, sz)         // 像身
      body.rotation.y = (rng() - 0.5) * 0.3
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), sandStone)
      head.position.set(sx, 3.5, sz)
      head.castShadow = true
      scene.add(head); obstacleMeshes.push(head)
    }
    mkContainer(-60, -6, '武器箱', 0.55, 0, rng)
    mkContainer(-63, -14, '收纳盒', 0.4, 0, rng)
    mapMarkers.push({ x: -60, z: -10, kind: 'block', name: '雕像群' })

    // ================= 地表：沙丘（掩体） =================
    for (const [dx, dz, dr] of [[-30, 50, 6], [35, 60, 7], [-70, 60, 8], [70, -40, 7], [-40, -70, 8], [40, -80, 6], [-90, -50, 7], [90, 60, 8]] as const) {
      const dune = new THREE.Mesh(new THREE.SphereGeometry(dr, 14, 10), sandDark)
      dune.scale.set(1, 0.32, 1)
      dune.position.set(dx, 0, dz)
      dune.receiveShadow = true
      scene.add(dune); obstacleMeshes.push(dune)
      colliders.push({ minX: dx - dr * 0.7, maxX: dx + dr * 0.7, minZ: dz - dr * 0.7, maxZ: dz + dr * 0.7, top: dr * 0.32 })
    }

    // ================= 地表：骆驼商队（撤离点 126,0） =================
    const mkCamel = (cx: number, cz: number, rot: number) => {
      const g = new THREE.Group()
      const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.1, 0.9), sandDark)
      body.position.y = 1.5
      const hump = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 8), sandDark)
      hump.position.set(-0.2, 2.2, 0)
      hump.scale.set(1, 0.8, 0.9)
      const neck = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.3, 0.35), sandDark)
      neck.position.set(1.25, 2.2, 0)
      neck.rotation.z = -0.35
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.35, 0.35), sandDark)
      head.position.set(1.7, 2.8, 0)
      g.add(body, hump, neck, head)
      for (const [lx, lz] of [[-0.9, 0.3], [-0.9, -0.3], [0.9, 0.3], [0.9, -0.3]] as const) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.0, 0.22), sandDark)
        leg.position.set(lx, 0.5, lz)
        g.add(leg)
      }
      g.position.set(cx, 0, cz)
      g.rotation.y = rot
      g.traverse(o => { o.castShadow = true })
      scene.add(g); obstacleMeshes.push(g)
      colliders.push({ minX: cx - 1.3, maxX: cx + 1.3, minZ: cz - 0.7, maxZ: cz + 0.7, top: 2.9 })
    }
    mkCamel(122, 3, 0.4)
    mkCamel(124, -4, -0.3)
    const tent2 = new THREE.Mesh(new THREE.ConeGeometry(2.6, 3, 6), sandDark)
    tent2.position.set(130, 1.5, 5)
    scene.add(tent2); obstacleMeshes.push(tent2)
    mapMarkers.push({ x: 126, z: 0, kind: 'block', name: '骆驼商队' })

    // ================= 地下：主墓道（10m 宽南北大道，z -48 → -90） =================
    // 侧壁只在「非开口段」：z -66..-78（耳室与陪葬殿之间）
    uwall(-5, -72, 0.7, 12.7)     // 西壁中段
    uwall(5, -72, 0.7, 12.7)      // 东壁中段
    walkables.push({ minX: -5, maxX: 5, minZ: -90, maxZ: -48, y0: UY, y1: UY })
    uceil(0, -69, 11, 43)
    // 墓道壁画 + 壁柱（装饰）
    for (const mz of [-54, -62, -70]) {
      dbox(goldMat2, 0.1, 0.9, 2.6, -4.6, UY + 1.6, mz, false)
      dbox(goldMat2, 0.1, 0.9, 2.6, 4.6, UY + 1.6, mz + 3, false)
    }

    // ================= 地下：西耳室（41×18 大厅，长明灯） =================
    uwall(-25.5, -66, 41.7, 0.7)  // 北墙
    uwall(-25.5, -48, 41.7, 0.7)  // 南墙
    uwall(-46, -57, 0.7, 18.7)    // 西端封口
    walkables.push({ minX: -46, maxX: -5, minZ: -66, maxZ: -48, y0: UY, y1: UY })
    uceil(-25.5, -57, 42, 19)
    // 西耳室陪葬石柱两排
    for (const px of [-14, -24, -34]) {
      for (const pz of [-52, -62]) {
        const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 3, 8), tombStone)
        pil.position.set(px, UY + 1.5, pz)
        pil.castShadow = true
        scene.add(pil); obstacleMeshes.push(pil)
        colliders.push({ minX: px - 0.6, maxX: px + 0.6, minZ: pz - 0.6, maxZ: pz + 0.6, top: UY + 3, base: UY })
      }
    }
    mkContainer(-42, -63, '医疗物资', 0.7, UY, rng)
    mkContainer(-38, -51, '收纳盒', 0.5, UY, rng)
    mkContainer(-28, -63, '弹药箱', 0.65, UY, rng)
    mkContainer(-16, -51, '武器箱', 0.6, UY, rng)
    mapMarkers.push({ x: -25, z: -57, kind: 'block', name: '西耳室' })

    // ================= 地下：东耳室（61×18 长廊，长明灯 + 暗河撤离点） =================
    uwall(35.5, -66, 61.7, 0.7)   // 北墙
    uwall(35.5, -48, 61.7, 0.7)   // 南墙
    uwall(66, -57, 0.7, 18.7)     // 东端封口
    walkables.push({ minX: 5, maxX: 66, minZ: -66, maxZ: -48, y0: UY, y1: UY })
    uceil(35.5, -57, 62, 19)
    for (const px of [16, 30, 44]) {
      for (const pz of [-52, -62]) {
        const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 3, 8), tombStone)
        pil.position.set(px, UY + 1.5, pz)
        pil.castShadow = true
        scene.add(pil); obstacleMeshes.push(pil)
        colliders.push({ minX: px - 0.6, maxX: px + 0.6, minZ: pz - 0.6, maxZ: pz + 0.6, top: UY + 3, base: UY })
      }
    }
    mkContainer(14, -63, '弹药箱', 0.65, UY, rng)
    mkContainer(24, -51, '医疗物资', 0.7, UY, rng)
    mkContainer(40, -63, '收纳盒', 0.5, UY, rng)
    mkContainer(50, -51, '高级旅行箱', 0.6, UY, rng)
    // 暗河（水面）+ 地下撤离点（东耳室尽头）
    const river = new THREE.Mesh(new THREE.BoxGeometry(12, 0.1, 16),
      new THREE.MeshStandardMaterial({ color: 0x123a4a, emissive: 0x0a3a4a, emissiveIntensity: 0.7, transparent: true, opacity: 0.9 }))
    river.position.set(60, UY + 0.04, -57)
    scene.add(river)
    extractPos2 = new THREE.Vector3(60, UY, -57)
    const ex2 = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 0.25, 28),
      new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x0a5a66, transparent: true, opacity: 0.7 }))
    ex2.position.set(60, UY + 0.13, -57)
    scene.add(ex2)
    const ex2beam = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 3, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.15, side: THREE.DoubleSide, depthWrite: false }))
    ex2beam.position.set(60, UY + 1.5, -57)
    scene.add(ex2beam)
    mapMarkers.push({ x: 35, z: -57, kind: 'block', name: '东耳室' })
    mapMarkers.push({ x: 60, z: -57, kind: 'block', name: '暗河撤离点' })

    // ================= 地下：陪葬殿（76×12 东西横廊，长明灯） =================
    uwall(-21.5, -90, 33.7, 0.7)  // 北墙西段（中央留 10m 口接主墓道）
    uwall(21.5, -90, 33.7, 0.7)   // 北墙东段
    uwall(-21.5, -78, 33.7, 0.7)  // 南墙西段
    uwall(21.5, -78, 33.7, 0.7)   // 南墙东段
    uwall(-38, -84, 0.7, 12.7)    // 西端封口
    uwall(38, -84, 0.7, 12.7)     // 东端封口
    walkables.push({ minX: -38, maxX: 38, minZ: -90, maxZ: -78, y0: UY, y1: UY })
    uceil(0, -84, 77, 13)
    mkContainer(-34, -87, '武器箱', 0.75, UY, rng)       // 西端陪葬品
    mkContainer(-30, -81, '高级旅行箱', 0.7, UY, rng)
    mkContainer(34, -81, '弹药箱', 0.7, UY, rng)         // 东端陪葬品
    mkContainer(30, -87, '收纳盒', 0.55, UY, rng)
    mapMarkers.push({ x: 0, z: -84, kind: 'block', name: '陪葬殿' })

    // ================= 地下：主墓室（32×28 大殿，Boss 巡逻 + 石棺） =================
    uwall(-16, -104, 0.7, 28.7)   // 西墙
    uwall(16, -104, 0.7, 28.7)    // 东墙
    uwall(-10.5, -118, 11, 0.7)   // 北墙西段（中央 6m 通陵寝甬道）
    uwall(10.5, -118, 11, 0.7)    // 北墙东段
    // 南墙即陪葬殿北墙开口段（x -5..5 已通）
    uwall(-10.5, -90, 11, 0.7)    // 南墙西段
    uwall(10.5, -90, 11, 0.7)     // 南墙东段
    walkables.push({ minX: -16, maxX: 16, minZ: -118, maxZ: -90, y0: UY, y1: UY })
    uceil(0, -104, 33, 29)
    // 大殿立柱两列（绕柱战）
    for (const px of [-9, 9]) {
      for (const pz of [-96, -104, -112]) {
        const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.85, 3, 10), tombStone)
        pil.position.set(px, UY + 1.5, pz)
        pil.castShadow = true
        scene.add(pil); obstacleMeshes.push(pil)
        colliders.push({ minX: px - 0.85, maxX: px + 0.85, minZ: pz - 0.85, maxZ: pz + 0.85, top: UY + 3, base: UY })
      }
    }
    // 主墓室明器容器 + 一具可见石棺（不用门卡也能见到摸到）
    mkContainer(-13, -95, '武器箱', 0.85, UY, rng)
    mkContainer(13, -95, '收纳盒', 0.6, UY, rng)
    mkContainer(-13, -113, '高级旅行箱', 0.8, UY, rng)
    mkContainer(13, -113, '弹药箱', 0.7, UY, rng)
    mkContainer(-6, -115, '石棺', 2.2, UY, rng)
    mapMarkers.push({ x: 0, z: -104, kind: 'block', name: '主墓室' })

    // ================= 地下：陵寝甬道 + 石门（任务墙） =================
    uwall(-3, -121, 0.6, 6.4)     // 甬道西壁
    uwall(3, -121, 0.6, 6.4)      // 甬道东壁
    walkables.push({ minX: -3, maxX: 3, minZ: -124, maxZ: -118, y0: UY, y1: UY })
    uceil(0, -121, 7, 7)
    // 石门：点亮四座长明灯后由引擎移除
    const stoneDoor = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 0.7), tombDark)
    stoneDoor.position.set(0, UY + 1.5, -119.5)
    stoneDoor.castShadow = true
    scene.add(stoneDoor); obstacleMeshes.push(stoneDoor)
    const glyph = new THREE.Mesh(new THREE.CircleGeometry(0.55, 16), goldMat2)
    glyph.position.set(0, UY + 1.7, -119.1)
    scene.add(glyph)
    const sdAABB = { minX: -3, maxX: 3, minZ: -119.85, maxZ: -119.15, top: -1, base: UY }
    colliders.push(sdAABB)
    missionWall = { meshes: [stoneDoor, glyph], aabb: sdAABB }
    mkRewardCrate(0, -122, UY) // 石门后奖励箱，点灯完成后现身

    // ================= 地下：法老陵寝（22×18 双门双卡锁房） =================
    uwall(-11, -133, 0.7, 18.7)   // 西墙
    uwall(11, -133, 0.7, 18.7)    // 东墙
    uwall(0, -142, 22.7, 0.7)     // 北墙
    uwall(-6.5, -124, 9, 0.7)     // 南墙西段（中央 4m 门洞）
    uwall(6.5, -124, 9, 0.7)      // 南墙东段
    uwall(-6.5, -133, 9, 0.7)     // 内室隔墙西段（中央 4m 门洞）
    uwall(6.5, -133, 9, 0.7)      // 内室隔墙东段
    walkables.push({ minX: -11, maxX: 11, minZ: -142, maxZ: -124, y0: UY, y1: UY })
    uceil(0, -133, 23, 19)
    mkDoor(0, -124, 2.4, 2.6, UY, 0, 'k_d_gate', '陵寝外殿门卡')   // 外门（紫卡）
    mkDoor(0, -133, 2.4, 2.6, UY, 0, 'k_d_tomb', '法老墓室门卡')   // 内门（红卡）
    // 外殿：金饰陪葬
    dbox(goldMat2, 1.2, 0.5, 1.2, -8, UY + 0.25, -127, false)
    dbox(goldMat2, 1.2, 0.5, 1.2, 8, UY + 0.25, -127, false)
    mkContainer(6, -128, '高级旅行箱', 1.1, UY, rng)
    mkContainer(-6, -128, '收纳盒', 0.8, UY, rng)
    // 内室：双保险柜 + 法老石棺（高价值）
    mkContainer(-5, -139, '保险柜', 2.0, UY, rng)
    mkContainer(5, -139, '保险柜', 2.0, UY, rng)
    mkContainer(0, -138, '石棺', 2.6, UY, rng)
    mapMarkers.push({ x: 0, z: -133, kind: 'locked', name: '法老陵寝' })

    // ================= 地下：长明灯 ×4（专属任务） =================
    lampStands = []
    const mkLamp = (x: number, z: number, floorY: number) => {
      const g = new THREE.Group()
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, 1.1, 8), tombStone)
      ped.position.y = 0.55
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.2, 0.3, 10), goldMat2)
      bowl.position.y = 1.22
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 8),
        new THREE.MeshBasicMaterial({ color: 0xffa63c }))
      flame.position.y = 1.65
      flame.visible = false
      g.add(ped, bowl, flame)
      g.position.set(x, floorY, z)
      g.traverse(o => { o.castShadow = true })
      scene.add(g); obstacleMeshes.push(g)
      colliders.push({ minX: x - 0.4, maxX: x + 0.4, minZ: z - 0.4, maxZ: z + 0.4, top: floorY + 1.4, base: floorY })
      const light = new THREE.PointLight(0xff9a3c, 0, 13, 1.6)
      light.position.set(x, floorY + 1.9, z)
      scene.add(light)
      const lbeam = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.34, 4.4, 10, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xffc46a, transparent: true, opacity: 0.26, side: THREE.DoubleSide, depthWrite: false }))
      lbeam.position.set(x, floorY + 2.2, z)
      scene.add(lbeam)
      missionGuides.push(lbeam)
      lampStands!.push({ x, z, floorY, flame, light, lit: false })
    }
    for (const l of MAP_MISSIONS.desert.lamps ?? []) mkLamp(l.x, l.z, l.floorY ?? UY)
    mapMarkers.push({ x: 0, z: -57, kind: 'mission', name: '长明灯' })

    // ================= 地下照明（每座厅室都有火盆光） =================
    for (const [lx, lz] of [[0, -57], [-25, -57], [30, -57], [0, -84], [0, -104], [0, -128]] as const) {
      const pl = new THREE.PointLight(0xffb060, 16, 26, 1.5)
      pl.position.set(lx, UY + 2.4, lz)
      scene.add(pl)
    }

    // ================= 任务终端（地表接取） =================
    mkTerminal(4, -18)

    // ================= 地表散落容器 =================
    const dBlocked = (x: number, z: number) =>
      (Math.abs(x) < 14 && z > -52 && z < -26) ||                       // 神庙
      (x > 50 && x < 72 && z > 18 && z < 40) ||                         // 驿站
      (x > -72 && x < -48 && z > -22 && z < 2) ||                       // 雕像群
      Math.hypot(x - 126, z) < 12 || Math.hypot(x, z - 112) < 12        // 撤离点 / 出生点
    const dTypes = [
      { title: '收纳盒', luck: 0.35 }, { title: '武器箱', luck: 0.5 },
      { title: '高级旅行箱', luck: 0.3 }, { title: '医疗物资', luck: 0.3 },
    ]
    let dPlaced = 0
    while (dPlaced < 9) {
      const x = (rng() - 0.5) * (size * 2 - 30)
      const z = (rng() - 0.5) * (size * 2 - 30)
      if (dBlocked(x, z)) continue
      const t = dTypes[Math.floor(rng() * dTypes.length)]
      mkContainer(x, z, t.title, t.luck, 0, rng)
      dPlaced++
    }

    // Boss：沙之祭司在主墓室巡逻
    bossSpawns.push({ pos: new THREE.Vector3(0, UY, -104), name: '沙之祭司·伊姆霍特' })
    // 敌人出没点：地表 + 地下各厅室
    for (const [ex, ez] of [[-30, 60], [40, 70], [-80, 40], [80, -30], [-20, -70]] as const) {
      spawnPoints.push(new THREE.Vector3(ex, 0, ez))
    }
    for (const [ex, ez] of [[0, -57], [-36, -57], [36, -57], [-30, -84], [30, -84], [0, -100]] as const) {
      spawnPoints.push(new THREE.Vector3(ex, UY, ez))
    }
  } else if (mapId === 'tower') {
    // ================= 地图二：高塔禁区 =================
    playerSpawn = new THREE.Vector3(-110, 0, 0)
    playerYaw = -Math.PI / 2 // 面向地图中心（+x 方向）

    const towerMat = new THREE.MeshStandardMaterial({ color: 0x7d838c, roughness: 0.6, metalness: 0.35 })
    const towerDark = new THREE.MeshStandardMaterial({ color: 0x4c5158, roughness: 0.7, metalness: 0.3 })
    const slabMat = new THREE.MeshStandardMaterial({ color: 0x686c74, roughness: 0.85 })
    const glowCyan = new THREE.MeshStandardMaterial({ color: 0x0a2a30, emissive: 0x2ad6e8, emissiveIntensity: 1.6, roughness: 0.4 })
    const T = 36          // 塔基半宽
    const IN = T - 0.5    // 内沿
    const FH = 3.4        // 层高
    const FLOORS = 4
    const A = IN          // 内部半宽
    const box = (mat: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, solid = true) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
      m.position.set(x, y, z)
      m.castShadow = true; m.receiveShadow = true
      scene.add(m); obstacleMeshes.push(m)
      if (solid) colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, base: y - h / 2, top: y + h / 2 })
      return m
    }
    // 沿 z 延伸的隔墙（x=at，z 从 from 到 to，doors 为门洞中心）
    const vWall = (at: number, from: number, to: number, fy: number, doorGaps: number[], dw = 3.2, mk = true) => {
      const ds = [...doorGaps].sort((a, b) => a - b)
      const cuts = [from, ...ds.flatMap(d => [d - dw / 2, d + dw / 2]), to]
      for (let i = 0; i < cuts.length; i += 2) {
        const a0 = cuts[i], b0 = cuts[i + 1]
        if (b0 - a0 < 0.05) continue
        box(towerDark, 0.5, FH, b0 - a0, at, fy + FH / 2, (a0 + b0) / 2)
      }
      if (mk) for (const d of ds) mkDoor(at, d, dw, 2.7, fy, Math.PI / 2)
    }
    // 沿 x 延伸的隔墙（z=at）
    const hWall = (at: number, from: number, to: number, fy: number, doorGaps: number[], dw = 3.2, mk = true) => {
      const ds = [...doorGaps].sort((a, b) => a - b)
      const cuts = [from, ...ds.flatMap(d => [d - dw / 2, d + dw / 2]), to]
      for (let i = 0; i < cuts.length; i += 2) {
        const a0 = cuts[i], b0 = cuts[i + 1]
        if (b0 - a0 < 0.05) continue
        box(towerDark, b0 - a0, FH, 0.5, (a0 + b0) / 2, fy + FH / 2, at)
      }
      if (mk) for (const d of ds) mkDoor(d, at, dw, 2.7, fy, 0)
    }

    // ---- 塔内照明：每层两盏暖光顶灯（适中亮度，保持压抑氛围） ----
    for (let f = 0; f < FLOORS; f++) {
      for (const lx of [-A / 2, A / 2]) {
        const lamp = new THREE.PointLight(0xffd9a0, 170, 48, 1.25)
        lamp.position.set(lx, f * FH + FH - 0.5, 0)
        scene.add(lamp)
        const lampMesh = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 1.6),
          new THREE.MeshStandardMaterial({ color: 0x2a2a2a, emissive: 0xffcf90, emissiveIntensity: 1.1 }))
        lampMesh.position.set(lx, f * FH + FH - 0.28, 0)
        scene.add(lampMesh)
      }
    }

    // ---- 可玩塔身：外墙 + 科幻细节 ----
    for (let f = 0; f < FLOORS; f++) {
      const fy = f * FH
      box(towerMat, T * 2, FH, 0.5, 0, fy + FH / 2, -(T - 0.25))                    // 北墙
      if (f === 0) {
        box(towerMat, T - 1.6, FH, 0.5, -(1.6 + (T - 1.6) / 2), fy + FH / 2, T - 0.25) // 南墙左段
        box(towerMat, T - 1.6, FH, 0.5, 1.6 + (T - 1.6) / 2, fy + FH / 2, T - 0.25)    // 南墙右段（3.2m 门洞）
      } else {
        box(towerMat, T * 2, FH, 0.5, 0, fy + FH / 2, T - 0.25)                      // 南墙
      }
      box(towerMat, 0.5, FH, T * 2 - 1, -(T - 0.25), fy + FH / 2, 0)                 // 西墙
      box(towerMat, 0.5, FH, T * 2 - 1, T - 0.25, fy + FH / 2, 0)                    // 东墙
      box(towerDark, T * 2 + 0.6, 0.25, T * 2 + 0.6, 0, fy + FH - 0.02, 0, false)    // 层间线条
      // 外立面青色能量条（每面两条竖向光带）
      for (const sx of [-0.55, 0.55]) {
        box(glowCyan, 0.35, FH * 0.7, 0.1, sx * T, fy + FH / 2, -(T + 0.02), false)
        box(glowCyan, 0.35, FH * 0.7, 0.1, sx * T, fy + FH / 2, T + 0.02, false)
        box(glowCyan, 0.1, FH * 0.7, 0.35, -(T + 0.02), fy + FH / 2, sx * T, false)
        box(glowCyan, 0.1, FH * 0.7, 0.35, T + 0.02, fy + FH / 2, sx * T, false)
      }
    }
    // 四角立柱 + 柱顶护甲
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      box(towerDark, 2.0, FH * FLOORS, 2.0, sx * (T - 1), FH * FLOORS / 2, sz * (T - 1), false)
      box(towerMat, 2.6, 1.2, 2.6, sx * (T - 1), FH * FLOORS + 0.6, sz * (T - 1), false)
    }

    // ---- 巴别塔上层结构：蓝色玻璃幕墙摩天楼，对称退台收分 + 尖顶（仿三角洲巴别塔原型，总高约 200 米） ----
    {
      const glassBlue = new THREE.MeshStandardMaterial({ color: 0x4a90d9, roughness: 0.25, metalness: 0.55, emissive: 0x1a4a80, emissiveIntensity: 0.5 })
      const glassPale = new THREE.MeshStandardMaterial({ color: 0xbcdcf5, roughness: 0.28, metalness: 0.5, emissive: 0x2a5a8a, emissiveIntensity: 0.4 })
      const stripDark = new THREE.MeshStandardMaterial({ color: 0x16222e, roughness: 0.4, metalness: 0.6 })

      // 可玩段玻璃幕墙（四面外挂蓝玻璃板，内部保持原样）
      for (const [gw, gd, gx, gz] of [
        [T * 2 + 1.2, 0.3, 0, -(T + 0.45)], [T * 2 + 1.2, 0.3, 0, T + 0.45],
        [0.3, T * 2 + 1.2, -(T + 0.45), 0], [0.3, T * 2 + 1.2, T + 0.45, 0],
      ] as [number, number, number, number][]) {
        box(glassBlue, gw, FH * FLOORS, gd, gx, FH * FLOORS / 2, gz, false)
      }
      // 幕墙竖向浅色铝框 + 中央深色竖条
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        box(glassPale, 1.0, FH * FLOORS, 1.0, sx * (T + 0.45), FH * FLOORS / 2, sz * (T + 0.45), false)
      }

      // 退台段：宽度逐级收分，蓝玻璃主体 + 浅色角柱 + 每面中央深色竖条
      const sections = [
        { w: 40, h: 30 }, { w: 30, h: 38 }, { w: 21, h: 48 }, { w: 12, h: 54 },
      ]
      let ty = FH * FLOORS
      for (const s of sections) {
        // 层底浅色挑檐
        box(glassPale, s.w + 2.4, 1.2, s.w + 2.4, 0, ty + 0.6, 0, false)
        // 蓝玻璃主体
        box(glassBlue, s.w, s.h, s.w, 0, ty + s.h / 2, 0, false)
        // 浅色角柱（四角的亮边）
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
          box(glassPale, Math.max(1.2, s.w * 0.09), s.h, Math.max(1.2, s.w * 0.09), sx * (s.w / 2 - 0.4), ty + s.h / 2, sz * (s.w / 2 - 0.4), false)
        }
        // 每面中央深色竖条（巴别塔标志性的中缝）
        box(stripDark, Math.max(1.4, s.w * 0.12), s.h, 0.25, 0, ty + s.h / 2, s.w / 2 + 0.08, false)
        box(stripDark, Math.max(1.4, s.w * 0.12), s.h, 0.25, 0, ty + s.h / 2, -s.w / 2 - 0.08, false)
        box(stripDark, 0.25, s.h, Math.max(1.4, s.w * 0.12), s.w / 2 + 0.08, ty + s.h / 2, 0, false)
        box(stripDark, 0.25, s.h, Math.max(1.4, s.w * 0.12), -s.w / 2 - 0.08, ty + s.h / 2, 0, false)
        ty += s.h
      }
      // 尖顶：四棱锥收束 + 顶针 + 红色信标
      const spire = new THREE.Mesh(new THREE.ConeGeometry(12 / Math.SQRT2, 18, 4), glassBlue)
      spire.position.set(0, ty + 9, 0)
      spire.rotation.y = Math.PI / 4
      spire.castShadow = true
      scene.add(spire); obstacleMeshes.push(spire)
      box(stripDark, 1.1, 12, 1.1, 0, ty + 18 + 6, 0, false)
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(1.5, 12, 10),
        new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff2a2a, emissiveIntensity: 2.4 }))
      beacon.position.set(0, ty + 30.5, 0)
      scene.add(beacon)
      // ty 总计 ≈ 13.6 + 30 + 38 + 48 + 54 + 18 + 12 ≈ 200 米
    }

    // ---- 楼板与楼梯井（开口只留在楼梯区域） ----
    const stripW = 3               // 楼梯条带宽
    const runX0 = -11, runX1 = 1.5 // 坡道 x 范围（北侧升向 +x）
    const landX1 = 8               // 平台到 x=8
    for (let f = 1; f <= FLOORS; f++) {
      const fy = f * FH
      if (f === FLOORS) {
        box(slabMat, IN * 2, 0.3, IN * 2, 0, fy - 0.15, 0, false) // 屋顶盖板
      } else {
        const openNorth = f % 2 === 1 // 该层楼板的楼梯井开口侧
        const zIn = openNorth ? -A + stripW : A - stripW
        if (openNorth) {
          box(slabMat, IN * 2, 0.3, A - zIn, 0, fy - 0.15, (zIn + A) / 2, false)
          walkables.push({ minX: -A, maxX: A, minZ: zIn, maxZ: A, y0: fy, y1: fy })
          box(slabMat, A - landX1, 0.3, stripW, (landX1 + A) / 2, fy - 0.15, -A + stripW / 2, false)
          walkables.push({ minX: landX1, maxX: A, minZ: -A, maxZ: -A + stripW, y0: fy, y1: fy })
          box(slabMat, runX0 + A, 0.3, stripW, (-A + runX0) / 2, fy - 0.15, -A + stripW / 2, false)
          walkables.push({ minX: -A, maxX: runX0, minZ: -A, maxZ: -A + stripW, y0: fy, y1: fy })
        } else {
          box(slabMat, IN * 2, 0.3, zIn + A, 0, fy - 0.15, (-A + zIn) / 2, false)
          walkables.push({ minX: -A, maxX: A, minZ: -A, maxZ: zIn, y0: fy, y1: fy })
          box(slabMat, A - landX1, 0.3, stripW, (landX1 + A) / 2, fy - 0.15, A - stripW / 2, false)
          walkables.push({ minX: landX1, maxX: A, minZ: A - stripW, maxZ: A, y0: fy, y1: fy })
          box(slabMat, runX0 + A, 0.3, stripW, (-A + runX0) / 2, fy - 0.15, A - stripW / 2, false)
          walkables.push({ minX: -A, maxX: runX0, minZ: A - stripW, maxZ: A, y0: fy, y1: fy })
        }
      }
    }
    box(slabMat, IN * 2, 0.06, IN * 2, 0, 0.03, 0, false) // 一层水泥地板

    // ---- 之字形坡道楼梯 ----
    const rampMat = new THREE.MeshStandardMaterial({ color: 0x8f887f, roughness: 0.9 })
    for (let f = 0; f < FLOORS - 1; f++) {
      const y0 = f * FH, y1 = (f + 1) * FH
      const north = f % 2 === 0
      const zC = north ? -(A - stripW / 2) : (A - stripW / 2)
      const len = runX1 - runX0
      const dirSign = north ? 1 : -1
      const ramp = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(len, FH), 0.25, stripW), rampMat)
      ramp.position.set((runX0 + runX1) / 2 * dirSign, (y0 + y1) / 2 - 0.1, zC)
      ramp.rotation.z = dirSign * Math.atan2(FH, len)
      ramp.castShadow = true; ramp.receiveShadow = true
      scene.add(ramp); obstacleMeshes.push(ramp)
      walkables.push({
        minX: Math.min(runX0 * dirSign, runX1 * dirSign), maxX: Math.max(runX0 * dirSign, runX1 * dirSign),
        minZ: zC - stripW / 2, maxZ: zC + stripW / 2,
        y0: north ? y0 : y1, y1: north ? y1 : y0, axis: 'x',
      })
      const lMinX = north ? runX1 : -landX1, lMaxX = north ? landX1 : -runX1
      const land = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(lMaxX - lMinX), 0.25, stripW), rampMat)
      land.position.set((lMinX + lMaxX) / 2, y1 - 0.1, zC)
      land.castShadow = true; land.receiveShadow = true
      scene.add(land); obstacleMeshes.push(land)
      walkables.push({ minX: lMinX, maxX: lMaxX, minZ: zC - stripW / 2, maxZ: zC + stripW / 2, y0: y1, y1: y1 })
    }

    // ---- 每层内部结构：各自不同的房间布局 ----
    // 塔大门（一层南门洞）
    mkDoor(0, T - 0.25, 3.2, 2.7, 0, 0)
    // 一层「仓库大厅」：两条纵廊分出三列，东西两侧再横断，中央大厅再分两截
    vWall(-12, -A, A, 0, [-20, 8, 26])
    vWall(12, -A, A, 0, [-26, -8, 20])
    hWall(0, -A, -12, 0, [-24])
    hWall(0, 12, A, 0, [24])
    hWall(20, -12, 12, 0, [0])
    hWall(-20, -12, 12, 0, [0])
    // 二层「隔间迷宫」：三条横向隔断 + 中带纵断
    hWall(-12, -A, A, FH, [-26, 0, 26])
    hWall(12, -A, A, FH, [-26, 0, 26])
    vWall(0, -12, 12, FH, [0])
    vWall(-22, -A, -12, FH, [-24])
    vWall(22, 12, A, FH, [24])
    // 三层「环形走廊」：中央大厅 + 四角房间
    vWall(-16, -A, A, 2 * FH, [-24, 0, 24])
    vWall(16, -A, A, 2 * FH, [-24, 0, 24])
    hWall(-16, -16, 16, 2 * FH, [0])
    hWall(16, -16, 16, 2 * FH, [0])
    // 四层「Boss 殿」：北侧王座大厅 + 南侧前厅带侧室，前厅再隔出一间
    hWall(-8, -A, A, 3 * FH, [-14, 14])
    vWall(-16, -8, A, 3 * FH, [10])
    vWall(16, -8, A, 3 * FH, [10])
    hWall(12, -16, 16, 3 * FH, [0])

    // ---- 塔内容器：楼层越高货越好 ----
    mkContainer(-24, 14, '收纳盒', 0.4, 0)
    mkContainer(0, 24, '医疗物资', 0.4, 0)
    mkContainer(-20, -28, '高级旅行箱', 0.4, 0)
    mkContainer(18, 26, '武器箱', 0.5, 0)
    mkContainer(26, -20, '收纳盒', 0.4, 0)
    mkContainer(-22, 20, '武器箱', 0.7, FH)
    mkContainer(22, 18, '高级旅行箱', 0.6, FH)
    mkContainer(-24, -16, '收纳盒', 0.5, FH)
    mkContainer(18, -24, '医疗物资', 0.6, FH)
    mkContainer(0, -28, '武器箱', 0.7, FH)
    mkContainer(0, 0, '保险箱', 1.3, 2 * FH)
    mkContainer(-24, -24, '武器箱', 0.9, 2 * FH)
    mkContainer(24, 24, '医疗物资', 0.6, 2 * FH)
    mkContainer(-26, 10, '高级旅行箱', 0.8, 2 * FH)
    mkContainer(26, -10, '收纳盒', 0.8, 2 * FH)
    mkContainer(-10, -26, '保险箱', 2.2, 3 * FH), undefined, 'tower_top'
    mkContainer(10, -26, '保险箱', 1.8, 3 * FH), undefined, 'tower_top'
    mkContainer(0, 20, '武器箱', 1.2, 3 * FH), undefined, 'tower_top'
    mkContainer(-22, 8, '医疗物资', 0.8, 3 * FH), undefined, 'tower_top'
    // 每层一间专属锁房（角落房间，刷卡才能进，货比同层好一档）
    const lockedRoom = (fy: number, cx: number, cz: number, cardId: string, cardName: string, roomName: string) => {
      // 房在 (cx,cz) 角落：两面新墙 + 两面外墙围成 10×10，门开在内侧纵墙
      const x0 = Math.min(cx - 5, cx + 5), x1 = Math.max(cx - 5, cx + 5)
      const z0 = Math.min(cz - 5, cz + 5), z1 = Math.max(cz - 5, cz + 5)
      const xIn = cx > 0 ? x0 : x1 // 靠内的纵墙
      const zIn = cz > 0 ? z0 : z1 // 靠内的横墙
      vWall(xIn, z0, z1, fy, [cz], 3.2, false)
      hWall(zIn, x0, x1, fy, [])
      mkDoor(xIn, cz, 3.2, 2.7, fy, Math.PI / 2, cardId, cardName)
      mapMarkers.push({ x: cx, z: cz, kind: 'locked', name: roomName })
    }
    lockedRoom(0, 29, 29, 'k_t_dorm', '宿舍房卡', '宿舍')
    lockedRoom(FH, -29, 29, 'k_t_arch', '档案室房卡', '档案室')
    lockedRoom(2 * FH, 29, -29, 'k_t_arm', '军械库房卡', '军械库')
    lockedRoom(3 * FH, -29, -29, 'k_t_warden', '典狱长密卡', '典狱长密库')
    mkContainer(29, 29, '收纳盒', 0.9, 0)
    mkContainer(31, 26, '医疗物资', 0.8, 0)
    mkContainer(-29, 29, '高级旅行箱', 1.1, FH)
    mkContainer(-31, 26, '收纳盒', 1.0, FH)
    mkContainer(29, -29, '武器箱', 1.6, 2 * FH)
    mkContainer(31, -26, '高级旅行箱', 1.2, 2 * FH)
    mkContainer(-29, -29, '保险箱', 2.6, 3 * FH), undefined, 'tower_top'
    mkContainer(-31, -26, '武器箱', 1.4, 3 * FH), undefined, 'tower_top'

    // 保险柜：顶层两角；售货机：出生点与撤离点
    mkContainer(-33, 29, '保险柜', 1.8, 3 * FH)
    mkContainer(33, 29, '保险柜', 1.8, 2 * FH)
    mkContainer(-100, 6, '售货机', 0.2, 0, rng)
    mkContainer(-96, 2, '弹药箱', 0.5, 0, rng)    // 高塔出生点弹药箱
    mkContainer(20, 20, '弹药箱', 0.8, 2 * FH, rng) // 高塔三层弹药箱
    mkContainer(120, 6, '售货机', 0.2, 0, rng)

    // ---- 专属任务「塔顶信号」：西侧任务终端 + 顶层发射器奖励箱 ----
    mkTerminal(-95, 6)
    mkObjective(5, 5, 3 * FH)  // 顶层信号发射器
    mkRewardCrate(7, 7, 3 * FH) // 顶层，信号传输完成后解锁
    mapMarkers.push({ x: 5, z: 5, kind: 'mission', name: '发射器' })

    // Boss 镇守顶层王座大厅
    bossSpawns.push({ pos: new THREE.Vector3(0, FH * 3, -20), name: '塔主·典狱长' })
    // 塔内守卫出没层
    spawnPoints.push(new THREE.Vector3(0, FH, 14))
    spawnPoints.push(new THREE.Vector3(-14, 2 * FH, -14))

    // 塔内掩体箱（每层几个，填充空旷也当对战掩体）
    const innerCrate = new THREE.MeshStandardMaterial({ color: 0x7a6a4d, roughness: 0.9 })
    const crateSpots = [[-6, 6], [8, -14], [-18, 18], [20, 4]]
    for (let f = 0; f < FLOORS; f++) {
      for (let i = 0; i < crateSpots.length; i++) {
        if ((i + f) % 2 === 0) continue
        const [cx, cz] = crateSpots[i]
        const cs = 1.1 + (i % 3) * 0.3
        const m = new THREE.Mesh(new THREE.BoxGeometry(cs, cs, cs), innerCrate)
        m.position.set(cx, f * FH + cs / 2, cz)
        m.castShadow = true; m.receiveShadow = true
        scene.add(m); obstacleMeshes.push(m)
        colliders.push({ minX: cx - cs / 2, maxX: cx + cs / 2, minZ: cz - cs / 2, maxZ: cz + cs / 2, base: f * FH, top: f * FH + cs })
      }
    }

    mapMarkers.push({ x: 0, z: 0, kind: 'tower', name: '巴别塔' })

    // ---- 塔外平房区：密集棚屋环带 ----
    const houseMat = new THREE.MeshStandardMaterial({ color: 0xa89a80, roughness: 0.9 })
    const houseMat2 = new THREE.MeshStandardMaterial({ color: 0x97a08c, roughness: 0.9 })
    const houseRoof = new THREE.MeshStandardMaterial({ color: 0x7a6a55, roughness: 0.9 })
    const houseTypes = ['收纳盒', '高级旅行箱', '医疗物资', '武器箱', '收纳盒', '高级旅行箱', '医疗物资', '收纳盒']
    const houseSpots: { x: number; z: number }[] = []
    // 绕塔两圈密集排布：内圈 8 座、外圈 10 座
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2
      const r = 50 + (rng() - 0.5) * 7
      houseSpots.push({ x: Math.cos(a) * r, z: Math.sin(a) * r })
    }
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.55
      const r = 76 + (rng() - 0.5) * 14
      houseSpots.push({ x: Math.cos(a) * r, z: Math.sin(a) * r })
    }
    for (let i = 0; i < houseSpots.length; i++) {
      const hs = houseSpots[i]
      if (houseSpots.some((o, j) => j < i && Math.hypot(o.x - hs.x, o.z - hs.z) < 12)) continue
      const W = 6 + rng() * 2.5, D = 5.5 + rng() * 2, H = 2.8
      const ang = Math.atan2(-hs.x, -hs.z) // 门朝塔
      const hm = rng() < 0.5 ? houseMat : houseMat2
      const mk = (w: number, h: number, d: number, dx: number, dz: number) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), hm)
        m.position.set(hs.x + dx, h / 2, hs.z + dz)
        m.rotation.y = ang
        m.castShadow = true; m.receiveShadow = true
        scene.add(m); obstacleMeshes.push(m)
        const ex = Math.abs(Math.cos(ang)) * w / 2 + Math.abs(Math.sin(ang)) * d / 2
        const ez = Math.abs(Math.sin(ang)) * w / 2 + Math.abs(Math.cos(ang)) * d / 2
        colliders.push({ minX: hs.x + dx - ex, maxX: hs.x + dx + ex, minZ: hs.z + dz - ez, maxZ: hs.z + dz + ez, top: h })
      }
      mk(W, H, 0.3, Math.sin(ang) * -(D / 2), Math.cos(ang) * -(D / 2))                    // 后墙
      mk(0.3, H, D, Math.cos(ang) * (W / 2), -Math.sin(ang) * (W / 2))                     // 右墙
      mk(0.3, H, D, -Math.cos(ang) * (W / 2), Math.sin(ang) * (W / 2))                     // 左墙
      const seg = (W - 2) / 2
      mk(seg, H, 0.3, Math.cos(ang) * (1 + seg / 2) + Math.sin(ang) * (D / 2), -Math.sin(ang) * (1 + seg / 2) + Math.cos(ang) * (D / 2))
      mk(seg, H, 0.3, -Math.cos(ang) * (1 + seg / 2) + Math.sin(ang) * (D / 2), Math.sin(ang) * (1 + seg / 2) + Math.cos(ang) * (D / 2))
      const roofM = new THREE.Mesh(new THREE.BoxGeometry(W + 0.6, 0.25, D + 0.6), houseRoof)
      roofM.position.set(hs.x, H + 0.12, hs.z)
      roofM.rotation.y = ang
      roofM.castShadow = true
      scene.add(roofM); obstacleMeshes.push(roofM)
      // 房门（可推开）
      mkDoor(hs.x + Math.sin(ang) * (D / 2), hs.z + Math.cos(ang) * (D / 2), 2.0, 2.2, 0, ang)
      mapMarkers.push({ x: hs.x, z: hs.z, kind: 'house' })
      const t1 = houseTypes[i % houseTypes.length]
      mkContainer(hs.x + Math.cos(ang) * 1.2, hs.z - Math.sin(ang) * 1.2, t1, t1 === '武器箱' ? 0.35 : 0.3, 0, rng)
      if (rng() < 0.45) {
        const t2 = houseTypes[(i + 3) % houseTypes.length]
        mkContainer(hs.x - Math.cos(ang) * 1.5, hs.z + Math.sin(ang) * 1.5, t2, 0.3, 0, rng)
      }
      spawnPoints.push(new THREE.Vector3(hs.x + Math.sin(ang) * (D / 2 + 2.5), 0, hs.z + Math.cos(ang) * (D / 2 + 2.5)))
    }
    // 草地上散落几个鸟窝（黄金鸟蛋唯一点位，这张图也有）
    for (let i = 0; i < 6; i++) {
      const x = (rng() - 0.5) * (size * 2 - 40)
      const z = (rng() - 0.5) * (size * 2 - 40)
      if (Math.hypot(x, z) < 44) continue
      mkContainer(x, z, '鸟窝', 0.2, 0, rng)
    }
    // 巷战掩体箱
    const crateMat2 = new THREE.MeshStandardMaterial({ color: 0x8a6f4d, roughness: 0.9 })
    for (let i = 0; i < 40; i++) {
      const s = 0.9 + rng() * 1.2
      const x = (rng() - 0.5) * (size * 2 - 24)
      const z = (rng() - 0.5) * (size * 2 - 24)
      if (Math.hypot(x, z) < 42) continue
      const c = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), crateMat2)
      c.position.set(x, s / 2, z)
      c.castShadow = true; c.receiveShadow = true
      scene.add(c); obstacleMeshes.push(c)
      colliders.push({ minX: x - s / 2, maxX: x + s / 2, minZ: z - s / 2, maxZ: z + s / 2, top: s })
    }
  }

  if (mapId === 'tower') {
    scene.fog = new THREE.Fog(0x87a8c8, 80, 400) // 让 200 米高塔远景可见
  }

  if (mapId === 'prison') {
    // ================= 地图三：潮汐监狱（仿三角洲行动） =================
    scene.background = new THREE.Color(0x93a0ae) // 阴天的海边
    scene.fog = new THREE.Fog(0x93a0ae, 70, 260)
    const PW = 75 // 监狱围墙半宽
    const concreteMat = new THREE.MeshStandardMaterial({ color: 0x8d9299, roughness: 0.95 })
    const concreteDark = new THREE.MeshStandardMaterial({ color: 0x767b82, roughness: 0.95 })
    const barMat = new THREE.MeshStandardMaterial({ color: 0x3a3f45, roughness: 0.4, metalness: 0.7 })
    const pw = (x: number, z: number, w: number, d: number, h: number, mat: THREE.Material = concreteMat) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
      m.position.set(x, h / 2, z)
      m.castShadow = true; m.receiveShadow = true
      scene.add(m); obstacleMeshes.push(m)
      colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, top: h })
    }
    // 铁栅栏墙（从 (x0,z0) 到 (x1,z1) 的竖杆阵列）
    const bars = (x0: number, z0: number, x1: number, z1: number, h = 2.7) => {
      const len = Math.hypot(x1 - x0, z1 - z0)
      const n = Math.max(2, Math.round(len / 0.26))
      for (let i = 0; i <= n; i++) {
        const t = i / n
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, h, 6), barMat)
        b.position.set(x0 + (x1 - x0) * t, h / 2, z0 + (z1 - z0) * t)
        b.castShadow = true
        scene.add(b); obstacleMeshes.push(b)
      }
      const pad = 0.09
      colliders.push({ minX: Math.min(x0, x1) - pad, maxX: Math.max(x0, x1) + pad, minZ: Math.min(z0, z1) - pad, maxZ: Math.max(z0, z1) + pad, top: h })
    }

    // ---- 监狱外墙（高 7m，南北各开 6m 大门） ----
    pw(0, -PW - 0.6, PW * 2 + 2.4, 1.2, 7)                                    // 北墙整段
    pw(-(PW + 0.6), 0, 1.2, PW * 2 + 2.4, 7)                                  // 西墙整段
    pw(PW + 0.6, 0, 1.2, PW * 2 + 2.4, 7)                                     // 东墙整段
    pw(-(PW / 2 + 1.5), PW + 0.6, PW - 3 + 1.2, 1.2, 7)                       // 南墙左半
    pw(PW / 2 + 1.5, PW + 0.6, PW - 3 + 1.2, 1.2, 7)                          // 南墙右半
    // 北墙开门（中段留 6m 缺口重建）
    // （上面北墙是整段，这里用两根门柱代替中段）
    // 北门：直接放两扇对开铁门在北墙缺口 —— 简化：北墙不开门，只开南门
    mkDoor(-1.5, PW + 0.6, 3, 3.4, 0, 0)
    mkDoor(1.5, PW + 0.6, 3, 3.4, 0, Math.PI)
    // 墙顶电网（装饰细盒）
    const wireMat = new THREE.MeshStandardMaterial({ color: 0x4a4e54, roughness: 0.5, metalness: 0.6 })
    for (const [wx, wz, ww, wd] of [[0, -PW - 0.6, PW * 2 + 2.4, 0.3], [-(PW + 0.6), 0, 0.3, PW * 2 + 2.4], [PW + 0.6, 0, 0.3, PW * 2 + 2.4], [0, PW + 0.6, PW * 2 + 2.4, 0.3]] as [number, number, number, number][]) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(ww, 0.35, wd), wireMat)
      w.position.set(wx, 7.2, wz)
      scene.add(w)
    }

    // ---- 四座瞭望塔（墙角） ----
    for (const [tx, tz] of [[-PW, -PW], [PW, -PW], [-PW, PW], [PW, PW]] as [number, number][]) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.9, 9, 10), concreteDark)
      pillar.position.set(tx, 4.5, tz)
      pillar.castShadow = true; pillar.receiveShadow = true
      scene.add(pillar); obstacleMeshes.push(pillar)
      colliders.push({ minX: tx - 1.8, maxX: tx + 1.8, minZ: tz - 1.8, maxZ: tz + 1.8, top: 9 })
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(4.6, 2.6, 4.6), concreteMat)
      cabin.position.set(tx, 10.3, tz)
      cabin.castShadow = true
      scene.add(cabin); obstacleMeshes.push(cabin)
      const tRoof = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.3, 5.2), concreteDark)
      tRoof.position.set(tx, 11.75, tz)
      scene.add(tRoof)
      // 探照灯（朝向监狱内的发光锥）
      const spot = new THREE.Mesh(
        new THREE.ConeGeometry(0.5, 1.4, 10),
        new THREE.MeshStandardMaterial({ color: 0x2c2f33, emissive: 0xfff2c0, emissiveIntensity: 1.6 })
      )
      spot.position.set(tx - Math.sign(tx) * 2.2, 10.6, tz - Math.sign(tz) * 2.2)
      spot.rotation.z = Math.sign(tx) * 1.2
      spot.rotation.x = -Math.sign(tz) * 1.2
      scene.add(spot)
      mapMarkers.push({ x: tx, z: tz, kind: 'house', name: '瞭望塔' })
    }

    // ---- A区：牢房大楼（60×30，铁栏牢房两排 + 中央走廊，有屋顶） ----
    const CB = { x0: -30, x1: 30, z0: -45, z1: -15, h: 3.6 }
    // 外墙（南墙中央留 4m 入口）
    pw((CB.x0 + CB.x1) / 2, CB.z0, CB.x1 - CB.x0, 0.4, CB.h)                  // 北外墙
    pw(CB.x0, (CB.z0 + CB.z1) / 2, 0.4, CB.z1 - CB.z0, CB.h)                  // 西外墙
    pw(CB.x1, (CB.z0 + CB.z1) / 2, 0.4, CB.z1 - CB.z0, CB.h)                  // 东外墙
    pw(-16, CB.z1, 28, 0.4, CB.h)                                             // 南外墙左（-30..-2）
    pw(16, CB.z1, 28, 0.4, CB.h)                                              // 南外墙右（2..30）
    mkDoor(0, CB.z1, 3.2, 2.8, 0, 0)                                          // 牢楼入口铁门
    // 屋顶
    const cbRoof = new THREE.Mesh(new THREE.BoxGeometry(CB.x1 - CB.x0 + 1, 0.3, CB.z1 - CB.z0 + 1), concreteDark)
    cbRoof.position.set(0, CB.h + 0.15, (CB.z0 + CB.z1) / 2)
    cbRoof.castShadow = true
    scene.add(cbRoof); obstacleMeshes.push(cbRoof)
    // 牢楼内照明
    for (const [lx, lz] of [[-18, -30], [0, -30], [18, -30]] as [number, number][]) {
      const lamp = new THREE.PointLight(0xffe8c0, 55, 30, 1.4)
      lamp.position.set(lx, CB.h - 0.4, lz)
      scene.add(lamp)
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe8c0 }))
      bulb.position.set(lx, CB.h - 0.25, lz)
      scene.add(bulb)
    }
    // 两排牢房：北排面朝走廊(z=-36)，南排面朝走廊(z=-24)
    const bunkMat = new THREE.MeshStandardMaterial({ color: 0x5a5f52, roughness: 0.8 })
    const cellLoot: [string, number][] = [['收纳盒', 0.55], ['航空箱', 0.9], ['收纳盒', 0.55], ['医疗物资', 0.6], ['收纳盒', 0.55], ['航空箱', 0.95]]
    for (let i = 0; i < 6; i++) {
      const cx0 = CB.x0 + 0.2 + i * 10 // 每间 10 宽
      const ccx = cx0 + 5
      // 北排牢房（z -44.8..-36）
      if (i > 0) pw(cx0, -40.5, 0.3, 8.6, CB.h - 0.4)                          // 隔断
      bars(cx0 + (i === 0 ? 0 : 0.15), -36, ccx - 0.9, -36)                    // 铁栏（门左侧）
      bars(ccx + 0.9, -36, cx0 + 10 - (i === 5 ? 0.2 : 0), -36)                // 铁栏（门右侧）
      mkDoor(ccx, -36, 1.6, 2.5, 0, 0)                                         // 牢门
      // 床铺
      const bunk = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 1), bunkMat)
      bunk.position.set(ccx - 2.5, 0.25, -43.5)
      bunk.castShadow = true
      scene.add(bunk); obstacleMeshes.push(bunk)
      colliders.push({ minX: ccx - 3.6, maxX: ccx - 1.4, minZ: -44, maxZ: -43, top: 0.5 })
      // 南排牢房（z -24..-15.2），镜像
      if (i > 0) pw(cx0, -19.5, 0.3, 8.6, CB.h - 0.4)
      bars(cx0 + (i === 0 ? 0 : 0.15), -24, ccx - 0.9, -24)
      bars(ccx + 0.9, -24, cx0 + 10 - (i === 5 ? 0.2 : 0), -24)
      mkDoor(ccx, -24, 1.6, 2.5, 0, 0)
      const bunk2 = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 1), bunkMat)
      bunk2.position.set(ccx + 2.5, 0.25, -16.5)
      bunk2.castShadow = true
      scene.add(bunk2); obstacleMeshes.push(bunk2)
      colliders.push({ minX: ccx + 1.4, maxX: ccx + 3.6, minZ: -17, maxZ: -16, top: 0.5 })
      // 牢房物资
      const [t, lk] = cellLoot[i]
      mkContainer(ccx + 1.5, -42.5, t, lk, 0, rng)
      const [t2, lk2] = cellLoot[5 - i]
      if (t2 !== '航空箱') mkContainer(ccx - 1.5, -17.5, t2, lk2 * 0.9, 0, rng)
    }
    mapMarkers.push({ x: 0, z: -30, kind: 'block', name: '牢房区' })

    // ---- B区：办公楼（含典狱长办公室/医务室两间锁房） ----
    const OB = { x0: -30, x1: -10, z0: 15, z1: 45, h: 3.2 }
    pw((OB.x0 + OB.x1) / 2, OB.z0, OB.x1 - OB.x0, 0.4, OB.h)                  // 北墙
    pw(OB.x0, (OB.z0 + OB.z1) / 2, 0.4, OB.z1 - OB.z0, OB.h)                  // 西墙
    pw((OB.x0 + OB.x1) / 2, OB.z1, OB.x1 - OB.x0, 0.4, OB.h)                  // 南墙
    pw(OB.x1, OB.z0 + 6.5, 0.4, 13, OB.h)                                     // 东墙上半
    pw(OB.x1, OB.z1 - 4, 0.4, 8, OB.h)                                        // 东墙下半（留 4m 门洞）
    mkDoor(OB.x1, OB.z0 + 17, 3, 2.6, 0, Math.PI / 2)                         // 办公楼入口门
    const obRoof = new THREE.Mesh(new THREE.BoxGeometry(OB.x1 - OB.x0 + 1, 0.3, OB.z1 - OB.z0 + 1), concreteDark)
    obRoof.position.set((OB.x0 + OB.x1) / 2, OB.h + 0.15, (OB.z0 + OB.z1) / 2)
    obRoof.castShadow = true
    scene.add(obRoof); obstacleMeshes.push(obRoof)
    const obLamp = new THREE.PointLight(0xffe8c0, 50, 26, 1.4)
    obLamp.position.set((OB.x0 + OB.x1) / 2, OB.h - 0.4, (OB.z0 + OB.z1) / 2)
    scene.add(obLamp)
    // 内部隔断：西边隔出上下两间锁房（典狱长办公室 / 医务室）
    // 纵隔墙 x=OB.x0+8：在 z=21 / z=39 各留 1.6m 门洞（典狱长办公室 / 医务室）
    pw(OB.x0 + 8, 17.7, 0.3, 5, OB.h - 0.3)                                   // 纵隔墙北段
    pw(OB.x0 + 8, 30, 0.3, 16.4, OB.h - 0.3)                                  // 纵隔墙中段
    pw(OB.x0 + 8, 42.3, 0.3, 5, OB.h - 0.3)                                   // 纵隔墙南段
    pw(OB.x0 + 4, (OB.z0 + OB.z1) / 2, 8, 0.3, OB.h - 0.3)                    // 横隔墙
    mkDoor(OB.x0 + 8, 21, 1.6, 2.4, 0, Math.PI / 2, 'k_p_warden', '典狱长办公室卡')  // 典狱长办公室（北间）
    mkDoor(OB.x0 + 8, 39, 1.6, 2.4, 0, Math.PI / 2, 'k_p_med', '医务室房卡')         // 医务室（南间）
    mkContainer(OB.x0 + 4, OB.z0 + 3.5, '保险箱', 2.6, 0, rng)                 // 典狱长办公室保险箱
    mkContainer(OB.x0 + 2, OB.z0 + 10, '航空箱', 1.1, 0, rng)                  // 典狱长办公室航空箱
    mkContainer(OB.x0 + 4, OB.z0 + 4, '保险柜', 1.8, 0, rng)                   // 典狱长办公室保险柜
    mkContainer(OB.x0 + 4, OB.z1 - 3.5, '医疗物资', 1.0, 0, rng)               // 医务室药品堆
    mkContainer(OB.x0 + 2, OB.z1 - 9, '医疗物资', 0.9, 0, rng)
    mkContainer(OB.x0 + 14, OB.z0 + 5, '高级旅行箱', 0.6, 0, rng)              // 办公开放区
    mkContainer(OB.x0 + 14, OB.z1 - 6, '收纳盒', 0.5, 0, rng)
    mapMarkers.push({ x: OB.x0 + 4, z: OB.z0 + 7.5, kind: 'locked', name: '典狱长办公室' })
    mapMarkers.push({ x: OB.x0 + 4, z: OB.z1 - 7.5, kind: 'locked', name: '医务室' })
    mapMarkers.push({ x: (OB.x0 + OB.x1) / 2, z: (OB.z0 + OB.z1) / 2, kind: 'house', name: '办公楼' })

    // ---- C区：狱警楼（含狱警军械库锁房） ----
    const GB = { x0: 10, x1: 30, z0: 15, z1: 45, h: 3.2 }
    pw((GB.x0 + GB.x1) / 2, GB.z0, GB.x1 - GB.x0, 0.4, GB.h)
    pw(GB.x1, (GB.z0 + GB.z1) / 2, 0.4, GB.z1 - GB.z0, GB.h)
    pw((GB.x0 + GB.x1) / 2, GB.z1, GB.x1 - GB.x0, 0.4, GB.h)
    pw(GB.x0, GB.z0 + 6.5, 0.4, 13, GB.h)
    pw(GB.x0, GB.z1 - 4, 0.4, 8, GB.h)
    mkDoor(GB.x0, GB.z0 + 17, 3, 2.6, 0, Math.PI / 2)
    const gbRoof = new THREE.Mesh(new THREE.BoxGeometry(GB.x1 - GB.x0 + 1, 0.3, GB.z1 - GB.z0 + 1), concreteDark)
    gbRoof.position.set((GB.x0 + GB.x1) / 2, GB.h + 0.15, (GB.z0 + GB.z1) / 2)
    gbRoof.castShadow = true
    scene.add(gbRoof); obstacleMeshes.push(gbRoof)
    const gbLamp = new THREE.PointLight(0xffe8c0, 50, 26, 1.4)
    gbLamp.position.set((GB.x0 + GB.x1) / 2, GB.h - 0.4, (GB.z0 + GB.z1) / 2)
    scene.add(gbLamp)
    // 军械库隔间（东侧）
    // 军械库纵隔墙 x=GB.x1-8：在 z=23 留 1.6m 门洞
    pw(GB.x1 - 8, 18.7, 0.3, 7, GB.h - 0.3)                                   // 军械库隔墙北段
    pw(GB.x1 - 8, 34.3, 0.3, 21, GB.h - 0.3)                                  // 军械库隔墙南段
    mkDoor(GB.x1 - 8, 23, 1.6, 2.4, 0, Math.PI / 2, 'k_p_arm', '狱警军械库房卡')
    pw(GB.x1 - 4, GB.z0 + 3.5, 8, 0.3, GB.h - 0.3)                            // 军械库北隔墙（留南半进入）
    mkContainer(GB.x1 - 4, GB.z0 + 6, '武器箱', 1.0, 0, rng)                   // 军械库武器箱 ×2
    mkContainer(GB.x1 - 2, GB.z0 + 11, '武器箱', 1.0, 0, rng)
    mkContainer(GB.x1 - 4, GB.z1 - 6, '航空箱', 1.15, 0, rng)                  // 军械库航空箱, undefined, 'air'
    mkContainer(GB.x1 - 2, GB.z1 - 2, '保险柜', 1.8, 0, rng)                   // 军械库保险柜
    mkContainer(GB.x0 + 4, GB.z0 + 5, '收纳盒', 0.55, 0, rng)                  // 狱警开放区
    mkContainer(GB.x0 + 5, GB.z1 - 5, '医疗物资', 0.55, 0, rng)
    mkContainer(GB.x0 + 4, GB.z0 + 12, '弹药箱', 0.6, 0, rng)               // 狱警楼弹药箱
    mapMarkers.push({ x: GB.x1 - 4, z: GB.z0 + 8, kind: 'locked', name: '狱警军械库' })
    mapMarkers.push({ x: (GB.x0 + GB.x1) / 2, z: (GB.z0 + GB.z1) / 2, kind: 'house', name: '狱警楼' })

    // ---- D区：禁闭室（四间小号 solitary，一间上锁） ----
    const SB = { x0: 46, z0: -8, cell: 5.5 }
    for (let i = 0; i < 4; i++) {
      const sx = SB.x0 + i * (SB.cell + 1.2)
      const sz = SB.z0
      // 三面混凝土 + 正面铁栏 + 铁门
      pw(sx + SB.cell / 2, sz, SB.cell, 0.3, 3)                                // 后墙
      pw(sx, sz + SB.cell / 2, 0.3, SB.cell, 3)                                // 左墙
      pw(sx + SB.cell, sz + SB.cell / 2, 0.3, SB.cell, 3)                      // 右墙
      const sRoof = new THREE.Mesh(new THREE.BoxGeometry(SB.cell + 0.4, 0.25, SB.cell + 0.4), concreteDark)
      sRoof.position.set(sx + SB.cell / 2, 3.1, sz + SB.cell / 2)
      sRoof.castShadow = true
      scene.add(sRoof); obstacleMeshes.push(sRoof)
      const locked = i === 2 // 第三间是锁房
      bars(sx + 0.15, sz + SB.cell, sx + SB.cell / 2 - 0.85, sz + SB.cell)
      bars(sx + SB.cell / 2 + 0.85, sz + SB.cell, sx + SB.cell - 0.15, sz + SB.cell)
      mkDoor(sx + SB.cell / 2, sz + SB.cell, 1.5, 2.4, 0, 0, locked ? 'k_p_cell' : undefined, locked ? '禁闭室房卡' : undefined)
      if (locked) {
        mkContainer(sx + SB.cell / 2, sz + 1.6, '保险箱', 2.2, 0, rng)
        mapMarkers.push({ x: sx + SB.cell / 2, z: sz + SB.cell / 2, kind: 'locked', name: '禁闭室' })
      } else {
        mkContainer(sx + SB.cell / 2, sz + 1.6, '收纳盒', 0.5, 0, rng)
      }
    }
    mapMarkers.push({ x: SB.x0 + 11, z: SB.z0 + 2.75, kind: 'house', name: '禁闭区' })

    // ---- 操场：放风区围栏 + 篮球架 + 散落物资 ----
    // 围栏（矮铁栏，分隔操场与建筑区，中央留 4m 通道）
    bars(-40, 2, -2, 2, 1.6)
    bars(2, 2, 40, 2, 1.6)
    // 篮球架
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x777d84, roughness: 0.5, metalness: 0.5 })
    for (const bx of [-50, 50]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 3.4, 8), poleMat)
      pole.position.set(bx, 1.7, 0)
      pole.castShadow = true
      scene.add(pole); obstacleMeshes.push(pole)
      const board = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 0.06), new THREE.MeshStandardMaterial({ color: 0xd8d8d0, roughness: 0.6 }))
      board.position.set(bx, 3.2, 0)
      scene.add(board)
      colliders.push({ minX: bx - 0.15, maxX: bx + 0.15, minZ: -0.15, maxZ: 0.15, top: 3.4 })
    }
    // 操场与墙角空地的航空箱（监狱特色容器）
    mkContainer(-52, 24, '航空箱', 0.85, 0, rng), undefined, 'air'
    mkContainer(52, -34, '航空箱', 0.85, 0, rng), undefined, 'air'
    mkContainer(-14, 58, '航空箱', 0.9, 0, rng), undefined, 'air'
    // 操场零散容器
    mkContainer(-40, -8, '收纳盒', 0.5, 0, rng)
    mkContainer(38, 8, '医疗物资', 0.55, 0, rng)
    mkContainer(0, 56, '高级旅行箱', 0.55, 0, rng)
    mkContainer(-58, -20, '武器箱', 0.65, 0, rng)
    // 墙外鸟窝 ×3（黄金鸟蛋点位）
    for (let i = 0; i < 3; i++) {
      const a = rng() * Math.PI * 2
      const r = 92 + rng() * 30
      mkContainer(Math.cos(a) * r, Math.sin(a) * r, '鸟窝', 0.2, 0, rng)
    }
    // 操场掩体箱
    const yardCrate = new THREE.MeshStandardMaterial({ color: 0x707a66, roughness: 0.9 })
    for (let i = 0; i < 26; i++) {
      const s = 0.9 + rng() * 1.1
      const x = (rng() - 0.5) * (PW * 2 - 14)
      const z = (rng() - 0.5) * (PW * 2 - 14)
      // 避开三栋主楼与牢楼
      if (x > -32 && x < 32 && ((z > -47 && z < -13) || (z > 13 && z < 47))) continue
      if (x > 44 && x < 70 && z > -10 && z < 6) continue
      const c = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), yardCrate)
      c.position.set(x, s / 2, z)
      c.castShadow = true; c.receiveShadow = true
      scene.add(c); obstacleMeshes.push(c)
      colliders.push({ minX: x - s / 2, maxX: x + s / 2, minZ: z - s / 2, maxZ: z + s / 2, top: s })
    }
    // 敌人刷新点
    for (const [sx, sz] of [[-55, -55], [55, -55], [-55, 55], [55, 55], [0, -60], [-60, 20], [60, 20], [0, 10], [-20, 30], [24, -20]] as [number, number][]) {
      spawnPoints.push(new THREE.Vector3(sx, 0, sz))
    }
    // 双 Boss：牢楼监狱长 + 操场狱警队长
    bossSpawns.push({ pos: new THREE.Vector3(0, 0, -30), name: '监狱长·洛克' })
    bossSpawns.push({ pos: new THREE.Vector3(20, 0, 25), name: '狱警队长·狂鲨' })
    // 售货机：南门口与撤离点旁
    mkContainer(6, 104, '售货机', 0.2, 0, rng)
    mkContainer(120, 6, '售货机', 0.2, 0, rng)

    // ---- 专属任务「空投引导」：南门任务终端 + 操场空投 ----
    mkTerminal(8, 100)
    mkObjective(-52, 24)     // 操场引导信标
    mkRewardCrate(-55, 27) // 操场角落，信标引导结束后空投落地
    mapMarkers.push({ x: -52, z: 24, kind: 'mission', name: '信标点' })

    // 玩家从南门外入场（南门是唯一出入口）
    playerSpawn = new THREE.Vector3(0, 0, 112)
    playerYaw = 0
  }

  // ===== 活动「空投补给」：每张图额外刷一批航空箱 =====
  if (currentEvent().event?.id === 'airdrop') {
    const spots: [number, number][] = mapId === 'prison'
      ? [[-62, 42], [62, 52], [2, -62]]
      : mapId === 'snow'
        ? [[30, -100], [-100, 30], [100, 60]]
      : mapId === 'tower'
        ? [[62, 62], [-62, -62], [62, -62], [-62, 62]]
        : [[70, 0], [-70, 0], [0, 70], [0, -70]]
    for (const [ax, az] of spots) mkContainer(ax, az, '航空箱', 0.9, 0, rng)
  }

  // ===== 撤离点 =====
  const extractGeo = new THREE.CylinderGeometry(6, 6, 0.3, 32)
  const extractMat = new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x0a5a66, transparent: true, opacity: 0.7 })
  const extractMesh = new THREE.Mesh(extractGeo, extractMat)
  extractMesh.position.copy(extractPos).setY(0.15)
  scene.add(extractMesh)
  // 撤离点光柱
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(4.6, 4.6, 60, 32, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false })
  )
  beam.position.copy(extractPos).setY(30)
  scene.add(beam)
  // 烟雾弹标记
  const smokeGeo = new THREE.ConeGeometry(1.2, 3, 8)
  const smoke = new THREE.Mesh(smokeGeo, new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.5 }))
  smoke.position.copy(extractPos).setY(64)
  scene.add(smoke)

  // ===== 夜战模式：天色压暗、雾气逼近、月光清冷（手电由引擎挂相机） =====
  if (night) {
    scene.background = new THREE.Color(mapId === 'snow' ? 0x0c1220 : 0x0a0e1a)
    scene.fog = new THREE.Fog(mapId === 'snow' ? 0x0c1220 : 0x0a0e1a, mapId === 'snow' ? 10 : 8, mapId === 'snow' ? 44 : 60)
    hemi.intensity = 0.16
    hemi.color.setHex(0x2e3c5c)
    hemi.groundColor.setHex(0x141a24)
    sun.intensity = 0.3
    sun.color.setHex(0x9ab4e8) // 月光
    groundMat.color.multiplyScalar(0.5)
  }

  // ===== 高危禁区模式：新增专属容器「军用保险库」（Boss 附近，高危物资） =====
  if (highRisk && bossSpawns.length) {
    const b = bossSpawns[0].pos
    mkContainer(b.x + 3.5, b.z + 1.5, '军用保险库', 2.2, b.y)
  }

  return { scene, colliders, obstacleMeshes, containers, extractPos, extractPos2, extractMesh, size, walkables, playerSpawn, playerYaw, spawnPoints, bossSpawns, doors, mapId, mapMarkers, slowZones, missionWall, missionGuides, lampStands, sun, hemi }
}

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 局内随机事件「空投雨」：运行时在世界中落下一个航空箱容器（含降落伞） */
export function spawnAirDrop(world: World, x: number, z: number, floorY: number): Container {
  const g = buildAirCrateMesh()
  g.position.set(x, floorY + 0.04, z)
  g.rotation.y = Math.random() * Math.PI * 2
  // 降落伞
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(1.4, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.7, side: THREE.DoubleSide }))
  canopy.position.y = 2.6
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.6),
    new THREE.MeshStandardMaterial({ color: 0x555555 }))
  cord.position.y = 1.6
  g.add(canopy, cord)
  g.userData.containerId = `ad${Date.now()}${Math.random()}`
  world.scene.add(g)
  const c: Container = {
    id: g.userData.containerId as string, mesh: g, pos: new THREE.Vector3(x, floorY + 0.8, z),
    grid: makeGrid(6, 4), searched: false, title: '航空箱', luck: 1.5,
  }
  world.containers.push(c)
  return c
}
