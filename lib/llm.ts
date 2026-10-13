import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, type ModelMessage } from "ai";
import type { z } from "zod";
import { extractJson, stripThink } from "@/lib/json";

// LLM_API_KEY may hold several comma-separated keys; each gets its own provider in the pool.
const providers = (process.env.LLM_API_KEY || "").split(",").map((k) => k.trim()).filter(Boolean).map((apiKey) =>
  createOpenAICompatible({ name: "llm", baseURL: process.env.LLM_BASE_URL || "https://api.groq.com/openai/v1", apiKey }),
);

// Optional second OpenAI-compatible host (e.g. a self-hosted Ollama) joins the same pool.
const provider2 = process.env.LLM2_BASE_URL
  ? createOpenAICompatible({ name: "llm2", baseURL: process.env.LLM2_BASE_URL, apiKey: process.env.LLM2_API_KEY || "ollama" })
  : undefined;

const list = (s?: string) => (s ?? "").split(",").map((x) => x.trim()).filter(Boolean);

// Groq rate-limits per model (8k tokens/min on free tier), so rotate through a pool:
// LLM_MODELS="openai/gpt-oss-120b,openai/gpt-oss-20b,qwen/qwen3.8-27b" ≈ 3x throughput, plus LLM2_MODELS.
const MODELS = [
  ...providers.flatMap((make) => list(process.env.LLM_MODELS || process.env.LLM_MODEL || "openai/gpt-oss-120b").map((id) => ({ id, make }))),
  ...(provider2 ? list(process.env.LLM2_MODELS).map((id) => ({ id, make: provider2 })) : []),
];
let cursor = 0;

// gpt-oss is ~3x faster at "low" reasoning; other models may reject the option, so scope it.
const effort = process.env.LLM_REASONING_EFFORT;
const optionsFor = (id: string) => (effort && id.includes("gpt-oss") ? { llm: { reasoningEffort: effort } } : undefined);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function chat(system: string, messages: ModelMessage[], temperature = 0.9) {
  let lastErr: unknown;
  // On any failure (usually 429) move straight to the next model; back off only after a full lap.
  for (let attempt = 0; attempt < MODELS.length * 8; attempt++) {
    const { id, make } = MODELS[cursor++ % MODELS.length];
    try {
      const { text } = await generateText({ model: make(id), system, messages, temperature, maxRetries: 0, maxOutputTokens: 3000, providerOptions: optionsFor(id) });
      const out = stripThink(text).trim();
      if (out) return out;
      lastErr = new Error(`${id} returned empty text`);
    } catch (e) {
      lastErr = e;
    }
    console.warn(`[llm] ${id} failed: ${String(lastErr).slice(0, 160)}`);
    if ((attempt + 1) % MODELS.length === 0) await sleep(8000);
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
