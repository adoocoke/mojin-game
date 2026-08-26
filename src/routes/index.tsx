import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const GameApp = lazy(() => import("@/App"));

export const Route = createFileRoute("/")({
  ssr: false,
  component: Home,
});

function BootScreen() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-zinc-950 text-center px-6">
      <div className="text-amber-400 tracking-[0.5em] text-sm mb-3">LOOT · SHOOT · EXTRACT</div>
      <h1 className="text-5xl font-black text-white mb-3">
        摸金<span className="text-amber-400">枪战</span>
      </h1>
      <p className="text-zinc-400 max-w-md">潜入战区，搜索物资，击毙敌人，带着财富活着撤离。</p>
      <div className="mt-8 text-amber-300/80 text-sm tracking-widest animate-pulse">战区装载中…</div>
    </div>
  );
}

function Home() {
  return (
    <Suspense fallback={<BootScreen />}>
      <GameApp />
    </Suspense>
  );
}
