import { useEffect, useState } from "react";
import api from "../lib/api";
import { Flame, TrendingUp, Sparkles, AlertTriangle, Trophy, Brain, Loader2, ChevronRight, ChevronDown, ChevronUp } from "lucide-react";

const ICONS = {
  flame: Flame,
  trending: TrendingUp,
  fire: Flame,
  sparkles: Sparkles,
  alert: AlertTriangle,
  trophy: Trophy,
};

const COLORS = {
  workouts: "#FF5A1F",
  volume: "#FF4500",
  streak: "#FF5722",
  progression: "#FFD740",
  stagnation: "#FF9800",
  nutrition_protein: "#FF5252",
  nutrition_cal: "#FFD740",
  milestone: "#FFD700",
};

function renderText(text) {
  // Support **bold** markdown
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={i} className="text-[#FF5A1F] glow-text-soft font-bold">{p.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}

export default function CoachInsights({ compact = false, collapsible = false }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(() => {
    if (!collapsible) return false;
    try { return localStorage.getItem("coach_insights_collapsed") === "1"; } catch { return false; }
  });

  const toggleCollapsed = () => {
    setCollapsed((v) => {
      const next = !v;
      try { localStorage.setItem("coach_insights_collapsed", next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  };

  useEffect(() => {
    api.get("/coach/insights")
      .then(({ data }) => setData(data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="af-card p-4 sm:p-5 mb-4 sm:mb-6 clip-corner-tl-br" data-testid="coach-insights-loading">
        <div className="flex items-center gap-2 text-gray-500 font-chakra text-sm">
          <Loader2 size={14} className="animate-spin text-[#FF4500]" /> Alpha Coach analysiert deine Daten...
        </div>
      </div>
    );
  }
  if (!data || data.insights.length === 0) return null;

  const visible = compact ? data.insights.slice(0, 2) : data.insights;
  const showTracingBorder = !collapsible || !collapsed; // hide neon animated border when collapsed

  return (
    <div className={`af-card p-3 sm:p-5 mb-4 sm:mb-6 clip-corner-tl-br ${showTracingBorder ? "tracing-border" : ""}`} data-testid="coach-insights">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="relative w-9 h-9 hex-shield flex items-center justify-center pulse-glow flex-shrink-0" style={{ background: "linear-gradient(180deg, #FF5A1F, #1E90FF)" }}>
            <div className="absolute inset-[2px] hex-shield bg-black flex items-center justify-center">
              <Brain size={14} className="text-[#FF5A1F]" style={{ filter: "drop-shadow(0 0 6px rgba(255,90,31,0.9))" }} />
            </div>
          </div>
          <div className="min-w-0">
            <div className="text-[10px] text-[#FF4500] uppercase tracking-[0.3em] font-chakra">ALPHA COACH</div>
            <div className="font-teko text-lg sm:text-xl chrome-text leading-none truncate">
              {collapsible && collapsed ? `${data.insights.length} Insights verfügbar` : "Deine Wochen-Analyse"}
            </div>
          </div>
        </div>
        {collapsible && (
          <button
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Einblenden" : "Ausblenden"}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center border border-[#1A1A24] hover:border-[#FF4500]/60 text-gray-400 hover:text-[#FF4500] transition rounded"
            data-testid="coach-insights-toggle"
          >
            {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
        )}
      </div>

      {!collapsed && (
        <div className="space-y-2">
          {visible.map((i, idx) => {
            const Icon = ICONS[i.icon] || Sparkles;
            const color = COLORS[i.type] || "#FF4500";
            return (
              <div key={idx} className="flex items-start gap-3 p-3 bg-[#0A0A10] border border-[#1A1A24] hover:border-[#FF4500]/30 transition" data-testid={`insight-${i.type}`}>
                <Icon size={18} style={{ color, filter: `drop-shadow(0 0 6px ${color}99)` }} className="mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-teko text-base tracking-wide chrome-text leading-tight">{i.title}</div>
                  <div className="text-xs sm:text-sm text-gray-300 font-chakra mt-1 leading-relaxed">{renderText(i.text)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {compact && !collapsed && data.insights.length > 2 && (
        <div className="mt-3 text-center">
          <a href="/coach" className="text-[10px] text-[#FF4500] uppercase tracking-widest font-chakra inline-flex items-center gap-1" data-testid="see-all-insights">
            +{data.insights.length - 2} weitere Insights <ChevronRight size={12} />
          </a>
        </div>
      )}
    </div>
  );
}
