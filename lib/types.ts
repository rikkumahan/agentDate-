import { z } from "zod";

const list = z.array(z.string()).catch([]);

export const ProfileSchema = z.object({
  name: z.string().catch("Unknown"),
  headline: z.string().catch(""),
  location: z.string().catch("unknown"),
  age_range: z.string().catch("unknown"),
  summary: z.string().catch(""),
  career: z.string().catch(""),
  lifestyle: z.string().catch(""),
  personality: list,
  interests: list,
  hobbies: list,
  values: list,
  needs: list,
  dealbreakers: list,
  evidence: z
    .array(
      z.object({
        claim: z.string().catch(""),
        source: z.string().catch(""),
        quote: z.string().catch(""),
      }),
    )
    .catch([]),
  voice: z.string().catch(""),
});
export type Profile = z.infer<typeof ProfileSchema>;

export type Person = {
  id: string;
  linkedin: string;
  instagram: string;
  raw?: { linkedin: unknown; instagram: unknown };
  profile?: Profile;
  shortlist?: { id: string; reason: string }[];
  error?: string;
};

export type Verdict = {
  score: number;
  second_date: boolean;
  highlights: string[];
  concerns: string[];
  summary: string;
};

export type DateEvent =
  | { type: "venue"; venue: string; why: string }
  | { type: "msg"; speaker: string; text: string }
  | { type: "verdict"; speaker: string; verdict: Verdict }
  | { type: "error"; error: string };

export type DateRecord = {
  a: string;
  b: string;
  status: "pending" | "live" | "done" | "error";
  venue?: { venue: string; why: string };
  messages: { speaker: string; text: string }[];
  verdicts: Record<string, Verdict>;
  error?: string;
};

export type Stage = "idle" | "scraping" | "analyzing" | "shortlisting" | "dating" | "done";

export type Run = {
  id: string;
  stage: Stage;
  people: Person[];
  dates: Record<string, DateRecord>;
  log: string[];
};

export const pairKey = (a: string, b: string) => [a, b].sort().join("__");
