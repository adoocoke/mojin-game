import * as THREE from 'three'
import { buildWorld, buildDeathCrateMesh, spawnAirDrop, type World, type Container, type MapId, type Door } from './world'
import { EnemyManager, type Enemy } from './enemies'
import { GUNS, ITEMS, rollLootItem, ENEMY_LOOT_POOL, LOOT_POOL, WEAPON_LOOT_POOL, NEST_LOOT_POOL, AIR_LOOT_POOL, VAULT_LOOT_POOL, VENDOR_LOOT_POOL, AMMO_BOX_POOL, CARD_POOLS, MARKET_GOODS, makeItem, KNIFE, OPERATORS, BOSS_DROPS, BOSS_DROP_RATE, BOSS_COLLECT_REWARD, loadBossDrops, saveBossDrops, type OpMods } from './data'
import { RARITY_INFO, RARITY_ORDER, itemValue, itemWeight, type GunDef, type Rarity, type AttSlot, type ItemInstance, type ItemDef, type PlacedItem } from './types'
import { makeGrid, autoPlace, removeItem, findPlaced, placeAt, hitTest, defOf } from './inventory'
import { uiState, notify, engine } from './store'
import { sfx } from './audio'
import { loadStash, addToStash, saveStash, clearStash, sellFromStash, saveMoney, sortStash, sellAllValuables } from './stash'
import { currentEvent, currentSeasonTheme } from './events'
import { loadSeason, recordRaid, safeLv, SAFE_DIMS, SAFE_CELLS, phaseUnlocked, QUESTS } from './quests'
import { SCOUT_SPOTS } from './story'
import { findLevel, chapterOf, loadCampaign, saveCampaign, clearReward, type CampaignLevel } from './campaign'
import { loadOpXp, saveOpXp, opLevel, effActive, xpForRaid } from './oplevel'
import { MAP_MISSIONS } from './missions'
import { vsClient, type VsSession, type RemoteState } from './net'
import { loadBp, gainBpXp, claimBp as bpClaim, claimable, BP_MAX_LV } from './battlepass'
import { loadStats, recordCareer, loadAchClaimed, saveAchClaimed, ACHIEVEMENTS } from './achievements'
import { placeOrder, cancelOrder, claimOrder, arriveOrders, orderPrice } from './orders'
import { hideoutMedHp, marketBuyPrice } from './hideout'
import { resolveQuality, applyRenderer, applyLighting, applyFog, capPointLights, stripMeshShadows, updateFollowShadow, type QualityPreset } from './graphics'

const EYE = 1.62
const RAID_SECONDS = 600 // 一局 10 分钟

interface Tracer { line: THREE.Line; life: number }
interface Spark { mesh: THREE.Mesh; life: number; vel: THREE.Vector3 }

export class Game {
  private renderer: THREE.WebGLRenderer
  private camera: THREE.PerspectiveCamera
  private world: World
  private enemies: EnemyManager
  private clock = new THREE.Clock()

  // 玩家
  private pos = new THREE.Vector3(0, EYE, -100)
  private yaw = Math.PI   // 面向地图中心
  private pitch = 0
  private hp = 100
  private vy = 0 // 垂直速度（上下楼梯/跌落）
  private keys = new Set<string>()
  private sprinting = false
  private ads = false
  private baseFov = 75

  // 武器（开局只有匕首，捡到枪才能用枪）
  private gunDef: GunDef = KNIFE
  private gunRarity: Rarity = 'white'
  private mag = 0
  private magTier = 1            // 当前弹匣里子弹的等级（1-6）
  private magDmgMul = 1          // 当前弹匣伤害倍率
  private vest: ItemInstance | null = null    // 已装备防弹衣
  private helmet: ItemInstance | null = null  // 已装备头盔
  private dmgNums: { sprite: THREE.Sprite; life: number }[] = []
  private grenades: { mesh: THREE.Mesh; target: THREE.Vector3; t: number; from: THREE.Vector3 }[] = []
  private weightTier = 0         // 0 轻载 1 中载 2 重载 3 超载
  private weightCheckT = 0
  private tutMoveDist = 0
  private tutReloaded = false
  private lastTutPos = new THREE.Vector3()
  private ownedGun: { def: GunDef; rarity: Rarity; atts?: Partial<Record<AttSlot, ItemInstance>> } | null = null // 本局已拾取的枪（按 2 切回）
  private swingT = 0 // 匕首挥砍动画进度
  private reloading = false
  private reloadEnd = 0
  private lastShot = 0
  private firing = false
  private viewmodel!: THREE.Group
  private muzzleFlash!: THREE.PointLight
  private recoilT = 0
  private bobT = 0

  // 摸金
  private backpack = makeGrid(8, 9)
  private safebox = makeGrid(4, 3)
  private activeLoot: Container | null = null
  private searchT = -1
  private searchTarget: Container | null = null
  private extractT = 0
  private stormOn = false      // 沙海古城：沙暴已来袭
  private stormHurtT = 0       // 沙暴掉血音效节流
  // ===== 剧情战役（P3 #23） =====
  private camp: CampaignLevel | null = null
  private campStage = 0        // 0 潜入 1 夺取 2 撤离
  private campObjCrate: Container | null = null
  // ===== 赛季主题（P3 #20） =====
  private theme = currentSeasonTheme()
  private themeActions = 0   // 当季主题行动次数（任务统计）
  private sprayBuffT = 0     // 消毒喷雾免疫剩余
  private convoyAlerted = false // 押运车队已被惊动
  private powerStation: { x: number; z: number; floorY: number; mesh: THREE.Group; on: boolean } | null = null
  // ===== 局内随机事件（P3 #21）：开局不预告，局内广播 + 小地图图标 =====
  private raidEvents: { id: 'supplyRain' | 'elitePatrol' | 'gasLeak' | 'convoy'; at: number; fired: boolean }[] = []
  private gasZones: { x: number; z: number; r: number; mesh: THREE.Mesh }[] = []
  private gasHurtT = 0         // 毒气掉血音效节流
  // ===== 联机（组队/对战） =====
  private vs: VsSession | null = null
  private vsSendT = 0
  private vsSinceId = 0
  private vsRemotes = new Map<string, RemoteState>()                       // 所有远程玩家状态
  private vsActors = new Map<string, { mesh: THREE.Group; tag: THREE.Sprite }>() // 远程玩家模型
  private vsDeadNotified = new Set<string>()                               // 组队：已播报过阵亡的玩家
  private vsOver = false
  private kills = 0
  private raidLeft = RAID_SECONDS
  private spawnTimer = 6

  // 本局任务统计（赛季任务）
  private raidSearches = 0
  private raidDoors = 0
  private raidBossKills = 0

  // 干员技能
  private opMods: Required<OpMods> = { speed: 1, reload: 1, search: 1, extract: 1, med: 1, maxHp: 0, reduce: 0, luck: 0, seeRange: 1 }
  private skillCdT = 0   // 技能冷却剩余秒数
  private invisT = 0     // 光学迷彩剩余
  // ===== 战术装备（P3 #22）：T 键使用，每局限 1 次 =====
  private droneT = 0     // 侦察无人机剩余
  private tacBrought = false // 本局战术装备已从仓库带入
  private smokes: { x: number; z: number; r: number; t: number; mesh: THREE.Mesh }[] = []
  private mines: { x: number; z: number; floorY: number; mesh: THREE.Mesh }[] = []
  private armorT = 0     // 能量护甲剩余
  private revealT = 0    // 侦察脉冲剩余
  private rallyT = 0     // 战术号令剩余
  private markBonus = 0  // 死亡标记的受伤加深比例
  private charge: { mesh: THREE.Mesh; t: number; dmg: number } | null = null // 已掷出的炸药包
  private torch: THREE.SpotLight | null = null // 夜战手电

  private tracers: Tracer[] = []
  private sparks: Spark[] = []
  private running = false
  private disposed = false
  private snowPts: THREE.Points | null = null   // 飘雪粒子
  private snowVel: Float32Array | null = null
  private radarDish: THREE.Object3D | null = null // 旋转雷达天线
  // ===== 赛季剧情·跑图调查点 =====
  private raidScouts: string[] = []   // 本局已完成交互的调查任务 id
  private scoutSpawns: { questId: string; mesh: THREE.Group; x: number; z: number; floorY?: number }[] = []
  private inLake = false                         // 冰湖减速提示状态
  private missionAccepted = false   // 已在任务点接取
  private missionStarted = false    // 已安放炸药 / 已启动装置
  private missionTimer = 0          // 引爆/坚守倒计时
  private missionTimerUi = -1       // 节流：上次同步给 UI 的整秒
  private missionWaveSpawned = false // defend 刷怪波次已生成
  private missionDone = false
  private canvas: HTMLCanvasElement
  private lastNotify = 0
  private ac = new AbortController() // 销毁时统一移除输入监听
  private gfx: QualityPreset

  // 触屏
  readonly isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0
  private mMove = { x: 0, y: 0 }   // 摇杆 -1~1
  private mSprint = false

