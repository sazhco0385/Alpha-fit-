import { useEffect, useState } from "react";
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

  const load = async () => {
    setLoading(true);
    const { data } = await api.get("/plans/current");
    setPlan(data.plan);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const adjust = async () => {
    setAdjusting(true);
    try {
      const { data } = await api.post("/coach/adjust-plan");
      setPlan(data.plan);
      toast.success("Plan angepasst!");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Fehler");
    } finally {
      setAdjusting(false);
    }
  };

  const startDay = async (dayIndex) => {
    const { data } = await api.post("/sessions/start", { day_index: dayIndex });
    navigate(`/workout/${data.session.id}`);
  };

  if (loading) return <Layout><div className="text-center py-12 text-[#00BFFF] font-teko text-2xl">Lade...</div></Layout>;

  return (
    <Layout>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <div className="text-xs text-gray-500 font-chakra uppercase tracking-widest">TRAININGSPLAN V{plan?.version || 1}</div>
          <h1 className="font-teko text-5xl chrome-text mt-1">{plan?.name || "Plan"}</h1>
          <p className="text-gray-500 font-chakra mt-2 max-w-2xl">{plan?.progression_notes}</p>
        </div>
        <button onClick={adjust} disabled={adjusting} className="btn-outline flex items-center gap-2" data-testid="plan-adjust-btn">
          {adjusting ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          KI ANPASSEN
        </button>
      </div>

      <div className="space-y-6">
        {plan?.days?.map((day) => (
          <div key={day.day_index} className="af-card p-6 clip-corner-tl-br" data-testid={`plan-detail-day-${day.day_index}`}>
            <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
              <div>
                <div className="text-xs text-[#00BFFF] uppercase tracking-widest font-chakra">TAG {day.day_index}</div>
                <div className="font-teko text-3xl chrome-text">{day.name}</div>
              </div>
              <button onClick={() => startDay(day.day_index)} className="btn-primary flex items-center gap-2" data-testid={`plan-start-${day.day_index}`}>
                <Play size={16} /> STARTEN
              </button>
            </div>
            <div className="space-y-2">
              {day.exercises?.map((ex, i) => (
                <div key={i} className="flex items-center gap-4 p-3 bg-[#0A0A10] border border-[#1A1A24] hover:border-[#00BFFF]/40 transition" data-testid={`exercise-${day.day_index}-${i}`}>
                  <img
                    src={getExerciseImage(ex.name, ex.target_muscle)}
                    alt={ex.name}
                    className="w-16 h-16 object-cover border border-[#1A1A24]"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-teko text-xl tracking-wide chrome-text truncate">{ex.name}</div>
                    <div className="text-xs text-gray-500 font-chakra uppercase tracking-widest">{ex.target_muscle}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-teko text-2xl electric-text glow-text-soft">{ex.sets} × {ex.reps}</div>
                    <div className="text-xs text-gray-400 font-chakra">{ex.weight_kg} kg · {ex.rest_seconds}s rest</div>
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
