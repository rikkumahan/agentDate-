import assert from "node:assert";
import { igHandle, liSlug, parsePeople } from "./links.ts";

// igHandle
assert.strictEqual(igHandle("https://www.instagram.com/Jane.Doe/"), "jane.doe");
assert.strictEqual(igHandle("https://instagram.com/jane_doe?igsh=abc"), "jane_doe");
assert.strictEqual(igHandle("@Jane"), "jane");
assert.strictEqual(igHandle("  jane  "), "jane");

// liSlug
assert.strictEqual(liSlug("https://www.linkedin.com/in/Jane-Doe/?trk=x"), "jane-doe");
assert.strictEqual(liSlug("https://linkedin.com/in/jane/"), "jane");
assert.strictEqual(liSlug("https://linkedin.com/in/%C3%A9lodie"), "élodie");
assert.strictEqual(liSlug("https://linkedin.com/company/acme"), "");
// Malformed percent-encoding must not throw (it would abort the whole paste).
assert.strictEqual(liSlug("https://linkedin.com/in/%E0%A4%A"), "%e0%a4%a");

// parsePeople
const li = "https://www.linkedin.com/in/jane-doe/";
const ig = "https://www.instagram.com/jane.doe/?hl=en";

assert.deepStrictEqual(parsePeople(`${li} ${ig}`), [{ linkedin: li, instagram: ig, id: "jane-doe" }]);
assert.deepStrictEqual(parsePeople(`${ig} ${li}`), [{ linkedin: li, instagram: ig, id: "jane-doe" }]);
assert.deepStrictEqual(parsePeople(`${li}\t|\t${ig}`), [{ linkedin: li, instagram: ig, id: "jane-doe" }]);

// Comma-separated with no space must still split into two URLs.
assert.deepStrictEqual(
  parsePeople("https://linkedin.com/in/jane,https://instagram.com/jane"),
  [{ linkedin: "https://linkedin.com/in/jane", instagram: "https://instagram.com/jane", id: "jane" }],
);

// Blank lines, CRLF, and a line missing one URL (dropped).
const text = [`${li} ${ig}`, "", `${li}`, `https://linkedin.com/in/bob ${"https://instagram.com/bob"}`].join("\r\n");
assert.deepStrictEqual(parsePeople(text).map((p) => p.id), ["jane-doe", "bob"]);

// Empty LinkedIn slug falls back to the Instagram handle as id.
assert.deepStrictEqual(
  parsePeople("https://linkedin.com/in/ https://instagram.com/xo"),
  [{ linkedin: "https://linkedin.com/in/", instagram: "https://instagram.com/xo", id: "xo" }],
);

assert.deepStrictEqual(parsePeople(""), []);

// The same person pasted twice is kept once.
assert.strictEqual(
  parsePeople("https://linkedin.com/in/dup https://instagram.com/dup\nhttps://www.linkedin.com/in/dup/ https://instagram.com/dup2").length,
  1,
);

console.log("links ok");
