import * as THREE from 'three'
import type { AABB, Door } from './world'

export type EnemyKind = 'normal' | 'heavy' | 'grenadier' | 'scout'

export interface Enemy {
  id: number
  group: THREE.Group
  hp: number
  maxHp: number
  kind: EnemyKind
  armorLv: number     // 护甲等级 0=无 1-3，需对应穿透等级子弹才能打穿
  state: 'patrol' | 'alert' | 'search' | 'chase' | 'attack'
  patrolTarget: THREE.Vector3
  fireTimer: number
  speed: number
  dmg: number
  bar: THREE.Sprite
  barBg: THREE.Sprite
  hitParts: THREE.Mesh[]
  dead: boolean
  name: string
  baseY: number      // 所在楼层地面高度
  markedT: number    // 死亡标记剩余秒数（>0 时受伤加深）
  boss: boolean
  acc: number        // 命中率加成（Boss 枪法更好）
  fireGap: number    // 开火间隔倍率（越小射速越快）
  patrolRadius: number
  stunT: number      // 震撼弹眩晕剩余时间
  alertT: number     // 警觉/搜索状态剩余时间
  lastSeen: THREE.Vector3  // 最后看到玩家的位置（搜索用）
  grenadeT: number   // 掷弹兵：手雷冷却
  calledHelp: boolean// 侦察兵：是否已呼援
}

const ENEMY_NAMES = ['猎犬', '秃鹫', '豺狼', '毒蝎', '夜枭', '铁壁', '幽灵', '狂徒', '哨兵', '游侠']

export class EnemyManager {
  enemies: Enemy[] = []
  private scene: THREE.Scene
  private colliders: AABB[]
  private nextId = 1
  private raycaster = new THREE.Raycaster()

  constructor(scene: THREE.Scene, colliders: AABB[]) {
    this.scene = scene
    this.colliders = colliders
  }

