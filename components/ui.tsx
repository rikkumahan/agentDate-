import Link from "next/link";
import type { DateRecord, Person, Run } from "@/lib/types";
import { DateScene } from "./scene";

export const nameOf = (p?: Person) => p?.profile?.name ?? p?.id ?? "?";
export const firstOf = (p?: Person) => nameOf(p).split(" ")[0];
export const byId = (run: Run, id: string) => run.people.find((p) => p.id === id);

const HUES = [12, 32, 340, 280, 200, 160, 50];
export function Avatar({ p, size = 40 }: { p?: Person; size?: number }) {
  const n = nameOf(p);
  const hue = HUES[[...n].reduce((s, c) => s + c.charCodeAt(0), 0) % HUES.length];
  const initials = n.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-serif text-ink"
      style={{ width: size, height: size, fontSize: size * 0.4, background: `hsl(${hue} 55% 72%)` }}
    >
      {initials}
    </div>
  );
}

export function Chips({ items, tone }: { items: string[]; tone?: "gold" | "rose" }) {
  const cls = tone === "gold" ? "border-gold/40 text-gold" : tone === "rose" ? "border-rose/40 text-rose" : "";
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((x) => (
        <span key={x} className={`chip ${cls}`}>{x}</span>
      ))}
    </div>
  );
}

// The one bold element: compatibility as a filling ring (gold = strong fit, blush = middling).
export function Score({ n, label, size = 44 }: { n: number; label?: string; size?: number }) {
  const r = size / 2 - 3;
  const full = 2 * Math.PI * r;
  const stroke = n >= 75 ? "var(--color-gold)" : n >= 55 ? "var(--color-rose)" : "var(--color-mute)";
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }} title={label ?? `${n} out of 100`}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-line)" strokeWidth={3} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={stroke} strokeWidth={3} strokeLinecap="round"
          strokeDasharray={full} strokeDashoffset={full * (1 - n / 100)}
          className="ring-fill" style={{ ["--ring-full" as string]: full }}
        />
      </svg>
      <span className="absolute font-serif tabular-nums" style={{ fontSize: size * 0.34 }}>{n}</span>
    </span>
  );
}

// `upto` replays a finished date: only the first `upto` messages show, verdicts wait for the end.
export function DateTranscript({ run, d, upto, compact }: { run: Run; d: DateRecord; upto?: number; compact?: boolean }) {
  const a = byId(run, d.a), b = byId(run, d.b);
  const who = (s: string) => (s === "a" ? a : b);
  const ended = upto === undefined || upto >= d.messages.length;
  return (
    <div className="space-y-4">
      <DateScene d={d} a={a} b={b} upto={upto} />
      {d.venue && !compact && (
        <div className="space-y-2 text-sm">
          {d.venue.proposals?.a && d.venue.proposals?.b && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="chip">{firstOf(a)}&apos;s agent suggested {d.venue.proposals.a}</span>
              <span className="chip">{firstOf(b)}&apos;s agent suggested {d.venue.proposals.b}</span>
            </div>
          )}
          <p className="text-mute">{d.venue.why}</p>
        </div>
      )}
      <div className="space-y-3">
        {d.messages.slice(0, upto ?? d.messages.length).map((m, i) => {
          const left = m.speaker === "a";
          return (
            <div key={i} className={`flex items-end gap-2 ${left ? "" : "flex-row-reverse"}`}>
              <Avatar p={who(m.speaker)} size={30} />
              <div className={`flex max-w-[75%] flex-col gap-1 ${left ? "items-start" : "items-end"}`}>
                {m.thought && !compact && (
                  <div className="rounded-xl border border-dashed border-line px-3 py-1.5 font-serif text-xs italic text-mute">
                    {firstOf(who(m.speaker))}&apos;s agent, thinking privately: {m.thought}
                  </div>
                )}
                <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${left ? "rounded-bl-sm bg-panel border border-line" : "rounded-br-sm bg-gold/15 border border-gold/30"}`}>
                  <div className="mb-0.5 text-[11px] text-mute">{firstOf(who(m.speaker))}&apos;s agent</div>
                  {m.text.replace(/^\**\s*SAY\s*\**\s*:\s*\**\s*/i, "")}
                </div>
              </div>
            </div>
          );
        })}
        {d.status === "live" && <div className="animate-pulse text-sm text-mute">agents are talking…</div>}
        {d.status === "pending" && <div className="text-sm text-mute">waiting for a table…</div>}
        {d.status === "error" && <div className="text-sm text-rose">Date failed: {d.error}</div>}
      </div>
      {ended && Object.keys(d.verdicts).length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {(["a", "b"] as const).map((s) =>
            d.verdicts[s] ? (
              <div key={s} className="card p-4">
                <div className="flex items-center justify-between">
                  <span className="label">{firstOf(who(s))}&apos;s agent, debriefing in private</span>
                  <Score n={d.verdicts[s].score} />
                </div>
                {d.verdicts[s].briefing && (
                  <p className="mt-3 rounded-lg bg-ink/60 px-3 py-2 font-serif text-sm italic">
                    To {firstOf(who(s))}: “{d.verdicts[s].briefing}”
                  </p>
                )}
                <p className="mt-2 text-sm">{d.verdicts[s].summary}</p>
                <p className="mt-2 text-xs text-mute">Second date? {d.verdicts[s].second_date ? "Yes ♥" : "No"}</p>
                {d.verdicts[s].highlights.length > 0 && <div className="mt-2"><Chips items={d.verdicts[s].highlights} tone="gold" /></div>}
                {d.verdicts[s].concerns.length > 0 && <div className="mt-2"><Chips items={d.verdicts[s].concerns} tone="rose" /></div>}
              </div>
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}

export function DateLink({ run, k, d }: { run: Run; k: string; d: DateRecord }) {
  const a = byId(run, d.a), b = byId(run, d.b);
  const mutual = d.status === "done" ? Math.round((d.verdicts.a.score + d.verdicts.b.score) / 2) : null;
  return (
    <Link href={`/${run.id}/date/${k}`} className="card flex items-center gap-3 p-3 hover:border-gold/60">
      <div className="flex -space-x-2"><Avatar p={a} size={32} /><Avatar p={b} size={32} /></div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm">{firstOf(a)} × {firstOf(b)}</div>
        <div className="truncate text-xs text-mute">{d.venue?.venue ?? d.status}</div>
      </div>
      {mutual !== null ? <Score n={mutual} /> : <span className={`text-xs ${d.status === "live" ? "animate-pulse text-gold" : "text-mute"}`}>{d.status}</span>}
    </Link>
  );
}
