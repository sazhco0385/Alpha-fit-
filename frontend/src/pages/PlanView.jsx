import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import api from "../lib/api";
import { Play, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { getExerciseImage } from "../lib/exerciseImages";

export default function PlanView() {
  const navigate = useNavigate();
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [adjusting, setAdjusting] = useState(false);
  const [adjustElapsed, setAdjustElapsed] = useState(0);
  const elapsedTimerRef = useRef(null);

  const load = async () => {
    setLoading(true);
    const { data } = await api.get("/plans/current");
    setPlan(data.plan);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => () => { if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current); }, []);

  const adjust = async () => {
    setAdjusting(true);
    setAdjustElapsed(0);
    const started = Date.now();
    elapsedTimerRef.current = setInterval(() => {
      setAdjustElapsed(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    try {
      const { data: startData } = await api.post("/coach/adjust-plan/start");
      const jobId = startData.job_id;
      // Poll up to ~3 minutes
      const maxAttempts = 90; // 90 * 2s = 180s
      let result = null;
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const { data: st } = await api.get(`/coach/adjust-plan/status/${jobId}`);
        if (st.status === "done") { result = st; break; }
        if (st.status === "error") {
          throw new Error(st.error || "KI-Anpassung fehlgeschlagen");
        }
      }
      if (!result) throw new Error("Zeitüberschreitung - bitte erneut versuchen");
      setPlan(result.plan);
      toast.success("Plan angepasst!");
    } catch (err) {
      toast.error(err?.response?.data?.detail || err?.message || "Fehler");
    } finally {
      if (elapsedTimerRef.current) { clearInterval(elapsedTimerRef.current); elapsedTimerRef.current = null; }
      setAdjusting(false);
      setAdjustElapsed(0);
    }
  };

  const startDay = async (dayIndex) => {
    const { data } = await api.post("/sessions/start", { day_index: dayIndex });
    navigate(`/workout/${data.session.id}`);
  };

  if (loading) return <Layout><div className="text-center py-12 text-[#00BFFF] font-teko text-2xl">Lade...</div></Layout>;

  return (
    <Layout>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div className="min-w-0">
          <div className="text-[10px] sm:text-xs text-gray-500 font-chakra uppercase tracking-widest">TRAININGSPLAN V{plan?.version || 1}</div>
          <h1 className="font-teko text-3xl sm:text-5xl chrome-text mt-1 break-words">{plan?.name || "Plan"}</h1>
          <p className="prose-af font-chakra mt-2 max-w-2xl">{plan?.progression_notes}</p>
        </div>
        <button onClick={adjust} disabled={adjusting} className="btn-outline flex items-center gap-2 text-xs sm:text-sm" data-testid="plan-adjust-btn">
          {adjusting ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          {adjusting ? `ANPASSEN... ${adjustElapsed}s` : "KI ANPASSEN"}
        </button>
      </div>

      <div className="space-y-5 sm:space-y-6">
        {plan?.days?.map((day) => (
          <div key={day.day_index} className="af-card p-4 sm:p-6 clip-corner-tl-br" data-testid={`plan-detail-day-${day.day_index}`}>
            <div className="flex items-center justify-between mb-4 sm:mb-5 flex-wrap gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-[10px] sm:text-xs text-[#00BFFF] uppercase tracking-widest font-chakra">TAG {day.day_index}</div>
                <div className="font-teko text-xl sm:text-3xl chrome-text break-words leading-tight">{day.name}</div>
              </div>
              <button onClick={() => startDay(day.day_index)} className="btn-primary flex items-center gap-2 text-sm flex-shrink-0" data-testid={`plan-start-${day.day_index}`}>
                <Play size={16} /> STARTEN
              </button>
            </div>
            <div className="space-y-2">
              {day.exercises?.map((ex, i) => (
                <div key={i} className="flex items-center gap-3 sm:gap-4 p-2 sm:p-3 bg-[#0A0A10] border border-[#1A1A24] hover:border-[#00BFFF]/40 transition" data-testid={`exercise-${day.day_index}-${i}`}>
                  <img
                    src={getExerciseImage(ex.name, ex.target_muscle)}
                    alt={ex.name}
                    className="w-12 h-12 sm:w-16 sm:h-16 object-cover border border-[#1A1A24] flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-teko text-base sm:text-xl tracking-wide chrome-text truncate">{ex.name}</div>
                    <div className="text-[10px] sm:text-xs text-gray-500 font-chakra uppercase tracking-widest truncate">{ex.target_muscle}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-teko text-lg sm:text-2xl electric-text glow-text-soft whitespace-nowrap">{ex.sets} × {ex.reps}</div>
                    <div className="text-[10px] sm:text-xs text-gray-400 font-chakra whitespace-nowrap">{ex.weight_kg}kg · {ex.rest_seconds}s</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
