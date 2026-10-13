"use client";
import { useEffect, useSyncExternalStore } from "react";
import type { Run } from "./types";

// Two runs: "demo" (pre-computed, served from /demo.json) and "live" (this browser, localStorage).
const runs: Record<string, Run | undefined> = {};
const listeners = new Set<() => void>();
const KEY = "agentdate:live";

export const getRun = (id: string) => runs[id];

export function setRun(run: Run) {
  runs[run.id] = run;
  if (run.id === "live") {
    try {
      localStorage.setItem(KEY, JSON.stringify(run));
    } catch {}
  }
  listeners.forEach((l) => l());
}

export function update(id: string, fn: (r: Run) => void) {
  const r = runs[id];
  if (!r) return;
  fn(r);
  setRun({ ...r });
}

export async function loadRun(id: string): Promise<Run | undefined> {
  if (runs[id]) return runs[id];
  if (id === "live") {
    try {
      const s = localStorage.getItem(KEY);
      if (s) setRun(JSON.parse(s));
    } catch {}
  } else if (id === "demo") {
    // Without public/demo.json, "/demo.json" falls through to the [run] page and returns HTML.
    try {
      const res = await fetch("/demo.json");
      if (res.ok && res.headers.get("content-type")?.includes("json")) setRun({ ...(await res.json()), id: "demo" });
    } catch {}
  }
  return runs[id];
}

export function useRun(id: string) {
  useEffect(() => {
    loadRun(id);
  }, [id]);
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => runs[id],
    () => undefined,
  );
}
