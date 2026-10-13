// Drop media/URL/ID noise and cap sizes so the raw profile fits an LLM prompt.
// Case-sensitive and anchored so real keys like "topics", "paid" or "returnDate" survive.
const NOISE = /^(id|urn|fbid|dimensions|childPosts|images|relatedProfiles|latestIgtvVideos|externalUrlShimmed|moreProfiles|emails|profileActions|composeOptionType|sectionTotals|originalQuery|profileLocales)$|[uU]rls?$|^(profilePic|thumbnail|display|video|sidecar)|[iI]mage|Id$/;

export function prune(v: unknown, depth = 0): unknown {
  if (typeof v === "string") return v.length > 600 ? v.slice(0, 600) + "…" : v;
  if (Array.isArray(v)) return v.slice(0, depth === 0 ? 12 : 8).map((x) => prune(x, depth + 1));
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) {
      if (x === null || x === "" || (Array.isArray(x) && !x.length)) continue;
      if (NOISE.test(k) && k !== "alt") continue;
      out[k] = prune(x, depth + 1);
    }
    return out;
  }
  return v;
}
