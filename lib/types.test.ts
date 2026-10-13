import assert from "node:assert";
import { ProfileSchema } from "./types.ts";

// Empty object gets every default.
const empty = ProfileSchema.parse({});
assert.strictEqual(empty.name, "Unknown");
assert.strictEqual(empty.location, "unknown");
assert.deepStrictEqual(empty.interests, []);
assert.deepStrictEqual(empty.evidence, []);

// Partial output keeps what is valid and defaults the rest.
const partial = ProfileSchema.parse({ name: "Ana", interests: ["climbing"] });
assert.strictEqual(partial.name, "Ana");
assert.deepStrictEqual(partial.interests, ["climbing"]);
assert.strictEqual(partial.headline, "");

// Wrong types in fields fall back to defaults instead of throwing.
const garbage = ProfileSchema.parse({ name: 42, interests: "climbing", evidence: "nope", headline: null });
assert.strictEqual(garbage.name, "Unknown");
assert.deepStrictEqual(garbage.interests, []);
assert.deepStrictEqual(garbage.evidence, []);
assert.strictEqual(garbage.headline, "");

// A bad field inside an evidence item defaults only that field.
const ev = ProfileSchema.parse({ evidence: [{ claim: 1, source: "instagram" }] });
assert.deepStrictEqual(ev.evidence, [{ claim: "", source: "instagram", quote: "" }]);

// A non-object top level is rejected (json() then retries the LLM call).
assert.strictEqual(ProfileSchema.safeParse(null).success, false);
assert.strictEqual(ProfileSchema.safeParse("text").success, false);

console.log("types ok");
