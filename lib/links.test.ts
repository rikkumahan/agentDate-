import assert from "node:assert";
import { igHandle, liSlug, parsePeople, safeBaseUrl } from "./links.ts";

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

// Blank lines, CRLF, and a repeated person with one URL (deduped).
const text = [`${li} ${ig}`, "", `${li}`, `https://linkedin.com/in/bob ${"https://instagram.com/bob"}`].join("\r\n");
assert.deepStrictEqual(parsePeople(text).map((p) => p.id), ["jane-doe", "bob"]);

// Empty LinkedIn slug is ignored; the Instagram handle becomes the id.
assert.deepStrictEqual(
  parsePeople("https://linkedin.com/in/ https://instagram.com/xo"),
  [{ linkedin: "", instagram: "https://instagram.com/xo", id: "xo" }],
);

// A LinkedIn link on its own is enough, with or without https://.
assert.deepStrictEqual(parsePeople("https://www.linkedin.com/in/nikeshreddyy/"), [
  { linkedin: "https://www.linkedin.com/in/nikeshreddyy/", instagram: "", id: "nikeshreddyy" },
]);
assert.deepStrictEqual(parsePeople("www.linkedin.com/in/sam"), [{ linkedin: "https://www.linkedin.com/in/sam", instagram: "", id: "sam" }]);
assert.deepStrictEqual(parsePeople("instagram.com/xo"), [{ linkedin: "", instagram: "https://instagram.com/xo", id: "xo" }]);

assert.deepStrictEqual(parsePeople(""), []);

// The same person pasted twice is kept once.
assert.strictEqual(
  parsePeople("https://linkedin.com/in/dup https://instagram.com/dup\nhttps://www.linkedin.com/in/dup/ https://instagram.com/dup2").length,
  1,
);

// safeBaseUrl: public https providers only.
for (const ok of ["https://api.groq.com/openai/v1", "https://api.openai.com/v1", "https://openrouter.ai/api/v1", "https://x.trycloudflare.com/v1"])
  assert.strictEqual(safeBaseUrl(ok), true, ok);
for (const bad of [
  "http://api.groq.com/openai/v1", "https://localhost:11434/v1", "https://127.0.0.1/v1", "https://169.254.169.254/latest",
  "https://10.0.0.5/v1", "https://192.168.1.2/v1", "https://172.20.0.1/v1", "https://[::1]/v1", "https://metadata/v1",
  "https://foo.internal/v1", "not a url", "",
])
  assert.strictEqual(safeBaseUrl(bad), false, bad);

console.log("links ok");
