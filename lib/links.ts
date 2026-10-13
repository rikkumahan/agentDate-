export const igHandle = (url: string) =>
  (url.match(/instagram\.com\/([^/?#]+)/i)?.[1] ?? url.replace(/^@/, "")).toLowerCase().trim();

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

// Accepts one person per line: "<linkedin url> <instagram url>" in any order, any separator.
export function parsePeople(text: string) {
  return text
    .split("\n")
    .map((line) => {
      const urls = line.match(/https?:\/\/[^\s,;|]+/g) ?? [];
      return {
        linkedin: urls.find((u) => /linkedin\.com\/in\//i.test(u)) ?? "",
        instagram: urls.find((u) => /instagram\.com\//i.test(u)) ?? "",
      };
    })
    .filter((p) => p.linkedin && p.instagram)
    .map((p) => ({ ...p, id: liSlug(p.linkedin) || igHandle(p.instagram) }))
    .filter((p, i, all) => all.findIndex((q) => q.id === p.id) === i);
}
