// Picks which (key, model) slot serves the next LLM call.
// Each slot has a "ready at" time; a rate-limited slot is benched until Groq says it is free again,
// instead of being retried blindly. Fast slots (Groq) are preferred; slow ones (self-hosted) are a last resort.
export type Slot = { key: string; slow?: boolean };

export function pick<T extends Slot>(slots: T[], readyAt: Map<string, number>, now: number, cursor: number): { slot: T } | { wait: number } {
  const order = slots.map((_, i) => slots[(cursor + i) % slots.length]);
  const free = (s: T) => (readyAt.get(s.key) ?? 0) <= now;
  const slot = order.find((s) => !s.slow && free(s)) ?? order.find(free);
  if (slot) return { slot };
  return { wait: Math.min(...slots.map((s) => readyAt.get(s.key) ?? 0)) - now };
}

// Groq 429s say "Please try again in 1h2m3.5s" / "7.66s" / "450ms". Returns ms, or undefined.
export function parseWait(message: string): number | undefined {
  const m = message.match(/try again in ((?:\d+(?:\.\d+)?(?:ms|h|m|s))+)/i);
  if (!m) return undefined;
  const unit: Record<string, number> = { ms: 1, s: 1e3, m: 6e4, h: 3.6e6 };
  let ms = 0;
  for (const [, n, u] of m[1].matchAll(/(\d+(?:\.\d+)?)(ms|h|m|s)/g)) ms += Number(n) * unit[u];
  return Math.ceil(ms);
}