  spawn(pos: THREE.Vector3, tier = 0, opts: { boss?: boolean; name?: string; acc?: number; fireGap?: number; hp?: number; dmg?: number; speed?: number; patrolRadius?: number; armor?: number; kind?: EnemyKind; armorLv?: number } = {}) {
    const kind: EnemyKind = opts.kind ?? 'normal'
    const id = this.nextId++
    const group = new THREE.Group()
    const armorColor = opts.armor ?? (opts.boss ? 0x8a2be2 : [0x5a6b4a, 0x6b5a3a, 0x4a5a6b, 0x6b3a3a][Math.min(tier, 3)])
    const mat = new THREE.MeshStandardMaterial({ color: armorColor, roughness: 0.8 })
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x2a2d31, roughness: 0.7 })
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xc9a584, roughness: 0.9 })

    // 腿
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.8, 0.26), darkMat)
    legL.position.set(-0.16, 0.4, 0)
    const legR = legL.clone(); legR.position.x = 0.16
    // 身体
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.78, 0.36), mat)
    body.position.y = 1.18
    // 头
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), skinMat)
    head.position.y = 1.86
    head.userData.isHead = true
    // 头盔
    const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.4), darkMat)
    helmet.position.y = 2.04
    // 枪
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.85), darkMat)
    gun.position.set(0.3, 1.35, 0.4)
    // 手臂
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.5), mat)
    arm.position.set(0.28, 1.32, 0.18)

    body.userData.isBody = true
    legL.userData.isLimb = true; legR.userData.isLimb = true
    const hitParts = [body, head, legL, legR]
    for (const m of [body, head, legL, legR, helmet, gun, arm]) {
      m.castShadow = true
      group.add(m)
    }
    // 兵种外观
    if (kind === 'heavy') {
      group.scale.setScalar(1.3)                                     // 重甲兵更壮
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.12), darkMat) // 胸前护甲
      plate.position.set(0, 1.2, 0.22)
      group.add(plate)
    } else if (kind === 'grenadier') {
      const pack = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.5, 0.2), mat)      // 背后榴弹包
      pack.position.set(0, 1.2, -0.28)
      group.add(pack)
    } else if (kind === 'scout') {
      group.scale.setScalar(0.92)                                    // 侦察兵瘦小
      const goggle = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.1, 0.08),
        new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x22d3ee, emissiveIntensity: 1.5 }))
      goggle.position.set(0, 1.9, 0.18)
      group.add(goggle)
    }
    if (opts.boss) group.scale.setScalar(1.25) // Boss 更魁梧
    group.position.copy(pos)

    // 血条
    const barBg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x222222, depthTest: false }))
    barBg.scale.set(1.1, 0.09, 1)
    barBg.position.y = 2.4
    const bar = new THREE.Sprite(new THREE.SpriteMaterial({ color: opts.boss ? 0xf5c518 : 0xef4444, depthTest: false }))
    bar.scale.set(1.05, 0.06, 1)
    bar.position.y = 2.4
    group.add(barBg); group.add(bar)

    group.traverse(o => { o.userData.enemyId = id })

    let maxHp = opts.hp ?? (70 + tier * 30)
    let speed = opts.speed ?? (3.2 + tier * 0.4 + Math.random() * 0.8)
    let armorLv = opts.armorLv ?? 0
    let dmg = opts.dmg ?? (6 + tier * 3)
    if (kind === 'heavy') { maxHp = Math.round(maxHp * 2.2); speed *= 0.6; armorLv = Math.max(armorLv, 3); dmg = Math.round(dmg * 1.3) }
    else if (kind === 'grenadier') { maxHp = Math.round(maxHp * 1.2); dmg = Math.round(dmg * 0.8) }
    else if (kind === 'scout') { speed *= 1.5; maxHp = Math.round(maxHp * 0.7) }
    const patrolRadius = opts.patrolRadius ?? 20
    const kindPrefix: Record<EnemyKind, string> = { normal: '', heavy: '重甲·', grenadier: '掷弹·', scout: '侦察·' }
    const enemy: Enemy = {
      id, group, hp: maxHp, maxHp, kind, armorLv, state: 'patrol',
      patrolTarget: this.randomPoint(pos, patrolRadius), fireTimer: 1 + Math.random(),
      speed, dmg,
      bar, barBg, hitParts, dead: false,
      name: opts.name ?? (kindPrefix[kind] + ENEMY_NAMES[Math.floor(Math.random() * ENEMY_NAMES.length)] + '·' + id),
      baseY: pos.y, boss: !!opts.boss,
      acc: opts.acc ?? 0, fireGap: opts.fireGap ?? 1, patrolRadius, stunT: 0, markedT: 0,
      alertT: 0, lastSeen: pos.clone(), grenadeT: 3 + Math.random() * 3, calledHelp: false,
    }
    this.scene.add(group)
    this.enemies.push(enemy)
    return enemy
  }

  private randomPoint(center: THREE.Vector3, radius: number): THREE.Vector3 {
    const a = Math.random() * Math.PI * 2
    const r = Math.random() * radius
    const x = THREE.MathUtils.clamp(center.x + Math.cos(a) * r, -130, 130)
    const z = THREE.MathUtils.clamp(center.z + Math.sin(a) * r, -130, 130)
    return new THREE.Vector3(x, 0, z)
  }

  /** 敌人是否能看到玩家（视线不被遮挡） */
  canSee(e: Enemy, playerPos: THREE.Vector3, obstacleMeshes: THREE.Object3D[]): boolean {
    const from = e.group.position.clone()
    from.y = e.baseY + 1.6
    const to = playerPos.clone()
    to.y -= 0.12 // 玩家胸口
    const dir = to.clone().sub(from)
    const dist = dir.length()
    dir.normalize()
    this.raycaster.set(from, dir)
    this.raycaster.far = dist
    const hits = this.raycaster.intersectObjects(obstacleMeshes, false)
    return hits.length === 0
  }

  private doors: Door[] = []
  update(dt: number, playerPos: THREE.Vector3, playerAlive: boolean, obstacleMeshes: THREE.Object3D[],
    onShootPlayer: (dmg: number, from: THREE.Vector3, e: Enemy) => void, doors: Door[] = [],
    mods: { seeMul?: number; invisible?: boolean; onGrenade?: (from: THREE.Vector3, to: THREE.Vector3) => void } = {}) {
    this.doors = doors
    const seeRange = 55 * (mods.seeMul ?? 1)
    const atkRange = 26 * (mods.seeMul ?? 1)
    for (const e of this.enemies) {
      if (e.dead) continue
      // 震撼弹眩晕：不能移动/开火
      if (e.stunT > 0) {
        e.stunT -= dt
        e.group.rotation.y += dt * 0.5 // 原地打转
        continue
      }
      if (e.markedT > 0) {
        e.markedT -= dt
        // 被标记者头顶泛红光（血条染色）
        e.bar.material.color.setHex(0xff3b30)
      }
      const pos = e.group.position
      const toPlayer = playerPos.clone().sub(pos); toPlayer.y = 0
      const dist = toPlayer.length()

      const dy = Math.abs((playerPos.y - 1.62) - e.baseY) // 脚底高度差
      const scoutBonus = e.kind === 'scout' ? 1.4 : 1
      const sees = playerAlive && !mods.invisible && dist < seeRange * scoutBonus && dy < 3.0 && this.canSee(e, playerPos, obstacleMeshes)
      // 光学迷彩：隐身时敌人立即丢失目标转入搜索
      if (mods.invisible && (e.state === 'chase' || e.state === 'attack')) { e.state = 'search'; e.alertT = 5; e.lastSeen.copy(playerPos) }

      if (sees && dist < atkRange) e.state = 'attack'
      else if (sees) e.state = 'chase'
      else if (e.state === 'chase' || e.state === 'attack') {
        // 丢失目标 → 搜索最后目击位置
        e.state = 'search'
        e.alertT = 6
        e.lastSeen.copy(playerPos)
      } else if (e.state === 'alert' || e.state === 'search') {
        e.alertT -= dt
        if (e.alertT <= 0 && dist > 40) e.state = 'patrol'
      }
      // 侦察兵发现玩家：呼援（范围内同伴进入追击）
      if (e.kind === 'scout' && sees && !e.calledHelp) {
        e.calledHelp = true
        for (const o of this.enemies) {
          if (o.dead || o === e) continue
          if (o.group.position.distanceTo(pos) < 40 && Math.abs(o.baseY - e.baseY) < 3) {
            if (o.state === 'patrol' || o.state === 'alert') { o.state = 'chase'; o.lastSeen.copy(playerPos) }
          }
        }
        setTimeout(() => { e.calledHelp = false }, 20000) // 20s 后可再次呼援
      }
      // 掷弹兵：交战时朝玩家扔雷（爆炸表现由 engine 处理）
      if (e.kind === 'grenadier' && e.state === 'attack' && sees) {
        e.grenadeT -= dt
        if (e.grenadeT <= 0 && mods.onGrenade) {
          e.grenadeT = 6 + Math.random() * 2
          const from = pos.clone(); from.y = e.baseY + 1.5
          mods.onGrenade(from, playerPos.clone())
        }
      }

      let moveDir: THREE.Vector3 | null = null
      if (e.state === 'patrol') {
        const t = e.patrolTarget.clone().sub(pos); t.y = 0
        if (t.length() < 2) e.patrolTarget = this.randomPoint(pos, e.patrolRadius)
        else moveDir = t.normalize()
      } else if (e.state === 'alert') {
        // 警觉：原地转向最后听到的方向，不移动
      } else if (e.state === 'search') {
        // 搜索：走向最后目击点，到了就原地张望
        const t = e.lastSeen.clone().sub(pos); t.y = 0
        if (t.length() > 2.5) moveDir = t.normalize()
      } else if (e.state === 'chase') {
        moveDir = toPlayer.clone().normalize()
      } else if (e.state === 'attack') {
        // 环绕走位
        const strafe = new THREE.Vector3(-toPlayer.z, 0, toPlayer.x).normalize()
        const toward = toPlayer.clone().normalize()
        moveDir = strafe.multiplyScalar(Math.sin(performance.now() / 900 + e.id) > 0 ? 1 : -1)
          .add(toward.multiplyScalar(dist > 18 ? 0.7 : (dist < 10 ? -0.6 : 0)))
          .normalize()
        // 开火
        e.fireTimer -= dt
        if (e.fireTimer <= 0 && sees) {
          e.fireTimer = (0.55 + Math.random() * 0.7) * e.fireGap
          const from = pos.clone()
          from.y = e.baseY + 1.4
          onShootPlayer(e.dmg, from, e)
        }
      }

      // 面向
      const faceTarget = (e.state === 'patrol') ? e.patrolTarget : (e.state === 'search' || e.state === 'alert') ? e.lastSeen : playerPos
      const face = Math.atan2(faceTarget.x - pos.x, faceTarget.z - pos.z)
      e.group.rotation.y += (face - e.group.rotation.y) * Math.min(1, dt * 8)

      // 移动 + 碰撞
      if (moveDir) {
        const sp = e.speed * (e.state === 'attack' ? 0.75 : 1)
        const nx = pos.x + moveDir.x * sp * dt
        const nz = pos.z + moveDir.z * sp * dt
        if (!this.collide(nx, pos.z, e.baseY)) pos.x = nx
        if (!this.collide(pos.x, nz, e.baseY)) pos.z = nz
        // 走路摆动
        e.group.position.y = e.baseY + Math.abs(Math.sin(performance.now() / 180 + e.id)) * 0.05
      }

      // 血条朝向与比例
      const ratio = Math.max(0, e.hp / e.maxHp)
      e.bar.scale.x = 1.05 * ratio
      e.bar.position.x = -(1.05 * (1 - ratio)) / 2
    }
  }

  private collide(x: number, z: number, feet = 0): boolean {
    const r = 0.4
    for (const c of this.colliders) {
      if (feet >= c.top - 0.25 || feet + 1.7 <= (c.base ?? 0)) continue
      if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) return true
    }
    for (const d of this.doors) {
      if (d.open || Math.abs(feet - d.base) > 2.4) continue
      const cos = Math.abs(Math.cos(d.rot)), sin = Math.abs(Math.sin(d.rot))
      const ex = cos * d.w / 2 + sin * 0.1, ez = sin * d.w / 2 + cos * 0.1
      if (x + r > d.x - ex && x - r < d.x + ex && z + r > d.z - ez && z - r < d.z + ez) return true
    }
    return false
  }

  /** 命中检测（只检测身体部件，避开 Sprite 血条），返回 {enemy, zone, isHead, point} */
  raycast(origin: THREE.Vector3, dir: THREE.Vector3, far: number): { enemy: Enemy; zone: 'head' | 'body' | 'limb'; isHead: boolean; point: THREE.Vector3 } | null {
    this.raycaster.set(origin, dir)
    this.raycaster.far = far
    const parts: THREE.Mesh[] = []
    for (const e of this.enemies) if (!e.dead) parts.push(...e.hitParts)
    const hits = this.raycaster.intersectObjects(parts, false)
    for (const h of hits) {
      const id = h.object.userData.enemyId
      if (!id) continue
      const enemy = this.enemies.find(e => e.id === id && !e.dead)
      if (!enemy) continue
      const zone: 'head' | 'body' | 'limb' = h.object.userData.isHead ? 'head' : h.object.userData.isLimb ? 'limb' : 'body'
      return { enemy, zone, isHead: zone === 'head', point: h.point }
    }
    return null
  }

  /** 听到枪声：半径内敌人进入警觉/搜索（面朝声源） */
  alertAt(pos: THREE.Vector3, radius: number, floorY: number) {
    for (const e of this.enemies) {
      if (e.dead || e.state === 'attack' || e.state === 'chase') continue
      if (Math.abs(e.baseY - floorY) > 3) continue
      const d = e.group.position.distanceTo(pos)
      if (d < radius) {
        e.state = d < radius * 0.5 ? 'search' : 'alert'
        e.alertT = 4 + Math.random() * 2
        e.lastSeen.copy(pos)
      }
    }
  }

  damage(e: Enemy, dmg: number): boolean {
    e.hp -= dmg
    const ratio = Math.max(0, e.hp / e.maxHp)
    e.bar.scale.x = 1.05 * ratio
    if (e.hp <= 0 && !e.dead) {
      e.dead = true
      return true
    }
    // 受击后警觉
    e.state = 'chase'
    return false
  }

  remove(e: Enemy) {
    this.scene.remove(e.group)
    this.enemies = this.enemies.filter(x => x !== e)
  }

  clear() {
    for (const e of this.enemies) this.scene.remove(e.group)
    this.enemies = []
  }

  aliveCount() { return this.enemies.filter(e => !e.dead).length }
}
