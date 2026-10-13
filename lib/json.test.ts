import assert from "node:assert";
import { extractJson } from "./json.ts";

// Plain JSON.
assert.deepStrictEqual(extractJson('{"a":1}'), { a: 1 });

// Leading and trailing prose.
assert.deepStrictEqual(extractJson('Sure! Here it is: {"a":{"b":2}} hope that helps.'), { a: { b: 2 } });

// Markdown fences.
assert.deepStrictEqual(extractJson('```json\n{"a":3}\n```'), { a: 3 });

// Think blocks are removed, even when they contain braces.
assert.deepStrictEqual(extractJson('<think>maybe {x}</think>\n{"a":4}'), { a: 4 });
assert.deepStrictEqual(extractJson('<think>\nmulti\nline\n</think>{"a":5}'), { a: 5 });

// Template-injected opening tag: only "</think>" appears.
assert.deepStrictEqual(extractJson('reasoning {x}</think>{"a":6}'), { a: 6 });

// Trailing prose containing braces, and braces inside strings.
assert.deepStrictEqual(extractJson('{"venue":"X {cafe}","why":"Y"}\n(Note: {optional})'), { venue: "X {cafe}", why: "Y" });

// No JSON at all throws (json() catches this and retries).
assert.throws(() => extractJson("no json here"));

console.log("json ok");
