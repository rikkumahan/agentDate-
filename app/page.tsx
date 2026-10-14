"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { parsePeople } from "@/lib/links";
import { setRun } from "@/lib/store";
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
  const [busy, setBusy] = useState(false);
  const people = parsePeople(text);

  async function start() {
    // Replacing the live run under an in-flight pipeline would orphan its dates.
    if (isRunning()) return router.push("/live");
    setBusy(true);
    // Every paste starts a fresh run with only these people; earlier runs never mix in.
    const run: Run = { id: "live", stage: "idle", people, dates: {}, log: [`New pool of ${people.length} people.`] };
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
        <a href="/demo" className="btn mt-8">Open the finished demo: 25 people, already dated</a>
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
          {people.length} {people.length === 1 ? "person" : "people"} found. Add at least 2 people so they have someone to date.
          Only public Instagram profiles can be read.
        </div>
        <button className="btn mt-5 w-full" disabled={busy || people.length < 2} onClick={start}>
          {busy ? "Starting…" : "Send the agents out"}
        </button>
      </section>
    </div>
  );
}
