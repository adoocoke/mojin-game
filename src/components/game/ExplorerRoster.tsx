import { useState } from 'react'
import { trpc } from '@/providers/trpc'
import { readSavedExplorerName } from '@/lib/explorer-name'

/** 大厅「摸金人 N 人来过」+ 点开名单（#17） */
export function ExplorerRoster() {
  const [open, setOpen] = useState(false)
  const roster = trpc.explorers.roster.useQuery(undefined, { retry: false })
  const mine = readSavedExplorerName()
  const count = roster.data?.count
  const list = roster.data?.explorers ?? []

  return (
    <div className="mb-5">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-4 py-1.5 text-sm hover:border-amber-400"
      >
        <span className="text-amber-300">👥</span>
        <span className="text-zinc-300">摸金人</span>
        <span className="font-black text-amber-300 tabular-nums">
          {count == null ? (roster.isError ? '—' : '…') : count.toLocaleString()}
        </span>
        <span className="text-zinc-400">人来过</span>
      </button>
      {mine && <div className="mt-1 text-[11px] text-zinc-500">当前：{mine}</div>}
      {open && (
        <div className="mt-3 mx-auto max-w-md max-h-48 overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-950/90 text-left p-3">
          <div className="text-xs text-amber-300 font-bold mb-2">来过的摸金人</div>
          {roster.isError && <div className="text-xs text-zinc-500">名单暂时读不到（本地仍可玩）</div>}
          {list.length === 0 && !roster.isError && (
            <div className="text-xs text-zinc-500">还没有人留下名字</div>
          )}
          {list.map(p => (
            <div key={p.name} className="flex items-center justify-between text-xs py-0.5 border-b border-zinc-800/80 last:border-0">
              <span className={p.name === mine ? 'text-amber-200 font-bold' : 'text-zinc-300'}>{p.name}</span>
              <span className="text-zinc-600">{new Date(p.lastSeenAt).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
