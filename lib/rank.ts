import type { DateRecord, Verdict } from "./types";

export type RankRow = {
  id: string;
  dateKey: string;
  mine: Verdict;
  theirs: Verdict;
  mutual: number;
};

// Rank everyone `id` went on a finished date with. Mutual = mean of both agents' scores,
// with a small bonus when both want a second date (fit has to go both ways).
export function rankFor(id: string, dates: Record<string, DateRecord>): RankRow[] {
  return Object.entries(dates)
    .filter(([, d]) => d.status === "done" && d.verdicts.a && d.verdicts.b && (d.a === id || d.b === id))
    .map(([dateKey, d]) => {
      const other = d.a === id ? d.b : d.a;
      const mine = d.verdicts[d.a === id ? "a" : "b"];
      const theirs = d.verdicts[d.a === id ? "b" : "a"];
      const bonus = mine.second_date && theirs.second_date ? 5 : 0;
      return { id: other, dateKey, mine, theirs, mutual: Math.min(100, Math.round((mine.score + theirs.score) / 2) + bonus) };
    })
    .sort((x, y) => y.mutual - x.mutual || y.mine.score - x.mine.score);
}
