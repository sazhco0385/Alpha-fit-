import { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import { Activity, Loader2 } from "lucide-react";

/** Interactive muscle-group overview — anatomically-inspired SVG male silhouette
 *  with dynamic heat coloring (blue → cyan → gold → orange → red) and pulse animation
 *  on the hardest-trained muscle group. */

// Heat gradient: 0% dark, 100% hot pink
function heatColor(pct) {
  const p = Math.max(0, Math.min(100, pct));
  if (p < 5)  return { fill: "#0f1a2a", stroke: "#1e2a44", glow: 0 };   // untrained (dim slate)
  if (p < 25) return { fill: "#1E3A5F", stroke: "#3B82F6", glow: 4 };   // cool blue
  if (p < 45) return { fill: "#0088CC", stroke: "#00BFFF", glow: 6 };   // cyan
  if (p < 65) return { fill: "#C9A04E", stroke: "#FFD700", glow: 8 };   // gold
  if (p < 85) return { fill: "#D26A2A", stroke: "#FF8A00", glow: 10 };  // orange
  return           { fill: "#C21F5B", stroke: "#FF1493", glow: 14 };    // hot pink (peak)
}

/* ═══════════════════════════════════════════════════════════
 * FRONT view — anatomically accurate male silhouette
 * ViewBox: 200 × 320
 * ═══════════════════════════════════════════════════════════ */
const OUTLINE_FRONT = `
M 100 8
C 90 8 82 15 82 26
C 82 34 87 40 87 45
L 87 52
C 82 54 74 55 68 57
L 55 62
C 42 68 34 76 32 88
L 30 108
C 30 114 32 120 36 124
L 42 128
L 46 145
C 47 152 48 158 50 165
L 55 200
C 56 208 57 216 60 224
L 66 260
C 68 275 69 285 72 296
L 76 310
L 90 310
L 92 296
C 93 285 94 275 95 260
L 98 210
L 102 210
L 105 260
C 106 275 107 285 108 296
L 110 310
L 124 310
L 128 296
C 131 285 132 275 134 260
L 140 224
C 143 216 144 208 145 200
L 150 165
C 152 158 153 152 154 145
L 158 128
L 164 124
C 168 120 170 114 170 108
L 168 88
C 166 76 158 68 145 62
L 132 57
C 126 55 118 54 113 52
L 113 45
C 113 40 118 34 118 26
C 118 15 110 8 100 8 Z
`;

// Front regions — proper anatomical positions & shapes
const REGIONS_FRONT = {
  brust: {
    label: "Brust",
    // Pec major — two separated pectorals with realistic bulge
    d: "M 55 68 C 52 74 55 92 75 100 C 90 105 96 100 96 92 L 96 68 C 92 63 82 62 74 63 C 66 64 60 66 55 68 Z M 145 68 C 148 74 145 92 125 100 C 110 105 104 100 104 92 L 104 68 C 108 63 118 62 126 63 C 134 64 140 66 145 68 Z",
  },
  schultern: {
    label: "Schultern (Delts)",
    // Deltoid caps — rounded shoulder domes
    d: "M 42 68 C 36 72 33 82 34 92 C 36 100 44 98 50 92 C 54 82 52 72 50 66 C 46 64 43 65 42 68 Z M 158 68 C 164 72 167 82 166 92 C 164 100 156 98 150 92 C 146 82 148 72 150 66 C 154 64 157 65 158 68 Z",
  },
  arme: {
    label: "Bizeps",
    // Biceps — elongated ovals with distinct peak
    d: "M 36 96 C 32 108 32 128 38 142 C 44 145 50 143 52 135 L 52 108 C 51 100 46 94 42 92 C 39 92 37 93 36 96 Z M 164 96 C 168 108 168 128 162 142 C 156 145 150 143 148 135 L 148 108 C 149 100 154 94 158 92 C 161 92 163 93 164 96 Z",
  },
  bauch: {
    label: "Bauch (6-Pack)",
    // Abs — 3 pairs of rectangles stacked (6-pack) + linea alba centerline
    d: "M 82 108 L 96 108 L 96 122 L 82 122 Z M 104 108 L 118 108 L 118 122 L 104 122 Z M 82 126 L 96 126 L 96 140 L 82 140 Z M 104 126 L 118 126 L 118 140 L 104 140 Z M 82 144 L 96 144 L 96 158 L 82 158 Z M 104 144 L 118 144 L 118 158 L 104 158 Z",
  },
  beine: {
    label: "Quadrizeps",
    // Quads — proper thigh sweep with knee separation, tapered
    d: "M 68 172 C 62 200 60 230 66 254 L 92 254 C 94 232 94 200 94 172 C 86 168 76 168 68 172 Z M 132 172 C 138 200 140 230 134 254 L 108 254 C 106 232 106 200 106 172 C 114 168 124 168 132 172 Z",
  },
};

/* ═══════════════════════════════════════════════════════════
 * BACK view — same outline, different muscle groups
 * ═══════════════════════════════════════════════════════════ */
const OUTLINE_BACK = OUTLINE_FRONT;

const REGIONS_BACK = {
  ruecken: {
    label: "Rücken (Lats)",
    // Lats — V-taper wing shape
    d: "M 55 68 C 45 82 42 108 46 138 C 55 145 72 145 92 142 L 96 130 L 96 68 C 92 63 82 62 74 63 C 66 64 60 66 55 68 Z M 145 68 C 155 82 158 108 154 138 C 145 145 128 145 108 142 L 104 130 L 104 68 C 108 63 118 62 126 63 C 134 64 140 66 145 68 Z",
  },
  trapezius: {
    label: "Trapezius / Nacken",
    // Traps — diamond shape between shoulders and mid-back
    d: "M 82 45 C 78 50 76 58 82 66 L 100 68 L 118 66 C 124 58 122 50 118 45 C 110 44 90 44 82 45 Z",
  },
  schultern: {
    label: "Rückwärtige Schultern",
    d: "M 42 68 C 36 72 33 82 34 92 C 36 100 44 98 50 92 C 54 82 52 72 50 66 C 46 64 43 65 42 68 Z M 158 68 C 164 72 167 82 166 92 C 164 100 156 98 150 92 C 146 82 148 72 150 66 C 154 64 157 65 158 68 Z",
  },
  arme: {
    label: "Trizeps",
    d: "M 36 96 C 32 108 32 128 38 142 C 44 145 50 143 52 135 L 52 108 C 51 100 46 94 42 92 C 39 92 37 93 36 96 Z M 164 96 C 168 108 168 128 162 142 C 156 145 150 143 148 135 L 148 108 C 149 100 154 94 158 92 C 161 92 163 93 164 96 Z",
  },
  gesaess: {
    label: "Gesäß",
    // Glutes — rounded twin curves
    d: "M 68 158 C 62 168 62 178 68 186 C 78 192 90 192 96 186 L 96 158 C 88 155 76 155 68 158 Z M 132 158 C 138 168 138 178 132 186 C 122 192 110 192 104 186 L 104 158 C 112 155 124 155 132 158 Z",
  },
  beine: {
    label: "Hamstrings",
    d: "M 68 190 C 62 214 60 240 66 258 L 92 258 C 94 236 94 210 94 190 C 86 186 76 186 68 190 Z M 132 190 C 138 214 140 240 134 258 L 108 258 C 106 236 106 210 106 190 C 114 186 124 186 132 190 Z",
  },
  waden: {
    label: "Waden",
    d: "M 68 264 C 66 280 66 295 72 300 L 88 300 C 90 290 90 275 88 264 C 82 262 74 262 68 264 Z M 132 264 C 134 280 134 295 128 300 L 112 300 C 110 290 110 275 112 264 C 118 262 126 262 132 264 Z",
  },
};

function BodySilhouette({ view, activeKey, groupPercents, hottestKey, onHover }) {
  const regions = view === "back" ? REGIONS_BACK : REGIONS_FRONT;
  const outline = view === "back" ? OUTLINE_BACK : OUTLINE_FRONT;
  return (
    <svg viewBox="0 0 200 320" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <defs>
        <linearGradient id="body-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b0f19" />
          <stop offset="1" stopColor="#020617" />
        </linearGradient>
        <filter id="muscle-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="hot-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Body silhouette outline */}
      <path
        d={outline}
        fill="url(#body-fill)"
        stroke="#1e293b"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />

      {/* Muscle regions ordered so smaller ones render last */}
      {Object.entries(regions).map(([key, region]) => {
        const pct = groupPercents[key] || 0;
        const isActive = activeKey === key;
        const isHot = hottestKey === key && pct >= 45;
        const heat = heatColor(pct);
        const strokeW = isActive ? 2 : isHot ? 1.4 : 0.8;
        return (
          <path
            key={key}
            d={region.d}
            fill={heat.fill}
            stroke={isActive ? "#FFFFFF" : heat.stroke}
            strokeWidth={strokeW}
            className={isHot ? "muscle-hot-pulse" : ""}
            style={{
              filter: isActive
                ? `drop-shadow(0 0 12px ${heat.stroke})`
                : heat.glow ? `drop-shadow(0 0 ${heat.glow}px ${heat.stroke}90)` : "none",
              cursor: "pointer",
              transition: "fill 400ms ease, stroke 300ms ease, filter 300ms ease",
            }}
            onMouseEnter={() => onHover?.(key)}
            onMouseLeave={() => onHover?.(null)}
            data-testid={`muscle-region-${view}-${key}`}
          />
        );
      })}
    </svg>
  );
}

