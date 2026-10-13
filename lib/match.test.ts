import assert from "node:assert";
import { matchInstagram, matchLinkedin } from "./match.ts";

// Instagram: exact handle, case-insensitive on username.
const igItems = [{ username: "Bob" }, { username: "jane.doe", followers: 5 }];
assert.deepStrictEqual(matchInstagram(igItems, "jane.doe"), { username: "jane.doe", followers: 5 });
assert.strictEqual(matchInstagram(igItems, "nobody"), undefined);
assert.strictEqual(matchInstagram([{}], "jane"), undefined);

// LinkedIn: exact slug on top-level URL fields or publicIdentifier; empty slug never matches.
const liItems = [
  { name: "Al", url: "https://linkedin.com/in/al", about: "national champion" },
  { name: "Bob", url: "https://linkedin.com/in/bob", alsoViewed: [{ url: "https://linkedin.com/in/jane-doe" }] },
  { name: "Jane", profileUrl: "https://linkedin.com/in/jane-doe/" },
  { name: "Kim", publicIdentifier: "Kim-L" },
];
assert.deepStrictEqual(matchLinkedin(liItems, "jane-doe"), liItems[2]); // not Bob's nested "also viewed"
assert.deepStrictEqual(matchLinkedin(liItems, "al"), liItems[0]);
assert.deepStrictEqual(matchLinkedin(liItems, "kim-l"), liItems[3]);
assert.strictEqual(matchLinkedin(liItems, "nat"), undefined); // no substring matches
assert.strictEqual(matchLinkedin(liItems, ""), undefined);
assert.strictEqual(matchLinkedin(liItems, "carol"), undefined);

console.log("match ok");
