import type { DateRecord, Person } from "@/lib/types";

type Kind = "cafe" | "park" | "bar" | "gallery" | "restaurant";

export function sceneKind(venue = ""): Kind {
  const v = venue.toLowerCase();
  if (/coffee|caf[eé]|espresso|tea|bakery|brunch/.test(v)) return "cafe";
  if (/park|run|walk|hike|trail|garden|beach|lake|picnic|bike|cycle/.test(v)) return "park";
  if (/bar|wine|cocktail|rooftop|pub|brew|jazz|speakeasy/.test(v)) return "bar";
  if (/gallery|museum|exhibit|studio|art|design|pottery|workshop|class/.test(v)) return "gallery";
  return "restaurant";
}

const PALETTE: Record<Kind, { wall: string; floor: string }> = {
  cafe: { wall: "#3a2418", floor: "#24150e" },
  park: { wall: "#1d2a3f", floor: "#1f3322" },
  bar: { wall: "#2a1530", floor: "#170c1a" },
  gallery: { wall: "#33292f", floor: "#1f1a1d" },
  restaurant: { wall: "#3a1a22", floor: "#220f14" },
};

function Props({ kind }: { kind: Kind }) {
  switch (kind) {
    case "cafe":
      return (
        <g>
          <rect x="230" y="30" width="140" height="90" rx="6" fill="#5b3a26" stroke="#7a5236" />
          <line x1="300" y1="30" x2="300" y2="120" stroke="#7a5236" />
          <line x1="230" y1="75" x2="370" y2="75" stroke="#7a5236" />
          {[110, 490].map((x) => (
            <g key={x}>
              <line x1={x} y1="0" x2={x} y2="40" stroke="#6b5040" />
              <path d={`M${x - 16} 52 L${x + 16} 52 L${x + 8} 40 L${x - 8} 40 Z`} fill="#f2c46d" />
              <circle cx={x} cy="58" r="14" fill="#f2c46d" opacity="0.12" />
            </g>
          ))}
          <text x="300" y="140" textAnchor="middle" fill="#f2c46d" opacity="0.5" fontSize="11" fontFamily="serif">espresso · pour-over · cake</text>
        </g>
      );
    case "park":
      return (
        <g>
          <circle cx="500" cy="50" r="22" fill="#f2c46d" opacity="0.85" />
          {[60, 140, 470, 545].map((x, i) => (
            <g key={x}>
              <rect x={x - 4} y={120 + (i % 2) * 6} width="8" height="70" fill="#4a3324" />
              <circle cx={x} cy={110 + (i % 2) * 6} r={30 - (i % 2) * 6} fill="#2f5a36" />
            </g>
          ))}
        </g>
      );
    case "bar":
      return (
        <g>
          {[0, 1].map((row) => (
            <g key={row}>
              <rect x="190" y={50 + row * 45} width="220" height="4" fill="#5a3a5e" />
              {Array.from({ length: 9 }, (_, i) => (
                <rect key={i} x={200 + i * 23} y={22 + row * 45} width="10" height="28" rx="3" fill={["#f2c46d", "#f29e9e", "#9ec7f2", "#b8e0a8"][(i + row) % 4]} opacity="0.75" />
              ))}
            </g>
          ))}
          <text x="300" y="140" textAnchor="middle" fill="#f29e9e" fontSize="13" fontFamily="serif" fontStyle="italic">open late</text>
        </g>
      );
    case "gallery":
      return (
        <g>
          {[[90, 40, 70, 90], [250, 30, 100, 70], [440, 45, 80, 80]].map(([x, y, w, h], i) => (
            <g key={i}>
              <rect x={x} y={y} width={w} height={h} fill="#f6eadf" stroke="#c9a76a" strokeWidth="4" />
              <circle cx={x + w / 2} cy={y + h / 2} r={Math.min(w, h) / 4} fill={["#f29e9e", "#9ec7f2", "#f2c46d"][i]} />
            </g>
          ))}
        </g>
      );
    default:
      return (
        <g>
          {[150, 450].map((x) => (
            <g key={x}>
              <rect x={x - 30} y="30" width="60" height="80" rx="30" fill="#4a2230" stroke="#6a3344" />
              <circle cx={x} cy="70" r="16" fill="#f2c46d" opacity="0.12" />
            </g>
          ))}
          <text x="300" y="80" textAnchor="middle" fill="#f2c46d" opacity="0.4" fontSize="12" fontFamily="serif" fontStyle="italic">reservations only</text>
        </g>
      );
  }
}

