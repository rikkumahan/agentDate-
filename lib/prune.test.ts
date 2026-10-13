import assert from "node:assert";
import { prune } from "./prune.ts";

// Drops url / pic / id style keys, keeps "alt".
assert.deepStrictEqual(
  prune({ url: "x", profilePicUrl: "y", id: "1", userId: "2", alt: "hi", name: "Ana" }),
  { alt: "hi", name: "Ana" },
);

// Real keys that merely contain "pic"/"urn"/"id" survive.
assert.deepStrictEqual(prune({ topics: "ai", returnDate: "x", paid: "y", valid: "z" }), { topics: "ai", returnDate: "x", paid: "y", valid: "z" });

// Drops null, empty strings and empty arrays.
assert.deepStrictEqual(prune({ a: null, b: "", c: [], d: "ok" }), { d: "ok" });

// Strings cap at 600 chars plus an ellipsis.
const long = prune({ bio: "x".repeat(700) }) as { bio: string };
assert.strictEqual(long.bio.length, 601);
assert.ok(long.bio.endsWith("…"));
assert.strictEqual(prune("y".repeat(600)), "y".repeat(600));

// Top-level arrays keep 12 items; nested arrays keep 8.
assert.strictEqual((prune(Array.from({ length: 20 }, (_, i) => i)) as number[]).length, 12);
assert.strictEqual((prune({ tags: Array.from({ length: 20 }, (_, i) => i) }) as { tags: number[] }).tags.length, 8);

console.log("prune ok");
