import { createTRPCClient, httpBatchLink } from '@trpc/client'
import superjson from 'superjson'
import type { AppRouter } from '@/api/router'

/** 联机 tRPC 客户端（非 React 环境直接用 vanilla client） */
export const vsClient = createTRPCClient<AppRouter>({
  links: [httpBatchLink({ url: '/api/trpc', transformer: superjson })],
})

export interface VsSession {
  roomId: string
  playerId: string
  mode: 'pvp' | 'coop'
  mapId: string
  ai: boolean                 // 房间规则：是否刷 AI 敌人
  isHost: boolean
  players: { id: string; name: string }[]  // 开局时的房间成员
}

export interface RemoteState {
  id: string; name: string
  x: number; y: number; z: number; yaw: number
  hp: number; gun: string; dead: boolean; ts: number
}

/** 从 URL 读取房间号（好友分享的链接） */
export function roomFromUrl(): string | null {
  if (typeof window === 'undefined') return null
  const m = new URLSearchParams(window.location.search).get('room')
  return m ? m.toUpperCase() : null
}

export function roomShareUrl(roomId: string): string {
  if (typeof window === 'undefined') return `?room=${roomId}`
  return `${window.location.origin}${window.location.pathname}?room=${roomId}`
}
