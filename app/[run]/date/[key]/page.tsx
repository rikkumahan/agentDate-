"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useRun } from "@/lib/store";
import { safeDecode } from "@/lib/links";
import { Avatar, byId, DateTranscript, nameOf, Score } from "@/components/ui";

const REPLAY_MS = 3500;

export default function DatePage() {
  const { run: id, key } = useParams<{ run: string; key: string }>();
  const run = useRun(id);
  const d = run?.dates[safeDecode(key)];
  // Replay: step through a finished date one line at a time so you can watch it happen.
  const [upto, setUpto] = useState<number | undefined>(undefined);
  const total = d?.messages.length ?? 0;
  useEffect(() => {
    if (upto === undefined || upto > total) return;
    const t = setTimeout(() => setUpto(upto + 1), upto === 0 ? 1200 : REPLAY_MS);
    return () => clearTimeout(t);
  }, [upto, total]);

  if (!run || !d) return <p className="mt-10 text-mute">{run ? "Date not found." : "Loading…"}</p>;
  const a = byId(run, d.a), b = byId(run, d.b);
  const mutual = d.status === "done" ? Math.round((d.verdicts.a.score + d.verdicts.b.score) / 2) : null;
  const replaying = upto !== undefined && upto <= total;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <Link href={`/${id}`} className="text-sm text-mute hover:text-cream">Back to all dates</Link>
        {d.status === "done" && (
          <button className="btn-ghost" onClick={() => setUpto(replaying ? undefined : 0)}>
            {replaying ? "Skip to the end" : "Replay the date"}
          </button>
        )}
      </div>
      <div className="flex items-center justify-between gap-4">
        {[a, b].map((p, i) => (
          <Link key={i} href={`/${id}/p/${p?.id}`} className={`flex items-center gap-3 hover:text-gold ${i ? "flex-row-reverse text-right" : ""}`}>
            <Avatar p={p} size={56} />
            <div>
              <div className="font-serif text-xl">{nameOf(p)}</div>
              <div className="text-xs text-mute">{p?.profile?.headline}</div>
            </div>
          </Link>
        ))}
      </div>
      {mutual !== null && !replaying && (
        <div className="flex flex-col items-center gap-1">
          <Score n={mutual} size={72} />
          <p className="label">Mutual fit</p>
        </div>
      )}
      <DateTranscript run={run} d={d} upto={replaying ? upto : undefined} />
    </div>
  );
}
