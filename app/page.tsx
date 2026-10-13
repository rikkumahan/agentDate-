"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { parsePeople } from "@/lib/links";
import { loadRun, setRun } from "@/lib/store";
import { isRunning, runPipeline } from "@/lib/pipeline";
import type { Run } from "@/lib/types";

const STEPS = [
  ["Find", "Paste a LinkedIn + public Instagram per person"],
  ["Read", "Each person's agent studies both profiles"],
  ["Profile", "Needs, hobbies, interests, values — with evidence"],
  ["Date", "Agents go on real dates on their person's behalf"],
  ["Rank", "Everyone gets a ranking of who fits them best"],
];

export default function Home() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [joinDemo, setJoinDemo] = useState(true);
  const [busy, setBusy] = useState(false);
  const people = parsePeople(text);

  async function start() {
    // Replacing the live run under an in-flight pipeline would orphan its dates.
    if (isRunning()) return router.push("/live");
    setBusy(true);
    // New people join your existing run if there is one (nothing already done is redone), else the demo pool.
    const live = await loadRun("live");
    const base = live ?? (joinDemo ? await loadRun("demo") : undefined);
    const existing = new Set(base?.people.map((p) => p.id));
    const fresh = people.filter((p) => !existing.has(p.id));
    // Growing your own pool re-runs matching for everyone (profiles are kept); joining the demo keeps its dates.
    const rematch = base?.id === "live" && fresh.length > 0;
    const kept = base ? structuredClone(base.people) : [];
    if (rematch) for (const p of kept) p.shortlist = undefined;
    const run: Run = {
      id: "live",
      stage: "idle",
      people: [...kept, ...fresh],
      dates: base && !rematch ? structuredClone(base.dates) : {},
      log: [
        ...(base?.id === "live" ? base.log : []),
        base ? `Added ${fresh.length} people to a pool of ${base.people.length}.` : "New pool.",
      ],
    };
    setRun(run);
    router.push("/live");
    runPipeline();
  }

  return (
    <div className="grid gap-10 pt-6 lg:grid-cols-[1.1fr_1fr]">
      <section>
        <p className="label text-gold">agentic dating</p>
        <h1 className="mt-3 font-serif text-5xl leading-[1.05] sm:text-6xl">
          Your agent <br />goes on the dates.
        </h1>
        <p className="mt-5 max-w-md text-mute">
          Every person is represented by an AI agent that reads their LinkedIn and Instagram, learns who they are,
          and dates other agents on their behalf. Then it tells you who fits best.
        </p>
        <ol className="mt-8 space-y-3">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gold/50 text-xs text-gold">{i + 1}</span>
              <span><b className="font-medium">{t}.</b> <span className="text-mute">{d}</span></span>
            </li>
          ))}
        </ol>
        <a href="/demo" className="btn-ghost mt-8">Watch 25 agents date</a>
      </section>

      <section className="card p-5">
        <label className="label" htmlFor="links">One person per line: their LinkedIn link, then their Instagram link</label>
        <textarea
          id="links"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={12}
          placeholder={"https://www.linkedin.com/in/someone  https://www.instagram.com/someone\nhttps://www.linkedin.com/in/another, https://instagram.com/another"}
          className="mt-2 w-full resize-y rounded-xl border border-line bg-ink/70 p-3 font-mono text-xs text-cream outline-none focus:border-gold"
        />
        <div className="mt-2 text-xs text-mute">
          {people.length} {people.length === 1 ? "person" : "people"} found. Only public Instagram profiles can be read.
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={joinDemo} onChange={(e) => setJoinDemo(e.target.checked)} className="accent-[#f2c46d]" />
          Add them to the 25-person demo pool (so they have people to date)
        </label>
        <button className="btn mt-5 w-full" disabled={busy || !people.length || (!joinDemo && people.length < 2)} onClick={start}>
          {busy ? "Starting…" : "Send the agents out"}
        </button>
      </section>
    </div>
  );
}
