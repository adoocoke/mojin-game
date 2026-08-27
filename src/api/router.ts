import { createRouter, publicQuery } from './middleware'
import { versusRouter } from './versus'
import { explorersRouter } from './explorers'

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  versus: versusRouter,
  explorers: explorersRouter,
})

export type AppRouter = typeof appRouter
