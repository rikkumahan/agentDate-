import { ApifyClient } from "apify-client";
import { igHandle, liSlug } from "@/lib/links";
import { prune } from "@/lib/prune";
import { matchInstagram, matchLinkedin } from "@/lib/match";

export const maxDuration = 300;

const apify = new ApifyClient({ token: process.env.APIFY_TOKEN });

async function runActor(actor: string, input: object) {
  const run = await apify.actor(actor).call(input, { waitSecs: 280 });
  // call() resolves (not throws) on timeout/failure — surface that instead of "nothing scraped".
  if (run.status !== "SUCCEEDED") throw new Error(`${actor} run ${run.status} (${run.id})`);
  const { items } = await apify.dataset(run.defaultDatasetId).listItems();
  // Some actors "succeed" but only emit an error item (e.g. plan restrictions).
  const errs = items.filter((i) => i.error && Object.keys(i).length <= 2);
  if (items.length && errs.length === items.length) throw new Error(`${actor}: ${errs[0].error}`);
  return items;
}

export async function POST(req: Request) {
  const { people } = (await req.json()) as { people: { id: string; linkedin: string; instagram: string }[] };
  if (!process.env.APIFY_TOKEN) return Response.json({ error: "APIFY_TOKEN not set" }, { status: 500 });

  const handles = people.map((p) => igHandle(p.instagram)).filter(Boolean);
  const liUrls = people.map((p) => p.linkedin).filter(Boolean);

  const liBatchErrors: string[] = [];
  const [ig, li] = await Promise.allSettled([
    runActor(process.env.IG_ACTOR || "apify/instagram-profile-scraper", { usernames: handles }),
    // Apify free plan caps this actor at 10 items per run, so fan out in parallel batches of 10.
    Promise.all(
      Array.from({ length: Math.ceil(liUrls.length / 10) }, (_, i) => liUrls.slice(i * 10, i * 10 + 10)).map((urls) =>
        // One failed batch must not wipe the others' LinkedIn data.
        runActor(process.env.LINKEDIN_ACTOR || "harvestapi/linkedin-profile-scraper", { urls, profileUrls: urls }).catch((e) => {
          liBatchErrors.push(String(e));
          return [];
        }),
      ),
    ).then((batches) => batches.flat()),
  ]);
  const igItems = ig.status === "fulfilled" ? ig.value : [];
  const liItems = li.status === "fulfilled" ? li.value : [];

  const results = people.map((p) => {
    let igItem = matchInstagram(igItems, igHandle(p.instagram));
    const liItem = matchLinkedin(liItems, liSlug(p.linkedin));
    const notes: string[] = [];
    if (igItem?.error) {
      notes.push(`Instagram: ${igItem.errorDescription ?? igItem.error}`);
      igItem = undefined;
    } else if (igItem?.private) notes.push("Instagram is private — only the bio is readable");
    if (!igItem && !notes.length) notes.push("Instagram: no data returned");
    if (!liItem) notes.push("LinkedIn: no data returned");
    return {
      id: p.id,
      linkedin: liItem ? prune(liItem) : null,
      instagram: igItem ? prune(igItem) : null,
      notes,
    };
  });

  return Response.json({
    results,
    errors: {
      instagram: ig.status === "rejected" ? String(ig.reason) : null,
      linkedin: li.status === "rejected" ? String(li.reason) : liBatchErrors.join("; ") || null,
    },
  });
}
