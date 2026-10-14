import { json, withUserKey } from "@/lib/llm";
import { ProfileSchema } from "@/lib/types";

export const maxDuration = 300;

const SYSTEM = `You are a personal dating agent. You are about to represent one real person on dates.
Your only sources are their public LinkedIn and public Instagram data, given as raw JSON.
Read both carefully and build the dossier you will date with.

Rules:
- Ground every claim in the data. Instagram captions, hashtags, locations and image alt-text reveal hobbies,
  lifestyle and personality; LinkedIn reveals career, ambition, education, values and how they present themselves.
- Infer needs (what this person needs in a partner) from the patterns you see, and say so plainly.
- Never invent facts. If something is unknown, say "unknown".
- Do not guess sexual orientation, religion, health or ethnicity.

JSON shape:
{
  "name": string,
  "headline": string,                 // one line: who they are
  "location": string,
  "age_range": string,                // estimate from career timeline, or "unknown"
  "summary": string,                  // 3 sentences in third person, warm and specific
  "career": string,                   // 1-2 sentences
  "lifestyle": string,                // 1-2 sentences: how they spend their time
  "personality": string[],            // 4-6 traits
  "interests": string[],              // 5-8 topics they care about
  "hobbies": string[],                // 3-6 things they actively do
  "values": string[],                 // 3-5
  "needs": string[],                  // 3-5: what they need in a partner, and why
  "dealbreakers": string[],           // 2-4 likely mismatches
  "evidence": [{ "claim": string, "source": "linkedin" | "instagram", "quote": string }],  // 5-8 items, quote the data
  "voice": string                     // how this person talks/writes, so you can speak like them on a date
}`;

async function handle(req: Request): Promise<Response> {
  const { linkedin, instagram, links } = await req.json();
  if (!linkedin && !instagram) return Response.json({ error: "No data scraped for this person" }, { status: 422 });
  const prompt = `LinkedIn URL: ${links?.linkedin}\nInstagram URL: ${links?.instagram}

LINKEDIN DATA:
${linkedin ? JSON.stringify(linkedin).slice(0, 6000) : "(not available)"}

INSTAGRAM DATA:
${instagram ? JSON.stringify(instagram).slice(0, 6000) : "(not available)"}`;
  try {
    let profile = await json(SYSTEM, prompt, ProfileSchema);
    // Schema defaults can turn a garbled reply into an empty profile; retry once rather than accept it.
    if (!profile.summary || !profile.needs.length) profile = await json(SYSTEM, prompt, ProfileSchema);
    if (!profile.summary || !profile.needs.length) throw new Error("Model returned an empty profile");
    // Models sometimes leave the name as "Unknown"; the scraped data always has it.
    if (!profile.name || /^unknown$/i.test(profile.name))
      profile.name = [linkedin?.firstName, linkedin?.lastName].filter(Boolean).join(" ") || instagram?.fullName || profile.name;
    return Response.json({ profile });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export const POST = withUserKey(handle);
