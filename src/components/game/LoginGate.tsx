import { useEffect, useState } from 'react'
import { trpc } from '@/providers/trpc'
import {
  EXPLORER_NAME_MAX,
  readSavedExplorerName,
  saveExplorerName,
  validateExplorerName,
} from '@/lib/explorer-name'

/** 进厅前摸金名闸门（#17）：本机记住、服务端按 name_key 去重。 */
export function LoginGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const claim = trpc.explorers.claim.useMutation()

  useEffect(() => {
    setName(readSavedExplorerName())
  }, [])

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const v = validateExplorerName(name)
    if (!v.ok) { setError(v.error); return }
    setBusy(true)
    setError('')
    try {
      const res = await claim.mutateAsync({ name: v.name })
      if (!res.ok) { setError(res.error); return }
      saveExplorerName(res.name)
      setName(res.name)
      setReady(true)
    } catch {
      saveExplorerName(v.name)
      setReady(true)
    } finally {
      setBusy(false)
    }
  }

  if (ready) return <>{children}</>

  return (
    <div className="absolute inset-0 z-[80] flex items-center justify-center bg-gradient-to-b from-zinc-950 via-zinc-900 to-black px-6">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-amber-500/40 bg-zinc-950/90 p-6 text-center shadow-[0_0_40px_rgba(251,191,36,0.12)]">
        <div className="text-amber-400 tracking-[0.4em] text-xs mb-2">LOOT · SHOOT · EXTRACT</div>
        <h1 className="text-3xl font-black text-white mb-1">摸金<span className="text-amber-400">枪战</span></h1>
        <p className="text-zinc-400 text-sm mb-5">进厅先取一个摸金名。回访自动填上，名字在全站唯一。</p>
        <input
          value={name}
          onChange={e => { setName(e.target.value); setError('') }}
          maxLength={EXPLORER_NAME_MAX + 4}
          placeholder="1–12 个字"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-center text-amber-100 placeholder:text-zinc-600 focus:border-amber-400 focus:outline-none"
          autoComplete="nickname"
        />
        {error && <div className="mt-2 text-xs text-red-400">{error}</div>}
        <button type="submit" disabled={busy} className="mt-4 w-full rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 py-3 font-black text-black tracking-widest">
          {busy ? '登录中…' : '进入大厅'}
        </button>
        <div className="mt-3 text-[11px] text-zinc-600">不做邮箱密码，名字就是你的通行证</div>
      </form>
    </div>
  )
}
