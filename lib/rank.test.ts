import assert from "node:assert";
import { rankFor } from "./rank.ts";
import type { DateRecord } from "./types.ts";

const v = (score: number, second_date = false) => ({ score, second_date, highlights: [], concerns: [], summary: "" });
const d = (a: string, b: string, sa: number, sb: number, both = false): DateRecord => ({
  a, b, status: "done", messages: [], verdicts: { a: v(sa, both), b: v(sb, both) },
});

const dates: Record<string, DateRecord> = {
  k1: d("x", "y", 80, 60),            // x→y mutual 70
  k2: d("z", "x", 70, 72, true),      // x is "b": mine 72, theirs 70 → 71 + 5 = 76
  k3: d("y", "z", 99, 99),            // not x's date
  k4: { ...d("x", "w", 100, 100), status: "live" }, // unfinished, ignored
};

const r = rankFor("x", dates);
assert.deepStrictEqual(r.map((row) => row.id), ["z", "y"]);
assert.strictEqual(r[0].mutual, 76);
assert.strictEqual(r[0].mine.score, 72);
assert.strictEqual(r[1].mutual, 70);

// Ties on mutual are broken by my own score (higher first).
const tie: Record<string, DateRecord> = {
  t1: d("x", "p", 60, 80), // mutual 70, mine 60
  t2: d("x", "q", 80, 60), // mutual 70, mine 80
};
assert.deepStrictEqual(rankFor("x", tie).map((row) => row.id), ["q", "p"]);

// Second-date bonus only when BOTH want it, and mutual is capped at 100.
const capped = rankFor("x", { c1: d("x", "y", 98, 98, true) });
assert.strictEqual(capped[0].mutual, 100);

const oneSided = rankFor("x", { o1: { ...d("x", "y", 70, 70), verdicts: { a: v(70, true), b: v(70, false) } } });
assert.strictEqual(oneSided[0].mutual, 70);

// Nothing to rank: no dates, or only unfinished/errored ones.
assert.deepStrictEqual(rankFor("x", {}), []);
assert.deepStrictEqual(rankFor("x", { e1: { ...d("x", "y", 90, 90), status: "error" } }), []);

// A "done" date missing one verdict is skipped, not a crash.
assert.deepStrictEqual(rankFor("x", { m1: { ...d("x", "y", 90, 90), verdicts: { a: v(90) } } }), []);

console.log("rank ok");
