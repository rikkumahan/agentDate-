export const igHandle = (url: string) =>
  (url.match(/instagram\.com\/([^/?#]+)/i)?.[1] ?? url).replace(/^@/, "").toLowerCase().trim();

// Malformed percent-encoding (e.g. "%E0%A4%A") must not throw and abort the whole paste.
export const safeDecode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

export const liSlug = (url: string) =>
  safeDecode(url.match(/linkedin\.com\/in\/([^/?#]+)/i)?.[1] ?? "").toLowerCase();

// Accepts one person per line: a LinkedIn and/or an Instagram link, in any order, any separator.
// "https://" is optional so links copied from the address bar without it still count.
export function parsePeople(text: string) {
  return text
    .split("\n")
    .map((line) => {
      const urls = line.match(/(?:https?:\/\/)?(?:[\w-]+\.)*(?:linkedin|instagram)\.com\/[^\s,;|]+/gi) ?? [];
      const full = (u = "") => (u && !/^https?:\/\//i.test(u) ? `https://${u}` : u);
      return {
        linkedin: full(urls.find((u) => /linkedin\.com\/in\/[^/?#]/i.test(u))),
        instagram: full(urls.find((u) => /instagram\.com\/[^/?#]/i.test(u))),
      };
    })
    .filter((p) => p.linkedin || p.instagram)
    .map((p) => ({ ...p, id: liSlug(p.linkedin) || igHandle(p.instagram) }))
    .filter((p, i, all) => all.findIndex((q) => q.id === p.id) === i);
}

// The server calls this URL, so only public https hosts: no localhost, private IPs or cloud metadata.
// ponytail: a hostname that resolves to a private IP (DNS rebinding) still passes; resolve-and-check if that matters.
export function safeBaseUrl(raw: string) {
  try {
    const { protocol, hostname } = new URL(raw);
    if (protocol !== "https:") return false;
    const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (h === "localhost" || /\.(local|internal|localhost)$/.test(h) || !h.includes(".") && !h.includes(":")) return false;
    if (/^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h)) return false;
    if (h.includes(":") && /^(::1?$|f[cd]|fe80)/.test(h)) return false;
    return true;
  } catch {
    return false;
  }
}
