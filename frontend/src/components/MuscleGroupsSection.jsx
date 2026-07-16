import { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import { Activity, Loader2 } from "lucide-react";

/** Interactive muscle-group overview — shows an SVG body (front + back) with
 *  highlightable regions plus a card list with progress bars for the last 4 weeks. */

// SVG muscle region paths. Kept intentionally stylized (not medical) — glow-friendly.
const REGIONS_FRONT = {
  brust:     "M60,42 Q90,50 90,78 L60,80 Z M120,42 Q90,50 90,78 L120,80 Z",       // pecs
  schultern: "M40,38 Q50,30 62,36 L60,44 Q50,42 44,50 Z M140,38 Q130,30 118,36 L120,44 Q130,42 136,50 Z", // delts
  arme:      "M32,50 Q28,72 34,96 L48,96 Q46,72 44,54 Z M148,50 Q152,72 146,96 L132,96 Q134,72 136,54 Z", // biceps
  bauch:     "M76,82 L104,82 L104,120 L76,120 Z",                                  // abs
  beine:     "M60,130 Q56,166 62,204 L78,204 Q80,166 78,130 Z M120,130 Q124,166 118,204 L102,204 Q100,166 102,130 Z", // quads
};

const REGIONS_BACK = {
  ruecken:   "M60,44 Q90,52 90,110 L60,110 Z M120,44 Q90,52 90,110 L120,110 Z",   // lats
  schultern: "M40,38 Q50,30 62,36 L60,44 Q50,42 44,50 Z M140,38 Q130,30 118,36 L120,44 Q130,42 136,50 Z",
  arme:      "M32,50 Q28,72 34,96 L48,96 Q46,72 44,54 Z M148,50 Q152,72 146,96 L132,96 Q134,72 136,54 Z", // triceps
  gesaess:   "M60,118 Q90,128 90,150 L60,150 Z M120,118 Q90,128 90,150 L120,150 Z", // glutes
  beine:     "M62,150 Q58,186 64,214 L78,214 Q80,186 78,150 Z M118,150 Q122,186 116,214 L102,214 Q100,186 102,150 Z", // hamstrings
};

const BODY_OUTLINE = `
  M90,10 Q78,10 74,22 Q74,34 82,38 Q82,44 78,46 L62,46 Q42,52 40,68 L38,100 Q40,112 46,114 L48,124 L60,130
  L62,204 Q62,222 68,224 L78,224 Q82,222 82,204 L80,140 L90,142 L100,140 L98,204 Q98,222 102,224 L112,224
  Q118,222 118,204 L120,130 L132,124 L134,114 Q140,112 142,100 L140,68 Q138,52 118,46 L102,46 Q98,44 98,38
  Q106,34 106,22 Q102,10 90,10 Z`;

function BodySilhouette({ view, activeKey, groupPercents, onHover }) {
  const regions = view === "back" ? REGIONS_BACK : REGIONS_FRONT;
  return (
    <svg viewBox="0 0 180 230" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <defs>
        <linearGradient id="body-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0f172a" />
          <stop offset="1" stopColor="#020617" />
        </linearGradient>
        <filter id="body-glow"><feGaussianBlur stdDeviation="2" /></filter>
      </defs>
      <path d={BODY_OUTLINE} fill="url(#body-fill)" stroke="#1e293b" strokeWidth="1" />
      {/* Render regions sorted so smaller/inner ones sit on top for cleaner hover-hit detection */}
      {Object.entries(regions)
        .sort(([a], [b]) => {
          const order = ["brust", "ruecken", "gesaess", "bauch", "beine", "schultern", "arme"];
          return order.indexOf(a) - order.indexOf(b);
        })
        .map(([key, d]) => {
        const pct = groupPercents[key] || 0;
        const isActive = activeKey === key;
        // Color intensity based on training %: 0=dim, 100=bright neon
        const alpha = 0.10 + (pct / 100) * 0.55;
        const stroke = isActive ? "#FF5A1F" : "#FF4500";
        return (
          <path
            key={key}
            d={d}
            fill={`rgba(255,69,0,${alpha})`}
            stroke={stroke}
            strokeWidth={isActive ? 1.8 : 0.6}
            style={{
              filter: isActive ? "drop-shadow(0 0 8px rgba(255,90,31,0.9))" : undefined,
              cursor: "pointer",
              transition: "all 150ms",
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

  useEffect(() => {
    api.get("/muscle-groups/stats")
      .then(({ data }) => setData(data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const groupPercents = useMemo(() => {
    const map = {};
    (data?.groups || []).forEach((g) => { map[g.key] = g.percent; });
    return map;
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
      <div className="flex items-end justify-between mb-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-teko tracking-wider chrome-text uppercase flex items-center gap-2">
            <Activity size={18} className="text-[#FF4500]" />
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
                  ? "border-[#FF4500] text-[#FF4500] bg-[#FF4500]/10"
                  : "border-gray-700 text-gray-500 hover:border-gray-500"
              }`}
            >
              {v === "front" ? "Vorne" : "Hinten"}
            </button>
          ))}
        </div>
      </div>

      <div className="af-card p-4 sm:p-5 grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4 sm:gap-6">
        {/* SVG body */}
        <div className="mx-auto w-full max-w-[240px] flex items-center justify-center">
          <BodySilhouette
            view={view}
            activeKey={active}
            groupPercents={groupPercents}
            onHover={setActive}
          />
        </div>

        {/* Group cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(data.groups || []).map((g) => {
            const isActive = active === g.key;
            return (
              <button
                type="button"
                key={g.key}
                onMouseEnter={() => setActive(g.key)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(g.key)}
                onBlur={() => setActive(null)}
                data-testid={`muscle-card-${g.key}`}
                className={`text-left p-3 border transition ${
                  isActive
                    ? "border-[#FF4500] bg-[#FF4500]/10 shadow-[0_0_14px_rgba(255,69,0,0.4)]"
                    : "border-gray-800 hover:border-gray-600"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-chakra text-sm text-gray-200">{g.name}</span>
                  <span className={`font-teko text-lg tracking-wide ${isActive ? "text-[#FF4500]" : "text-gray-400"}`}>
                    {g.percent}%
                  </span>
                </div>
                <div className="h-1.5 bg-gray-800 rounded overflow-hidden">
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${g.percent}%`,
                      background: g.percent >= 80 ? "#00FF7F" : g.percent >= 50 ? "#FF4500" : "#f4d27a",
                      boxShadow: g.percent > 0 ? "0 0 6px rgba(255,69,0,0.6)" : "none",
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
    </section>
  );
}
