// Reasoning models (qwen3, gpt-oss on some hosts) leak <think> blocks into text.
// Some chat templates inject the opening tag, so a lone "</think>" also marks the end of reasoning.
export function stripThink(s: string) {
  const end = s.lastIndexOf("</think>");
  if (end !== -1) s = s.slice(end + "</think>".length);
  return s.replace(/<think>[\s\S]*$/, "");
}

// Return the first balanced {...} that parses. First-"{"-to-last-"}" breaks on trailing prose with braces.
export function extractJson(text: string): unknown {
  const s = stripThink(text);
  for (let start = s.indexOf("{"); start !== -1; start = s.indexOf("{", start + 1)) {
    let depth = 0, inStr = false, esc = false;
    for (let i = start; i < s.length; i++) {
      const c = s[i];
      if (inStr) {
        if (esc) esc = false;
        else if (c === "\\") esc = true;
        else if (c === '"') inStr = false;
      } else if (c === '"') inStr = true;
      else if (c === "{") depth++;
      else if (c === "}" && --depth === 0) {
        try {
          return JSON.parse(s.slice(start, i + 1));
        } catch {
          break;
        }
      }
    }
  }
  throw new Error("No JSON object found");
}
