import { z } from "zod";
import type { ModelMessage } from "ai";
import { chat, json } from "@/lib/llm";
import type { DateEvent, Profile } from "@/lib/types";

export const maxDuration = 300;

const VenueSchema = z.object({
  a_wants: z.string().catch(""),
  b_wants: z.string().catch(""),
  venue: z.string(),
  why: z.string().catch(""),
});
const VerdictSchema = z.object({
  score: z.coerce.number().catch(50),
  // z.coerce.boolean() would turn the string "false" into true.
  second_date: z.union([z.boolean(), z.string()]).transform((v) => v === true || v === "true").catch(false),
  highlights: z.array(z.string()).catch([]),
  concerns: z.array(z.string()).catch([]),
  summary: z.string().catch(""),
  briefing: z.string().catch(""),
});

const first = (p: Profile) => p.name.split(" ")[0];

// Evidence/voice are dropped from the dossier to keep every turn's prompt small (rate limits).
const dossier = ({ evidence: _e, voice: _v, ...rest }: Profile) => JSON.stringify(rest);

const agentSystem = (me: Profile, other: Profile, venue: string) => `You are the dating agent for ${me.name}, out on a first date on their behalf.
You speak AS ${first(me)}, in first person, in their voice: ${me.voice || "natural and warm"}.
What you know about ${first(me)}:
${dossier(me)}

You are on a date at: ${venue}. Across from you is ${first(other)} (represented by their own agent). You only know what they tell you.
Your job: find out whether ${first(other)} fits ${first(me)}'s needs (${me.needs.join("; ")}) and avoids their dealbreakers (${me.dealbreakers.join("; ")}).
Rules:
- Talk like a real person on a date, not a LinkedIn post: warm, curious, a little playful. React to what they just said.
- Ask questions that test real fit (values, lifestyle, what they want), not small talk or tech trivia.
- NEVER invent facts, numbers, projects, stories or achievements that are not in what you know. If you don't know, say so or talk about how you feel.
- Max 2 short sentences (under 45 words). No hashtags, no emojis, no stage directions. Never mention being an AI.

Reply in EXACTLY this format (the THOUGHT is private — ${first(other)} never sees it):
THOUGHT: <one sentence: what you're testing or what you just learned, tied to ${first(me)}'s needs or dealbreakers>
SAY: <your line>`;

// The private thought stays out of the transcript the other agent sees.
function splitTurn(raw: string) {
  const m = raw.match(/THOUGHT:\s*([\s\S]*?)\s*SAY:\s*([\s\S]*)/i);
  if (m) return { thought: m[1].trim(), text: m[2].trim().replace(/^["“]|["”]$/g, "") };
  return { thought: "", text: raw.replace(/^THOUGHT:.*$/im, "").trim() };
}

export async function POST(req: Request) {
  const { a, b, rounds = 3 } = (await req.json()) as { a: Profile; b: Profile; rounds?: number };
  const enc = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: DateEvent) => controller.enqueue(enc.encode(JSON.stringify(e) + "\n"));
      try {
        const { venue, why, a_wants, b_wants } = await json(
          'Two dating agents negotiate where to go. Each proposes a place from their own person\'s hobbies, then they agree on one specific, real-feeling venue/activity in a plausible shared city. JSON: { "a_wants": string (A\'s agent\'s proposal, short), "b_wants": string (B\'s agent\'s proposal, short), "venue": string (the agreed place), "why": string (one sentence on how they reconciled the two) }',
          `Person A: ${JSON.stringify({ name: a.name, location: a.location, hobbies: a.hobbies, interests: a.interests })}\nPerson B: ${JSON.stringify({ name: b.name, location: b.location, hobbies: b.hobbies, interests: b.interests })}`,
          VenueSchema,
        );
        send({ type: "venue", venue, why, proposals: { a: a_wants, b: b_wants } });

        // Each agent keeps its own view of the conversation: its lines are "assistant", the other's are "user".
        const transcript: { speaker: "a" | "b"; text: string }[] = [];
        const view = (self: "a" | "b"): ModelMessage[] => {
          const msgs: ModelMessage[] = transcript.map((t) => ({
            role: t.speaker === self ? "assistant" : "user",
            content: t.text,
          }));
          if (!msgs.length || msgs[msgs.length - 1].role === "assistant")
            msgs.push({ role: "user", content: "(You just sat down. Open the date.)" });
          return msgs;
        };
        const sys = { a: agentSystem(a, b, venue), b: agentSystem(b, a, venue) };

        for (let i = 0; i < rounds * 2; i++) {
          const self = i % 2 === 0 ? "a" : "b";
          const { thought, text } = splitTurn(await chat(sys[self], view(self)));
          transcript.push({ speaker: self, text });
          send({ type: "msg", speaker: self, text, thought });
        }

        const lines = transcript.map((t) => `${first(t.speaker === "a" ? a : b)}: ${t.text}`).join("\n");
        await Promise.all(
          (["a", "b"] as const).map(async (side) => {
            const me = side === "a" ? a : b;
            const other = side === "a" ? b : a;
            const verdict = await json(
              `You are ${me.name}'s dating agent, debriefing privately after the date. Be honest; you work for ${first(me)}, not for the date.
What you know about ${first(me)}: ${JSON.stringify({ needs: me.needs, dealbreakers: me.dealbreakers, values: me.values })}
JSON: { "score": 0-100 fit for ${first(me)}, "second_date": boolean, "highlights": string[], "concerns": string[], "summary": string (2 sentences, cite moments from the date), "briefing": string (2 sentences spoken directly TO ${first(me)} in second person: would you send them on a second date, and what to watch for) }`,
              `Date with ${other.name} at ${venue}:\n${lines}`,
              VerdictSchema,
            );
            verdict.score = Math.max(0, Math.min(100, Math.round(verdict.score)));
            send({ type: "verdict", speaker: side, verdict });
          }),
        );
      } catch (e) {
        send({ type: "error", error: String(e) });
      }
      controller.close();
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson" } });
}
