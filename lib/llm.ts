import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, type ModelMessage } from "ai";
import type { z } from "zod";
import { extractJson, stripThink } from "@/lib/json";
import { parseWait, pick } from "@/lib/schedule";
import { safeBaseUrl } from "@/lib/links";

const BASE_URL = process.env.LLM_BASE_URL || "https://api.groq.com/openai/v1";
const list = (s?: string) => (s ?? "").split(",").map((x) => x.trim()).filter(Boolean);
const MODEL_IDS = list(process.env.LLM_MODELS || process.env.LLM_MODEL || "openai/gpt-oss-120b");
type Provider = ReturnType<typeof createOpenAICompatible>;
type LlmSlot = { key: string; id: string; make: Provider; slow?: boolean };

// Every (key, model) pair is a slot: Groq limits tokens per model per organization, so each pair has its own budget.
// LLM_API_KEY may hold several comma-separated keys; LLM3_API_KEY adds more on the same host.
const SHARED: LlmSlot[] = list(`${process.env.LLM_API_KEY ?? ""},${process.env.LLM3_API_KEY ?? ""}`).flatMap((apiKey, k) => {
  const make = createOpenAICompatible({ name: "llm", baseURL: BASE_URL, apiKey });
  return MODEL_IDS.map((id) => ({ key: `key${k}:${id}`, id, make }));
});
// Optional self-hosted OpenAI-compatible host (e.g. Ollama): slow, so only used when every Groq slot is benched.
if (process.env.LLM2_BASE_URL) {
  const make = createOpenAICompatible({ name: "llm2", baseURL: process.env.LLM2_BASE_URL, apiKey: process.env.LLM2_API_KEY || "ollama" });
  for (const id of list(process.env.LLM2_MODELS)) SHARED.push({ key: `llm2:${id}`, id, make, slow: true });
}

// A visitor's own OpenAI-compatible provider (x-llm-base / x-llm-key / x-llm-model headers),
// scoped to the request that carried it.
type UserLlm = { baseURL: string; apiKey: string; model: string };
// Per request: the visitor provider (if any) and a deadline safely inside the 300s function limit.
const ctx = new AsyncLocalStorage<{ user?: UserLlm; deadline: number }>();
const REQUEST_BUDGET_MS = 280_000;
const CALL_TIMEOUT_MS = 100_000; // Cloudflare tunnels (self-hosted Ollama) cut responses at 100s anyway
export const withUserKey =
  (handler: (req: Request) => Promise<Response>) =>
  (req: Request) => {
    const h = (n: string) => req.headers.get(n)?.trim() ?? "";
    const u = { baseURL: h("x-llm-base"), apiKey: h("x-llm-key"), model: h("x-llm-model") };
    const user = u.apiKey && u.model && safeBaseUrl(u.baseURL) ? u : undefined;
    return ctx.run({ user, deadline: Date.now() + REQUEST_BUDGET_MS }, () => handler(req));
  };

const userSlots = ({ baseURL, apiKey, model }: UserLlm): LlmSlot[] => [
  { key: `user:${new URL(baseURL).host}:${createHash("sha256").update(apiKey).digest("hex").slice(0, 8)}:${model}`, id: model, make: createOpenAICompatible({ name: "llm", baseURL, apiKey }) },
];

// ponytail: bench times live in this server instance's memory; a cold instance relearns them on its first 429.
const readyAt = new Map<string, number>();
let cursor = 0;
const MAX_WAIT = 20_000; // longer than this and we fail fast with a clear message instead of hanging the date

// gpt-oss is ~3x faster at "low" reasoning; other models may reject the option, so scope it.
const effort = process.env.LLM_REASONING_EFFORT;
const optionsFor = (id: string) => (effort && id.includes("gpt-oss") ? { llm: { reasoningEffort: effort } } : undefined);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function chat(system: string, messages: ModelMessage[], temperature = 0.9) {
  const { user: own, deadline } = ctx.getStore() ?? { deadline: Infinity };
  // A visitor's own key is tried first; the shared pool is the fallback.
  const pools = own ? [userSlots(own), SHARED] : [SHARED];
  let lastErr: unknown = new Error("No LLM configured (set LLM_API_KEY)");
  for (let attempt = 0; attempt < 12; attempt++) {
    const now = Date.now();
    const left = deadline - now;
    if (left < 5_000) throw new Error(`Out of time for this request (last error: ${String(lastErr).slice(0, 120)})`);
    const picks = pools.map((p) => pick(p, readyAt, now, cursor));
    const hit = picks.find((p) => "slot" in p);
    if (!hit) {
      const wait = Math.min(...picks.map((p) => ("wait" in p ? p.wait : Infinity)));
      if (wait > Math.min(MAX_WAIT, left - 5_000))
        throw new Error(`All LLM keys are rate-limited for ~${Math.ceil(wait / 60000)} min. Add your own API key on the home page, or retry later.`);
      await sleep(wait);
      continue;
    }
    const { key, id, make } = (hit as { slot: LlmSlot }).slot;
    cursor++;
    try {
      const { text } = await generateText({
        model: make(id), system, messages, temperature, maxRetries: 0, maxOutputTokens: 3000, providerOptions: optionsFor(id),
        abortSignal: AbortSignal.timeout(Math.min(CALL_TIMEOUT_MS, left)),
      });
      const out = stripThink(text).trim();
      if (out) return out;
      lastErr = new Error(`${id} returned empty text`);
    } catch (e) {
      lastErr = e;
    }
    // Bench the slot for exactly as long as Groq asks (daily limits can be hours); unknown failures sit out 20s.
    readyAt.set(key, Date.now() + (parseWait(String(lastErr)) ?? 20_000));
    console.warn(`[llm] ${key} benched: ${String(lastErr).slice(0, 160)}`);
  }
  throw lastErr;
}

// Plain-text JSON extraction instead of provider structured outputs:
// works the same on Groq, Ollama and anything else OpenAI-compatible.
export async function json<T extends z.ZodType>(system: string, prompt: string, schema: T): Promise<z.infer<T>> {
  let last = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await chat(
      system + "\n\nRespond with ONLY a single valid JSON object. No markdown, no commentary.",
      [{ role: "user", content: attempt ? `${prompt}\n\nYour previous reply was not valid JSON. Try again.` : prompt }],
      0.4,
    );
    last = text;
    try {
      return schema.parse(extractJson(text));
    } catch {}
  }
  throw new Error("LLM did not return valid JSON: " + last.slice(0, 200));
}
