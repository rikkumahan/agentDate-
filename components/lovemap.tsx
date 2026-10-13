"use client";
import { useRouter } from "next/navigation";
import type { Person, Run } from "@/lib/types";

const HUES = [12, 32, 340, 280, 200, 160, 50];
const hue = (p: Person) => HUES[[...(p.profile?.name ?? p.id)].reduce((s, c) => s + c.charCodeAt(0), 0) % HUES.length];
const initials = (p: Person) => (p.profile?.name ?? p.id).split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

// The whole pool as a living map: who asked whom out (dashed), dates in progress (pulsing gold),
// finished dates coloured by mutual fit, hearts where both agents want a second date.
export function LoveMap({ run }: { run: Run }) {
  const router = useRouter();
  const people = run.people;
  const n = people.length || 1;
  const C = 300, R = n > 12 ? 245 : 200;
  const pos = new Map(people.map((p, i) => {
    const t = (i / n) * Math.PI * 2 - Math.PI / 2;
    return [p.id, { x: C + R * Math.cos(t), y: C + R * Math.sin(t) }];
  }));
  const dateKeys = new Set(Object.values(run.dates).map((d) => [d.a, d.b].sort().join("|")));
  const asks = people.flatMap((p) =>
    (p.shortlist ?? [])
      .filter((s) => pos.has(s.id) && !dateKeys.has([p.id, s.id].sort().join("|")))
      .map((s) => ({ from: p.id, to: s.id })),
  );
  const r = n > 20 ? 15 : 19;

  return (
    <div className="card relative overflow-hidden p-2">
      <svg viewBox="0 0 600 600" className="mx-auto block w-full max-w-[640px]" role="img" aria-label="Map of who asked whom out and how each date went">
        {asks.map(({ from, to }, i) => {
          const a = pos.get(from)!, b = pos.get(to)!;
          return <line key={`ask${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--color-rose)" strokeOpacity="0.35" strokeDasharray="3 5" />;
        })}
        {Object.entries(run.dates).map(([k, d]) => {
          const a = pos.get(d.a), b = pos.get(d.b);
          if (!a || !b) return null;
          const done = d.status === "done";
          const mutual = done ? (d.verdicts.a.score + d.verdicts.b.score) / 2 : 0;
          const both = done && d.verdicts.a.second_date && d.verdicts.b.second_date;
          const stroke = d.status === "live" ? "var(--color-gold)" : done ? (mutual >= 75 ? "var(--color-gold)" : mutual >= 55 ? "var(--color-rose)" : "var(--color-mute)") : "var(--color-line)";
          const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
          return (
            <g key={k} className="cursor-pointer" onClick={() => router.push(`/${run.id}/date/${k}`)}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth="12" />
              <line
                x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={stroke}
                strokeWidth={d.status === "live" ? 3 : done ? 1 + mutual / 40 : 1}
                strokeOpacity={done ? 0.4 + mutual / 200 : 0.9}
                className={d.status === "live" ? "date-live" : undefined}
              />
              {both && <text x={mx} y={my + 5} textAnchor="middle" fontSize="15" fill="var(--color-rose)">♥</text>}
              <title>{`${d.a} × ${d.b}${done ? ` — mutual ${Math.round(mutual)}` : ` — ${d.status}`}`}</title>
            </g>
          );
        })}
        {people.map((p) => {
          const { x, y } = pos.get(p.id)!;
          const busy = Object.values(run.dates).some((d) => d.status === "live" && (d.a === p.id || d.b === p.id));
          return (
            <g key={p.id} className="cursor-pointer" onClick={() => router.push(`/${run.id}/p/${p.id}`)}>
              {busy && <circle cx={x} cy={y} r={r + 6} fill="none" stroke="var(--color-gold)" strokeWidth="2" className="date-live" />}
              <circle cx={x} cy={y} r={r} fill={p.profile ? `hsl(${hue(p)} 55% 72%)` : "var(--color-line)"} stroke="var(--color-ink)" strokeWidth="3" />
              <text x={x} y={y + 4} textAnchor="middle" fontSize={r * 0.62} fill="var(--color-ink)" fontFamily="var(--font-fraunces)">{initials(p)}</text>
              <text x={x} y={y + (y > C ? r + 14 : -r - 6)} textAnchor="middle" fontSize="10" fill="var(--color-cream)" opacity="0.8">
                {(p.profile?.name ?? p.id).split(" ")[0]}
              </text>
              <title>{p.profile?.name ?? p.id}</title>
            </g>
          );
        })}
      </svg>
      <div className="flex flex-wrap justify-center gap-4 px-3 pb-2 text-xs text-mute">
        <span><span className="text-rose">- - -</span> asked out</span>
        <span><span className="text-gold">━</span> on a date now</span>
        <span>line weight = how well it went</span>
        <span><span className="text-rose">♥</span> both want a second date</span>
      </div>
    </div>
  );
}