  constructor(canvas: HTMLCanvasElement, mapId: MapId = 'wild') {
    this.canvas = canvas
    this.gfx = resolveQuality(uiState.quality)
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: this.gfx.antialias,
      powerPreference: this.gfx.powerPreference,
      stencil: false,
      alpha: false,
    })
    applyRenderer(this.renderer, this.gfx)
    this.renderer.setSize(innerWidth, innerHeight)

    this.camera = new THREE.PerspectiveCamera(this.baseFov, innerWidth / innerHeight, 0.08, this.gfx.far)
    const blackout = currentSeasonTheme().id === 'blackout' // 停电夜：全赛季固定夜战
    this.world = buildWorld(mapId, uiState.night || blackout, uiState.highRisk)
    applyLighting(this.world.hemi, this.world.sun, uiState.night || blackout, this.gfx)
    this.world.scene.add(this.world.sun.target)
    applyFog(this.world.scene, this.gfx)
    const keepLights: THREE.Light[] = []
    if (this.world.lampStands) for (const l of this.world.lampStands) keepLights.push(l.light)
    capPointLights(this.world.scene, this.gfx.maxPointLights, keepLights)
    if (!this.gfx.shadows) stripMeshShadows(this.world.scene)
    if (uiState.night || blackout) {
      // 战术手电：挂在相机上的暖色聚光灯
      this.torch = new THREE.SpotLight(0xfff0d0, 3.2, 42, 0.52, 0.45, 1.1)
      this.world.scene.add(this.torch)
      this.world.scene.add(this.torch.target)
    }
    if (blackout) {
      // 停电夜主题：配电室——恢复局部照明
      const ex = this.world.extractPos
      const px = ex.x + 8, pz = ex.z + 4
      const py = 0
      const g = new THREE.Group()
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.6, 0.9),
        new THREE.MeshStandardMaterial({ color: 0x3a4148, roughness: 0.5, metalness: 0.5 }))
      body.position.y = 0.8
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8),
        new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xff3b30, emissiveIntensity: 1.5 }))
      lamp.position.set(0, 1.75, 0)
      g.add(body, lamp)
      g.position.set(px, py, pz)
      g.traverse(o => { o.castShadow = true })
      this.world.scene.add(g)
      this.powerStation = { x: px, z: pz, floorY: py, mesh: g, on: false }
      this.world.mapMarkers.push({ x: px, z: pz, kind: 'mission', name: '配电室' })
    }
    this.enemies = new EnemyManager(this.world.scene, this.world.colliders)
    uiState.mapMarkers = this.world.mapMarkers
    uiState.mapExtract = { x: this.world.extractPos.x, z: this.world.extractPos.z }
    uiState.mapOpen = false

    addEventListener('resize', this.onResize)
    document.addEventListener('pointerlockchange', this.onLockChange)
    this.bindInput()
    this.wireAPI()
    this.buildViewmodel()
    this.giveStarterGear()
    this.loop = this.loop.bind(this)
    // 雪地图氛围：飘雪粒子 + 旋转雷达天线
    if (mapId === 'snow') this.initSnow()
    this.world.scene.traverse(o => { if (o.userData.spinRadar) this.radarDish = o })
  }

  /** 初始化飘雪粒子（数量随画质档变化，围绕相机循环下落） */
  private initSnow() {
    const N = this.gfx.snow
    const pos = new Float32Array(N * 3)
    this.snowVel = new Float32Array(N)
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 120
      pos[i * 3 + 1] = Math.random() * 40
      pos[i * 3 + 2] = (Math.random() - 0.5) * 120
      this.snowVel[i] = 3 + Math.random() * 4
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.18, transparent: true, opacity: 0.85, depthWrite: false })
    this.snowPts = new THREE.Points(geo, mat)
    this.snowPts.frustumCulled = false
    this.world.scene.add(this.snowPts)
  }

  // ================= 输入 =================
  private onResize = () => {
    this.camera.aspect = innerWidth / innerHeight
    this.camera.updateProjectionMatrix()
    applyRenderer(this.renderer, this.gfx)
    this.renderer.setSize(innerWidth, innerHeight)
  }

  private get locked() { return document.pointerLockElement === this.canvas }

  /** 安全请求指针锁定（冷却期失败会静默，点击画面可重试） */
  private lock() {
    try {
      const p = this.canvas.requestPointerLock() as unknown as Promise<void> | undefined
      p?.catch?.(() => {})
    } catch { /* 忽略，点击画面可重新锁定 */ }
  }

  private onLockChange = () => {
    if (!this.locked) {
      this.firing = false
      this.keys.clear()
      // 搜索中松开锁不取消搜索状态，由距离判断
    }
  }

  private bindInput() {
    const sig = { signal: this.ac.signal } as AddEventListenerOptions
    this.canvas.addEventListener('click', () => {
      if (!this.isTouch && uiState.phase === 'playing' && !this.locked && !uiState.invOpen) {
        this.lock()
      }
    }, sig)
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return
      const sens = 0.0022 / (this.ads ? Math.sqrt(this.effGun().zoom) : 1)
      this.yaw -= e.movementX * sens
      this.pitch = THREE.MathUtils.clamp(this.pitch - e.movementY * sens, -1.45, 1.45)
    }, sig)
    document.addEventListener('mousedown', (e) => {
      if (!this.locked) return
      if (e.button === 0) { this.firing = true; this.tryShoot() }
      if (e.button === 2 && !this.gunDef.melee) this.ads = true
    }, sig)
    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.firing = false
      if (e.button === 2) this.ads = false
    }, sig)
    document.addEventListener('contextmenu', e => e.preventDefault(), sig)
    document.addEventListener('keydown', (e) => {
      if (uiState.phase !== 'playing') return
      const k = e.key.toLowerCase()
      if (k === 'tab' || k === 'i') { e.preventDefault(); this.toggleInventory(); return }
      if (k === 'm') { uiState.mapOpen = !uiState.mapOpen; notify(); return }
      if (uiState.invOpen) { if (k === 'escape') this.closeLoot(); return }
      this.keys.add(k)
      if (k === 'r') this.startReload()
      if (k === 'f') this.tryInteract()
      if (k === 'q') this.useSkill()
      if (k === 't') this.useTactical()
      if (k === 'l') { engine.toggleQuestHud(); return }
      if (k === '1') this.equipKnife()
      if (k === '2') this.equipOwnedGun()
      if (k === 'shift') this.sprinting = true
    }, sig)
    document.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase()
      this.keys.delete(k)
      if (k === 'shift') this.sprinting = false
    }, sig)
  }

  // ================= 干员技能 =================
  private currentOp() {
    return OPERATORS.find(o => o.id === uiState.operator) ?? OPERATORS[0]
  }

  private opLv() {
    return opLevel(loadOpXp()[this.currentOp().id] ?? 0)
  }

  private refreshOpMods() {
    const op = this.currentOp()
    const m: Required<OpMods> = { speed: 1, reload: 1, search: 1, extract: 1, med: 1, maxHp: 0, reduce: 0, luck: 0, seeRange: 1 }
    for (const p of op.passives) {
      if (p.mods.speed) m.speed *= p.mods.speed
      if (p.mods.reload) m.reload *= p.mods.reload
      if (p.mods.search) m.search *= p.mods.search
      if (p.mods.extract) m.extract *= p.mods.extract
      if (p.mods.med) m.med *= p.mods.med
      if (p.mods.maxHp) m.maxHp += p.mods.maxHp
      if (p.mods.reduce) m.reduce = Math.min(0.6, m.reduce + p.mods.reduce)
      if (p.mods.luck) m.luck += p.mods.luck
      if (p.mods.seeRange) m.seeRange *= p.mods.seeRange
    }
    this.opMods = m
    uiState.maxHp = 100 + m.maxHp + hideoutMedHp()
  }

  /** 使用战术装备（T）：无人机标记 / 绊雷布置 / 烟雾弹封视线，每局限 1 次 */
  private useTactical() {
    if (this.running === false || uiState.phase !== 'playing') return
    const def = uiState.tacticalDef
    if (!def) { this.toast('未携带战术装备——战前配装可选择 1 件（交易行有售）', 'white'); return }
    if (uiState.tacUsed) { this.toast('战术装备已用完（消耗品，每局限用 1 次）', 'white'); return }
    const feet = this.pos.y - EYE
    if (def === 't_drone') {
      this.droneT = 10
      this.toast('🛰️ 侦察无人机升空：30m 内敌人已标记 10 秒（看地图 M）', 'cyan')
    } else if (def === 't_mine') {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.12, 10),
        new THREE.MeshStandardMaterial({ color: 0x2a2d31, roughness: 0.5, metalness: 0.6, emissive: 0xff3b30, emissiveIntensity: 0.4 }))
      mesh.position.set(this.pos.x, feet + 0.06, this.pos.z)
      this.world.scene.add(mesh)
      this.mines.push({ x: this.pos.x, z: this.pos.z, floorY: feet, mesh })
      this.toast('🪤 绊雷已布置：敌人踩中会爆炸并全图标点', 'cyan')
    } else if (def === 't_smoke') {
      const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw)
      const sx = this.pos.x + fx * 6, sz = this.pos.z + fz * 6
      const sy = this.groundHeightAt(sx, sz, feet)
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(6, 16, 12),
        new THREE.MeshBasicMaterial({ color: 0xb8bcc2, transparent: true, opacity: 0.55, depthWrite: false }))
      mesh.position.set(sx, sy + 2.5, sz)
      this.world.scene.add(mesh)
      this.smokes.push({ x: sx, z: sz, r: 6, t: 8, mesh })
      this.toast('💨 烟雾弹引爆：封锁视线 8 秒', 'cyan')
    } else { this.toast('未知的战术装备', 'white'); return }
    uiState.tacUsed = true
    notify()
  }

  private useSkill() {
    if (uiState.phase !== 'playing' || this.hp <= 0) return
    const op = this.currentOp()
    const a = effActive(op, this.opLv())
    if (this.skillCdT > 0) { this.toast(`技能冷却中 ${Math.ceil(this.skillCdT)}s`, 'white'); return }
    this.skillCdT = a.cd
    uiState.skillCd = a.cd
    uiState.skillActive = a.kind
    switch (a.kind) {
      case 'stun': {
        let n = 0
        for (const e of this.enemies.enemies) {
          if (e.dead) continue
          if (e.group.position.distanceTo(this.pos) <= a.power) { e.stunT = a.dur ?? 4; n++ }
        }
        this.toast(n > 0 ? `💥 震撼弹！眩晕了 ${n} 个敌人` : '💥 震撼弹！范围内没有敌人', 'cyan')
        break
      }
      case 'heal': {
        if (this.hp >= uiState.maxHp) { this.toast('生命值已满', 'white'); this.skillCdT = 5; uiState.skillCd = 5; break }
        this.hp = Math.min(uiState.maxHp, this.hp + a.power)
        uiState.hp = this.hp
        this.toast(`❤️ 急救针 +${a.power} HP`, 'green')
        break
      }
      case 'reveal':
        this.revealT = a.dur ?? 10
        this.toast('📡 侦察脉冲启动，敌人位置已标记在地图上（M）', 'cyan')
        break
      case 'armor':
        this.armorT = a.dur ?? 8
        this.toast(`🛡️ 能量护甲启动，减伤 ${Math.round(a.power * 100)}%`, 'cyan')
        break
      case 'invis':
        this.invisT = a.dur ?? 7
        this.toast('👻 光学迷彩启动，敌人看不到你了', 'cyan')
        break
      case 'charge': {
        // 向前掷出炸药包，dur 秒后爆炸
        const dir = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw))
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.28, 10, 8),
          new THREE.MeshStandardMaterial({ color: 0x2a1505, emissive: 0xff5a3c, emissiveIntensity: 2.2 }))
        mesh.position.copy(this.pos).add(dir.clone().multiplyScalar(3.5))
        mesh.position.y = this.pos.y - EYE + 0.4
        this.world.scene.add(mesh)
        this.charge = { mesh, t: a.dur ?? 1.5, dmg: a.power }
        this.toast('🧨 炸药包已掷出！', 'red')
        break
      }
      case 'mark': {
        let n = 0
        for (const e of this.enemies.enemies) {
          if (e.dead) continue
          if (e.group.position.distanceTo(this.pos) <= 30) { e.markedT = a.dur ?? 8; n++ }
        }
        this.markBonus = a.power
        this.toast(n > 0 ? `🔴 死亡标记！${n} 个敌人受伤 +${Math.round(a.power * 100)}%` : '🔴 范围内没有敌人', 'cyan')
        break
      }
      case 'rally':
        this.rallyT = a.dur ?? 10
        this.toast('📣 战术号令！移速/换弹/射速全面提升', 'cyan')
        break
    }
    try { sfx.hit() } catch { /* 忽略 */ }
    notify()
  }

  // ================= 初始装备 =================
  private giveStarterGear(withLoadout = false) {
    autoPlace(this.backpack, makeItem('m_bandage', 2))
    autoPlace(this.backpack, makeItem('m_medkit', 1))
    autoPlace(this.backpack, makeItem('a_ammo', 2))
    // 战前配装选择的护甲/头盔：从仓库取出装备
    if (withLoadout) {
      const stash = loadStash()
      for (const kind of ['vest', 'helmet'] as const) {
        const defId = uiState.gearDefs[kind]
        if (!defId) continue
        const placed = stash.placed.find(p => p.item.defId === defId)
        if (!placed) continue
        const removed = removeItem(stash, placed.item.uid)!
        if (removed.item.dur == null) removed.item.dur = defOf(removed.item).durability ?? 50
        if (kind === 'vest') this.vest = removed.item; else this.helmet = removed.item
      }
      // 战术装备：从仓库取出带入局内（用了就没，未使用则在结算时返还）
      if (uiState.tacticalDef) {
        const placed = stash.placed.find(p => p.item.defId === uiState.tacticalDef)
        if (placed) {
          removeItem(stash, placed.item.uid)
          this.tacBrought = true
        } else {
          uiState.tacticalDef = null // 仓库已没有，清空选择
          localStorage.removeItem('mojin_tactical')
        }
      }
      saveStash(stash)
      uiState.stash = stash
      this.syncGearUI()
    }
    // 战前配装：把在仓库里勾选「携带」的物资移入开局背包（只在真正开局时执行，构造函数里不能搬，否则物品会丢）
    if (withLoadout && uiState.carryDefs.length) {
      const stash = loadStash()
      const remain: string[] = []
      let moved = 0
      for (const defId of uiState.carryDefs) {
        const placed = stash.placed.find(p => p.item.defId === defId)
        if (!placed) continue // 仓库里已经没有了（卖掉/遗失），跳过
        const removed = removeItem(stash, placed.item.uid)!
        if (autoPlace(this.backpack, removed.item)) moved++
        else placeAt(stash, removed.item, placed.x, placed.y) // 背包放不下就留仓库
        remain.push(defId)
      }
      saveStash(stash)
      if (moved > 0) this.toast(`已携带 ${moved} 件仓库物资`, 'cyan')
      // 清理仓库里已不存在的勾选
      uiState.carryDefs = remain
      localStorage.setItem('mojin_loadout', JSON.stringify(remain))
    }
    this.syncGrids()
  }

  // ================= 视角模型 =================
  private buildViewmodel() {
    if (this.viewmodel) this.camera.remove(this.viewmodel)
    const g = new THREE.Group()
    const d = this.gunDef

    if (d.melee) {
      // ===== 匕首模型：刀刃 + 护手 + 握柄 =====
      const bladeMat = new THREE.MeshStandardMaterial({ color: 0xc8cfd8, roughness: 0.25, metalness: 0.9 })
      const dark = new THREE.MeshStandardMaterial({ color: 0x1a1c1f, roughness: 0.6, metalness: 0.4 })
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.045, d.barrelLen), bladeMat)
      blade.position.set(0, 0.02, -d.barrelLen / 2 - 0.06)
      g.add(blade)
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.09, 4), bladeMat)
      tip.rotation.x = -Math.PI / 2
      tip.rotation.y = Math.PI / 4
      tip.scale.set(1.1, 1, 2.2)
      tip.position.set(0, 0.02, -d.barrelLen - 0.1)
      g.add(tip)
      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.02, 0.03), dark)
      guard.position.set(0, 0.02, -0.05)
      g.add(guard)
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.05, 0.16), dark)
      handle.position.set(0, 0, 0.05)
      g.add(handle)
      g.traverse(o => { o.frustumCulled = false })
      this.viewmodel = g
      this.camera.add(this.viewmodel)
      this.world.scene.add(this.camera)
      if (!this.muzzleFlash) {
        this.muzzleFlash = new THREE.PointLight(0xffaa33, 0, 8)
        this.camera.add(this.muzzleFlash)
      }
      this.muzzleFlash.intensity = 0
      this.positionViewmodel(0)
      return
    }

    const main = new THREE.MeshStandardMaterial({ color: d.color, roughness: 0.55, metalness: 0.45 })
    const dark = new THREE.MeshStandardMaterial({ color: 0x1a1c1f, roughness: 0.5, metalness: 0.5 })

    // 枪身
    const body = new THREE.Mesh(new THREE.BoxGeometry(d.bulky, d.bulky * 1.6, d.barrelLen * 0.75), main)
    body.position.set(0, 0, -d.barrelLen * 0.3)
    g.add(body)
    // 枪管
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(d.bulky * 0.35, d.bulky * 0.35, d.barrelLen, 10), dark)
    barrel.rotation.x = Math.PI / 2
    barrel.position.set(0, d.bulky * 0.35, -d.barrelLen * 0.75 - d.barrelLen / 2)
    g.add(barrel)
    // 弹匣
    const magW = d.mag > 50 ? 0.12 : 0.05
    const magM = new THREE.Mesh(new THREE.BoxGeometry(magW, 0.18, 0.09), dark)
    magM.position.set(0, -d.bulky * 1.2, -d.barrelLen * 0.25)
    magM.rotation.x = 0.15
    g.add(magM)
    // 枪托
    const stock = new THREE.Mesh(new THREE.BoxGeometry(d.bulky * 0.8, d.bulky * 1.2, 0.16), main)
    stock.position.set(0, -d.bulky * 0.2, 0.16)
    g.add(stock)
    // 瞄具
    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.06), dark)
    sight.position.set(0, d.bulky * 1.1, -d.barrelLen * 0.35)
    g.add(sight)
    if (d.zoom >= 2) {
      const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.16, 10), dark)
      scope.rotation.x = Math.PI / 2
      scope.position.set(0, d.bulky * 1.3, -d.barrelLen * 0.4)
      g.add(scope)
    }
    // 握把
    const grip = new THREE.Mesh(new THREE.BoxGeometry(d.bulky * 0.7, 0.12, 0.05), dark)
    grip.position.set(0, -d.bulky * 1.1, 0.02)
    grip.rotation.x = 0.4
    g.add(grip)

    // 稀有度发光描边（高稀有度枪身泛光）
    const idx = RARITY_ORDER.indexOf(this.gunRarity)
    if (idx >= 2) {
      main.emissive = new THREE.Color(RARITY_INFO[this.gunRarity].color)
      main.emissiveIntensity = 0.08 + idx * 0.04
    }

    g.traverse(o => { o.frustumCulled = false })
    this.viewmodel = g
    this.camera.add(this.viewmodel)
    this.world.scene.add(this.camera)

    if (!this.muzzleFlash) {
      this.muzzleFlash = new THREE.PointLight(0xffaa33, 0, 8)
      this.camera.add(this.muzzleFlash)
    }
    this.muzzleFlash.position.set(0, 0, -d.barrelLen - 0.4)
    this.positionViewmodel(0)
  }

  private positionViewmodel(dt: number) {
    const g = this.viewmodel
    const adsPos = new THREE.Vector3(0, -0.145, -0.35)
    const hipPos = new THREE.Vector3(0.22, -0.2, -0.45)
    const target = this.ads ? adsPos : hipPos
    // 走路摆动
    if ((this.keys.size > 0 || this.mMove.x !== 0 || this.mMove.y !== 0) && !this.ads) {
      this.bobT += dt * (this.sprinting ? 11 : 7)
      target.x += Math.sin(this.bobT) * 0.012
      target.y += Math.abs(Math.cos(this.bobT)) * 0.012
    }
    g.position.lerp(target, Math.min(1, dt * (this.ads ? 14 : 8)))
    // 后坐力恢复
    this.recoilT = Math.max(0, this.recoilT - dt * 6)
    this.swingT = Math.max(0, this.swingT - dt * 3.2)
    const kick = this.recoilT * this.recoilT
    g.position.z += kick * 0.12
    g.rotation.x = kick * 0.35
    // 换弹下沉
    if (this.reloading) {
      const p = 1 - Math.abs((this.reloadEnd - performance.now()) / this.gunDef.reloadTime * 2 - 1)
      g.position.y -= p * 0.22
      g.rotation.x -= p * 0.8
    }
    g.rotation.z = this.ads ? 0 : 0.03
    // 匕首挥砍动画（横斩）
    if (this.swingT > 0) {
      const s = Math.sin((1 - this.swingT) * Math.PI)
      g.rotation.z -= s * 1.0
      g.rotation.x -= s * 0.35
      g.position.x -= s * 0.12
      g.position.y += s * 0.03
    }
  }

  // ================= 射击 =================
  private gunDamageMult() { return 1 + RARITY_ORDER.indexOf(this.gunRarity) * 0.13 }

  private tryShoot() {
    if (this.reloading || uiState.phase !== 'playing' || uiState.invOpen) return
    const now = performance.now()
    if (now - this.lastShot < this.gunDef.fireInterval * (this.rallyT > 0 ? 0.85 : 1)) return
    if (this.gunDef.melee) { this.lastShot = now; this.meleeAttack(); return }
    if (this.mag <= 0) { this.startReload(); return }
    this.lastShot = now
    this.mag--
    const eff = this.effGun()
    this.recoilT = Math.min(1, this.recoilT + 0.5)
    this.pitch += eff.recoil * (this.ads ? 0.55 : 1)
    this.yaw += (Math.random() - 0.5) * eff.recoil * 0.4
    this.muzzleFlash.intensity = 3
    sfx.shot(this.gunDef.damage > 60 || this.gunDef.pellets > 1)
    // 枪声惊动附近敌人：警觉/搜索状态机（消音器大幅缩小半径）
    this.enemies.alertAt(this.pos, eff.alert, this.pos.y - EYE)

    const dir = new THREE.Vector3()
    for (let p = 0; p < this.gunDef.pellets; p++) {
      this.camera.getWorldDirection(dir)
      const spread = eff.spread * (this.ads ? 0.35 : eff.hipMul)
      dir.x += (Math.random() - 0.5) * spread * 2
      dir.y += (Math.random() - 0.5) * spread * 2
      dir.z += (Math.random() - 0.5) * spread * 2
      dir.normalize()
      this.firePellet(dir)
    }
    this.syncGunUI()
  }

  /** 匕首挥砍：近距离扇形判定（精确射线可爆头），会被掩体挡住 */
  private meleeAttack() {
    this.swingT = 1
    this.recoilT = Math.min(1, this.recoilT + 0.35)
    sfx.swing()
    const dir = new THREE.Vector3()
    this.camera.getWorldDirection(dir)
    const origin = this.camera.position.clone()
    const range = this.gunDef.range
    // 掩体遮挡
    const rc = new THREE.Raycaster(origin, dir, 0, range)
    const oHits = rc.intersectObjects(this.world.obstacleMeshes, false)
    const oDist = oHits.length ? oHits[0].distance : Infinity

    // 精确射线：瞄得准可爆头
    const eHit = this.enemies.raycast(origin, dir, range)
    if (eHit && eHit.point.distanceTo(origin) < oDist) {
      const dmg = this.gunDef.damage * (eHit.isHead ? this.gunDef.headMult : 1) * (eHit.enemy.markedT > 0 ? 1 + this.markBonus : 1)
      if (eHit.enemy.name.includes('押运护卫')) this.alertAllEnemies() // 袭击押运护卫：惊动全图
      const killed = this.enemies.damage(eHit.enemy, dmg)
      uiState.hitMarker = performance.now()
      sfx.hit()
      this.spawnSpark(eHit.point, 0xff7a5a)
      if (killed) this.onEnemyKilled(eHit.enemy)
      return
    }
    // 宽容扇形：正前方近距离内的最近敌人（平视也能砍中躯干）
    let best: Enemy | null = null
    let bestAlong = Infinity
    for (const e of this.enemies.enemies) {
      if (e.dead) continue
      const toE = e.group.position.clone()
      toE.y = 1.2
      toE.sub(origin)
      const along = toE.dot(dir)
      if (along < 0 || along > range + 0.4 || along > oDist) continue
      const perp = Math.sqrt(Math.max(0, toE.lengthSq() - along * along))
      if (perp < 0.75 && along < bestAlong) { best = e; bestAlong = along }
    }
    if (best) {
      const dmg = this.gunDef.damage * (best.markedT > 0 ? 1 + this.markBonus : 1)
      const killed = this.enemies.damage(best, dmg)
      uiState.hitMarker = performance.now()
      sfx.hit()
      const at = best.group.position.clone(); at.y = 1.3
      this.spawnSpark(at, 0xff7a5a)
      if (killed) this.onEnemyKilled(best)
    } else if (oHits.length) {
      this.spawnSpark(oHits[0].point, 0xcccccc)
    }
  }

  private firePellet(dir: THREE.Vector3) {
    const origin = this.camera.position.clone()
    const range = this.gunDef.range
    // 敌人命中
    const eHit = this.enemies.raycast(origin, dir, range)
    // 障碍命中
    const rc = new THREE.Raycaster(origin, dir, 0, range)
    const oHits = rc.intersectObjects(this.world.obstacleMeshes, false)
    const oDist = oHits.length ? oHits[0].distance : Infinity
    // 联机对战：命中远程玩家判定（多人乱斗：对所有存活对手做射线检测，取最近）
    let vsDist = Infinity
    let vsPoint: THREE.Vector3 | null = null
    let vsTargetId: string | null = null
    let vsTargetMesh: THREE.Group | null = null
    if (this.vs?.mode === 'pvp' && !this.vsOver) {
      for (const [pid, actor] of this.vsActors) {
        const r = this.vsRemotes.get(pid)
        if (!r || r.dead) continue
        const vrc = new THREE.Raycaster(origin, dir, 0, range)
        const vHits = vrc.intersectObject(actor.mesh, true)
        if (vHits.length && vHits[0].distance < vsDist) {
          vsDist = vHits[0].distance; vsPoint = vHits[0].point; vsTargetId = pid; vsTargetMesh = actor.mesh
        }
      }
    }

    let end: THREE.Vector3
    if (vsPoint && vsTargetId && vsTargetMesh && vsDist < oDist && (!eHit || vsDist < eHit.point.distanceTo(origin))) {
      // 命中对手：上报伤害事件（对方客户端扣血）
      end = vsPoint
      const zone = vsPoint.y - vsTargetMesh.position.y > 1.3 ? 'head' : 'body'
      const dmg = this.gunDef.damage * this.gunDamageMult() * this.magDmgMul * (zone === 'head' ? this.gunDef.headMult : 1)
      vsClient.versus.hit.mutate({ roomId: this.vs!.roomId, playerId: this.vs!.playerId, targetId: vsTargetId, dmg }).catch(() => undefined)
      uiState.hitMarker = performance.now()
      if (zone === 'head') sfx.headshot(); else sfx.hit()
      this.spawnSpark(end, 0xffd28a)
      this.spawnDmgNum(end, dmg, zone)
    } else if (eHit && eHit.point.distanceTo(origin) < oDist) {
      end = eHit.point
      const zone = eHit.zone
      const zoneMul = zone === 'head' ? this.gunDef.headMult : zone === 'limb' ? 0.7 : 1
      let dmg = this.gunDef.damage * this.gunDamageMult() * this.magDmgMul * zoneMul * (eHit.enemy.markedT > 0 ? 1 + this.markBonus : 1)
      // 穿透 vs 护甲：弹级低于护甲等级则减半
      const pierced = this.magTier >= eHit.enemy.armorLv
      if (!pierced) dmg *= 0.55
      if (eHit.enemy.name.includes('押运护卫')) this.alertAllEnemies() // 袭击押运护卫：惊动全图
      const killed = this.enemies.damage(eHit.enemy, dmg)
      uiState.hitMarker = performance.now()
      if (zone === 'head') sfx.headshot(); else sfx.hit()
      this.spawnSpark(end, 0xffd28a)
      this.spawnDmgNum(end, dmg, !pierced ? 'block' : zone)
      if (killed) this.onEnemyKilled(eHit.enemy)
    } else if (oHits.length) {
      end = oHits[0].point
      this.spawnSpark(end, 0xcccccc)
    } else {
      end = origin.clone().add(dir.clone().multiplyScalar(range))
    }
    // 曳光
    const muzzleWorld = new THREE.Vector3(0.22, -0.15, -1)
    this.viewmodel.localToWorld(muzzleWorld.set(0, 0, -this.gunDef.barrelLen))
    this.spawnTracer(muzzleWorld, end, 0xffe0a0)
  }

  /** 物品进背包前的钩子：护甲自动换装 */
  private onItemPicked(item: ItemInstance) {
    if (this.tryAutoEquipGear(item)) return true
    return false
  }

  private onEnemyKilled(e: Enemy) {
    this.kills++
    if (e.boss) { this.raidBossKills++; uiState.raidLive = { ...uiState.raidLive, bossKills: this.raidBossKills } }
    uiState.kills = this.kills
    uiState.killFeed = [`击杀 ${e.name}`, ...uiState.killFeed].slice(0, 4)
    sfx.kill()
    // 掉落战利品箱（卡其色 GTI 防护箱）
    const dropPos = e.group.position.clone()
    this.enemies.remove(e)
    const m = buildDeathCrateMesh()
    m.position.set(dropPos.x, dropPos.y + 0.35, dropPos.z)
    m.rotation.y = Math.random() * Math.PI * 2
    this.world.scene.add(m)
    const grid = makeGrid(6, 4)
    if (e.boss) {
      // 活动「首领悬赏」：击杀 Boss 额外赏金（自动档按强度浮动）
      const curEv = currentEvent().event
      if (curEv?.id === 'bounty') {
        const bounty = Math.round(1500 * (curEv.power ?? 1))
        uiState.money += bounty
        saveMoney(uiState.money)
        this.toast(`首领悬赏！赏金 +${bounty} 金币`, 'cyan')
      }
      // Boss 专属掉落（低爆率 12%）：掉入战利品箱，需搜出并带出才算收藏
      const drop = BOSS_DROPS.find(d => e.name.includes(d.boss))
      if (drop && Math.random() < BOSS_DROP_RATE) {
        if (autoPlace(grid, makeItem(drop.defId, 1))) {
          this.toast(`👑 Boss 专属掉落：${ITEMS[drop.defId].name}！`, 'red')
          sfx.kill()
        }
      }
      // Boss 战利品：顶级货（必含一把枪）
      autoPlace(grid, rollLootItem(WEAPON_LOOT_POOL, 1.2))
      const n = 3 + Math.floor(Math.random() * 2)
      for (let i = 0; i < n; i++) autoPlace(grid, rollLootItem(LOOT_POOL, 1.8))
    } else if (e.name.includes('精英巡逻兵')) {
      // 精英巡逻队：掉军用物资（航空箱池）
      const nItems = 2 + Math.floor(Math.random() * 2)
      for (let i = 0; i < nItems; i++) autoPlace(grid, rollLootItem(AIR_LOOT_POOL, 0.8))
    } else {
      const nItems = 1 + Math.floor(Math.random() * 3)
      for (let i = 0; i < nItems; i++) {
        const item = rollLootItem(ENEMY_LOOT_POOL, currentEvent().event?.id === 'elite' ? 0.6 : 0.15)
        autoPlace(grid, item)
      }
    }
    this.world.containers.push({
      id: `drop${Date.now()}${Math.random()}`, mesh: m, pos: new THREE.Vector3(dropPos.x, dropPos.y + 0.5, dropPos.z),
      grid, searched: true, title: e.boss ? `${e.name}的战利品` : '战利品', luck: 0, enemyDrop: true,
    })
  }

  private startReload() {
    if (this.gunDef.melee || this.reloading || this.mag >= this.gunDef.mag) return
    this.reloading = true
    this.reloadEnd = performance.now() + this.effGun().reloadTime * this.opMods.reload * (this.rallyT > 0 ? 0.7 : 1) * (this.weightTier === 3 ? 1.3 : 1)
    sfx.reload()
    uiState.reloading = true
    notify()
  }

  // ================= 子弹等级 =================
  /** 背包里最高级的子弹 */
  private bestAmmo(): { placed: PlacedItem; def: ItemDef } | null {
    let best: { placed: PlacedItem; def: ItemDef } | null = null
    for (const g of [this.backpack, this.safebox]) {
      for (const p of g.placed) {
        const def = defOf(p.item)
        if (def.kind !== 'ammo') continue
        if (!best || (def.pen ?? 1) > (best.def.pen ?? 1)) best = { placed: p, def }
      }
    }
    return best
  }

  /** 换弹完成：消耗 1 发最高级子弹（代表一个弹匣），没有则用免费 1 级弹 */
  private consumeAmmo() {
    const ammo = this.bestAmmo()
    if (ammo) {
      ammo.placed.item.count -= 1
      if (ammo.placed.item.count <= 0) {
        const g = this.backpack.placed.includes(ammo.placed) ? this.backpack : this.safebox
        removeItem(g, ammo.placed.item.uid)
      }
      this.magTier = ammo.def.pen ?? 1
      this.magDmgMul = ammo.def.dmgMul ?? 1
      if (this.magTier >= 4) this.toast(`装填 ${ammo.def.name}`, ammo.def.rarity)
    } else {
      this.magTier = 1
      this.magDmgMul = 1
    }
    uiState.ammoTier = this.magTier
    notify()
  }

  // ================= 伤害数字 =================
  private spawnDmgNum(at: THREE.Vector3, dmg: number, kind: 'head' | 'body' | 'limb' | 'block') {
    const colors = { head: '#ff3b30', body: '#ffffff', limb: '#9ca3af', block: '#60a5fa' }
    const canvas = document.createElement('canvas')
    canvas.width = 128; canvas.height = 48
    const ctx = canvas.getContext('2d')!
    ctx.font = 'bold 30px sans-serif'
    ctx.textAlign = 'center'
    ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 5
    const text = kind === 'block' ? `未穿透 ${Math.round(dmg)}` : `${Math.round(dmg)}`
    ctx.strokeText(text, 64, 34)
    ctx.fillStyle = colors[kind]
    ctx.fillText(text, 64, 34)
    const tex = new THREE.CanvasTexture(canvas)
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }))
    sprite.scale.set(1.2, 0.45, 1)
    sprite.position.copy(at).add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.35, 0))
    this.world.scene.add(sprite)
    this.dmgNums.push({ sprite, life: 0.7 })
  }

  // ================= 护甲 UI =================
  private syncGearUI() {
    uiState.vest = this.vest ? { defId: this.vest.defId, dur: this.vest.dur ?? 0 } : null
    uiState.helmet = this.helmet ? { defId: this.helmet.defId, dur: this.helmet.dur ?? 0 } : null
    notify()
  }

  /** 局内拾取护甲/头盔：空槽或更高级时自动装备 */
  private tryAutoEquipGear(item: ItemInstance): boolean {
    const def = defOf(item)
    if (def.kind !== 'vest' && def.kind !== 'helmet') return false
    if (item.dur == null) item.dur = def.durability ?? 50
    const cur = def.kind === 'vest' ? this.vest : this.helmet
    const curLv = cur ? (defOf(cur).armorLv ?? 0) : 0
    if ((def.armorLv ?? 0) > curLv) {
      if (cur) {
        // 换下的旧甲放回背包，放不下就放弃自动换装
        if (!autoPlace(def.kind === 'vest' ? this.backpack : this.backpack, cur)) return false
      }
      if (def.kind === 'vest') this.vest = item; else this.helmet = item
      this.toast(`${def.icon} 已装备 ${def.name}（${def.armorLv} 级）`, def.rarity)
      this.syncGearUI()
      return true
    }
    return false
  }

  // ================= 负重系统 =================
  private carriedWeight(): number {
    let w = 0
    for (const g of [this.backpack, this.safebox]) {
      for (const p of g.placed) w += itemWeight(defOf(p.item)) * p.item.count
    }
    for (const gear of [this.vest, this.helmet]) if (gear) w += itemWeight(defOf(gear))
    return w
  }

  private refreshWeight(dt: number) {
    this.weightCheckT -= dt
    if (this.weightCheckT > 0) return
    this.weightCheckT = 0.5
    const w = this.carriedWeight()
    const tier = w >= 26 ? 3 : w >= 18 ? 2 : w >= 10 ? 1 : 0
    if (tier !== this.weightTier) {
      this.weightTier = tier
      const tips = ['', '🎒 中载：行动自如', '🎒 重载：移速 -15%，冲刺减弱', '🎒 超载！无法冲刺，换弹变慢，脚步更重']
      if (tier >= 2) this.toast(tips[tier], tier === 3 ? 'red' : 'white')
    }
    uiState.weight = Math.round(w * 10) / 10
    uiState.weightTier = tier
  }

  /** 负重修正：移速倍率 / 可否冲刺 / 换弹倍率 */
  private weightSpeedMul(): number { return [1, 1, 0.85, 0.7][this.weightTier] }

  // ================= 特效 =================
  private spawnTracer(from: THREE.Vector3, to: THREE.Vector3, color: number) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to])
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 })
    const line = new THREE.Line(geo, mat)
    this.world.scene.add(line)
    this.tracers.push({ line, life: 0.08 })
  }

  private spawnSpark(at: THREE.Vector3, color: number) {
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.04, 0.04),
        new THREE.MeshBasicMaterial({ color })
      )
      m.position.copy(at)
      const vel = new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 3, (Math.random() - 0.5) * 3)
      this.world.scene.add(m)
      this.sparks.push({ mesh: m, life: 0.4, vel })
    }
  }

  // ================= 摸金交互 =================
  private nearestContainer(): Container | null {
    let best: Container | null = null
    let bestD = 3.6
    for (const c of this.world.containers) {
      if (c.hidden) continue // 任务奖励箱：目标完成前不可交互
      const d = c.pos.distanceTo(this.pos)
      if (d < bestD) { bestD = d; best = c }
    }
    return best
  }

  /** 距任务点（水平距离 + 楼层匹配） */
  private missionNear(p: { x: number; z: number; floorY?: number }, r: number) {
    const feet = this.pos.y - EYE
    if (Math.abs(feet - (p.floorY ?? 0)) > 1.4) return false
    return Math.hypot(p.x - this.pos.x, p.z - this.pos.z) < r
  }

  /** 赛季剧情·跑图调查点：为当前地图上「已解锁且未完成」的调查任务生成发光标记 */
  private setupScoutSpots() {
    // 清掉上一局的标记
    for (const s of this.scoutSpawns) this.world.scene.remove(s.mesh)
    this.scoutSpawns = []
    this.world.mapMarkers = this.world.mapMarkers.filter(m => !(m.name ?? '').startsWith('❗'))
    uiState.mapMarkers = this.world.mapMarkers

    const season = loadSeason()
    for (const spot of SCOUT_SPOTS) {
      if (spot.mapId !== this.world.mapId) continue
      const q = QUESTS.find(x => x.id === spot.questId)
      if (!q || season.done[q.id] || !phaseUnlocked(season, q.phase)) continue
      const y = spot.floorY ?? this.groundHeightAt(spot.x, spot.z, 0)
      const g = new THREE.Group()
      // 光柱
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.7, 6, 12, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xffc14d, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }))
      pillar.position.y = 3
      // 顶部旋转菱形
      const gem = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.42),
        new THREE.MeshStandardMaterial({ color: 0xffc14d, emissive: 0xff9a1f, emissiveIntensity: 1.6, roughness: 0.3, metalness: 0.4 }))
      gem.position.y = 1.6
      gem.userData.spinScout = true
      g.add(pillar, gem)
      g.position.set(spot.x, y, spot.z)
      this.world.scene.add(g)
      this.scoutSpawns.push({ questId: spot.questId, mesh: g, x: spot.x, z: spot.z, floorY: spot.floorY })
      this.world.mapMarkers.push({ x: spot.x, z: spot.z, kind: 'mission', name: `❗${spot.spotName}` })
    }
    uiState.mapMarkers = this.world.mapMarkers
  }

  private tryInteract() {
    if (this.activeLoot) return
    // ============ 停电夜主题：配电室恢复照明 ============
    if (this.powerStation && !this.powerStation.on && this.missionNear({ x: this.powerStation.x, z: this.powerStation.z, floorY: this.powerStation.floorY }, 2.6)) {
      this.powerStation.on = true
      const lampMesh = this.powerStation.mesh.children[1] as THREE.Mesh
      (lampMesh.material as THREE.MeshStandardMaterial).emissive.setHex(0x2ad66a)
      // 恢复局部照明：全场灯光增强 + 雾距拉远
      this.world.scene.traverse(o => {
        const l = o as THREE.Light
        if (l.isLight) l.intensity *= 3
      })
      const fog = this.world.scene.fog as THREE.Fog | null
      if (fog) { fog.near = Math.max(fog.near, 30); fog.far = Math.max(fog.far, 160) }
      this.themeActions++
      this.toast('💡 配电室已启动！局部照明恢复', 'green')
      sfx.extract()
      notify()
      return
    }
    // ============ 赛季剧情·跑图调查点：抵达现场按 F 调查 ============
    for (let i = 0; i < this.scoutSpawns.length; i++) {
      const s = this.scoutSpawns[i]
      if (this.raidScouts.includes(s.questId)) continue
      if (!this.missionNear({ x: s.x, z: s.z, floorY: s.floorY }, 2.8)) continue
      const spot = SCOUT_SPOTS.find(x => x.questId === s.questId)
      const q = QUESTS.find(x => x.id === s.questId)
      this.raidScouts.push(s.questId)
      this.world.scene.remove(s.mesh)
      this.world.mapMarkers = this.world.mapMarkers.filter(m => m.name !== `❗${spot?.spotName ?? ''}`)
      uiState.mapMarkers = this.world.mapMarkers
      uiState.raidLive = { ...uiState.raidLive, scouts: [...this.raidScouts] }
      this.toast(spot?.foundText ?? '调查完成', 'cyan')
      if (q) this.toast(`📕 剧情任务「${q.name}」进度已记录，成功撤离后结算`, 'green')
      sfx.extract()
      notify()
      return
    }
    // ============ 局内专属任务：接取 / 安放炸药 / 启动装置 ============
    const mm = MAP_MISSIONS[this.world.mapId]
    if (!this.missionDone) {
      if (!this.missionAccepted && this.missionNear(mm.acceptPos, 2.6)) {
        this.missionAccepted = true
        uiState.missionAccepted = true
        this.toast(`🎯 已接取任务「${mm.name}」：${mm.desc}`, 'cyan')
        sfx.extract()
        notify()
        return
      }
      if (mm.type !== 'lamps' && this.missionAccepted && !this.missionStarted && this.missionNear(mm.objPos, 2.8)) {
        this.missionStarted = true
        this.missionTimer = mm.holdTime
        if (mm.type === 'breach') {
          this.toast('🧨 炸药已安放，撤离到安全距离！', 'red')
          sfx.reload()
        } else {
          this.toast(`📶 装置已启动，坚守 ${mm.holdTime} 秒！`, 'cyan')
          sfx.extract()
        }
        notify()
        return
      }
      // 长明灯任务：逐一点亮灯座，四座全亮则石门开启
      if (mm.type === 'lamps' && this.missionAccepted && this.world.lampStands) {
        for (const s of this.world.lampStands) {
          if (s.lit) continue
          if (!this.missionNear({ x: s.x, z: s.z, floorY: s.floorY }, 2.2)) continue
          s.lit = true
          s.flame.visible = true
          s.light.intensity = 26
          sfx.search()
          const litN = this.world.lampStands.filter(t => t.lit).length
          if (litN >= this.world.lampStands.length) {
            this.missionDone = true
            uiState.missionDone = true
            uiState.missionTimer = -1
            for (const b of this.world.missionGuides) this.world.scene.remove(b)
            for (const c of this.world.containers) {
              if (!c.hidden) continue
              c.hidden = false
              c.mesh.visible = true
            }
            const w = this.world.missionWall
            if (w) {
              for (const m of w.meshes) this.world.scene.remove(m)
              const ci = this.world.colliders.indexOf(w.aabb)
              if (ci >= 0) this.world.colliders.splice(ci, 1)
            }
            sfx.boom()
            this.recoilT = 1 // 屏幕震动
            this.toast(`🏺 四座长明灯全部点亮，法老墓室的石门轰然开启！成功撤离后 +${mm.reward} 金币`, 'cyan')
          } else {
            this.toast(`🔥 长明灯已点亮（${litN}/${this.world.lampStands.length}）`, 'cyan')
          }
          notify()
          return
        }
      }
    }
    // 附近的锁门优先：刷卡开门
    const feet = this.pos.y - EYE
    for (const d of this.world.doors) {
      if (d.open || !d.lockedBy) continue
      if (Math.abs(feet - d.base) > 2.4) continue
      if (Math.hypot(d.x - this.pos.x, d.z - this.pos.z) < 2.6) {
        if (this.hasCard(d.lockedBy)) {
          d.open = true
          this.raidDoors++
          uiState.raidLive = { ...uiState.raidLive, doors: this.raidDoors }
          sfx.search()
          uiState.toast = `刷${d.lockedName}开门`
          uiState.toastRarity = 'cyan'
          uiState.toastTs = performance.now()
        } else {
          uiState.toast = `需要【${d.lockedName}】——容器里能找到房卡`
          uiState.toastRarity = 'red'
          uiState.toastTs = performance.now()
        }
        notify()
        return
      }
    }
    const c = this.nearestContainer()
    if (!c) return
    if (c.title === '售货机' && !c.searched) {
      if (uiState.money < 300) { this.toast('余额不足——售货机每次 300 金币', 'red'); return }
      uiState.money -= 300
      saveMoney(uiState.money)
      this.toast('🥤 投币 300 金币，售货机出货中……', 'cyan')
    }
    if (c.searched) { this.openLoot(c); return }
    // 开始搜索
    this.searchTarget = c
    this.searchT = 0
    sfx.search()
  }

  // 逐格揭示：各稀有度扫描时长（毫秒），越稀有转得越久
  private static REVEAL_SPIN: Record<string, number> = { white: 250, green: 400, blue: 650, purple: 950, cyan: 1300, red: 1700 }
  private revealAnnounced = new Set<string>()

  private openLoot(c: Container) {
    this.activeLoot = c
    // 首次打开：按格子顺序（从上到下、从左到右）排揭示时间表
    if (!c.reveal) {
      c.reveal = {}
      const sorted = [...c.grid.placed].sort((a, b) => a.y - b.y || a.x - b.x)
      let t = Date.now() + 300
      for (const p of sorted) {
        t += Game.REVEAL_SPIN[p.item.rarity] ?? 500
        c.reveal[p.item.uid] = t
      }
    }
    this.revealAnnounced.clear()
    uiState.lootGrid = c.grid
    uiState.lootTitle = c.title
    uiState.lootReveal = c.reveal
    uiState.invOpen = true
    try { document.exitPointerLock() } catch { /* 忽略 */ }
    this.syncGrids()
  }

  /** 某件战利品是否已揭示 */
  private lootRevealed(uid: string): boolean {
    const t = this.activeLoot?.reveal?.[uid]
    return !t || t <= Date.now()
  }

  private fillContainer(c: Container) {
    // 活动「狂欢爆率」：所有容器 luck +0.5；「百鸟朝凤」：鸟窝 luck +1.2（黄金鸟蛋概率大增）
    // 自动生成的活动带 power 强度倍率
    const cur = currentEvent().event
    const ev = cur?.id
    const pw = cur?.power ?? 1
    let luck = c.luck + (ev === 'lucky' ? 0.5 * pw : 0) + this.opMods.luck + (uiState.night ? 0.15 : 0) // 夜莺「幸运星」/ 夜战加成
    if (uiState.highRisk) luck += 0.8 // 高危禁区：出货品级整体升一档
    if (this.theme.id === 'blackout') luck += 0.3 // 停电夜：全赛季爆率提升
    if (c.tag === 'infected') {
      luck += 2 // 感染容器：出货率翻倍
      this.themeActions++
      if (this.sprayBuffT > 0) {
        this.toast('🧴 消毒喷雾起效：免受感染', 'green')
      } else {
        this.hp -= 12
        uiState.hp = this.hp
        uiState.damageFlash = 1
        sfx.hurt()
        this.toast('☣️ 这个容器被感染了！开箱 -12 HP（消毒喷雾可免疫）', 'red')
        if (this.hp <= 0) { this.hp = 0; uiState.hp = 0; notify(); this.endRaid(false); return }
      }
    }
    for (const gz of this.gasZones) { if (Math.hypot(c.pos.x - gz.x, c.pos.z - gz.z) < gz.r) { luck += 2; break } } // 毒气区：出货率 ×2
    if (c.title === '鸟窝' && ev === 'nests') luck += 1.2 * pw
    const n = c.title === '保险箱' ? 3 + Math.floor(Math.random() * 3)
      : c.title === '保险柜' ? 2 + Math.floor(Math.random() * 2)   // 高价值低数量
      : c.title === '军用保险库' ? 3 + Math.floor(Math.random() * 2) // 高危专属：量大质优
      : c.title === '售货机' ? 1 + Math.floor(Math.random() * 2)
      : c.title === '弹药箱' ? 2 + Math.floor(Math.random() * 2)   // 子弹 2-3 组
      : 2 + Math.floor(Math.random() * 3)
    const pool = c.title === '武器箱' ? WEAPON_LOOT_POOL : c.title === '鸟窝' ? NEST_LOOT_POOL : c.title === '航空箱' ? AIR_LOOT_POOL
      : c.title === '军用押运车' ? AIR_LOOT_POOL // 武装押运：军用物资
      : c.title === '保险柜' || c.title === '军用保险库' ? VAULT_LOOT_POOL : c.title === '售货机' ? VENDOR_LOOT_POOL : c.title === '弹药箱' ? AMMO_BOX_POOL : LOOT_POOL // 枪只在武器箱/航空箱出，黄金鸟蛋只在鸟窝出
    const redBoost = uiState.highRisk ? 2 : 1 // 高危禁区：红色权重翻倍
    for (let i = 0; i < n; i++) {
      const item = rollLootItem(pool, luck, redBoost)
      autoPlace(c.grid, item)
    }
    if (c.tag === 'convoy') { this.themeActions++; this.alertAllEnemies() } // 劫车：军用物资到手，但惊动全图
    if (c.tag === 'campObj' && this.camp && this.campStage === 1) {
      this.campStage = 2
      uiState.campObj = this.camp.stageText[2]
      // 夺取目标：真实品级变卖物，玩家拿出来、撤离成功就进仓库
      autoPlace(c.grid, makeItem(this.camp.targetItem, 1))
      this.toast(`${this.camp.stageText[2]}（夺取目标：${ITEMS[this.camp.targetItem].name}）`, 'cyan')
      sfx.extract()
    }
    // 任何容器都有机会出本图房卡（活动「门禁解禁」掉率翻倍以上，自动档按强度浮动）
    const cardChance = this.world.mapId === 'desert' ? 0.17 : 0.09 // 沙海古城房卡更好出（陵寝双门双卡）
    if (Math.random() < (ev === 'cards' ? cardChance + 0.13 * pw : cardChance)) autoPlace(c.grid, rollLootItem(CARD_POOLS[this.world.mapId], luck))
    if (c.title !== '售货机') c.searched = true // 售货机可反复投币
    this.raidSearches++ // 赛季任务统计
    uiState.raidLive = { ...uiState.raidLive, searches: this.raidSearches }
    // 地图专属任务改为任务点接取制（见 tryInteract / tick 中的 mission* 逻辑）
  }

  // ================= 引擎 API =================
  private wireAPI() {
    engine.start = () => this.reset()
    engine.restart = () => this.reset()
    engine.startTutorial = () => {
      uiState.tutorial = true
      uiState.tutorialStep = 0
      uiState.mapId = 'wild'
      localStorage.setItem('mojin_map', 'wild')
      engine.start()
    }

    engine.startCampaign = (levelId) => {
      const lv = findLevel(levelId)
      if (!lv || uiState.phase !== 'menu') return
      uiState.campOpen = false
      uiState.campLevelId = levelId
      uiState.resultOpen = false
      uiState.campResult = null
      localStorage.setItem('mojin_map', lv.mapId)
      uiState.mapId = lv.mapId
      notify()
      // 等地图重建完成后开局
      setTimeout(() => engine.start(), 600)
    }

    engine.vsExit = () => {
      const s = uiState.vsSession
      if (s) vsClient.versus.leave.mutate({ roomId: s.roomId, playerId: s.playerId }).catch(() => undefined)
      uiState.vsSession = null
      uiState.vsEnd = null
      uiState.vsOpp = null
      this.vs = null
      engine.toMenu()
    }

    engine.toMenu = () => {
      try { sfx.windStop() } catch { /* 忽略 */ }
      this.running = false
      this.firing = false
      this.activeLoot = null
      uiState.invOpen = false
      uiState.lootGrid = null
      try { document.exitPointerLock() } catch { /* 忽略 */ }
      uiState.stash = loadStash()
      uiState.phase = 'menu'
      notify()
    }
    engine.closeResult = () => { uiState.resultOpen = false; notify() }
    engine.openStash = () => { uiState.stash = loadStash(); uiState.stashOpen = true; notify() }
    engine.closeStash = () => { uiState.stashOpen = false; notify() }
    engine.stashMove = (uid, x, y) => {
      const stash = uiState.stash
      if (!stash) return
      const placed = findPlaced(stash, uid)
      if (!placed) return
      if (placeAt(stash, placed.item, x, y)) { saveStash(stash); sfx.ui() }
      notify()
    }
    engine.stashClear = () => { uiState.stash = clearStash(); sfx.ui(); notify() }
    engine.sortStash = () => {
      if (!uiState.stash) return
      uiState.stash = sortStash(uiState.stash)
      sfx.ui(); this.toast('🧹 仓库已按品级整理', 'cyan'); notify()
    }
    engine.sellAllValuables = () => {
      if (!uiState.stash) return
      const { n, value } = sellAllValuables(uiState.stash)
      if (n === 0) { this.toast('仓库里没有变卖物', 'white'); return }
      const mult = currentEvent().event?.id === 'goldrush' ? 2 : 1
      uiState.money += value * mult
      saveMoney(uiState.money)
      sfx.sell()
      this.toast(`💰 批量出售 ${n} 件变卖物 +${(value * mult).toLocaleString()} 金币`, 'cyan')
      uiState.stash = { ...uiState.stash }
      notify()
    }
    engine.toggleQuestHud = () => {
      uiState.questHudHide = !uiState.questHudHide
      try { localStorage.setItem('mojin_questhud_hide', uiState.questHudHide ? '1' : '0') } catch { /* 忽略 */ }
      sfx.ui(); notify()
    }
    engine.claimBossReward = () => {
      const got = loadBossDrops()
      if (!BOSS_DROPS.every(d => got[d.defId])) { this.toast('还没有集齐 4 件 Boss 专属战利品', 'white'); return }
      if (localStorage.getItem('mojin_boss_claim') === '1') { this.toast('奖励已领取过', 'white'); return }
      try { localStorage.setItem('mojin_boss_claim', '1') } catch { /* 忽略 */ }
      uiState.money += BOSS_COLLECT_REWARD
      saveMoney(uiState.money)
      sfx.extract()
      this.toast(`🏆 Boss 图鉴集齐！奖励 +${BOSS_COLLECT_REWARD.toLocaleString()} 金币`, 'cyan')
      notify()
    }
    // ===== 交易行 =====
    engine.openMarket = () => { uiState.marketOpen = true; notify() }
    engine.closeMarket = () => { uiState.marketOpen = false; notify() }
    engine.buyItem = (defId) => {
      const good = MARKET_GOODS.flatMap(c => c.goods).find(g => g.defId === defId)
      if (!good) return
      const def = ITEMS[defId]
      const { price, sale, benchOff } = marketBuyPrice(good.price, defId)
      if (uiState.money < price) { this.toast('金币不足！', 'red'); return }
      const stash = loadStash()
      if (!autoPlace(stash, makeItem(defId, 1))) { this.toast('仓库已满，放不下！', 'red'); return }
      saveStash(stash)
      uiState.money -= price
      saveMoney(uiState.money)
      uiState.stash = stash // 仓库面板若开着则同步
      sfx.sell()
      const tag = sale && benchOff ? '（半价+改装台）' : sale ? '（军火倾销半价）' : benchOff ? '（改装台折扣）' : ''
      this.toast(`已购入 ${def.name}${tag}（存入仓库）`, def.rarity)
      notify()
    }
    // ===== 战前配装 =====
    engine.openLoadout = () => { uiState.stash = loadStash(); uiState.loadoutOpen = true; notify() }
    engine.closeLoadout = () => { uiState.loadoutOpen = false; notify() }
    // ===== 赛季通行证 =====
    engine.claimBp = (lv) => {
      const bp = loadBp()
      const r = bpClaim(bp, lv)
      if (!r) return
      uiState.money += r.money
      saveMoney(uiState.money)
      sfx.sell()
      this.toast(`通行证 Lv.${lv}：+${r.money.toLocaleString()} 金币${r.itemName ? ` + ${r.itemName}` : ''}${r.overflow ? '（仓库已满，物资未发放）' : ''}`, 'purple')
      uiState.stash = loadStash()
      notify()
    }
    engine.claimAllBp = () => {
      const bp = loadBp()
      const list = claimable(bp)
      let moneySum = 0
      for (const lv of list) {
        const r = bpClaim(bp, lv)
        if (r) moneySum += r.money
      }
      if (moneySum > 0) {
        uiState.money += moneySum
        saveMoney(uiState.money)
        sfx.sell()
        this.toast(`已领取 ${list.length} 级通行证奖励，共 +${moneySum.toLocaleString()} 金币`, 'purple')
      }
      uiState.stash = loadStash()
      notify()
    }
    // ===== 成就 =====
    engine.claimAch = (id) => {
      const ach = ACHIEVEMENTS.find(a => a.id === id)
      if (!ach) return
      const claimed = loadAchClaimed()
      if (claimed.includes(id)) return
      if (loadStats()[ach.stat] < ach.target) { this.toast('成就尚未达成', 'red'); return }
      claimed.push(id)
      saveAchClaimed(claimed)
      uiState.money += ach.reward
      saveMoney(uiState.money)
      sfx.sell()
      this.toast(`成就「${ach.name}」+${ach.reward.toLocaleString()} 金币`, 'green')
      notify()
    }
    // ===== 求购单 =====
    engine.placeOrder = (defId) => {
      const price = orderPrice(defId)
      if (price == null) { this.toast('该物品不支持求购', 'red'); return }
      if (uiState.money < price) { this.toast('金币不足！', 'red'); return }
      const err = placeOrder(defId)
      if (err) { this.toast(err, 'red'); return }
      uiState.money -= price
      saveMoney(uiState.money)
      sfx.sell()
      this.toast(`已挂求购单：${ITEMS[defId].name}（${price.toLocaleString()} 金币），完成对局后可能到货`, 'cyan')
      notify()
    }
    engine.cancelOrder = (id) => {
      const refund = cancelOrder(id)
      if (refund > 0) {
        uiState.money += refund
        saveMoney(uiState.money)
        this.toast(`已取消求购单，返还 ${refund.toLocaleString()} 金币`, 'white')
      }
      notify()
    }
    engine.claimOrder = (id) => {
      if (!claimOrder(id)) { this.toast('仓库已满，放不下！', 'red'); return }
      sfx.sell()
      this.toast('求购物品已入仓库', 'cyan')
      uiState.stash = loadStash()
      notify()
    }
    engine.sellStashItem = (uid) => {
      if (!uiState.stash) return
      const gained = sellFromStash(uiState.stash, uid)
      if (gained == null) return
      // 活动「金市上涨」：双倍金币
      const mult = currentEvent().event?.id === 'goldrush' ? 2 : 1
      uiState.money += gained * mult
      saveMoney(uiState.money)
      sfx.sell()
      if (mult > 1) this.toast(`金市上涨！双倍金币 +${(gained * mult).toLocaleString()}`, 'cyan')
      notify()
    }
    engine.pickupFromLoot = (uid) => {
      if (!this.activeLoot) return
      if (!this.lootRevealed(uid)) return // 还在扫描，不能拿
      const placed = findPlaced(this.activeLoot.grid, uid)
      if (!placed) return
      const def = defOf(placed.item)
      const removed = removeItem(this.activeLoot.grid, uid)!
      if (this.onItemPicked(removed.item)) { sfx.pickup(RARITY_ORDER.indexOf(removed.item.rarity)); this.syncGrids(); return }
      if (!autoPlace(this.backpack, removed.item)) {
        // 背包满，放回
        placeAt(this.activeLoot.grid, removed.item, placed.x, placed.y)
        this.toast('背包已满！', 'red')
        return
      }
      sfx.pickup(RARITY_ORDER.indexOf(removed.item.rarity))
      this.toast(`获得 ${def.name}`, removed.item.rarity)
      this.syncGrids()
    }
    engine.takeAllLoot = () => {
      if (!this.activeLoot) return
      // 全部拿取：立即揭示所有格子
      if (this.activeLoot.reveal) {
        for (const uid of Object.keys(this.activeLoot.reveal)) this.activeLoot.reveal[uid] = 0
        uiState.lootReveal = this.activeLoot.reveal
      }
      const items = [...this.activeLoot.grid.placed]
      for (const p of items) {
        const removed = removeItem(this.activeLoot.grid, p.item.uid)!
        if (this.onItemPicked(removed.item)) continue
        if (!autoPlace(this.backpack, removed.item)) {
          placeAt(this.activeLoot.grid, removed.item, p.x, p.y)
          this.toast('背包已满！', 'red')
          break
        }
      }
      sfx.pickup(1)
      this.syncGrids()
    }
    engine.moveItem = (from, uid, to, x, y) => {
      const grids = { backpack: this.backpack, loot: this.activeLoot?.grid ?? null, safebox: this.safebox }
      const src = grids[from]; const dst = grids[to]
      if (!src || !dst) return false
      if (from === 'loot' && !this.lootRevealed(uid)) return false // 扫描中的物品不能拖动
      const placed = findPlaced(src, uid)
      if (!placed) return false
      // 堆叠合并
      const target = hitTest(dst, x, y)
      const def = defOf(placed.item)
      if (target && def.stack && target.item.defId === placed.item.defId && target.item.rarity === placed.item.rarity && target.item.uid !== uid) {
        const add = Math.min(def.stack - target.item.count, placed.item.count)
        if (add > 0) {
          target.item.count += add
          placed.item.count -= add
          if (placed.item.count <= 0) removeItem(src, uid)
          sfx.ui()
          this.syncGrids()
          return true
        }
      }
      if (from === to) {
        if (!placeAt(src, placed.item, x, y)) { this.syncGrids(); return false }
      } else {
        const old = { x: placed.x, y: placed.y }
        removeItem(src, uid)
        if (!placeAt(dst, placed.item, x, y)) {
          placeAt(src, placed.item, old.x, old.y)
          this.syncGrids()
          return false
        }
      }
      sfx.ui()
      this.syncGrids()
      return true
    }
    engine.equipWeapon = (uid) => {
      const placed = findPlaced(this.backpack, uid)
      if (!placed) return
      const def = defOf(placed.item)
      if (def.kind !== 'weapon' || !def.gunId) return
      removeItem(this.backpack, uid)
      if (!this.gunDef.melee) {
        // 把当前枪放回背包（匕首是永久装备，不占格子）；配件跟着枪走
        const currentItemId = Object.keys(ITEMS).find(k => ITEMS[k].gunId === this.gunDef.id)!
        const oldItem = makeItem(currentItemId, 1)
        if (this.ownedGun?.atts) oldItem.atts = this.ownedGun.atts
        if (!autoPlace(this.backpack, oldItem)) {
          // 放不下，撤销
          autoPlace(this.backpack, placed.item)
          this.toast('背包空间不足，无法换枪', 'red')
          this.syncGrids()
          return
        }
      }
      this.gunDef = GUNS[def.gunId]
      this.gunRarity = placed.item.rarity
      this.ownedGun = { def: this.gunDef, rarity: this.gunRarity, atts: placed.item.atts }
      this.mag = this.effGun().mag
      this.reloading = false
      this.ads = false
      this.buildViewmodel()
      sfx.pickup(2)
      this.toast(`装备 ${RARITY_INFO[this.gunRarity].name}·${this.gunDef.name}`, this.gunRarity)
      this.syncGunUI()
      this.syncGrids()
    }
    engine.useItem = (uid) => {
      const placed = findPlaced(this.backpack, uid)
      if (!placed) return
      const def = defOf(placed.item)
      if (placed.item.defId === 'm_spray') {
        // 消毒喷雾：60 秒免疫感染容器伤害
        this.sprayBuffT = 60
        placed.item.count--
        if (placed.item.count <= 0) removeItem(this.backpack, uid)
        sfx.pickup(0)
        this.toast('🧴 消毒喷雾：60 秒内开启感染容器不扣血', 'green')
        this.syncGrids()
      } else if (def.kind === 'med' && def.heal) {
        if (this.hp >= uiState.maxHp) { this.toast('生命值已满', 'white'); return }
        // 活动「战地医疗」：回复量 +50%（自动档按强度浮动）
        const medEv = currentEvent().event
        const heal = Math.round(def.heal * (medEv?.id === 'medic' ? 1 + 0.5 * (medEv.power ?? 1) : 1) * this.opMods.med)
        this.hp = Math.min(uiState.maxHp, this.hp + heal)
        placed.item.count--
        if (placed.item.count <= 0) removeItem(this.backpack, uid)
        sfx.pickup(0)
        this.toast(`恢复 ${heal} 生命`, 'green')
        uiState.hp = this.hp
        this.syncGrids()
      } else if (def.kind === 'weapon') {
        engine.equipWeapon(uid)
      }
    }
    engine.dropItem = (uid) => {
      removeItem(this.backpack, uid)
      sfx.ui()
      this.syncGrids()
    }
    engine.closeLoot = () => this.closeLoot()
    engine.toggleInventory = () => this.toggleInventory()
    // 触屏输入
    engine.mobileMove = (x, y, sprint) => { this.mMove.x = x; this.mMove.y = y; this.mSprint = sprint }
    engine.mobileLook = (dx, dy) => {
      const sens = 0.0042 / (this.ads ? Math.sqrt(this.effGun().zoom) : 1)
      this.yaw -= dx * sens
      this.pitch = THREE.MathUtils.clamp(this.pitch - dy * sens, -1.45, 1.45)
    }
    engine.mobileFire = (on) => { this.firing = on; if (on) this.tryShoot() }
    engine.mobileAdsToggle = () => { if (!this.gunDef.melee) this.ads = !this.ads }
    engine.mobileReload = () => this.startReload()
    engine.useSkill = () => this.useSkill()
    // 武器配件：安装 / 卸下
    engine.attachMod = (uid) => {
      if (this.gunDef.melee || !this.ownedGun || this.ownedGun.def !== this.gunDef) {
        this.toast('先装备一把枪，再安装配件', 'red'); return
      }
      const placed = findPlaced(this.backpack, uid)
      if (!placed) return
      const def = defOf(placed.item)
      if (def.kind !== 'attachment' || !def.slot) return
      removeItem(this.backpack, uid)
      this.ownedGun.atts = this.ownedGun.atts ?? {}
      const old = this.ownedGun.atts[def.slot]
      if (old) {
        // 槽位已有配件：换回背包
        if (!autoPlace(this.backpack, old)) {
          placeAt(this.backpack, placed.item, placed.x, placed.y)
          this.toast('背包已满，无法替换配件', 'red')
          this.syncGrids()
          return
        }
      }
      this.ownedGun.atts[def.slot] = placed.item
      // 弹匣配件影响当前弹容量
      const eff = this.effGun()
      this.mag = Math.min(this.mag, eff.mag)
      sfx.ui()
      this.toast(`安装 ${def.name}`, def.rarity)
      this.syncGunUI()
      this.syncGrids()
    }
    engine.detachMod = (slot) => {
      if (!this.ownedGun?.atts?.[slot]) return
      const att = this.ownedGun.atts[slot]!
      if (!autoPlace(this.backpack, att)) { this.toast('背包已满！', 'red'); return }
      delete this.ownedGun.atts[slot]
      // 卸下扩容弹匣：当前弹药超出的部分退还
      const eff = this.effGun()
      if (this.mag > eff.mag) this.mag = eff.mag
      sfx.ui()
      this.toast(`卸下 ${defOf(att).name}`, 'white')
      this.syncGunUI()
      this.syncGrids()
    }
    engine.mobileInteract = () => this.tryInteract()
    engine.mobileSwapWeapon = () => { this.gunDef.melee ? this.equipOwnedGun() : this.equipKnife() }
  }

  // ================= 武器配件 =================
  /** 当前枪生效的配件（刀/非 ownedGun 时为空） */
  private curAtts(): Partial<Record<AttSlot, ItemInstance>> {
    if (this.gunDef.melee || !this.ownedGun || this.ownedGun.def !== this.gunDef) return {}
    return this.ownedGun.atts ?? {}
  }

  /** 配件修正后的枪械属性 */
  private effGun() {
    const a = this.curAtts()
    const g = this.gunDef
    const has = (id: string) => Object.values(a).some(x => x?.defId === id)
    return {
      spread: g.spread * (has('at_rdot') ? 0.8 : 1) * (has('at_scope4') ? 0.7 : 1) * (has('at_comp') ? 0.85 : 1)
        * (has('at_stock_s') ? 0.92 : 1) * (has('at_grip_l') ? 0.9 : 1) * (has('at_grip_v') ? 1.04 : 1),
      zoom: has('at_scope4') ? 4 : g.zoom * (has('at_rdot') ? 1.35 : 1),
      recoil: g.recoil * (has('at_comp') ? 0.7 : 1) * (has('at_stock_s') ? 0.75 : 1) * (has('at_stock_l') ? 1.06 : 1)
        * (has('at_grip_v') ? 0.82 : 1) * (has('at_grip_l') ? 1.06 : 1),
      reloadTime: g.reloadTime * (has('at_qmag') ? 0.7 : 1) * (has('at_stock_l') ? 0.88 : 1),
      mag: Math.round(g.mag * (has('at_emag') ? 1.5 : 1)),
      alert: (has('at_supp') ? 12 : 42) + (has('at_laser') ? 8 : 0) + (has('at_laser_r') ? 14 : 0), // 枪声惊动敌人的半径
      hipMul: has('at_laser_r') ? 0.55 : has('at_laser') ? 0.7 : 1, // 腰射散布修正（镭射加成，但会暴露）
    }
  }

  private equipKnife() {
    if (this.gunDef.melee) return
    this.gunDef = KNIFE
    this.gunRarity = 'white'
    this.reloading = false
    this.ads = false
    this.buildViewmodel()
    sfx.ui()
    this.toast('切换 战术匕首', 'white')
    this.syncGunUI()
  }

  /** 轮换武器（按 2 / 手机切换钮）：刀 → 最近用的枪 → 背包里的枪（依次轮换）→ 回刀 */
  private equipOwnedGun() {
    const bagGuns = this.backpack.placed.filter(p => {
      const d = defOf(p.item)
      return d.kind === 'weapon' && !!d.gunId
    })
    if (this.gunDef.melee) {
      // 持刀：优先回到最近用的枪；没有就从背包自动装备第一把
      if (this.ownedGun) {
        this.gunDef = this.ownedGun.def
        this.gunRarity = this.ownedGun.rarity
        this.mag = this.effGun().mag
        this.reloading = false
        this.buildViewmodel()
        sfx.ui()
        this.toast(`切换 ${RARITY_INFO[this.gunRarity].name}·${this.gunDef.name}`, this.gunRarity)
        this.syncGunUI()
        return
      }
      if (bagGuns.length) { engine.equipWeapon(bagGuns[0].item.uid); return }
      this.toast('还没有枪——去找棕色武器箱！', 'red')
      return
    }
    // 持枪：背包里还有枪就换下一把（当前枪自动放回背包），否则切回刀
    if (bagGuns.length) { engine.equipWeapon(bagGuns[0].item.uid); return }
    this.equipKnife()
  }

  private toggleInventory() {
    if (uiState.invOpen) this.closeLoot()
    else {
      uiState.invOpen = true
      uiState.lootGrid = null
      uiState.lootTitle = ''
      try { document.exitPointerLock() } catch { /* 忽略 */ }
      notify()
    }
  }

  private closeLoot() {
    this.activeLoot = null
    uiState.invOpen = false
    uiState.lootGrid = null
    uiState.lootReveal = {}
    notify()
    if (!this.isTouch && uiState.phase === 'playing') this.lock()
  }

  private toast(text: string, rarity: Rarity) {
    uiState.toast = text
    uiState.toastRarity = rarity
    uiState.toastTs = performance.now()
    notify()
  }

  private syncGrids() {
    uiState.backpack = this.backpack
    uiState.safebox = this.safebox
    if (this.activeLoot) uiState.lootGrid = this.activeLoot.grid
    notify()
  }

  private syncGunUI() {
    // HUD 弹容量显示配件修正后的值（如 45/45）
    uiState.gun = this.gunDef.melee ? this.gunDef : { ...this.gunDef, mag: this.effGun().mag }
    uiState.gunRarity = this.gunRarity
    uiState.mag = this.mag
    uiState.ammoTier = this.magTier
    uiState.reloading = this.reloading
    // 同步当前武器配件到 UI
    const a = this.curAtts()
    uiState.gunAtts = { scope: a.scope ?? null, muzzle: a.muzzle ?? null, mag: a.mag ?? null, stock: a.stock ?? null, grip: a.grip ?? null, laser: a.laser ?? null }
    notify()
  }

  // ================= 对局流程 =================
  private startRaid() {
    uiState.phase = 'playing'
    uiState.hideoutOpen = false
    notify()
    this.running = true
    this.lock()
    if (this.world.mapId === 'snow') { try { sfx.windStart() } catch { /* 忽略 */ } }
    const med = hideoutMedHp()
    if (med > 0) this.toast(`🏥 医疗站：开局生命 ${uiState.maxHp}（+${med}）`, 'green')
  }

  private reset() {
    // 重置所有状态
    this.enemies.clear()
    this.refreshOpMods()
    this.hp = uiState.maxHp
    this.skillCdT = 0
    this.invisT = 0
    this.droneT = 0
    this.smokes = []
    this.mines = []
    uiState.tacUsed = false
    this.tacBrought = false
    this.rallyT = 0
    this.markBonus = 0
    if (this.charge) { this.world.scene.remove(this.charge.mesh); this.charge = null }
    this.armorT = 0
    this.revealT = 0
    uiState.skillCd = 0
    uiState.skillActive = ''
    uiState.revealEnemies = []
    this.kills = 0
    this.pos.set(this.world.playerSpawn.x, this.world.playerSpawn.y + EYE, this.world.playerSpawn.z)
    this.vy = 0
    this.yaw = this.world.playerYaw; this.pitch = 0
    // ===== 联机：自定义房间出生 + 建所有远程玩家模型 =====
    this.vs = uiState.vsSession
    this.vsSendT = 0; this.vsSinceId = 0; this.vsOver = false
    this.vsRemotes.clear(); this.vsDeadNotified.clear()
    uiState.vsEnd = null; uiState.vsOpp = null
    for (const [, actor] of this.vsActors) { this.world.scene.remove(actor.mesh); this.world.scene.remove(actor.tag) }
    this.vsActors.clear()
    if (this.vs) {
      const members = this.vs.players.length ? this.vs.players : [{ id: this.vs.playerId, name: '我' }]
      const myIdx = Math.max(0, members.findIndex(p => p.id === this.vs!.playerId))
      if (this.vs.mode === 'pvp') {
        // 乱斗：沿圆周均匀散开出生，面朝中心
        const n = Math.max(2, members.length)
        const ang = (myIdx / n) * Math.PI * 2
        this.pos.set(Math.sin(ang) * 112, EYE, Math.cos(ang) * 112)
        this.yaw = ang + Math.PI
      } else {
        // 组队：同点集结，依次错开
        this.pos.set(this.world.playerSpawn.x + (myIdx % 3) * 2.5, this.world.playerSpawn.y + EYE, this.world.playerSpawn.z + Math.floor(myIdx / 3) * 2.5)
      }
      const COLORS = [0xd84a3a, 0x3a8ad8, 0xd8a03a, 0x9a3ad8, 0x3ad8a0, 0xd83a8a]
      for (const m of members) {
        if (m.id === this.vs.playerId) continue
        const idx = members.indexOf(m)
        const color = this.vs.mode === 'pvp' ? COLORS[idx % COLORS.length] : 0x3ad86a
        const mesh = this.buildVsSoldier(color)
        this.world.scene.add(mesh)
        const tag = this.makeVsName(m.name, this.vs.mode === 'pvp' ? '#ff6a5a' : '#5aff8a')
        this.world.scene.add(tag)
        this.vsActors.set(m.id, { mesh, tag })
      }
    }
    this.raidLeft = RAID_SECONDS
    this.extractT = 0
    this.stormOn = false
    this.stormHurtT = 0
    this.spawnTimer = 6
    this.backpack = makeGrid(8, 9)
    // 保险箱格数由赛季任务进度决定（2 格 → 4 格 → 9 格 → 12 格）
    const lv = safeLv(loadSeason())
    this.safebox = makeGrid(...SAFE_DIMS[lv])
    this.raidSearches = 0
    this.raidDoors = 0
    this.raidScouts = []
    uiState.raidLive = { searches: 0, doors: 0, bossKills: 0, scouts: [] }
    this.setupScoutSpots()
    this.missionAccepted = false
    this.missionStarted = false
    this.missionTimer = 0
    this.missionTimerUi = -1
    this.missionWaveSpawned = false
    this.missionDone = false
    uiState.missionAccepted = false
    uiState.missionTimer = -1
    uiState.missionDone = false
    this.raidBossKills = 0
    // 开局只有匕首
    this.gunDef = KNIFE
    this.gunRarity = 'white'
    this.mag = 0
    this.magTier = 1
    this.magDmgMul = 1
    this.vest = null
    this.helmet = null
    this.weightTier = 0
    this.grenades = []
    this.dmgNums = []
    uiState.vest = null
    uiState.helmet = null
    uiState.weight = 0
    uiState.weightTier = 0
    this.ownedGun = null
    this.ads = false
    this.swingT = 0
    this.buildViewmodel()
    this.giveStarterGear(true)
    // 重建世界容器状态
    for (const c of this.world.containers) {
      if (c.enemyDrop) { this.world.scene.remove(c.mesh) }
      else { c.searched = false; c.grid = makeGrid(6, 4) }
    }
    this.world.containers = this.world.containers.filter(c => !c.enemyDrop)
    // ===== 赛季主题（P3 #20） =====
    this.theme = currentSeasonTheme()
    this.themeActions = 0
    this.sprayBuffT = 0
    this.convoyAlerted = false
    // 感染爆发：约 30% 容器被污染（出货率翻倍但开箱扣血）
    for (const c of this.world.containers) {
      const old = c.mesh.getObjectByName('infectedMark')
      if (old) c.mesh.remove(old)
      c.tag = undefined
      if (this.theme.id === 'infection' && !this.camp && !c.enemyDrop && c.title !== '售货机' && Math.random() < 0.3) {
        c.tag = 'infected'
        const spore = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6),
          new THREE.MeshStandardMaterial({ color: 0x3fae2a, emissive: 0x2a8a1a, emissiveIntensity: 1.2, transparent: true, opacity: 0.85 }))
        spore.name = 'infectedMark'
        spore.position.y = 1.6
        c.mesh.add(spore)
      }
    }
    this.spawnInitialEnemies()
    uiState.kills = 0
    uiState.killFeed = []
    // ===== 剧情战役：关卡初始化 =====
    this.camp = uiState.campLevelId ? findLevel(uiState.campLevelId) ?? null : null
    this.campStage = 0
    this.campObjCrate = null
    uiState.campObj = this.camp ? this.camp.stageText[0] : ''
    // 局内随机事件排程：随机 2 个，开局不预告（战役模式不刷）
    this.raidEvents = (uiState.tutorial || this.camp || this.vs?.mode === 'pvp') ? [] :
      (['supplyRain', 'elitePatrol', 'gasLeak'] as ('supplyRain' | 'elitePatrol' | 'gasLeak' | 'convoy')[])
        .sort(() => Math.random() - 0.5).slice(0, 2)
        .map(id => ({ id, at: 90 + Math.random() * 270, fired: false }))
    // 赛季主题「武装押运」：局内随机时段押运车队入场
    if (this.theme.id === 'convoy' && !uiState.tutorial && this.vs?.mode !== 'pvp') {
      this.raidEvents.push({ id: 'convoy', at: 120 + Math.random() * 180, fired: false })
    }
    uiState.hp = this.hp
    uiState.extractProgress = -1
    uiState.searching = -1
    this.syncGunUI()
    this.syncGrids()
    this.startRaid()
  }

  /** 联机：远程玩家士兵模型 */
  private buildVsSoldier(color: number): THREE.Group {
    const g = new THREE.Group()
    const mat = new THREE.MeshStandardMaterial({ color: 0x4a4f45, roughness: 0.8 })
    const accent = new THREE.MeshStandardMaterial({ color, roughness: 0.6, emissive: color, emissiveIntensity: 0.25 })
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.32), mat)
    legs.position.y = 0.35
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.38), mat)
    body.position.y = 1.06
    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.4, 0.42), accent)
    vest.position.y = 1.1
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 10), new THREE.MeshStandardMaterial({ color: 0xd8b08c, roughness: 0.7 }))
    head.position.y = 1.62
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), accent)
    helmet.position.y = 1.66
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.7), new THREE.MeshStandardMaterial({ color: 0x22252a, roughness: 0.4, metalness: 0.6 }))
    gun.position.set(0.3, 1.1, -0.3)
    g.add(legs, body, vest, head, helmet, gun)
    g.traverse(o => { o.castShadow = true })
    return g
  }

  /** 联机：头顶名字牌 */
  private makeVsName(name: string, color: string): THREE.Sprite {
    const cv = document.createElement('canvas')
    cv.width = 256; cv.height = 56
    const ctx = cv.getContext('2d')!
    ctx.fillStyle = 'rgba(0,0,0,0.45)'
    ctx.fillRect(0, 0, 256, 56)
    ctx.font = 'bold 30px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillStyle = color
    ctx.fillText(name, 128, 38)
    const tex = new THREE.CanvasTexture(cv)
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }))
    sp.scale.set(2.2, 0.48, 1)
    return sp
  }

  /** 联机：状态同步（150ms 节流）+ 远程玩家插值渲染 */
  private vsTick(dt: number) {
    if (!this.vs || uiState.phase !== 'playing') return
    const s = this.vs
    this.vsSendT -= dt
    if (this.vsSendT <= 0) {
      this.vsSendT = 0.15
      vsClient.versus.sync.mutate({
        roomId: s.roomId, playerId: s.playerId,
        x: this.pos.x, y: this.pos.y - EYE, z: this.pos.z, yaw: this.yaw,
        hp: this.hp, gun: this.gunDef?.name ?? '', dead: this.hp <= 0,
        sinceId: this.vsSinceId,
      }).then(res => {
        if (!res.ok || !this.vs) return
        // 更新所有远程玩家
        for (const pl of res.players) {
          if (pl.id === s.playerId) continue
          this.vsRemotes.set(pl.id, pl)
          if (pl.dead && !this.vsDeadNotified.has(pl.id)) {
            this.vsDeadNotified.add(pl.id)
            if (s.mode === 'coop') {
              // 组队：队友阵亡只播报，对局继续（修复：此前会错误地直接结算）
              this.toast(`💀 队友 ${pl.name} 阵亡了！`, 'red')
              uiState.killFeed = [`💀 ${pl.name} 阵亡`, ...uiState.killFeed].slice(0, 4)
            }
          }
        }
        // 对战乱斗：其余全部阵亡 → 胜利（仅 pvp；组队绝不因此结算）
        if (s.mode === 'pvp' && !this.vsOver) {
          const others = res.players.filter(pl => pl.id !== s.playerId)
          if (others.length > 0 && others.every(pl => pl.dead)) this.endVs('win')
          const first = others.find(pl => !pl.dead) ?? others[0]
          if (first) uiState.vsOpp = { name: others.length > 1 ? `${first.name} 等 ${others.length} 人` : first.name, hp: Math.max(0, Math.round(first.hp)) }
        }
        for (const ev of res.events) {
          if (ev.id <= this.vsSinceId) continue
          this.vsSinceId = ev.id
          if (ev.type === 'hit' && ev.to === s.playerId && s.mode === 'pvp' && !this.vsOver) {
            const dmg = ev.dmg ?? 0
            this.hp -= dmg
            sfx.hurt()
            uiState.hp = Math.max(0, this.hp)
            this.spawnDmgNum(this.pos.clone(), dmg, 'body')
            if (this.hp <= 0) { this.hp = 0; this.endVs('lose') }
          }
        }
        notify()
      }).catch(() => undefined)
    }
    // 远程玩家插值渲染
    for (const [pid, actor] of this.vsActors) {
      const r = this.vsRemotes.get(pid)
      if (!r) continue
      actor.mesh.position.lerp(new THREE.Vector3(r.x, r.y, r.z), Math.min(1, dt * 10))
      actor.mesh.rotation.y = r.yaw
      actor.mesh.visible = !r.dead
      actor.tag.position.copy(actor.mesh.position)
      actor.tag.position.y += 2.2
      actor.tag.visible = !r.dead
    }
  }

  /** 联机对战结算 */
  private endVs(result: 'win' | 'lose') {
    this.vsOver = true
    uiState.vsEnd = result
    uiState.hp = Math.max(0, this.hp)
    try { document.exitPointerLock() } catch { /* 忽略 */ }
    if (result === 'win') sfx.extract(); else sfx.hurt()
    notify()
  }

  private spawnInitialEnemies() {
    if (this.vs && (this.vs.mode === 'pvp' || !this.vs.ai)) return // 对战乱斗无 AI；组队按房间规则决定是否刷 AI
    if (uiState.tutorial) {
      // 教学模式：无敌人，发一把 P92 + 子弹练手
      autoPlace(this.backpack, makeItem('w_p92', 1))
      autoPlace(this.backpack, makeItem('a_ammo', 2))
      return
    }
    const nBoss = this.world.bossSpawns.length
    const isSnow = this.world.mapId === 'snow'
    const isDesert = this.world.mapId === 'desert'
    let total = isSnow ? 11 : nBoss >= 2 ? 12 : nBoss === 1 ? 10 : 8 // 潮汐监狱最大；雪地 11 人
    const hr = uiState.highRisk
    if (hr) total = Math.round(total * 1.5) // 高危禁区：敌人数量 ×1.5
    // 活动「精英出没」：敌人整体 tier +1（更强，掉落更好）
    const elite = currentEvent().event?.id === 'elite'
    // 兵种构成：监狱多重甲、雪地多侦察、其余混搭（约 1/3 特殊兵种）
    const kindPool = (): 'normal' | 'heavy' | 'grenadier' | 'scout' => {
      const r = Math.random()
      const mid = this.world.mapId
      if (mid === 'prison') return r < 0.2 ? 'heavy' : r < 0.32 ? 'grenadier' : r < 0.4 ? 'scout' : 'normal'
      if (mid === 'snow') return r < 0.24 ? 'scout' : r < 0.34 ? 'grenadier' : r < 0.4 ? 'heavy' : 'normal'
      if (mid === 'tower') return r < 0.14 ? 'heavy' : r < 0.26 ? 'grenadier' : r < 0.38 ? 'scout' : 'normal'
      if (mid === 'desert') return r < 0.16 ? 'heavy' : r < 0.36 ? 'grenadier' : r < 0.5 ? 'scout' : 'normal'
      return r < 0.12 ? 'heavy' : r < 0.22 ? 'grenadier' : r < 0.32 ? 'scout' : 'normal'
    }
    for (let i = 0; i < total; i++) {
      const p = this.randomSpawnPos(45)
      const t = Math.floor(Math.random() * 2) + (elite ? 1 : 0)
      const hrHp = hr ? { hp: Math.round((70 + t * 30) * 1.5) } : {} // 高危禁区：敌人血量 ×1.5
      this.enemies.spawn(p, t,
        isSnow ? { armor: 0xdde4ea, kind: kindPool(), ...hrHp } : isDesert ? { armor: 0xcbb26a, kind: kindPool(), ...hrHp } : { kind: kindPool(), ...hrHp }) // 雪地白色/沙漠土黄迷彩装甲
    }
    // Boss：枪法更准、射速更快、更耐打；雪地白狼是狙击型（高伤低射速）
    for (const b of this.world.bossSpawns) {
      this.enemies.spawn(b.pos.clone(), 3, isSnow ? {
        boss: true, name: `👑 ${b.name}`, armor: 0xf2f6fa,
        hp: hr ? 630 : 420, dmg: 24, speed: 3.2, acc: 0.3, fireGap: 1.7, patrolRadius: 14,
      } : {
        boss: true, name: `👑 ${b.name}`,
        hp: hr ? 630 : 420, dmg: 11, speed: 3.6, acc: 0.22, fireGap: 0.55, patrolRadius: 12,
      })
    }
  }

  private randomSpawnPos(minDist: number): THREE.Vector3 {
    const pts = this.world.spawnPoints
    if (pts.length) {
      const shuffled = [...pts].sort(() => Math.random() - 0.5)
      for (const p of shuffled) {
        if (Math.hypot(p.x - this.pos.x, p.z - this.pos.z) > minDist) return p.clone()
      }
    }
    for (let i = 0; i < 20; i++) {
      const x = (Math.random() - 0.5) * 250
      const z = (Math.random() - 0.5) * 250
      if (Math.hypot(x - this.pos.x, z - this.pos.z) > minDist) {
        return new THREE.Vector3(x, 0, z)
      }
    }
    return new THREE.Vector3(100, 0, 100)
  }

  private endRaid(extracted: boolean) {
    // 第一步：无条件切换界面状态，保证玩家一定回到主页
    this.running = false
    this.firing = false
    this.activeLoot = null
    this.searchTarget = null
    this.searchT = -1
    uiState.invOpen = false
    uiState.lootGrid = null
    uiState.lootReveal = {}
    uiState.searching = -1
    uiState.extractProgress = -1
    uiState.lastRaidExtracted = extracted
    uiState.phase = 'menu'
    uiState.resultOpen = true
    try { document.exitPointerLock() } catch { /* 忽略 */ }
    // 联机：发最终同步（死亡广播给房间其他人，组队对局可继续）
    if (this.vs) {
      const s = this.vs
      vsClient.versus.sync.mutate({
        roomId: s.roomId, playerId: s.playerId,
        x: this.pos.x, y: this.pos.y - EYE, z: this.pos.z, yaw: this.yaw,
        hp: Math.max(0, this.hp), gun: '', dead: !extracted,
        sinceId: this.vsSinceId,
      }).catch(() => undefined)
    }
    notify()
    // ===== 战役结算：独立存档进度，不影响摸金主模式经济 =====
    if (this.camp) {
      const lv = this.camp
      const ch = chapterOf(lv)
      this.camp = null
      uiState.campLevelId = null
      uiState.campObj = ''
      const win = extracted && this.campStage >= 2
      const save = loadCampaign()
      const times = save.cleared[lv.id] ?? 0
      const lines: string[] = []
      if (win) {
        const gold = clearReward(times, ch.rewardGold)
        uiState.money += gold
        saveMoney(uiState.money)
        lines.push(`💰 战役奖励 +${gold.toLocaleString()} 金币${times > 0 ? '（重复通关奖励递减）' : ''}`)
        save.cleared[lv.id] = times + 1
        lines.push(`✅ ${lv.name} —— 通关！（本章进度 ${ch.levels.filter(l => (save.cleared[l.id] ?? 0) > 0).length}/3）`)
        // 夺取目标：真的带出来了才进仓库（背包/保险箱里找到才算）
        {
          const got: typeof this.backpack.placed = []
          for (const g of [this.backpack, this.safebox]) {
            for (const pl of g.placed) if (pl.item.defId === lv.targetItem) got.push(pl)
          }
          if (got.length > 0) {
            const stash2 = loadStash()
            addToStash(stash2, got.map(pl => pl.item))
            uiState.stash = stash2
            lines.push(`🎒 夺取目标「${ITEMS[lv.targetItem].name}」已带出，存入仓库！`)
          } else {
            lines.push(`⚠️ 夺取目标「${ITEMS[lv.targetItem].name}」没有带出来（忘了拿/中途丢了）`)
          }
        }
        // 整章 3 关全部通关：才发章节专属纪念物 + 播报章节完成
        const chapterCleared = ch.levels.every(l => (save.cleared[l.id] ?? 0) > 0)
        save.rewarded = save.rewarded ?? {}
        if (chapterCleared && !save.rewarded[ch.chapter]) {
          save.rewarded[ch.chapter] = true
          const stash = loadStash()
          const item = makeItem(ch.rewardItem, 1)
          const ov = addToStash(stash, [item])
          uiState.stash = stash
          lines.push(ov === 0
            ? `🎁 章节专属纪念物「${ITEMS[ch.rewardItem].name}」已入仓库（只此一家！）`
            : `🎁 章节专属纪念物「${ITEMS[ch.rewardItem].name}」（仓库已满，请清理后再刷）`)
          lines.push(`📜 ${ch.title} —— 全部通关！${ch.boss} 的故事落幕了`)
        }
        saveCampaign(save)
      } else {
        lines.push(extracted ? '⚠️ 你撤离了，但没有完成夺取目标——战役失败' : '💀 你阵亡了——战役失败')
      }
      uiState.resultOpen = false
      uiState.campResult = { win, title: `${ch.icon} ${lv.name}`, lines }
      notify()
      return
    }
    // 第二步：结算与入库（任何失败都不影响回主页）
    try {
      const grids = extracted ? [this.backpack, this.safebox] : [this.safebox]
      const items: { name: string; rarity: string; value: number; count: number }[] = []
      let total = 0
      for (const g of grids) {
        for (const p of g.placed) {
          const def = defOf(p.item)
          const v = itemValue(def, p.item.rarity) * p.item.count
          total += v
          items.push({ name: def.name, rarity: p.item.rarity, value: v, count: p.item.count })
        }
      }
      items.sort((a, b) => b.value - a.value)
      uiState.resultItems = items
      uiState.resultValue = total
      // 带出的物资全部入仓库（含穿在身上的护甲）
      const stash = loadStash()
      const carried = grids.flatMap(g => g.placed.map(p => p.item))
      if (extracted) {
        if (this.vest) carried.push(this.vest)
        if (this.helmet) carried.push(this.helmet)
      }
      // 战术装备未使用：返还仓库；用了就没了（消耗品化）
      if (this.tacBrought && !uiState.tacUsed && uiState.tacticalDef) {
        carried.push(makeItem(uiState.tacticalDef, 1))
      }
      this.tacBrought = false
      uiState.resultOverflow = addToStash(stash, carried)
      uiState.stash = stash
      if (extracted && total > uiState.best) {
        uiState.best = total
        try { localStorage.setItem('mojin_best', String(total)) } catch { /* 忽略 */ }
      }
      // ============ 赛季任务结算 ============
      const season = loadSeason()
      const rarityCount = (rs: string[]) => items.filter(it => rs.includes(it.rarity)).reduce((a, it) => a + it.count, 0)
      const raidStats = {
        kills: this.kills,
        bossKills: this.raidBossKills,
        extracted,
        raidValue: total,
        searches: this.raidSearches,
        doorsOpened: this.raidDoors,
        purplePlus: rarityCount(['purple', 'cyan', 'red']),
        cyanPlus: rarityCount(['cyan', 'red']),
        redPlus: rarityCount(['red']),
        themeActions: this.themeActions,
        scouts: this.raidScouts,
      }
      const qres = recordRaid(season, raidStats)
      const lines: string[] = []
      let rewardSum = 0
      for (const q of qres.completed) {
        rewardSum += q.reward
        lines.push(`${q.main ? '📕' : '📗'} ${q.icon} ${q.name} 完成 +${q.reward} 金币`)
      }
      if (rewardSum > 0) {
        uiState.money += rewardSum
        saveMoney(uiState.money)
      }
      if (qres.newPhase) lines.push(`🎉 赛季第 ${qres.newPhase} 阶段已解锁！`)
      if (qres.safeUp) lines.push(`🔓 保险箱扩容至 ${SAFE_CELLS[qres.safeUp]} 格！`)
      if (uiState.highRisk) lines.push(extracted ? '☠️ 高危禁区：成功撤离禁区，荣耀加身！' : '☠️ 高危禁区：陨落禁区，死亡惩罚不变')
      // ============ Boss 专属图鉴登记 ============
      const bossGot = loadBossDrops()
      for (const d of BOSS_DROPS) {
        if (bossGot[d.defId]) continue
        if (items.some(it => it.name === ITEMS[d.defId].name)) {
          bossGot[d.defId] = true
          const n = BOSS_DROPS.filter(x => bossGot[x.defId]).length
          lines.push(`🌟 首次带回「${ITEMS[d.defId].name}」！Boss 图鉴 ${n}/${BOSS_DROPS.length}`)
        }
      }
      saveBossDrops(bossGot)
      // ============ 地图专属任务奖励 ============
      const mission = MAP_MISSIONS[this.world.mapId]
      if (this.missionDone && extracted) {
        uiState.money += mission.reward
        saveMoney(uiState.money)
        lines.push(`🎯 地图专属任务「${mission.name}」完成 +${mission.reward} 金币`)
      }
      // ============ 干员经验 ============
      const gained = xpForRaid(raidStats)
      if (gained > 0) {
        const op = this.currentOp()
        const xpMap = loadOpXp()
        const oldLv = opLevel(xpMap[op.id] ?? 0)
        xpMap[op.id] = (xpMap[op.id] ?? 0) + gained
        saveOpXp(xpMap)
        uiState.opXp = xpMap
        const newLv = opLevel(xpMap[op.id])
        lines.push(newLv > oldLv
          ? `✨ ${op.name} 经验 +${gained}，升级 Lv.${oldLv} → Lv.${newLv}！技能增强！`
          : `✨ ${op.name} 经验 +${gained}（当前 Lv.${newLv}）`)
      }
      // ============ 生涯统计 + 成就 ============
      const stats = recordCareer(loadStats(), {
        extracted, kills: this.kills, bossKills: this.raidBossKills,
        missionDone: this.missionDone, searches: this.raidSearches,
        raidValue: total, night: uiState.night, highRisk: uiState.highRisk,
      })
      void stats
      // ============ 赛季通行证经验 ============
      if (gained > 0) {
        const bp = loadBp()
        const lvres = gainBpXp(bp, gained)
        if (lvres.after > lvres.before) {
          lines.push(lvres.after >= BP_MAX_LV
            ? `🎫 通行证经验 +${gained}，已满级 Lv.${BP_MAX_LV}！`
            : `🎫 通行证经验 +${gained}，升级 Lv.${lvres.before} → Lv.${lvres.after}！`)
        }
      }
      // ============ 新手教学奖励 ============
      if (uiState.tutorial) {
        uiState.tutorial = false
        localStorage.setItem('mojin_tutorial_done', '1')
        if (extracted) {
          uiState.money += 1000
          saveMoney(uiState.money)
          lines.push('🎓 教学完成奖励 +1000 金币')
        }
      }
      // ============ 求购单到货 ============
      const arrived = arriveOrders()
      if (arrived > 0) lines.push(`📦 ${arrived} 张求购单已到货，去交易行「求购」领取`)
      uiState.resultQuests = lines
      notify()
    } catch (err) {
      console.error('结算入库失败', err)
    }
    try { extracted ? sfx.extract() : sfx.dead() } catch { /* 忽略 */ }
  }

  // ================= 主循环 =================
  private playerCollide(x: number, z: number): boolean {
    const r = 0.45
    const feet = this.pos.y - EYE
    for (const c of this.world.colliders) {
      // 只挡当前高度范围内的墙：脚底低于墙体顶部、头顶高于墙体底部
      if (feet >= c.top - 0.25 || feet + 1.7 <= (c.base ?? 0)) continue
      if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) return true
    }
    for (const d of this.world.doors) {
      if (d.open) continue
      if (Math.abs(feet - d.base) > 2.4) continue
      const cos = Math.abs(Math.cos(d.rot)), sin = Math.abs(Math.sin(d.rot))
      const ex = cos * d.w / 2 + sin * 0.1, ez = sin * d.w / 2 + cos * 0.1
      if (x + r > d.x - ex && x - r < d.x + ex && z + r > d.z - ez && z - r < d.z + ez) return true
    }
    return false
  }

  /** 玩家身上（背包/保险箱）是否有某房卡 */
  private hasCard(defId: string): boolean {
    for (const g of [this.backpack, this.safebox]) {
      for (const p of g.placed) if (p.item.defId === defId) return true
    }
    return false
  }

  /** (x,z) 处的地面高度：不高于 feet+step 的最高可行走面，默认地面 0 */
  /** 武装押运主题：惊动全图敌人 */
  private alertAllEnemies() {
    if (this.convoyAlerted) return
    this.convoyAlerted = true
    for (const e of this.enemies.enemies) {
      if (e.dead) continue
      e.state = 'chase'
      e.lastSeen.copy(this.pos)
      e.alertT = 15
    }
    this.toast('🚨 押运警报！全图敌人被惊动，正在向你包抄！', 'red')
    uiState.killFeed = ['🚨 押运警报：全图敌人被惊动', ...uiState.killFeed].slice(0, 4)
    notify()
  }

  /** 局内随机事件触发器 */
  private fireRaidEvent(id: 'supplyRain' | 'elitePatrol' | 'gasLeak' | 'convoy') {
    const W = this.world
    const R = W.size - 25
    if (id === 'supplyRain') {
      // 空投雨：一次落 3 个空投在全图随机位置
      for (let i = 0; i < 3; i++) {
        const x = (Math.random() - 0.5) * 2 * R
        const z = (Math.random() - 0.5) * 2 * R
        const y = this.groundHeightAt(x, z, 10)
        spawnAirDrop(W, x, z, y)
        W.mapMarkers.push({ x, z, kind: 'airdrop', name: '空投' })
      }
      this.toast('🪂 空投雨！3 个空投已落在全图随机位置（看地图 M）', 'cyan')
      uiState.killFeed = ['🪂 空投雨：3 个空投落地', ...uiState.killFeed].slice(0, 4)
      try { sfx.extract() } catch { /* 忽略 */ }
    } else if (id === 'elitePatrol') {
      // 精英巡逻队：4 人精英小队中途入场，沿主路巡逻，掉军用物资
      const edge = Math.random() < 0.5 ? -R : R
      const px = edge * (Math.random() < 0.5 ? 1 : 0.2)
      const pz = edge * (Math.random() < 0.5 ? 0.2 : 1)
      const kinds = ['heavy', 'grenadier', 'scout', 'normal'] as const
      for (let i = 0; i < 4; i++) {
        const p = new THREE.Vector3(px + (i % 2) * 2.5, 0, pz + Math.floor(i / 2) * 2.5)
        p.y = this.groundHeightAt(p.x, p.z, 10)
        this.enemies.spawn(p, 2, { name: '🎖️ 精英巡逻兵', kind: kinds[i], patrolRadius: 30, hp: 160, dmg: 12, acc: 0.2, fireGap: 0.7 })
      }
      W.mapMarkers.push({ x: px, z: pz, kind: 'patrol', name: '精英巡逻队' })
      this.toast('🎖️ 一支精英巡逻队入场！装备精良，掉落军用物资', 'red')
      uiState.killFeed = ['🎖️ 精英巡逻队入场', ...uiState.killFeed].slice(0, 4)
    } else if (id === 'convoy') {
      // 武装押运（赛季主题）：押运车队入场——卡车 + 4 名护卫，劫车得军用物资但惊动全图
      const x = (Math.random() - 0.5) * 1.2 * R
      const z = (Math.random() - 0.5) * 1.2 * R
      const y = this.groundHeightAt(x, z, 10)
      const truck = new THREE.Group()
      const cargo = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.2, 2.0),
        new THREE.MeshStandardMaterial({ color: 0x4a5240, roughness: 0.5, metalness: 0.4 }))
      cargo.position.y = 1.5
      const cab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 1.9),
        new THREE.MeshStandardMaterial({ color: 0x37402e, roughness: 0.45, metalness: 0.5 }))
      cab.position.set(2.8, 1.1, 0)
      truck.add(cargo, cab)
      truck.position.set(x, y, z)
      truck.rotation.y = Math.random() * Math.PI * 2
      truck.traverse(o => { o.castShadow = true })
      truck.userData.containerId = `cv${Date.now()}`
      this.world.scene.add(truck)
      this.world.containers.push({
        id: truck.userData.containerId as string, mesh: truck, pos: new THREE.Vector3(x, y + 0.8, z),
        grid: makeGrid(6, 4), searched: false, title: '军用押运车', luck: 2, tag: 'convoy',
      })
      const kinds = ['heavy', 'heavy', 'grenadier', 'scout'] as const
      for (let i = 0; i < 4; i++) {
        const p = new THREE.Vector3(x + Math.cos(i * 1.57) * 3, 0, z + Math.sin(i * 1.57) * 3)
        p.y = this.groundHeightAt(p.x, p.z, 10)
        this.enemies.spawn(p, 2, { name: '🚚 押运护卫', kind: kinds[i], patrolRadius: 6, hp: 180, dmg: 12, acc: 0.2, fireGap: 0.7 })
      }
      W.mapMarkers.push({ x, z, kind: 'patrol', name: '押运车队' })
      this.toast('🚚 武装押运车队入场！劫车可得军用物资——但会惊动全图敌人', 'cyan')
      uiState.killFeed = ['🚚 押运车队入场', ...uiState.killFeed].slice(0, 4)
    } else {
      // 毒气泄漏：随机区域变黄区，持续掉血但容器出货率 ×2
      const x = (Math.random() - 0.5) * 1.4 * R
      const z = (Math.random() - 0.5) * 1.4 * R
      const y = this.groundHeightAt(x, z, 10)
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(22, 22, 8, 24, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xd8c81e, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }))
      mesh.position.set(x, y + 4, z)
      W.scene.add(mesh)
      this.gasZones.push({ x, z, r: 22, mesh })
      W.mapMarkers.push({ x, z, kind: 'gas', name: '毒气区' })
      this.toast('☣️ 毒气泄漏！黄区内持续掉血，但容器出货率 ×2', 'red')
      uiState.killFeed = ['☣️ 毒气泄漏：黄区出货率 ×2', ...uiState.killFeed].slice(0, 4)
    }
    notify()
  }

  private groundHeightAt(x: number, z: number, feet: number): number {
    let best = 0
    let local = -Infinity // 脚下就近面（含向地下延伸的坡道与地下层，可低于默认地面 0）
    const limit = feet + 0.55 // 台阶容差
    for (const w of this.world.walkables) {
      if (x < w.minX || x > w.maxX || z < w.minZ || z > w.maxZ) continue
      let y: number
      if (!w.axis || w.y0 === w.y1) y = w.y0
      else {
        const t = w.axis === 'x' ? (x - w.minX) / (w.maxX - w.minX) : (z - w.minZ) / (w.maxZ - w.minZ)
        y = w.y0 + THREE.MathUtils.clamp(t, 0, 1) * (w.y1 - w.y0)
      }
      if (y > limit) continue
      if (y > best) best = y
      if (y >= feet - 0.55 && y > local) local = y // 就近面优先：沿坡道可一路走下地下
    }
    return local > -Infinity ? local : best
  }

  private loop() {
    if (this.disposed) return
    requestAnimationFrame(this.loop)
    try {
      this.tick()
    } catch (err) {
      // 单帧异常不冻结游戏
      console.error('帧错误', err)
    }
  }

  private tick() {
    const rawDt = this.clock.getDelta()
    const dt = Math.min(rawDt, 0.05)

    if (uiState.phase === 'playing' && this.running) {
      // 移动（键鼠或触屏）
      const inputActive = (this.locked || this.isTouch) && !uiState.invOpen
      if (inputActive) {
        const sprint = this.sprinting || this.mSprint
        // 冰湖减速区
        let slowMul = 1
        let onIce = false
        for (const zn of this.world.slowZones) {
          if (Math.hypot(this.pos.x - zn.x, this.pos.z - zn.z) < zn.r) { slowMul = 0.55; onIce = true; break }
        }
        if (onIce !== this.inLake) {
          this.inLake = onIce
          if (onIce) this.toast('🧊 冰面湿滑，移动减速！', 'cyan')
        }
        const canSprint = this.weightTier < 3
        const sprintNow = sprint && canSprint
        const speed = (sprintNow ? (this.weightTier === 2 ? 7 : 8.5) : 5.2) * (this.ads ? 0.5 : 1) * this.opMods.speed * slowMul * (this.rallyT > 0 ? 1.2 : 1) * this.weightSpeedMul()
        const f = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw))
        const r = new THREE.Vector3(-f.z, 0, f.x)
        const move = new THREE.Vector3()
        if (this.keys.has('w')) move.add(f)
        if (this.keys.has('s')) move.sub(f)
        if (this.keys.has('d')) move.add(r)
        if (this.keys.has('a')) move.sub(r)
        // 触屏摇杆
        if (this.mMove.x !== 0 || this.mMove.y !== 0) {
          move.add(f.clone().multiplyScalar(-this.mMove.y))
          move.add(r.clone().multiplyScalar(this.mMove.x))
        }
        if (move.lengthSq() > 0) {
          if (move.lengthSq() > 1) move.normalize()
          move.multiplyScalar(speed * dt)
          const nx = this.pos.x + move.x
          const nz = this.pos.z + move.z
          if (!this.playerCollide(nx, this.pos.z)) this.pos.x = nx
          if (!this.playerCollide(this.pos.x, nz)) this.pos.z = nz
        }
        // 垂直：楼梯上行 / 悬空下落
        {
          const feet = this.pos.y - EYE
          const target = this.groundHeightAt(this.pos.x, this.pos.z, feet)
          if (target >= feet - 0.001) {
            if (target > feet) { this.pos.y = target + EYE; this.vy = 0 } // 步上台阶/坡道
            else if (this.vy !== 0) { // 空中落回同高度面
              this.vy -= 26 * dt
              const nf = feet + this.vy * dt
              if (nf <= target) { this.pos.y = target + EYE; this.vy = 0 } else this.pos.y = nf + EYE
            }
          } else {
            this.vy -= 26 * dt
            const nf = feet + this.vy * dt
            if (nf <= target) { this.pos.y = target + EYE; this.vy = 0 } else this.pos.y = nf + EYE
          }
        }
        // 连发（触屏下半自动也允许按住连发）
        if (this.firing && (this.gunDef.auto || this.isTouch)) this.tryShoot()
      }

      // 换弹完成
      if (this.reloading && performance.now() >= this.reloadEnd) {
        this.reloading = false
        this.mag = this.effGun().mag
        this.consumeAmmo()
        this.tutReloaded = true
        this.syncGunUI()
      }

      this.refreshWeight(dt)
      // ===== 新手教学步进 =====
      if (uiState.tutorial) {
        if (uiState.tutorialStep === 0) {
          this.tutMoveDist += this.pos.distanceTo(this.lastTutPos)
          if (this.tutMoveDist > 8) { uiState.tutorialStep = 1; this.toast('✅ 很好！现在去找一个容器搜索物资', 'green'); notify() }
        } else if (uiState.tutorialStep === 1 && this.raidSearches > 0) {
          uiState.tutorialStep = 2; this.toast('✅ 搜到了！装备背包里的 P92，然后按 R 换弹', 'green'); notify()
        } else if (uiState.tutorialStep === 2 && this.tutReloaded) {
          uiState.tutorialStep = 3; this.toast('✅ 换弹完成！把一件物资拖进保险箱（死亡也能带出）', 'green'); notify()
        } else if (uiState.tutorialStep === 3 && this.safebox.placed.length > 0) {
          uiState.tutorialStep = 4; this.toast('✅ 最后一步：前往撤离点，站着别动等读条！', 'green'); notify()
        }
        this.lastTutPos.copy(this.pos)
      }
      // 伤害数字：上升淡出
      for (let i = this.dmgNums.length - 1; i >= 0; i--) {
        const d = this.dmgNums[i]
        d.life -= dt
        d.sprite.position.y += dt * 1.2
        d.sprite.material.opacity = Math.max(0, d.life / 0.7)
        if (d.life <= 0) { this.world.scene.remove(d.sprite); this.dmgNums.splice(i, 1) }
      }
      // 掷弹兵手雷：飞行 → 爆炸
      for (let i = this.grenades.length - 1; i >= 0; i--) {
        const g = this.grenades[i]
        g.t -= dt
        const p = 1 - Math.max(0, g.t) / 1.2
        g.mesh.position.lerpVectors(g.from, g.target, p)
        g.mesh.position.y += Math.sin(p * Math.PI) * 3
        if (g.t <= 0) {
          this.world.scene.remove(g.mesh)
          this.grenades.splice(i, 1)
          this.spawnSpark(g.target, 0xff7a3c)
          sfx.boom()
          const d = this.pos.distanceTo(g.target)
          if (d < 5 && this.hp > 0) {
            this.hp -= 35 * (1 - d / 5)
            uiState.hp = Math.max(0, this.hp)
            uiState.damageFlash = performance.now()
            sfx.hurt()
            notify()
            if (this.hp <= 0) { uiState.hp = 0; this.endRaid(false); return }
          }
        }
      }
      // 搜索进度
      if (this.searchTarget) {
        const d = this.searchTarget.pos.distanceTo(this.pos)
        if (d > 4.2 || uiState.invOpen) {
          this.searchTarget = null
          this.searchT = -1
          uiState.searching = -1
        } else {
          this.searchT += dt / (2.2 / this.opMods.search)
          uiState.searching = Math.min(1, this.searchT)
          if (this.searchT >= 1) {
            this.fillContainer(this.searchTarget)
            this.openLoot(this.searchTarget)
            this.searchTarget = null
            this.searchT = -1
            uiState.searching = -1
          }
        }
      }

      // 撤离（用真实时间，避免低帧率下变慢；半径略大于光圈）
      const distExtract = Math.hypot(this.pos.x - this.world.extractPos.x, this.pos.z - this.world.extractPos.z)
      const sameLevel = Math.abs((this.pos.y - EYE) - this.world.extractPos.y) < 2.5
      const ep2 = uiState.highRisk ? undefined : this.world.extractPos2 // 第二撤离点（沙海古城地下暗河）；高危禁区：撤离点减半
      const distExtract2 = ep2 ? Math.hypot(this.pos.x - ep2.x, this.pos.z - ep2.z) : Infinity
      const sameLevel2 = ep2 ? Math.abs((this.pos.y - EYE) - ep2.y) < 2.5 : false
      if ((distExtract < 6.2 && sameLevel) || (distExtract2 < 6.2 && sameLevel2)) {
        this.extractT += rawDt / ((uiState.highRisk ? 7 : 4) / this.opMods.extract) // 高危禁区：撤离读条 +3 秒
        uiState.extractProgress = Math.min(1, this.extractT)
        if (this.extractT >= 1) { uiState.extractProgress = -1; this.endRaid(true) }
      } else {
        this.extractT = 0
        if (uiState.extractProgress >= 0) uiState.extractProgress = -1
      }

      // ===== 战役阶段推进：潜入（接近目标区）→ 夺取（找到目标箱）→ 撤离 =====
      if (this.camp && this.campStage === 0 && this.world.bossSpawns.length) {
        const bp = this.world.bossSpawns[0].pos
        if (Math.hypot(this.pos.x - bp.x, this.pos.z - bp.z) < 12 && Math.abs((this.pos.y - EYE) - bp.y) < 3) {
          this.campStage = 1
          uiState.campObj = this.camp.stageText[1]
          // 在 Boss 旁放下剧情目标箱
          const ox = bp.x + 2.5, oz = bp.z + 1
          const oy = this.groundHeightAt(ox, oz, bp.y)
          const g = new THREE.Group()
          const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 0.6),
            new THREE.MeshStandardMaterial({ color: 0x6a5a20, roughness: 0.35, metalness: 0.7, emissive: 0x4a3a00, emissiveIntensity: 0.5 }))
          body.position.y = 0.28
          const band = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.12, 0.64),
            new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.3, metalness: 0.9 }))
          band.position.y = 0.42
          g.add(body, band)
          g.position.set(ox, oy, oz)
          g.userData.containerId = `camp${Date.now()}`
          this.world.scene.add(g)
          this.campObjCrate = {
            id: g.userData.containerId as string, mesh: g, pos: new THREE.Vector3(ox, oy + 0.8, oz),
            grid: makeGrid(3, 3), searched: false, title: '剧情目标', luck: 0, tag: 'campObj',
          }
          this.world.containers.push(this.campObjCrate)
          this.world.mapMarkers.push({ x: ox, z: oz, kind: 'mission', name: '剧情目标' })
          this.toast(this.camp.stageText[1], 'cyan')
          sfx.extract()
          notify()
        }
      }

      // 时间
      this.raidLeft -= rawDt
      if (this.raidLeft <= 0) { this.endRaid(false) }
      // 沙海古城：开局 8 分钟后沙暴来袭——地表能见度骤降且持续掉血，墓道内安全
      if (this.world.mapId === 'desert' && !this.stormOn && RAID_SECONDS - this.raidLeft >= 480) {
        this.stormOn = true
        const fog = this.world.scene.fog as THREE.Fog | null
        if (fog) { fog.near = 3; fog.far = 20; fog.color.setHex(0xc79a55) }
        this.world.scene.background = new THREE.Color(0xc79a55)
        try { sfx.windStart() } catch { /* 忽略 */ }
        this.toast('🌪️ 沙暴来袭！地表能见度骤降且持续受伤——躲进墓道或尽快撤离！', 'red')
        notify()
      }
      if (this.stormOn) {
        const feetNow = this.pos.y - EYE
        if (feetNow > -2) { // 只有地表（非地下墓道）受到沙暴伤害
          this.hp -= dt * 2
          this.stormHurtT += dt
          if (this.stormHurtT >= 1.5) { this.stormHurtT = 0; sfx.hurt() }
          if (this.hp <= 0) { this.hp = 0; uiState.hp = 0; notify(); this.endRaid(false) }
        }
      }

      // ===== 局内随机事件触发（广播 + 小地图图标） =====
      const elapsed = RAID_SECONDS - this.raidLeft
      for (const ev of this.raidEvents) {
        if (ev.fired || elapsed < ev.at) continue
        ev.fired = true
        this.fireRaidEvent(ev.id)
      }
      // 毒气泄漏：黄区内持续掉血（地下墓道不受影响）
      if (this.gasZones.length) {
        const feetNow2 = this.pos.y - EYE
        for (const gz of this.gasZones) {
          if (feetNow2 > -2 && Math.hypot(this.pos.x - gz.x, this.pos.z - gz.z) < gz.r) {
            this.hp -= dt * 3
            this.gasHurtT += dt
            if (this.gasHurtT >= 1.2) { this.gasHurtT = 0; sfx.hurt() }
            uiState.damageFlash = 1
            if (this.hp <= 0) { this.hp = 0; uiState.hp = 0; notify(); this.endRaid(false) }
            break
          }
        }
      }

      // 联机同步
      this.vsTick(dt)

      // 干员技能计时器
      if (this.skillCdT > 0) {
        this.skillCdT = Math.max(0, this.skillCdT - rawDt)
        uiState.skillCd = this.skillCdT
        if (this.skillCdT === 0) uiState.skillActive = ''
      }
      if (this.invisT > 0) this.invisT = Math.max(0, this.invisT - rawDt)
      if (this.sprayBuffT > 0) this.sprayBuffT = Math.max(0, this.sprayBuffT - rawDt)
      if (this.armorT > 0) this.armorT = Math.max(0, this.armorT - rawDt)
      if (this.rallyT > 0) this.rallyT = Math.max(0, this.rallyT - rawDt)
      // 遥控炸药：落地倒计时 → 爆炸 AoE
      if (this.charge) {
        this.charge.t -= rawDt
        const m = this.charge.mesh.material as THREE.MeshStandardMaterial
        m.emissiveIntensity = 1.5 + Math.sin(performance.now() / 60) * 1.2 // 急促闪烁
        if (this.charge.t <= 0) {
          const cp = this.charge.mesh.position.clone()
          const chargeDmg = this.charge.dmg
          this.world.scene.remove(this.charge.mesh)
          this.charge = null
          sfx.boom()
          let hit = 0
          for (const e of this.enemies.enemies) {
            if (e.dead) continue
            const d = e.group.position.distanceTo(cp)
            if (d < 8) {
              const killed = this.enemies.damage(e, chargeDmg * (e.markedT > 0 ? 1 + this.markBonus : 1))
              hit++
              if (killed) this.onEnemyKilled(e)
            }
          }
          this.toast(hit > 0 ? `💥 爆炸命中 ${hit} 个敌人！` : '💥 炸药爆炸，没炸到敌人', hit > 0 ? 'cyan' : 'white')
          this.recoilT = 1
          notify()
        }
      }
      if (this.revealT > 0 || this.droneT > 0) {
        if (this.revealT > 0) this.revealT = Math.max(0, this.revealT - rawDt)
        if (this.droneT > 0) this.droneT = Math.max(0, this.droneT - rawDt)
        // 同步敌人位置到小地图（侦察脉冲全图 / 无人机仅 30m）
        uiState.revealEnemies = this.enemies.enemies.filter(e => !e.dead)
          .filter(e => this.revealT > 0 || e.group.position.distanceTo(this.pos) <= 30)
          .map(e => ({ x: e.group.position.x, z: e.group.position.z }))
        if (this.revealT === 0 && this.droneT === 0) uiState.revealEnemies = []
      }
      // 烟雾弹：倒计时 + 消散
      let smokeHidden = false
      for (let i = this.smokes.length - 1; i >= 0; i--) {
        const sm = this.smokes[i]
        sm.t -= rawDt
        const mat = sm.mesh.material as THREE.MeshBasicMaterial
        mat.opacity = Math.min(0.55, sm.t * 0.3)
        if (Math.hypot(this.pos.x - sm.x, this.pos.z - sm.z) < sm.r) smokeHidden = true
        if (sm.t <= 0) { this.world.scene.remove(sm.mesh); this.smokes.splice(i, 1) }
      }
      // 绊雷：敌人踩中 → 爆炸 + 全图标点
      for (let i = this.mines.length - 1; i >= 0; i--) {
        const mn = this.mines[i]
        const step = this.enemies.enemies.find(e => !e.dead && !e.boss
          && Math.abs(e.group.position.y - mn.floorY) < 2.5
          && Math.hypot(e.group.position.x - mn.x, e.group.position.z - mn.z) < 1.4)
        if (!step) continue
        this.world.scene.remove(mn.mesh)
        this.mines.splice(i, 1)
        let hit = 0
        for (const e of this.enemies.enemies) {
          if (e.dead) continue
          if (Math.hypot(e.group.position.x - mn.x, e.group.position.z - mn.z) < 4.5
            && Math.abs(e.group.position.y - mn.floorY) < 3) {
            const killed = this.enemies.damage(e, 130)
            hit++
            if (killed) this.onEnemyKilled(e)
          }
        }
        this.world.mapMarkers.push({ x: mn.x, z: mn.z, kind: 'patrol', name: '绊雷爆炸' })
        this.toast(`💥 绊雷爆炸！命中 ${hit} 个敌人`, 'cyan')
        uiState.killFeed = ['💥 绊雷爆炸（已全图标点）', ...uiState.killFeed].slice(0, 4)
        this.recoilT = 1
        notify()
      }

      // 敌人
      this.enemies.update(dt, this.pos, this.hp > 0, this.world.obstacleMeshes, (dmg, from, e) => this.enemyShoot(dmg, from, e), this.world.doors,
      { onGrenade: (from, to) => {
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6),
          new THREE.MeshStandardMaterial({ color: 0x1a1a1a, emissive: 0xff3b30, emissiveIntensity: 1.5 }))
        mesh.position.copy(from)
        this.world.scene.add(mesh)
        const target = to.clone(); target.y = Math.max(0.2, to.y - 1.4)
        this.grenades.push({ mesh, target, t: 1.2, from })
        this.toast('💣 手雷！快躲开！', 'red')
      },
        seeMul: this.opMods.seeRange, invisible: this.invisT > 0 || smokeHidden }) // 烟雾内敌人失去视线
      // 补员
      this.spawnTimer -= dt
      if (this.spawnTimer <= 0 && this.enemies.aliveCount() < 7) {
        this.spawnTimer = 9
        const tier = Math.min(3, Math.floor((RAID_SECONDS - this.raidLeft) / 90))
        const rk = Math.random()
        const k = rk < 0.12 ? 'heavy' : rk < 0.22 ? 'grenadier' : rk < 0.32 ? 'scout' : 'normal'
        this.enemies.spawn(this.randomSpawnPos(50), tier + Math.floor(Math.random() * 2), { kind: k })
      }

      // 门：走近自动推开（未上锁的）；上锁的门提示刷卡
      let lockedDoorNear: Door | null = null
      {
        const feet = this.pos.y - EYE
        for (const d of this.world.doors) {
          if (Math.abs(feet - d.base) > 2.4) continue
          const dist = Math.hypot(d.x - this.pos.x, d.z - this.pos.z)
          if (!d.open && dist < 1.9 && !d.lockedBy) d.open = true // 推开
          if (!d.open && d.lockedBy && dist < 2.6) lockedDoorNear = d
        }
      }
      // 门动画
      for (const d of this.world.doors) {
        if (d.open && d.openT < 1) {
          d.openT = Math.min(1, d.openT + dt * 3)
          d.pivot.rotation.y = d.rot - d.openT * 1.85
        }
      }

      // ============ 局内专属任务：倒计时与完成 ============
      const mm2 = MAP_MISSIONS[this.world.mapId]
      if (this.missionStarted && !this.missionDone) {
        // defend：启动瞬间刷一波拦截敌人
        if (mm2.type === 'defend' && !this.missionWaveSpawned) {
          this.missionWaveSpawned = true
          const wy = mm2.objPos.floorY ?? 0 // 与目标点同层（高塔顶层/雷达楼二层也会来人）
          for (let i = 0; i < mm2.wave; i++) {
            const a = Math.random() * Math.PI * 2
            const r = 5 + Math.random() * 5
            this.enemies.spawn(new THREE.Vector3(mm2.objPos.x + Math.cos(a) * r, wy, mm2.objPos.z + Math.sin(a) * r), 1 + Math.floor(Math.random() * 2))
          }
          this.toast(`⚠️ 敌人被惊动了！${mm2.wave} 名敌人正在逼近`, 'red')
        }
        this.missionTimer -= dt
        const ceil = Math.max(0, Math.ceil(this.missionTimer))
        if (ceil !== this.missionTimerUi) { this.missionTimerUi = ceil; uiState.missionTimer = ceil; notify() }
        if (this.missionTimer <= 0) {
          this.missionDone = true
          uiState.missionDone = true
          uiState.missionTimer = -1
          // 引导光柱退场
          for (const b of this.world.missionGuides) this.world.scene.remove(b)
          // 奖励箱现身
          for (const c of this.world.containers) {
            if (!c.hidden) continue
            c.hidden = false
            c.mesh.visible = true
          }
          if (mm2.type === 'breach') {
            // 爆破：移除碎石挡板与碰撞体
            const w = this.world.missionWall
            if (w) {
              for (const m of w.meshes) this.world.scene.remove(m)
              const ci = this.world.colliders.indexOf(w.aabb)
              if (ci >= 0) this.world.colliders.splice(ci, 1)
            }
            sfx.boom()
            this.recoilT = 1 // 屏幕震动
            this.toast(`💥 破壁成功！取走物资，成功撤离后 +${mm2.reward} 金币`, 'cyan')
          } else {
            sfx.extract()
            this.toast(`🎯 任务「${mm2.name}」完成！奖励箱已解锁，成功撤离后 +${mm2.reward} 金币`, 'cyan')
          }
          notify()
        }
      }

      // 交互提示
      const near = this.nearestContainer()
      let prompt = ''
      if (!this.missionDone && !uiState.invOpen) {
        if (!this.missionAccepted && this.missionNear(mm2.acceptPos, 2.6)) prompt = `按 F 接取任务「${mm2.name}」`
        else if (mm2.type === 'lamps' && this.missionAccepted && this.world.lampStands) {
          const st = this.world.lampStands
          const un = st.find(s => !s.lit && this.missionNear({ x: s.x, z: s.z, floorY: s.floorY }, 2.2))
          if (un) prompt = `按 F 点燃长明灯（${st.filter(s => s.lit).length}/${st.length}）`
        }
        else if (this.missionAccepted && !this.missionStarted && this.missionNear(mm2.objPos, 2.8)) prompt = mm2.type === 'breach' ? '按 F 安放炸药' : '按 F 启动装置'
        else if (this.missionStarted) prompt = mm2.type === 'breach' ? `🧨 引爆中 ${Math.max(0, Math.ceil(this.missionTimer))}s……` : `🛡️ 坚守中 ${Math.max(0, Math.ceil(this.missionTimer))}s……`
      }
      if (lockedDoorNear && !uiState.invOpen && !prompt) { // 任务提示优先
        prompt = this.hasCard(lockedDoorNear.lockedBy!) ? `按 F 刷${lockedDoorNear.lockedName}开门` : `上锁了——需要【${lockedDoorNear.lockedName}】`
      }
      if (near && !uiState.invOpen && !lockedDoorNear && !prompt) { // 锁门提示优先于容器搜索提示
        prompt = near.title === '售货机' && !near.searched ? `按 F 投币 300 金币购买补给`
          : near.searched ? `按 F 打开 ${near.title}` : `按 F 搜索 ${near.title}`
      }
      if ((distExtract < 6.2 && sameLevel) || (distExtract2 < 6.2 && sameLevel2)) prompt = '正在撤离，请勿离开光圈！'
      else if ((distExtract < 12 && sameLevel) || (distExtract2 < 12 && sameLevel2)) prompt = '再走进青色光圈中心一些即可撤离'
      if (uiState.prompt !== prompt) { uiState.prompt = prompt; notify() }

      // 相机
      this.camera.position.copy(this.pos)
      this.camera.rotation.set(0, 0, 0)
      this.camera.rotateY(this.yaw)
      this.camera.rotateX(this.pitch)
      const targetFov = this.ads ? this.baseFov / this.effGun().zoom : this.baseFov
      this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 12)
      this.camera.updateProjectionMatrix()

      // 夜战手电跟随视线
      if (this.torch) {
        this.torch.position.copy(this.pos)
        const fdir = new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch))
        this.torch.target.position.copy(this.pos).add(fdir.multiplyScalar(12))
      }
      this.positionViewmodel(dt)
      this.muzzleFlash.intensity = Math.max(0, this.muzzleFlash.intensity - dt * 30)

      // 飘雪：围绕相机循环下落 + 横向风摆；雷达天线持续旋转
      if (this.snowPts && this.snowVel) {
        const attr = this.snowPts.geometry.getAttribute('position') as THREE.BufferAttribute
        const arr = attr.array as Float32Array
        const t = performance.now() / 1000
        for (let i = 0; i < this.snowVel.length; i++) {
          arr[i * 3 + 1] -= this.snowVel[i] * dt
          arr[i * 3] += Math.sin(t * 1.7 + i) * dt * 1.2
          if (arr[i * 3 + 1] < 0) {
            arr[i * 3] = this.pos.x + (Math.random() - 0.5) * 120
            arr[i * 3 + 1] = 30 + Math.random() * 10
            arr[i * 3 + 2] = this.pos.z + (Math.random() - 0.5) * 120
          }
          // 远离相机超过 70m 的拉回（跟随玩家移动）
          if (Math.abs(arr[i * 3] - this.pos.x) > 70) arr[i * 3] = this.pos.x + (Math.random() - 0.5) * 120
          if (Math.abs(arr[i * 3 + 2] - this.pos.z) > 70) arr[i * 3 + 2] = this.pos.z + (Math.random() - 0.5) * 120
        }
        attr.needsUpdate = true
      }
      if (this.radarDish) this.radarDish.rotation.y += dt * 0.6

      // 逐格揭示：到点的物品播放提示音（蓝色及以上）
      if (this.activeLoot?.reveal) {
        const ts = Date.now()
        for (const p of this.activeLoot.grid.placed) {
          const at = this.activeLoot.reveal[p.item.uid]
          if (at && at <= ts && !this.revealAnnounced.has(p.item.uid)) {
            this.revealAnnounced.add(p.item.uid)
            if (RARITY_ORDER.indexOf(p.item.rarity) >= 2) sfx.pickup(0)
          }
        }
      }

      // UI 节流同步
      const now = performance.now()
      if (now - this.lastNotify > 120) {
        this.lastNotify = now
        uiState.hp = this.hp
        uiState.mag = this.mag
        uiState.playerX = this.pos.x
        uiState.playerZ = this.pos.z
        uiState.playerYaw = this.yaw
        uiState.raidTime = Math.max(0, this.raidLeft)
        uiState.searching = this.searchTarget ? Math.min(1, this.searchT) : uiState.searching
        notify()
      }
    }

    // 特效更新
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i]
      t.life -= dt
      ;(t.line.material as THREE.LineBasicMaterial).opacity = Math.max(0, t.life / 0.08) * 0.9
      if (t.life <= 0) { this.world.scene.remove(t.line); this.tracers.splice(i, 1) }
    }
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i]
      s.life -= dt
      s.vel.y -= 9 * dt
      s.mesh.position.add(s.vel.clone().multiplyScalar(dt))
      if (s.life <= 0) { this.world.scene.remove(s.mesh); this.sparks.splice(i, 1) }
    }
    // 撤离点脉动
    if (this.world.extractMesh) {
      const m = this.world.extractMesh.material as THREE.MeshStandardMaterial
      m.opacity = 0.5 + Math.sin(performance.now() / 400) * 0.2
    }

    updateFollowShadow(this.world.sun, this.pos.x, this.pos.z, this.gfx)
    this.renderer.render(this.world.scene, this.camera)
  }

  private enemyShoot(dmg: number, from: THREE.Vector3, _e: Enemy) {
    const toPlayer = this.pos.clone().sub(from)
    const dist = toPlayer.length()
    const hitChance = THREE.MathUtils.clamp(0.75 + _e.acc - dist * (_e.boss ? 0.012 : 0.02), _e.boss ? 0.35 : 0.15, 0.7 + _e.acc)
    const hit = Math.random() < hitChance
    sfx.enemyShot()
    // 曳光：命中到玩家，未命中到附近
    const target = hit
      ? this.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3))
      : this.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 4))
    this.spawnTracer(from.clone().add(new THREE.Vector3(0, 0.2, 0)), target, 0xff6a4a)
    if (hit && this.hp > 0) {
      // 干员减伤：被动「重型装甲」+ 主动「能量护甲」
      let mul = 1 - this.opMods.reduce
      if (this.armorT > 0) mul *= 1 - effActive(this.currentOp(), this.opLv()).power
      let real = dmg * mul
      // 护甲/头盔减伤：敌人穿透（普通 1 / 重甲与 Boss 3）vs 护甲等级
      const pen = (_e.boss || _e.kind === 'heavy') ? 3 : 1
      const absorb = (gear: ItemInstance | null, chance: number) => {
        if (!gear || (gear.dur ?? 0) <= 0) return
        const def = defOf(gear)
        const lv = def.armorLv ?? 1
        if (Math.random() >= chance) return
        const full = lv >= pen ? 0.15 * lv : 0.08 * lv // 打不穿全效，打穿了减半
        real *= 1 - full
        gear.dur = Math.max(0, (gear.dur ?? def.durability ?? 50) - dmg * (pen > lv ? 0.5 : 0.35))
        if (gear.dur <= 0) { this.toast(`${def.icon} ${def.name} 耐久耗尽，碎了！`, 'red'); sfx.dead() }
        this.syncGearUI()
      }
      absorb(this.vest, 1)      // 防弹衣挡躯干（总是生效判定）
      absorb(this.helmet, 0.25) // 头盔：25% 概率判定为头部受击
      this.hp -= real
      uiState.hp = Math.max(0, this.hp)
      uiState.damageFlash = performance.now()
      sfx.hurt()
      notify()
      if (this.hp <= 0) {
        uiState.hp = 0
        this.endRaid(false)
      }
    }
  }

  run() {
    this.spawnInitialEnemies()
    this.syncGunUI()
    this.loop()
  }

  dispose() {
    try { sfx.windStop() } catch { /* 忽略 */ }
    this.disposed = true
    this.ac.abort() // 移除 bindInput 注册的全部监听
    removeEventListener('resize', this.onResize)
    document.removeEventListener('pointerlockchange', this.onLockChange)
    this.renderer.dispose()
  }
}
