"use client";
import { getRun, update } from "./store";
import { pairKey, type DateEvent, type Person, type Run } from "./types";

const ID = "live";
const SHORTLIST_K = 3;

async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(Array.from({ length: n }, async () => {
    while (queue.length) await fn(queue.shift()!);
  }));
}

const log = (msg: string) => update(ID, (r) => void r.log.push(`${new Date().toLocaleTimeString()}  ${msg}`));
const person = (r: Run, id: string) => r.people.find((p) => p.id === id)!;
const nameOf = (p: Person) => p.profile?.name ?? p.id;

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
  if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data;
}

// Resumable: every stage skips work that is already done, so "Run" after a failure
// (or after adding people to an existing pool) only does what is missing.
let running = false;
export const isRunning = () => running;
export async function runPipeline() {
  if (running) return;
  running = true;
  try {
    await pipeline();
  } finally {
    running = false;
  }
}

async function pipeline() {
  const stage = (s: Run["stage"]) => update(ID, (r) => void (r.stage = s));
  const r0 = getRun(ID)!;

  // 1. Scrape
  const toScrape = r0.people.filter((p) => !p.raw);
  if (toScrape.length) {
    stage("scraping");
    log(`Scraping ${toScrape.length} people (LinkedIn + Instagram via Apify)…`);
    try {
      const { results, errors } = await post("/api/scrape", { people: toScrape.map(({ id, linkedin, instagram }) => ({ id, linkedin, instagram })) });
      if (errors.linkedin) log(`LinkedIn scraper error: ${errors.linkedin}`);
      if (errors.instagram) log(`Instagram scraper error: ${errors.instagram}`);
      update(ID, (r) => {
        for (const res of results) {
          const p = person(r, res.id);
          for (const n of res.notes ?? []) r.log.push(`${new Date().toLocaleTimeString()}  ${p.id}: ${n}`);
          if (res.linkedin || res.instagram) {
            p.raw = { linkedin: res.linkedin, instagram: res.instagram };
            p.error = undefined;
          } else p.error = "Nothing scraped — check the links are public";
        }
      });
      log(`Scraped ${results.filter((x: { linkedin: unknown; instagram: unknown }) => x.linkedin || x.instagram).length}/${toScrape.length}`);
    } catch (e) {
      log(`Scrape failed: ${e}`);
    }
  }

  // 2. Analyze
  const toAnalyze = getRun(ID)!.people.filter((p) => p.raw && !p.profile);
  if (toAnalyze.length) {
    stage("analyzing");
    log(`Agents reading ${toAnalyze.length} people…`);
    await pool(toAnalyze, 4, async (p) => {
      try {
        const { profile } = await post("/api/analyze", { ...p.raw, links: { linkedin: p.linkedin, instagram: p.instagram } });
        update(ID, (r) => void (person(r, p.id).profile = profile));
        log(`Profile ready: ${profile.name}`);
      } catch (e) {
        update(ID, (r) => void (person(r, p.id).error = String(e)));
        log(`Analysis failed for ${p.id}: ${e}`);
      }
    });
  }

  // 3. Shortlist
  const ready = getRun(ID)!.people.filter((p) => p.profile);
  const toShortlist = ready.filter((p) => !p.shortlist?.length);
  if (toShortlist.length && ready.length > 1) {
    stage("shortlisting");
    log(`${toShortlist.length} agents choosing who to date…`);
    await pool(toShortlist, 4, async (p) => {
      try {
        const others = ready.filter((o) => o.id !== p.id).map((o) => ({ id: o.id, profile: o.profile }));
        const { picks } = await post("/api/shortlist", { me: p.profile, others, k: Math.min(SHORTLIST_K, others.length) });
        update(ID, (r) => void (person(r, p.id).shortlist = picks));
        log(`${nameOf(p)}'s agent asked out ${picks.map((x: { id: string }) => nameOf(person(getRun(ID)!, x.id))).join(", ")}`);
      } catch (e) {
        log(`Shortlist failed for ${nameOf(p)}: ${e}`);
      }
    });
  }

  // 4. Dates — one per unique shortlisted pair
  update(ID, (r) => {
    for (const p of r.people)
      for (const pick of p.shortlist ?? []) {
        const key = pairKey(p.id, pick.id);
        // "live" here means a date interrupted by a page reload — nothing else can be running.
        if (!r.dates[key] || r.dates[key].status === "error" || r.dates[key].status === "live") {
          // Don't split the key: Instagram-handle ids can themselves contain "__".
          const [a, b] = [p.id, pick.id].sort();
          r.dates[key] = { a, b, status: "pending", messages: [], verdicts: {} };
        }
      }
  });
  const pending = Object.keys(getRun(ID)!.dates).filter((k) => getRun(ID)!.dates[k].status === "pending");
  if (pending.length) {
    stage("dating");
    log(`${pending.length} dates scheduled.`);
    await pool(pending, 5, runDate);
  }

  stage("done");
  log("All done — rankings are ready.");
}

async function runDate(key: string) {
  const r = getRun(ID)!;
  const d = r.dates[key];
  const a = person(r, d.a), b = person(r, d.b);
  const set = (fn: (d: Run["dates"][string]) => void) => update(ID, (run) => fn(run.dates[key]));
  set((d) => {
    d.status = "live";
    d.messages = [];
    d.verdicts = {};
  });
  try {
    const res = await fetch("/api/date", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ a: a.profile, b: b.profile }) });
    if (!res.body) throw new Error(`HTTP ${res.status}`);
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buf = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += value;
      const lines = buf.split("\n");
      buf = lines.pop()!;
      for (const line of lines.filter(Boolean)) {
        const e = JSON.parse(line) as DateEvent;
        if (e.type === "venue") set((d) => void (d.venue = { venue: e.venue, why: e.why }));
        if (e.type === "msg") set((d) => void d.messages.push({ speaker: e.speaker, text: e.text }));
        if (e.type === "verdict") set((d) => void (d.verdicts[e.speaker] = e.verdict));
        if (e.type === "error") throw new Error(e.error);
      }
    }
    set((d) => void (d.status = Object.keys(d.verdicts).length === 2 ? "done" : "error"));
    log(`Date finished: ${nameOf(a)} × ${nameOf(b)}`);
  } catch (e) {
    set((d) => {
      d.status = "error";
      d.error = String(e);
    });
    log(`Date failed: ${nameOf(a)} × ${nameOf(b)}: ${e}`);
  }
}
