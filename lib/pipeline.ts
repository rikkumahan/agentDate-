"use client";
import { getRun, update } from "./store";
import { pairKey, type DateEvent, type Person, type Run } from "./types";

const ID = "live";
const SHORTLIST_K = 3;

// Pause state lives on globalThis so it survives hot reloads of this module.
const ctl = ((globalThis as { __agentdate?: { paused: boolean; aborts: Set<AbortController> } }).__agentdate ??= {
  paused: false,
  aborts: new Set(),
});

async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(Array.from({ length: n }, async () => {
    while (queue.length && !ctl.paused) await fn(queue.shift()!);
  }));
}

// Stops starting new work and cancels in-flight dates; they go back to "pending" for the next run.
export function pausePipeline() {
  ctl.paused = true;
  ctl.aborts.forEach((c) => c.abort());
}
export const isPaused = () => ctl.paused;

// Man–woman matching; people with no explicit gender signal can be matched with anyone.
const canDate = (a: Person, b: Person) => {
  const x = a.gender?.gender ?? "unknown", y = b.gender?.gender ?? "unknown";
  return x === "unknown" || y === "unknown" || x !== y;
};

// Throw away shortlists + dates (keeps profiles) and match again with the current rules and prompts.
export function redoDates() {
  if (running) return;
  update(ID, (r) => {
    r.dates = {};
    for (const p of r.people) p.shortlist = undefined;
    r.log.push(`${new Date().toLocaleTimeString()}  Cleared shortlists and dates — agents are choosing again.`);
  });
  runPipeline();
}

const log = (msg: string) => update(ID, (r) => void r.log.push(`${new Date().toLocaleTimeString()}  ${msg}`));
const person = (r: Run, id: string) => r.people.find((p) => p.id === id)!;
const nameOf = (p: Person) => p.profile?.name ?? p.id;

// A visitor's own OpenAI-compatible provider (saved on the home page) rides along on every API call;
// it is never stored server-side.
export type OwnLlm = { baseURL: string; apiKey: string; model: string };
const LLM_KEY = "agentdate:llm";
export function loadOwnLlm(): OwnLlm {
  try {
    return { baseURL: "", apiKey: "", model: "", ...JSON.parse(localStorage.getItem(LLM_KEY) ?? "{}") };
  } catch {
    return { baseURL: "", apiKey: "", model: "" };
  }
}
export function saveOwnLlm(v: OwnLlm) {
  try {
    if (v.baseURL || v.apiKey || v.model) localStorage.setItem(LLM_KEY, JSON.stringify(v));
    else localStorage.removeItem(LLM_KEY);
  } catch {}
}
const headers = (): Record<string, string> => {
  const { baseURL, apiKey, model } = loadOwnLlm();
  const own: Record<string, string> = baseURL && apiKey && model ? { "x-llm-base": baseURL, "x-llm-key": apiKey, "x-llm-model": model } : {};
  return { "Content-Type": "application/json", ...own };
};

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: headers(), body: JSON.stringify(body) });
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
  ctl.paused = false;
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
        update(ID, (r) => {
          person(r, p.id).profile = profile;
          person(r, p.id).error = undefined;
        });
        log(`Profile ready: ${profile.name}`);
      } catch (e) {
        update(ID, (r) => void (person(r, p.id).error = String(e)));
        log(`Analysis failed for ${p.id}: ${e}`);
      }
    });
  }

  // 2b. Gender, from explicit signals only — used to pair agents man–woman.
  const toClassify = getRun(ID)!.people.filter((p) => p.profile && p.raw && !p.gender);
  if (toClassify.length) {
    stage("classifying");
    log(`Checking ${toClassify.length} profiles for explicit gender signals (pronouns, recommendations)…`);
    await pool(toClassify, 4, async (p) => {
      try {
        const g = await post("/api/gender", p.raw);
        update(ID, (r) => void (person(r, p.id).gender = { gender: g.gender, evidence: g.evidence }));
      } catch (e) {
        log(`Gender check failed for ${nameOf(p)}: ${e}`);
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
        const others = ready.filter((o) => o.id !== p.id && canDate(p, o)).map((o) => ({ id: o.id, profile: o.profile }));
        if (!others.length) return log(`No compatible people in the pool for ${nameOf(p)} yet.`);
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
  if (ctl.paused) {
    stage("idle");
    log("Paused. Press Resume to continue where the agents left off.");
    return;
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
  const abort = new AbortController();
  ctl.aborts.add(abort);
  try {
    // The route stops before the server time limit on slow providers; each leg sends back what we have so far
    // and continues from there. Legs that add nothing mean it is stuck.
    for (let leg = 0; leg < 6; leg++) {
      const cur = getRun(ID)!.dates[key];
      if (Object.keys(cur.verdicts).length === 2) break;
      const before = cur.messages.length + (cur.venue ? 1 : 0);
      const body = { a: a.profile, b: b.profile, venue: cur.venue?.venue, messages: cur.messages.map(({ speaker, text }) => ({ speaker, text })) };
      const res = await fetch("/api/date", { method: "POST", headers: headers(), body: JSON.stringify(body), signal: abort.signal });
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
          if (e.type === "venue") set((d) => void (d.venue = { venue: e.venue, why: e.why, proposals: e.proposals }));
          if (e.type === "msg") set((d) => void d.messages.push({ speaker: e.speaker, text: e.text, thought: e.thought }));
          if (e.type === "verdict") set((d) => void (d.verdicts[e.speaker] = e.verdict));
          if (e.type === "error") throw new Error(e.error);
        }
      }
      const now = getRun(ID)!.dates[key];
      if (now.messages.length + (now.venue ? 1 : 0) === before && Object.keys(now.verdicts).length < 2) break;
    }
    set((d) => {
      d.status = Object.keys(d.verdicts).length === 2 ? "done" : "error";
      if (d.status === "error") d.error ??= "stream ended early";
    });
    log(`Date finished: ${nameOf(a)} × ${nameOf(b)}`);
  } catch (e) {
    if (abort.signal.aborted) {
      set((d) => {
        d.status = "pending";
        d.messages = [];
        d.verdicts = {};
      });
      return;
    }
    set((d) => {
      d.status = "error";
      d.error = String(e);
    });
    log(`Date failed: ${nameOf(a)} × ${nameOf(b)}: ${e}`);
  } finally {
    ctl.aborts.delete(abort);
  }
}
