// Builds public/demo.json by running the same pipeline as the browser, against a running server.
// Usage: node scripts/build-demo.mjs [baseUrl]   (people from docs/people.txt; resumes from an existing demo.json)
import fs from "node:fs";

const BASE = process.argv[2] || "http://localhost:3000";
const OUT = "public/demo.json";
const K = 2; // shortlist size — keeps the date count (and LLM quota) manageable

const liSlug = (u) => decodeURIComponent(u.match(/linkedin\.com\/in\/([^/?#]+)/i)?.[1] ?? "").toLowerCase();
const pairKey = (a, b) => [a, b].sort().join("__");
const lines = fs.readFileSync("docs/people.txt", "utf8").split("\n").map((l) => l.match(/https?:\/\/\S+/g) ?? []).filter((u) => u.length >= 2);
const fresh = lines.map(([linkedin, instagram]) => ({ id: liSlug(linkedin), linkedin, instagram }));

const run = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : { id: "demo", stage: "idle", people: [], dates: {}, log: [] };
for (const p of fresh) if (!run.people.some((q) => q.id === p.id)) run.people.push(p);
const save = () => fs.writeFileSync(OUT, JSON.stringify(run));
const log = (m) => { console.log(m); run.log.push(`${new Date().toLocaleTimeString()}  ${m}`); };
const post = async (path, body) => {
  const r = await fetch(BASE + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
  if (!r.ok || d.error) throw new Error(d.error ?? `HTTP ${r.status}`);
  return d;
};
const pool = async (items, n, fn) => { const q = [...items]; await Promise.all(Array.from({ length: n }, async () => { while (q.length) await fn(q.shift()); })); };
const name = (p) => p.profile?.name ?? p.id;

// 1. scrape
const toScrape = run.people.filter((p) => !p.raw);
if (toScrape.length) {
  log(`Scraping ${toScrape.length}…`);
  const { results } = await post("/api/scrape", { people: toScrape.map(({ id, linkedin, instagram }) => ({ id, linkedin, instagram })) });
  for (const r of results) { const p = run.people.find((x) => x.id === r.id); if (r.linkedin || r.instagram) p.raw = { linkedin: r.linkedin, instagram: r.instagram }; }
  save();
}
// 2. analyze
await pool(run.people.filter((p) => p.raw && !p.profile), 6, async (p) => {
  try { p.profile = (await post("/api/analyze", { ...p.raw, links: { linkedin: p.linkedin, instagram: p.instagram } })).profile; log(`Profile: ${name(p)}`); save(); }
  catch (e) { log(`analyze failed ${p.id}: ${e}`); }
});
// 2b. gender
await pool(run.people.filter((p) => p.profile && !p.gender), 6, async (p) => {
  try { const g = await post("/api/gender", p.raw); p.gender = { gender: g.gender, evidence: g.evidence }; console.log(`${name(p)}: ${g.gender}`); save(); }
  catch (e) { log(`gender failed ${p.id}: ${e}`); }
});
// 3. shortlist (man–woman; unknown matches anyone)
const ready = run.people.filter((p) => p.profile);
const g = (p) => p.gender?.gender ?? "unknown";
const canDate = (a, b) => g(a) === "unknown" || g(b) === "unknown" || g(a) !== g(b);
await pool(ready.filter((p) => !p.shortlist?.length), 6, async (p) => {
  const others = ready.filter((o) => o.id !== p.id && canDate(p, o)).map((o) => ({ id: o.id, profile: o.profile }));
  if (!others.length) return;
  try { p.shortlist = (await post("/api/shortlist", { me: p.profile, others, k: Math.min(K, others.length) })).picks; log(`${name(p)}'s agent asked out ${p.shortlist.map((s) => name(run.people.find((x) => x.id === s.id))).join(", ")}`); save(); }
  catch (e) { log(`shortlist failed ${p.id}: ${e}`); }
});
// 4. dates
for (const p of run.people) for (const s of p.shortlist ?? []) {
  const k = pairKey(p.id, s.id);
  if (!run.dates[k] || run.dates[k].status !== "done") { const [a, b] = [p.id, s.id].sort(); run.dates[k] = { a, b, status: "pending", messages: [], verdicts: {} }; }
}
const pending = Object.keys(run.dates).filter((k) => run.dates[k].status === "pending");
log(`${pending.length} dates scheduled.`);
let done = 0;
await pool(pending, 6, async (k) => {
  const d = run.dates[k];
  const a = run.people.find((x) => x.id === d.a), b = run.people.find((x) => x.id === d.b);
  try {
    const r = await fetch(BASE + "/api/date", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ a: a.profile, b: b.profile }) });
    const text = await r.text();
    for (const line of text.split("\n").filter(Boolean)) {
      const e = JSON.parse(line);
      if (e.type === "venue") d.venue = { venue: e.venue, why: e.why, proposals: e.proposals };
      if (e.type === "msg") d.messages.push({ speaker: e.speaker, text: e.text, thought: e.thought });
      if (e.type === "verdict") d.verdicts[e.speaker] = e.verdict;
      if (e.type === "error") throw new Error(e.error);
    }
    d.status = Object.keys(d.verdicts).length === 2 ? "done" : "error";
  } catch (e) { d.status = "error"; d.error = String(e); }
  console.log(`[${++done}/${pending.length}] ${name(a)} × ${name(b)}: ${d.status}`);
  save();
});
run.stage = "done";
log("All done — rankings are ready.");
save();