// Seated stick figure; `talking` makes the head nod and the near arm gesture.
function Figure({ x, flip, color, talking }: { x: number; flip: boolean; color: string; talking: boolean }) {
  const s = flip ? -1 : 1;
  return (
    <g transform={`translate(${x} 0) scale(${s} 1)`}>
      {/* chair */}
      <path d="M-28 150 L-28 215 M-28 185 L10 185 M8 185 L8 215" stroke="#6b4a3a" strokeWidth="5" fill="none" strokeLinecap="round" />
      <g className={talking ? "fig-talk" : "fig-idle"} stroke="#f6eadf" strokeWidth="5" strokeLinecap="round" fill="none">
        <line x1="-10" y1="122" x2="-10" y2="180" />
        <path d="M-10 180 L25 180 L25 212" />
        <path d="M-10 140 L18 160 L42 152" className={talking ? "fig-arm" : undefined} />
        <circle cx="-10" cy="104" r="16" fill={color} stroke="none" />
      </g>
    </g>
  );
}

const HUES = [12, 32, 340, 280, 200, 160, 50];
const hue = (p?: Person) => HUES[[...(p?.profile?.name ?? p?.id ?? "?")].reduce((s, c) => s + c.charCodeAt(0), 0) % HUES.length];

export function DateScene({ d, a, b, upto }: { d: DateRecord; a?: Person; b?: Person; upto?: number }) {
  const kind = sceneKind(d.venue?.venue);
  const { wall, floor } = PALETTE[kind];
  const msgs = d.messages.slice(0, upto ?? d.messages.length);
  const last = msgs[msgs.length - 1];
  const ended = d.status === "done" && (upto === undefined || upto >= d.messages.length);
  const mutual = ended ? (d.verdicts.a.score + d.verdicts.b.score) / 2 : 0;
  const bothYes = ended && d.verdicts.a.second_date && d.verdicts.b.second_date;
  const name = (p?: Person) => (p?.profile?.name ?? p?.id ?? "").split(" ")[0];

  return (
    <div className="relative overflow-hidden rounded-xl border border-line" style={{ aspectRatio: "600 / 260" }}>
      <svg viewBox="0 0 600 260" className="absolute inset-0 h-full w-full" role="img" aria-label={`${name(a)} and ${name(b)} on a date at ${d.venue?.venue ?? "a table"}`}>
        <rect width="600" height="260" fill={wall} />
        <rect y="200" width="600" height="60" fill={floor} />
        <Props kind={kind} />
        {kind === "park" ? (
          <path d="M215 190 L385 190 M225 190 L225 215 M375 190 L375 215" stroke="#6b4a3a" strokeWidth="7" strokeLinecap="round" />
        ) : (
          <g>
            <ellipse cx="300" cy="168" rx="70" ry="10" fill="#6b4a3a" />
            <line x1="300" y1="170" x2="300" y2="215" stroke="#6b4a3a" strokeWidth="6" />
            <rect x="282" y="150" width="7" height="14" fill="#f6eadf" opacity="0.8" />
            <rect x="311" y="150" width="7" height="14" fill="#f6eadf" opacity="0.8" />
            <line x1="300" y1="146" x2="300" y2="160" stroke="#f2c46d" strokeWidth="3" />
            <circle cx="300" cy="143" r="4" fill="#f2c46d" className="candle" />
          </g>
        )}
        <Figure x={kind === "park" ? 240 : 215} flip={false} color={`hsl(${hue(a)} 55% 72%)`} talking={last?.speaker === "a" && !ended} />
        <Figure x={kind === "park" ? 360 : 385} flip color={`hsl(${hue(b)} 55% 72%)`} talking={last?.speaker === "b" && !ended} />
        <text x={kind === "park" ? 240 : 215} y="250" textAnchor="middle" fill="#f6eadf" fontSize="12">{name(a)}</text>
        <text x={kind === "park" ? 360 : 385} y="250" textAnchor="middle" fill="#f6eadf" fontSize="12">{name(b)}</text>
        {bothYes &&
          [0, 1, 2, 3, 4].map((i) => (
            <text key={i} x={270 + i * 15} y="130" fill="#f29e9e" fontSize="16" className="heart" style={{ animationDelay: `${i * 0.35}s` }}>♥</text>
          ))}
      </svg>
      <div className="absolute inset-x-0 top-0 flex justify-center p-2">
        <span className="rounded-full bg-ink/70 px-3 py-1 font-serif text-sm text-gold backdrop-blur">
          {d.venue?.venue ?? (d.status === "pending" ? "Waiting for a table" : "Choosing a place…")}
        </span>
      </div>
      {last && !ended && (
        <div className={`absolute top-[18%] max-w-[46%] rounded-2xl bg-cream px-3 py-2 text-[11px] leading-snug text-ink shadow-lg sm:text-xs ${last.speaker === "a" ? "left-[3%] rounded-bl-sm" : "right-[3%] rounded-br-sm"}`}>
          {last.text.length > 160 ? last.text.slice(0, 160) + "…" : last.text}
        </div>
      )}
      {ended && (
        <div className="absolute inset-x-0 bottom-[22%] flex justify-center">
          <span className="rounded-full bg-ink/80 px-3 py-1 text-xs text-cream">
            {bothYes ? "Both agents want a second date" : mutual >= 60 ? "A good evening, no promises" : "A polite goodnight"}
          </span>
        </div>
      )}
    </div>
  );
}
