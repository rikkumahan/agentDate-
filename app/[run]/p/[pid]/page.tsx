"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useRun } from "@/lib/store";
import { safeDecode } from "@/lib/links";
import { rankFor } from "@/lib/rank";
import { Avatar, byId, Chips, nameOf, Score } from "@/components/ui";

export default function ProfilePage() {
  const { run: id, pid } = useParams<{ run: string; pid: string }>();
  const run = useRun(id);
  const p = run && byId(run, safeDecode(pid));
  if (!run || !p) return <p className="mt-10 text-mute">{run ? "Person not found." : "Loading…"}</p>;
  const pr = p.profile;
  const ranking = rankFor(p.id, run.dates);

  return (
    <div className="space-y-6">
      <Link href={`/${id}#People`} className="btn-ghost inline-block text-sm">← Back to dashboard</Link>
      <div className="flex flex-wrap items-center gap-5">
        <Avatar p={p} size={84} />
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-4xl">{nameOf(p)}</h1>
          {pr && <p className="text-mute">{pr.headline}<br />{pr.location}{pr.age_range !== "unknown" ? `, ${pr.age_range}` : ""}</p>}
          {p.gender && p.gender.gender !== "unknown" && (
            <p className="mt-1 text-xs text-mute" title={p.gender.evidence}>Matched man–woman as a {p.gender.gender} (from: {p.gender.evidence})</p>
          )}
          <div className="mt-2 flex gap-3 text-sm">
            {p.linkedin && <a href={p.linkedin} target="_blank" rel="noreferrer" className="text-gold hover:underline">LinkedIn ↗</a>}
            {p.instagram && <a href={p.instagram} target="_blank" rel="noreferrer" className="text-gold hover:underline">Instagram ↗</a>}
          </div>
        </div>
      </div>

      {!pr ? (
        <div className="card p-6 text-mute">{p.error ?? "The agent is still reading this person…"}</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-4">
            <section className="card p-5">
              <p className="label">The agent&apos;s read</p>
              <p className="mt-2 font-serif text-lg leading-relaxed">{pr.summary}</p>
              <p className="mt-3 text-sm text-mute"><b className="text-cream">Career.</b> {pr.career}</p>
              <p className="mt-1 text-sm text-mute"><b className="text-cream">Lifestyle.</b> {pr.lifestyle}</p>
            </section>
            <section className="card grid gap-5 p-5 sm:grid-cols-2">
              <Block title="Needs in a partner" items={pr.needs} list />
              <Block title="Likely dealbreakers" items={pr.dealbreakers} list />
              <Block title="Hobbies" items={pr.hobbies} tone="gold" />
              <Block title="Interests" items={pr.interests} />
              <Block title="Values" items={pr.values} tone="gold" />
              <Block title="Personality" items={pr.personality} />
            </section>
            <section className="card p-5">
              <p className="label">Evidence — where the agent got this</p>
              <ul className="mt-3 space-y-3">
                {pr.evidence.map((e, i) => (
                  <li key={i} className="text-sm">
                    <span className={`chip mr-2 ${e.source === "instagram" ? "border-rose/40 text-rose" : "border-gold/40 text-gold"}`}>{e.source}</span>
                    {e.claim}
                    {e.quote && <div className="mt-1 border-l border-line pl-3 text-xs italic text-mute">“{e.quote}”</div>}
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <aside className="space-y-4">
            <section className="card p-5">
              <p className="label">Ranking — who fits {nameOf(p).split(" ")[0]} best</p>
              <ol className="mt-3 space-y-2">
                {ranking.length ? ranking.map((r, i) => (
                  <li key={r.id}>
                    <Link href={`/${id}/date/${r.dateKey}`} className="block rounded-xl border border-line p-3 hover:border-gold/60">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-mute">#{i + 1}</span>
                        <Avatar p={byId(run, r.id)} size={28} />
                        <span className="flex-1 truncate text-sm">{nameOf(byId(run, r.id))}</span>
                        <Score n={r.mutual} label="mutual fit" />
                      </div>
                      <p className="mt-2 text-xs text-mute">{r.mine.briefing || r.mine.summary}</p>
                      <p className="mt-1 text-[11px] text-mute">Their agent gave {r.mine.score}, the other agent gave {r.theirs.score}{r.mine.second_date && r.theirs.second_date ? ". Both want a second date ♥" : ""}</p>
                    </Link>
                  </li>
                )) : <li className="text-sm text-mute">No finished dates yet.</li>}
              </ol>
            </section>
            {p.shortlist && (
              <section className="card p-5">
                <p className="label">Who the agent asked out, and why</p>
                <ul className="mt-3 space-y-2 text-sm">
                  {p.shortlist.map((s) => (
                    <li key={s.id}><b>{nameOf(byId(run, s.id))}</b> <span className="text-mute">— {s.reason}</span></li>
                  ))}
                </ul>
              </section>
            )}
            <section className="card p-5">
              <p className="label">How the agent will talk</p>
              <p className="mt-2 text-sm text-mute">{pr.voice}</p>
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}

function Block({ title, items, tone, list }: { title: string; items: string[]; tone?: "gold" | "rose"; list?: boolean }) {
  return (
    <div>
      <p className="label mb-2">{title}</p>
      {list ? (
        <ul className="list-disc space-y-1 pl-4 text-sm">{items.map((x) => <li key={x}>{x}</li>)}</ul>
      ) : (
        <Chips items={items} tone={tone} />
      )}
    </div>
  );
}
