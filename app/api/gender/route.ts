import { z } from "zod";
import { json, withUserKey } from "@/lib/llm";

export const maxDuration = 300;

const Schema = z.object({
  gender: z.enum(["woman", "man", "unknown"]).catch("unknown"),
  evidence: z.string().catch(""),
});

// Used only to pair agents man–woman. Explicit signals only — never the name alone.
const SYSTEM = `You read a person's public LinkedIn and Instagram data and report their gender ONLY if it is explicitly stated or clearly signalled.
Valid signals: pronouns (she/her, he/him) in their bio/headline/pronouns field; how others refer to them in LinkedIn recommendations ("she led…", "he built…");
self-descriptions ("mom", "dad", "mother", "father", "wife", "husband", "woman", "man", "girl", "guy").
Do NOT infer from the first name or photos. If there is no explicit signal, answer "unknown".
JSON: { "gender": "woman" | "man" | "unknown", "evidence": string (quote the signal, or "none") }`;

async function handle(req: Request): Promise<Response> {
  const { linkedin, instagram } = await req.json();
  // Recommendations and pronoun fields carry most of the signal, so send them first and untruncated by the rest.
  const li = linkedin ?? {};
  const signals = { pronoun: li.pronoun ?? li.pronouns, headline: li.headline, about: li.about, recommendations: li.receivedRecommendations };
  const prompt = `LINKEDIN SIGNALS:\n${JSON.stringify(signals).slice(0, 5000)}\n\nINSTAGRAM:\n${JSON.stringify({ bio: instagram?.biography, posts: instagram?.latestPosts?.map((p: { caption?: string }) => p.caption) }).slice(0, 3000)}`;
  try {
    return Response.json(await json(SYSTEM, prompt, Schema));
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export const POST = withUserKey(handle);
