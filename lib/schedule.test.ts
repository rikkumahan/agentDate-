import assert from "node:assert";
import { parseWait, pick } from "./schedule.ts";

// parseWait
assert.strictEqual(parseWait("Rate limit reached ... Please try again in 7.66s. Need more tokens?"), 7660);
assert.strictEqual(parseWait("try again in 1h2m3.5s"), 3723500);
assert.strictEqual(parseWait("try again in 450ms"), 450);
assert.strictEqual(parseWait("try again in 12m30s"), 750000);
assert.strictEqual(parseWait("connection reset"), undefined);

// pick
const slots = [{ key: "k1:a" }, { key: "k2:a" }, { key: "ollama", slow: true }];
const at = (o: Record<string, number>) => new Map(Object.entries(o));

// Round-robin over free fast slots.
assert.deepStrictEqual(pick(slots, at({}), 0, 0), { slot: slots[0] });
assert.deepStrictEqual(pick(slots, at({}), 0, 1), { slot: slots[1] });
// Cursor landing on the slow slot still prefers a free fast one.
assert.deepStrictEqual(pick(slots, at({}), 0, 2), { slot: slots[0] });
// A benched key is skipped.
assert.deepStrictEqual(pick(slots, at({ "k1:a": 100 }), 50, 0), { slot: slots[1] });
// Slow slot only when every fast slot is benched.
assert.deepStrictEqual(pick(slots, at({ "k1:a": 100, "k2:a": 100 }), 50, 0), { slot: slots[2] });
// Everything benched: wait for the earliest.
assert.deepStrictEqual(pick(slots, at({ "k1:a": 100, "k2:a": 80, ollama: 300 }), 50, 0), { wait: 30 });

console.log("schedule ok");
