"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useRun } from "@/lib/store";
import { isRunning, pausePipeline, redoDates, runPipeline } from "@/lib/pipeline";
import { LoveMap } from "@/components/lovemap";
import { rankFor } from "@/lib/rank";
import type { Run, Stage } from "@/lib/types";
import { Avatar, byId, Chips, DateLink, DateTranscript, firstOf, nameOf, Score } from "@/components/ui";

const STAGES: Stage[] = ["scraping", "analyzing", "shortlisting", "dating", "done"];
const TABS = ["Love map", "People", "Dates", "Rankings"] as const;

export default function RunPage() {
  const { run: id } = useParams<{ run: string }>();
  const run = useRun(id);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Love map");

  if (!run)
    return (
      <div className="card mt-10 p-8 text-center text-mute">
        {id === "live" ? <>No run yet. <Link href="/" className="text-gold">Paste some people</Link></> : "Loading…"}
      </div>
    );

  const dates = Object.entries(run.dates);
  const live = dates.filter(([, d]) => d.status === "live");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label">{id === "demo" ? "finished demo" : "your run"}</p>
          <h1 className="font-serif text-4xl">{run.people.length} people, {dates.length} dates</h1>
        </div>
        <div className="flex gap-2">
          {id === "live" && run.stage !== "idle" && run.stage !== "done" && isRunning() && (
            <button className="btn-ghost" onClick={pausePipeline}>Pause</button>
          )}
          {id === "live" && <button className="btn-ghost" onClick={() => runPipeline()}>Resume / retry failed</button>}
          {id === "live" && !isRunning() && Object.keys(run.dates).length > 0 && (
            <button className="btn-ghost" onClick={redoDates}>Redo all dates</button>
          )}
          <button className="btn-ghost" onClick={() => exportRun(run)}>Export JSON</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {STAGES.map((s) => {
          const idx = STAGES.indexOf(run.stage as Stage);
          const state = run.stage === s ? "now" : idx > STAGES.indexOf(s) ? "done" : "todo";
          return (
            <span key={s} className={`chip ${state === "now" ? "animate-pulse border-gold text-gold" : state === "done" ? "border-gold/40 text-cream" : "text-mute"}`}>
              {state === "done" ? "✓ " : ""}{s}
            </span>
          );
        })}
      </div>

      {live.length > 0 && (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {live.map(([k, d]) => (
            <div key={k} className="card max-h-[420px] overflow-y-auto p-4">
              <div className="label mb-3 text-gold">Live now: {firstOf(byId(run, d.a))} × {firstOf(byId(run, d.b))}</div>
              <DateTranscript run={run} d={d} compact />
            </div>
          ))}
        </section>
      )}

      <div className="flex gap-1 border-b border-line">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm ${tab === t ? "border-b-2 border-gold text-cream" : "text-mute hover:text-cream"}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === "Love map" && <LoveMap run={run} />}

      {tab === "People" && (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {run.people.map((p) => (
            <Link key={p.id} href={`/${id}/p/${p.id}`} className="card p-4 hover:border-gold/60">
              <div className="flex items-center gap-3">
                <Avatar p={p} />
                <div className="min-w-0">
                  <div className="truncate font-medium">{nameOf(p)}</div>
                  <div className="truncate text-xs text-mute">{p.profile?.headline ?? (p.error ? "" : p.raw ? "agent reading…" : "waiting to scrape…")}</div>
                </div>
              </div>
              {p.profile && <div className="mt-3"><Chips items={p.profile.interests.slice(0, 4)} /></div>}
              {p.error && <div className="mt-2 text-xs text-rose">{p.error}</div>}
            </Link>
          ))}
        </section>
      )}

      {tab === "Dates" && (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {dates.length ? dates.map(([k, d]) => <DateLink key={k} run={run} k={k} d={d} />) : <p className="text-mute">No dates yet.</p>}
        </section>
      )}

      {tab === "Rankings" && (
        <section className="grid gap-3 md:grid-cols-2">
          {run.people.filter((p) => p.profile).map((p) => {
            const rows = rankFor(p.id, run.dates);
            return (
              <div key={p.id} className="card p-4">
                <Link href={`/${id}/p/${p.id}`} className="flex items-center gap-3 hover:text-gold">
                  <Avatar p={p} size={34} />
                  <span className="font-medium">{nameOf(p)}</span>
                </Link>
                <ol className="mt-3 space-y-1.5">
                  {rows.length ? rows.map((r, i) => (
                    <li key={r.id}>
                      <Link href={`/${id}/date/${r.dateKey}`} className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-ink/60">
                        <span className="w-5 text-xs text-mute">#{i + 1}</span>
                        <Avatar p={byId(run, r.id)} size={24} />
                        <span className="flex-1 truncate text-sm">{nameOf(byId(run, r.id))}</span>
                        <Score n={r.mutual} />
                      </Link>
                    </li>
                  )) : <li className="text-sm text-mute">No finished dates yet.</li>}
                </ol>
              </div>
            );
          })}
        </section>
      )}

      <details className="card p-4">
        <summary className="label cursor-pointer">Agent activity log ({run.log.length})</summary>
        <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap text-xs text-mute">{run.log.join("\n")}</pre>
      </details>
    </div>
  );
}

function exportRun(run: Run) {
  const blob = new Blob([JSON.stringify({ ...run, id: "demo" }, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "demo.json";
  a.click();
}
