import { useEffect, useState } from "react";
import { TrendingDown, Dumbbell, Loader2 } from "lucide-react";
import api from "../lib/api";

/**
 * WeakMuscleRecommendations — cards under the muscle heatmap that surface the
 * user's 3 weakest muscle groups plus 2 concrete exercise suggestions each.
 * Only renders when the user has enough data (>= 2 sessions in the window).
 */
export default function WeakMuscleRecommendations() {
  const [state, setState] = useState({ loading: true, data: null });

  useEffect(() => {
    api.get("/muscle-groups/recommendations")
      .then(({ data }) => setState({ loading: false, data }))
      .catch(() => setState({ loading: false, data: null }));
  }, []);

  const { loading, data } = state;
  if (loading) {
    return (
      <div className="af-card p-4 flex items-center gap-2 text-gray-500" data-testid="weak-muscle-loading">
        <Loader2 size={16} className="animate-spin" /> Analysiere Schwachstellen …
      </div>
    );
  }
  if (!data || !data.has_enough_data) return null;
  const recs = data.recommendations || [];
  if (recs.length === 0) {
    return (
      <div className="af-card p-5 border-[#39FF14]/30 bg-[#39FF14]/5" data-testid="weak-muscle-balanced">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#39FF14]" style={{ boxShadow: "0 0 8px #39FF14" }} />
          <div className="font-teko text-lg tracking-wide text-[#39FF14] uppercase">Balanciert!</div>
        </div>
        <p className="text-sm text-white/60 mt-1 font-chakra">
          Alle Muskelgruppen liegen über 60 %. Weiter so.
        </p>
      </div>
    );
  }

  return (
    <section className="mb-6" data-testid="weak-muscle-recommendations">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, rgba(255,20,147,0.18), rgba(255,20,147,0.04))",
              border: "1px solid rgba(255,20,147,0.4)",
            }}
          >
            <TrendingDown size={16} className="text-[#FF1493]" style={{ filter: "drop-shadow(0 0 6px #FF1493)" }} />
          </div>
          <div>
            <h3 className="font-teko text-lg sm:text-xl uppercase tracking-wide chrome-text leading-tight">
              Deine Baustellen
            </h3>
            <div className="text-[10px] sm:text-xs font-chakra text-white/45 tracking-[0.2em] uppercase">
              {data.message}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2.5">
        {recs.map((rec) => (
          <div
            key={rec.key}
            className="af-card p-4 border-white/8 hover:border-[#FF1493]/45 transition"
            data-testid={`weak-rec-${rec.key}`}
          >
            <div className="flex items-baseline justify-between gap-3 mb-3">
              <div className="font-teko text-xl sm:text-2xl tracking-wide text-white uppercase leading-tight">
                {rec.name}
              </div>
              <div className="font-teko text-xl sm:text-2xl text-[#FF1493]" style={{ textShadow: "0 0 8px rgba(255,20,147,0.4)" }}>
                {rec.percent}%
              </div>
            </div>

            {/* Bar */}
            <div className="h-1 bg-white/8 rounded overflow-hidden mb-3">
              <div
                className="h-full transition-all"
                style={{
                  width: `${Math.max(3, rec.percent)}%`,
                  background: "linear-gradient(90deg, #FF1493, #FF6B35)",
                  boxShadow: "0 0 8px rgba(255,20,147,0.5)",
                }}
              />
            </div>

            {/* Exercise recommendations */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(rec.exercises || []).map((ex, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2.5 py-2 px-2.5 rounded border border-white/6 bg-white/[0.02]"
                  data-testid={`weak-rec-ex-${rec.key}-${i}`}
                >
                  <Dumbbell size={14} className="text-[#00BFFF] shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="font-chakra text-sm text-white truncate">{ex.name}</div>
                    <div className="text-[10px] text-white/45 font-chakra tracking-wide">
                      {ex.sets}×{ex.reps} · {ex.focus}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
