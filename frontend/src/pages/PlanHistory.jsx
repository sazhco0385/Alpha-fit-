import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import api from "../lib/api";
import { toast } from "sonner";
import { RotateCcw, CheckCircle2, Loader2, Dumbbell, ChevronLeft } from "lucide-react";

export default function PlanHistory() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState(null);
  const [rollingBack, setRollingBack] = useState(null);

  const load = async () => {
    try {
      const { data } = await api.get("/coach/plan-history");
      setPlans(data.plans || []);
    } catch {
      setPlans([]);
    }
  };
  useEffect(() => { load(); }, []);

  const rollback = async (planId, name) => {
    if (!confirm(`Plan "${name}" als aktiv setzen? Neuere Versionen bleiben in der Historie.`)) return;
    setRollingBack(planId);
    try {
      await api.post(`/coach/plan-rollback/${planId}`);
      toast.success(`Plan "${name}" aktiviert`);
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Rollback fehlgeschlagen");
    } finally {
      setRollingBack(null);
    }
  };

  return (
    <Layout>
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-gray-400 hover:text-[#00BFFF] mb-4 font-chakra" data-testid="plan-history-back">
        <ChevronLeft size={16} /> ZURÜCK
      </button>
      <h1 className="font-teko text-4xl chrome-text tracking-wider mb-1">PLAN-HISTORIE</h1>
      <p className="text-gray-500 font-chakra text-sm mb-6">Alle Anpassungen deines Trainingsplans. Klick auf &quot;Aktivieren&quot; um zu einer älteren Version zurückzukehren.</p>

      {plans === null ? (
        <div className="af-card p-6 flex items-center gap-2 text-gray-500"><Loader2 size={16} className="animate-spin" /> Lade…</div>
      ) : plans.length === 0 ? (
        <div className="af-card p-6 text-gray-500 font-chakra">Noch keine Plan-Historie vorhanden.</div>
      ) : (
        <div className="space-y-3" data-testid="plan-history-list">
          {plans.map((p) => (
            <div
              key={p.id}
              className={`af-card p-4 ${p.is_current ? "border-[#00BFFF] shadow-[0_0_14px_rgba(0,191,255,0.35)]" : ""}`}
              data-testid={`plan-history-item-${p.id}`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-teko text-2xl chrome-text tracking-wide">{p.name || `Plan v${p.version}`}</span>
                    <span className="text-[10px] px-2 py-0.5 border border-gray-700 text-gray-400 font-chakra uppercase tracking-widest">
                      v{p.version}
                    </span>
                    {p.is_current && (
                      <span className="text-[10px] px-2 py-0.5 border border-[#00FF7F] text-[#00FF7F] font-chakra uppercase tracking-widest flex items-center gap-1">
                        <CheckCircle2 size={10} /> AKTIV
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 font-chakra mb-2">
                    {new Date(p.created_at).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    {" · "}
                    <Dumbbell size={11} className="inline text-[#00BFFF] mx-0.5" />
                    {p.day_count} Tage · {p.exercise_count} Übungen
                  </div>
                  {p.day_focus && p.day_focus.length > 0 && (
                    <div className="flex gap-1 flex-wrap mb-2">
                      {p.day_focus.slice(0, 6).map((f, i) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.5 bg-gray-800 text-gray-400 font-chakra rounded">{f}</span>
                      ))}
                    </div>
                  )}
                  {p.progression_notes && (
                    <div className="text-xs text-gray-400 font-chakra italic leading-relaxed">
                      &quot;{p.progression_notes.substring(0, 200)}{p.progression_notes.length > 200 ? "…" : ""}&quot;
                    </div>
                  )}
                </div>
                {!p.is_current && (
                  <button
                    type="button"
                    onClick={() => rollback(p.id, p.name)}
                    disabled={rollingBack === p.id}
                    className="btn-outline text-xs flex items-center gap-1 flex-shrink-0 disabled:opacity-50"
                    data-testid={`rollback-btn-${p.id}`}
                  >
                    {rollingBack === p.id ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                    AKTIVIEREN
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