export default function MuscleGroupsSection() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null);
  const [view, setView] = useState("front");
  const [mode, setMode] = useState("relative");

  useEffect(() => {
    setLoading(true);
    api.get(`/muscle-groups/stats?mode=${mode}`)
      .then(({ data }) => setData(data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [mode]);

  const groupPercents = useMemo(() => {
    const map = {};
    (data?.groups || []).forEach((g) => { map[g.key] = g.percent; });
    return map;
  }, [data]);

  // Hottest = highest-percent muscle group (for the pulse animation)
  const hottestKey = useMemo(() => {
    if (!data?.groups?.length) return null;
    const sorted = [...data.groups].sort((a, b) => b.percent - a.percent);
    return sorted[0]?.percent >= 45 ? sorted[0].key : null;
  }, [data]);

  if (loading) return (
    <section className="mb-6" data-testid="muscle-groups-loading">
      <div className="af-card p-6 flex items-center justify-center gap-2 text-gray-500">
        <Loader2 size={16} className="animate-spin" /> Muskeldaten laden…
      </div>
    </section>
  );

  if (!data) return null;

  return (
    <section className="mb-6 sm:mb-8" data-testid="muscle-groups-section">
      <div className="flex items-end justify-between mb-3 gap-2">
        <div>
          <h2 className="text-xl sm:text-2xl font-teko tracking-wider chrome-text uppercase flex items-center gap-2">
            <Activity size={18} className="text-[#00BFFF]" />
            Muskelgruppen im Detail
          </h2>
          <div className="text-xs text-gray-500 font-chakra">
            Letzte {data.weeks} Wochen · {data.total_sessions} Trainings analysiert
          </div>
        </div>
        {/* Front/Back toggle */}
        <div className="flex text-xs font-chakra">
          {["front", "back"].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              data-testid={`body-view-${v}`}
              className={`px-3 py-1 border transition uppercase tracking-widest ${
                view === v
                  ? "border-[#00BFFF] text-[#00BFFF] bg-[#00BFFF]/10"
                  : "border-gray-700 text-gray-500 hover:border-gray-500"
              }`}
            >
              {v === "front" ? "Vorne" : "Hinten"}
            </button>
          ))}
        </div>
      </div>

      {/* Mode toggle: relative vs absolute */}
      <div className="flex items-center justify-between mb-3 text-[10px] font-chakra text-gray-500 uppercase tracking-widest">
        <span>
          {mode === "relative"
            ? "Vergleich untereinander (zeigt Imbalancen)"
            : "Ziel: 3× / Woche = 100 %"}
        </span>
        <div className="flex">
          {[
            { k: "relative", l: "Relativ" },
            { k: "absolute", l: "Absolut" },
          ].map((m) => (
            <button
              key={m.k}
              type="button"
              onClick={() => setMode(m.k)}
              data-testid={`heat-mode-${m.k}`}
              className={`px-2 py-1 border transition uppercase tracking-widest ${
                mode === m.k
                  ? "border-[#FF1493] text-[#FF1493] bg-[#FF1493]/10"
                  : "border-gray-700 text-gray-500 hover:border-gray-500"
              }`}
            >
              {m.l}
            </button>
          ))}
        </div>
      </div>

      <div className="af-card p-4 sm:p-5 grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4 sm:gap-6">
        {/* SVG body */}
        <div className="mx-auto w-full max-w-[260px] flex items-center justify-center relative">
          <div className="absolute inset-0 pointer-events-none" style={{
            background: "radial-gradient(circle at 50% 40%, rgba(0,191,255,0.12) 0%, transparent 65%)",
          }} />
          <BodySilhouette
            view={view}
            activeKey={active}
            groupPercents={groupPercents}
            hottestKey={hottestKey}
            onHover={setActive}
          />
        </div>

        {/* Group cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(data.groups || []).map((g) => {
            const isActive = active === g.key;
            const heat = heatColor(g.percent);
            return (
              <button
                type="button"
                key={g.key}
                onMouseEnter={() => setActive(g.key)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(g.key)}
                onBlur={() => setActive(null)}
                data-testid={`muscle-card-${g.key}`}
                className={`text-left p-3 border transition rounded ${
                  isActive
                    ? "border-[#00BFFF] bg-[#00BFFF]/10 shadow-[0_0_14px_rgba(0,191,255,0.4)]"
                    : "border-gray-800 hover:border-gray-600"
                }`}
              >
                <div className="flex items-center justify-between mb-1 gap-2">
                  <span className="font-chakra text-sm text-gray-200">{g.name}</span>
                  <span
                    className="font-teko text-lg tracking-wide"
                    style={{ color: heat.stroke }}
                  >
                    {g.percent}%
                  </span>
                </div>
                <div className="h-1.5 bg-gray-800 rounded overflow-hidden">
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${g.percent}%`,
                      background: heat.stroke,
                      boxShadow: g.percent > 0 ? `0 0 6px ${heat.stroke}` : "none",
                    }}
                  />
                </div>
                <div className="text-[10px] text-gray-500 font-chakra mt-1">
                  {g.sessions_hit}× getroffen · {g.exercises_completed} Übungen
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Heat legend */}
      <div className="mt-3 flex items-center justify-center gap-2 text-[10px] font-chakra text-gray-500 tracking-widest uppercase">
        <span className="w-3 h-3 rounded-sm" style={{background:"#1E3A5F"}} /> LOW
        <span className="w-3 h-3 rounded-sm" style={{background:"#00BFFF"}} />
        <span className="w-3 h-3 rounded-sm" style={{background:"#FFD700"}} />
        <span className="w-3 h-3 rounded-sm" style={{background:"#FF8A00"}} />
        <span className="w-3 h-3 rounded-sm" style={{background:"#FF1493"}} /> PEAK
      </div>
    </section>
  );
}
