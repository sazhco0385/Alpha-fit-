import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Flame, Apple, Scale, Calendar, Quote, TrendingDown, TrendingUp, Minus, Play, Loader2 } from "lucide-react";
import api from "../lib/api";
import { getDailyQuote } from "../lib/quotes";
import { toast } from "sonner";

/**
 * Dashboard summary panel: shows daily motivation quote, calories vs goal,
 * weight trend, and next workout day.
 */
export default function DailySummary({ plan, sessions }) {
  const navigate = useNavigate();
  const [nutrition, setNutrition] = useState(null);
  const [weight, setWeight] = useState(null);
  const [startingDay, setStartingDay] = useState(false);
  const quote = getDailyQuote();

  useEffect(() => {
    let alive = true;
    Promise.all([
      api.get("/nutrition/today").catch(() => null),
      api.get("/profile/weight-trend").catch(() => null),
    ]).then(([n, w]) => {
      if (!alive) return;
      setNutrition(n?.data || null);
      setWeight(w?.data || null);
    });
    return () => { alive = false; };
  }, []);

  const nextDay = computeNextDay(plan, sessions);

  const startNextDay = async () => {
    if (!nextDay || startingDay) return;
    setStartingDay(true);
    try {
      const { data } = await api.post("/sessions/start", { day_index: nextDay.day_index });
      navigate(`/workout/${data.session.id}`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Workout konnte nicht gestartet werden");
      setStartingDay(false);
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8" data-testid="daily-summary">
      {/* Daily Quote */}
      <div className="af-card p-4 sm:p-5 clip-corner-tl-br relative overflow-hidden" data-testid="daily-quote">
        <div className="absolute -top-4 -right-4 opacity-10">
          <Quote size={80} className="text-[#FF4500]" />
        </div>
        <div className="relative">
          <div className="text-[10px] text-[#FF4500] uppercase tracking-[0.3em] font-chakra mb-2">SPRUCH DES TAGES</div>
          <p className="font-teko text-lg sm:text-xl text-white leading-tight tracking-wide" style={{ textShadow: "0 0 12px rgba(255,69,0,0.25)" }}>
            „{quote.text}“
          </p>
          <div className="text-[10px] text-gray-500 uppercase tracking-[0.25em] font-chakra mt-3">— {quote.author}</div>
        </div>
      </div>

      {/* Calories */}
      <button
        onClick={() => navigate("/nutrition")}
        className="af-card p-4 sm:p-5 clip-corner-tl-br hover:glow-box transition text-left"
        data-testid="summary-calories"
      >
        <div className="flex items-center gap-2 mb-2">
          <Apple size={16} className="text-[#FF4500]" />
          <div className="text-[10px] text-gray-400 uppercase tracking-[0.25em] font-chakra">KCAL HEUTE</div>
        </div>
        {nutrition ? (
          <>
            <div className="font-teko text-3xl sm:text-4xl chrome-text leading-none">
              {Math.round(nutrition.totals?.calories || 0)}
              <span className="text-base text-gray-500">/{Math.round(nutrition.goals?.calories || 0)}</span>
            </div>
            <div className="mt-2 h-1.5 bg-[#1A1A24] overflow-hidden">
              <div
                className="h-full"
                style={{
                  width: `${Math.min(100, ((nutrition.totals?.calories || 0) / Math.max(1, nutrition.goals?.calories || 1)) * 100)}%`,
                  background: "linear-gradient(90deg, #FF4500, #FF5A1F)",
                  boxShadow: "0 0 8px rgba(255,69,0,0.6)",
                }}
              />
            </div>
            <div className="text-[10px] text-gray-500 font-chakra mt-2 flex gap-2 flex-wrap">
              <span>P {Math.round(nutrition.totals?.protein_g || 0)}g</span>
              <span>·</span>
              <span>C {Math.round(nutrition.totals?.carbs_g || 0)}g</span>
              <span>·</span>
              <span>F {Math.round(nutrition.totals?.fat_g || 0)}g</span>
            </div>
          </>
        ) : (
          <div className="font-teko text-2xl text-gray-500 mt-1">—</div>
        )}
      </button>

      {/* Weight */}
      <div className="af-card p-4 sm:p-5 clip-corner-tl-br" data-testid="summary-weight">
        <div className="flex items-center gap-2 mb-2">
          <Scale size={16} className="text-[#FF4500]" />
          <div className="text-[10px] text-gray-400 uppercase tracking-[0.25em] font-chakra">GEWICHT</div>
        </div>
        <div className="font-teko text-3xl sm:text-4xl chrome-text leading-none">
          {weight?.current_kg ? `${weight.current_kg}` : "—"}
          <span className="text-base text-gray-500"> kg</span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          {weight?.delta_kg !== null && weight?.delta_kg !== undefined ? (
            <WeightDelta value={weight.delta_kg} />
          ) : (
            <div className="text-[10px] text-gray-500 font-chakra">Body Scan starten für Verlauf</div>
          )}
        </div>
        {/* Mini sparkline */}
        {weight?.points && weight.points.length >= 2 && (
          <div className="mt-3">
            <Sparkline points={weight.points.map(p => p.weight_kg)} />
          </div>
        )}
      </div>

      {/* Next Workout */}
      <button
        onClick={startNextDay}
        disabled={!nextDay || startingDay}
        className="af-card p-4 sm:p-5 clip-corner-tl-br hover:glow-box transition text-left disabled:opacity-60"
        data-testid="summary-next-workout"
      >
        <div className="flex items-center gap-2 mb-2">
          <Calendar size={16} className="text-[#FF4500]" />
          <div className="text-[10px] text-gray-400 uppercase tracking-[0.25em] font-chakra">NÄCHSTES WORKOUT</div>
        </div>
        {nextDay ? (
          <>
            <div className="font-teko text-xl sm:text-2xl chrome-text leading-tight break-words">
              {nextDay.name}
            </div>
            <div className="text-xs text-[#FF4500] font-chakra mt-1 flex items-center gap-1">
              <Flame size={12} /> TAG {nextDay.day_index} · {nextDay.exercises?.length || 0} Übungen
            </div>
            <div className="text-[10px] text-gray-400 font-chakra mt-2 flex items-center gap-1">
              {startingDay
                ? <><Loader2 size={10} className="animate-spin" /> Starte Workout...</>
                : <><Play size={10} /> Tippen zum Starten</>}
            </div>
          </>
        ) : (
          <div className="font-teko text-xl text-gray-500 mt-1">Kein Plan</div>
        )}
      </button>
    </div>
  );
}

function WeightDelta({ value }) {
  const v = Number(value);
  if (v === 0 || isNaN(v)) {
    return (
      <span className="text-xs text-gray-400 font-chakra flex items-center gap-1">
        <Minus size={12} /> stabil
      </span>
    );
  }
  const down = v < 0;
  const color = down ? "text-green-400" : "text-orange-400";
  const Icon = down ? TrendingDown : TrendingUp;
  return (
    <span className={`text-xs font-chakra flex items-center gap-1 ${color}`}>
      <Icon size={12} /> {v > 0 ? "+" : ""}{v} kg seit 1. Scan
    </span>
  );
}

function Sparkline({ points }) {
  if (!points || points.length < 2) return null;
  const w = 100, h = 24;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const d = points.map((p, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = h - ((p - min) / range) * h;
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-6" preserveAspectRatio="none">
      <path d={d} stroke="#FF4500" strokeWidth="1.5" fill="none" style={{ filter: "drop-shadow(0 0 4px rgba(255,69,0,0.6))" }} />
    </svg>
  );
}

function computeNextDay(plan, sessions) {
  if (!plan?.days || plan.days.length === 0) return null;
  // Find most recent completed session in last 14 days
  const recent = (sessions || []).filter(s => s.status === "completed");
  if (recent.length === 0) return plan.days[0];
  const lastDayIndex = recent[0].day_index;
  // Next sequential day, wrapping
  const sortedDays = [...plan.days].sort((a, b) => a.day_index - b.day_index);
  const idx = sortedDays.findIndex(d => d.day_index === lastDayIndex);
  if (idx === -1) return sortedDays[0];
  return sortedDays[(idx + 1) % sortedDays.length];
}
