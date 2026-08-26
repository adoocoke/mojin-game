import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";

/**
 * 联机对战/组队房间（内存态，房间随对局结束自动过期）
 * - 房主 create 得链接 → 好友 join 时选择模式（pvp 对战 / coop 组队）
 * - 局内 sync：客户端每 ~150ms 上报自己的位置/血量/武器，换取对手状态与新事件
 * - hit：我命中对手时上报伤害事件，对方客户端收事件扣血；dead 状态经 sync 广播
 */

export interface PlayerState {
  id: string;
  name: string;
  x: number; y: number; z: number; yaw: number;
  hp: number; gun: string; dead: boolean;
  ts: number; // 上次上报时间
}

export interface VsEvent {
  id: number;
  type: "hit" | "join" | "start";
  from: string;
  to?: string;
  dmg?: number;
  ts: number;
}

interface Room {
  id: string;
  hostId: string;
  mode: "pvp" | "coop";
  mapId: string;
  ai: boolean;
  maxPlayers: number;
  started: boolean;
  players: Map<string, PlayerState>;
  events: VsEvent[];
  nextEventId: number;
  lastActive: number;
}

const rooms = new Map<string, Room>();

const rid = (n: number) => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
};

const touch = (r: Room) => { r.lastActive = Date.now(); };

/** Drop idle rooms on the next request — no module-level timers (serverless / build-safe). */
function gcRooms() {
  const now = Date.now();
  for (const [id, r] of rooms) if (now - r.lastActive > 10 * 60 * 1000) rooms.delete(id);
}

const snapshot = (r: Room, sinceId: number) => ({
  mode: r.mode,
  mapId: r.mapId,
  ai: r.ai,
  maxPlayers: r.maxPlayers,
  started: r.started,
  hostId: r.hostId,
  players: [...r.players.values()].filter(p => Date.now() - p.ts < 15000), // 15s 无心跳视为离线
  events: r.events.filter(e => e.id > sinceId).slice(-50),
});

export const versusRouter = createRouter({
  /** 建房：返回房间号与我的玩家 id */
  create: publicQuery
    .input(z.object({
      name: z.string().min(1).max(12),
      mode: z.enum(["pvp", "coop"]).default("coop"),
      mapId: z.string().default("wild"),
      ai: z.boolean().default(true),
      maxPlayers: z.number().min(2).max(6).default(2),
    }))
    .mutation(({ input }) => {
      gcRooms();
      const roomId = rid(6);
      const playerId = rid(8);
      const me: PlayerState = { id: playerId, name: input.name, x: 0, y: 0, z: 0, yaw: 0, hp: 100, gun: "", dead: false, ts: Date.now() };
      const room: Room = {
        id: roomId, hostId: playerId, mode: input.mode, mapId: input.mapId,
        ai: input.ai, maxPlayers: input.maxPlayers,
        started: false, players: new Map([[playerId, me]]), events: [], nextEventId: 1, lastActive: Date.now(),
      };
      rooms.set(roomId, room);
      return { roomId, playerId };
    }),

  /** 加入：好友选模式（pvp 对战 / coop 组队），进房即定局 */
  join: publicQuery
    .input(z.object({ roomId: z.string(), name: z.string().min(1).max(12) }))
    .mutation(({ input }) => {
      gcRooms();
      const r = rooms.get(input.roomId.toUpperCase());
      if (!r) return { ok: false as const, error: "房间不存在或已过期" };
      if (r.started) return { ok: false as const, error: "对局已开始" };
      if (r.players.size >= r.maxPlayers) return { ok: false as const, error: "房间已满" };
      const playerId = rid(8);
      const me: PlayerState = { id: playerId, name: input.name, x: 0, y: 0, z: 0, yaw: 0, hp: 100, gun: "", dead: false, ts: Date.now() };
      r.players.set(playerId, me);
      r.events.push({ id: r.nextEventId++, type: "join", from: playerId, ts: Date.now() });
      touch(r);
      return { ok: true as const, playerId, hostName: [...r.players.values()].find(p => p.id === r.hostId)?.name ?? "房主" };
    }),

  /** 房主开始 */
  start: publicQuery
    .input(z.object({ roomId: z.string(), playerId: z.string() }))
    .mutation(({ input }) => {
      const r = rooms.get(input.roomId.toUpperCase());
      if (!r || r.hostId !== input.playerId) return { ok: false as const };
      r.started = true;
      r.events.push({ id: r.nextEventId++, type: "start", from: input.playerId, ts: Date.now() });
      touch(r);
      return { ok: true as const };
    }),

  /** 心跳/拉取（大厅等待时） */
  state: publicQuery
    .input(z.object({ roomId: z.string(), playerId: z.string(), sinceId: z.number().default(0) }))
    .query(({ input }) => {
      gcRooms();
      const r = rooms.get(input.roomId.toUpperCase());
      if (!r) return { ok: false as const };
      const me = r.players.get(input.playerId);
      if (me) me.ts = Date.now();
      touch(r);
      return { ok: true as const, ...snapshot(r, input.sinceId) };
    }),

  /** 局内同步：上报我的状态，换取房间快照 */
  sync: publicQuery
    .input(z.object({
      roomId: z.string(), playerId: z.string(),
      x: z.number(), y: z.number(), z: z.number(), yaw: z.number(),
      hp: z.number(), gun: z.string(), dead: z.boolean(),
      sinceId: z.number().default(0),
    }))
    .mutation(({ input }) => {
      const r = rooms.get(input.roomId.toUpperCase());
      if (!r) return { ok: false as const };
      const me = r.players.get(input.playerId);
      if (!me) return { ok: false as const };
      me.x = input.x; me.y = input.y; me.z = input.z; me.yaw = input.yaw;
      me.hp = input.hp; me.gun = input.gun; me.dead = input.dead;
      me.ts = Date.now();
      touch(r);
      return { ok: true as const, ...snapshot(r, input.sinceId) };
    }),

  /** 我命中对手 */
  hit: publicQuery
    .input(z.object({ roomId: z.string(), playerId: z.string(), targetId: z.string(), dmg: z.number() }))
    .mutation(({ input }) => {
      const r = rooms.get(input.roomId.toUpperCase());
      if (!r) return { ok: false as const };
      r.events.push({ id: r.nextEventId++, type: "hit", from: input.playerId, to: input.targetId, dmg: input.dmg, ts: Date.now() });
      if (r.events.length > 200) r.events.splice(0, r.events.length - 200);
      touch(r);
      return { ok: true as const };
    }),

  /** 退房 */
  leave: publicQuery
    .input(z.object({ roomId: z.string(), playerId: z.string() }))
    .mutation(({ input }) => {
      const r = rooms.get(input.roomId.toUpperCase());
      if (r) {
        r.players.delete(input.playerId);
        if (r.players.size === 0) rooms.delete(input.roomId.toUpperCase());
      }
      return { ok: true as const };
    }),
});
