import { z } from 'zod'
import { createRouter, publicQuery } from './middleware'
import { getSql } from '@/lib/db'
import { validateExplorerName } from '@/lib/explorer-name'

export type ExplorerRow = {
  name: string
  createdAt: number
  lastSeenAt: number
}

export const explorersRouter = createRouter({
  claim: publicQuery
    .input(z.object({ name: z.string().min(1).max(24) }))
    .mutation(async ({ input }) => {
      const v = validateExplorerName(input.name)
      if (!v.ok) return { ok: false as const, error: v.error }
      const sql = await getSql()
      const now = new Date()
      const existing = await sql.query<{ name: string }>(
        'select name from explorers where name_key = $1',
        [v.key],
      )
      if (existing[0]) {
        await sql.query(
          'update explorers set last_seen_at = $1 where name_key = $2',
          [now, v.key],
        )
        return { ok: true as const, name: existing[0].name, created: false }
      }
      try {
        await sql.query(
          'insert into explorers (name, name_key, created_at, last_seen_at) values ($1, $2, $3, $3)',
          [v.name, v.key, now],
        )
      } catch (err) {
        const code = (err as { code?: string }).code
        if (code === '23505') return { ok: false as const, error: '这个名字已经有人用了' }
        throw err
      }
      return { ok: true as const, name: v.name, created: true }
    }),

  roster: publicQuery.query(async () => {
    const sql = await getSql()
    const rows = await sql.query<{
      name: string
      created_at: string | Date
      last_seen_at: string | Date
    }>('select name, created_at, last_seen_at from explorers order by created_at asc')
    const explorers: ExplorerRow[] = rows.map((r) => ({
      name: r.name,
      createdAt: toMs(r.created_at),
      lastSeenAt: toMs(r.last_seen_at),
    }))
    return { count: explorers.length, explorers }
  }),
})

function toMs(v: string | Date | number): number {
  if (typeof v === 'number') return v
  if (v instanceof Date) return v.getTime()
  const t = Date.parse(String(v))
  return Number.isFinite(t) ? t : 0
}
