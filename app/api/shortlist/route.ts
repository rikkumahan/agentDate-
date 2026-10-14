import { z } from "zod";
import { json, withUserKey } from "@/lib/llm";
import type { Profile } from "@/lib/types";

export const maxDuration = 60;

const Schema = z.object({
  picks: z.array(z.object({ id: z.string(), reason: z.string().catch("") })).catch([]),
});

const card = (p: Profile) =>
  `${p.name} — ${p.headline}. ${p.location}. Interests: ${p.interests.join(", ")}. Hobbies: ${p.hobbies.join(", ")}. Values: ${p.values.join(", ")}. Needs: ${p.needs.join("; ")}`;

async function handle(req: Request): Promise<Response> {
  const { me, others, k = 3 } = (await req.json()) as {
    me: Profile;
    others: { id: string; profile: Profile }[];
    k?: number;
  };
  const system = `You are the dating agent for ${me.name}. You know them deeply:
${JSON.stringify(me)}

Pick the ${k} people from the pool you most want to take ${me.name} on a date with.
Weigh their needs, values, lifestyle and location against each candidate — not just shared hobbies.
JSON: { "picks": [{ "id": string, "reason": string }] }  // exactly ${k}, best first; "id" is copied exactly from the pool; reason = one sentence`;
  const prompt = "POOL:\n" + others.map((o) => `id: "${o.id}" — ${card(o.profile)}`).join("\n");
  try {
    const { picks } = await json(system, prompt, Schema);
    // Models sometimes echo "[id]", the person's name, or change case — resolve all of those.
    const norm = (s: string) => s.replace(/[\[\]"']/g, "").trim().toLowerCase();
    const resolve = (raw: string) =>
      others.find((o) => norm(o.id) === norm(raw))?.id ?? others.find((o) => norm(o.profile.name) === norm(raw))?.id;
    const seen = new Set<string>();
    const good = picks
      .map((p) => ({ ...p, id: resolve(p.id) ?? "" }))
      .filter((p) => p.id && !seen.has(p.id) && seen.add(p.id))
      .slice(0, k);
    // An empty shortlist would be saved and never retried — fail so the pipeline can retry it.
    if (!good.length) throw new Error("Agent returned no valid picks");
    return Response.json({ picks: good });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export const POST = withUserKey(handle);
