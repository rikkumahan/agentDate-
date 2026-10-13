import { liSlug } from "./links.ts";

// Actors don't echo our ids back, so scrape results are matched by handle / slug.
export function matchInstagram<T extends { username?: unknown }>(items: T[], handle: string) {
  return items.find((i) => String(i.username ?? "").toLowerCase() === handle);
}

// Exact slug match on the item's own identifier / top-level profile URL fields only —
// nested "people also viewed" URLs must not match.
export function matchLinkedin(items: unknown[], slug: string) {
  if (!slug) return undefined;
  return items.find((i) => {
    const o = i as Record<string, unknown>;
    if (String(o.publicIdentifier ?? "").toLowerCase() === slug) return true;
    return Object.values(o).some((v) => typeof v === "string" && liSlug(v) === slug);
  });
}
