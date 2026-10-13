"use client";
import { DateScene } from "@/components/scene";
import type { DateRecord, Person } from "@/lib/types";

// Design preview of every date setting, with placeholder people (not real profiles).
const p = (name: string): Person => ({ id: name, linkedin: "", instagram: "", profile: { name } as Person["profile"] });
const A = p("Alex Rivera"), B = p("Sam Okafor");
const v = (score: number, second_date: boolean) => ({ score, second_date, highlights: [], concerns: [], summary: "" });

const VENUES = [
  "Blue Tokai Coffee Roasters, pour-over tasting",
  "Sunrise walk around Cubbon Park",
  "Rooftop wine bar in Indiranagar",
  "Pottery workshop at a design studio",
  "Candlelit dinner at a small Italian restaurant",
];

const live = (venue: string, speaker: "a" | "b"): DateRecord => ({
  a: A.id, b: B.id, status: "live", venue: { venue, why: "" }, verdicts: {},
  messages: [{ speaker, text: speaker === "a" ? "I always order whatever the barista is excited about. What's something you're weirdly picky about?" : "Honestly? Mornings. If I don't get a quiet hour before anyone talks to me, I'm a different person." }],
});

export default function Scenes() {
  return (
    <div className="space-y-8">
      <h1 className="font-serif text-4xl">Date settings</h1>
      <div className="grid gap-6 md:grid-cols-2">
        {VENUES.map((venue, i) => (
          <DateScene key={venue} d={live(venue, i % 2 ? "b" : "a")} a={A} b={B} />
        ))}
        <DateScene a={A} b={B} d={{ a: A.id, b: B.id, status: "done", venue: { venue: VENUES[4], why: "" }, messages: [], verdicts: { a: v(88, true), b: v(84, true) } }} />
      </div>
    </div>
  );
}
