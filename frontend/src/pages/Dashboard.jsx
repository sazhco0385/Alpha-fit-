import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import CoachInsights from "../components/CoachInsights";
import DailySummary from "../components/DailySummary";
import WeekSchedule from "../components/WeekSchedule";
import CollapsibleSection from "../components/CollapsibleSection";
import api from "../lib/api";
import { useAuth } from "../lib/auth";
import { Brain, Crown, Play, Calendar, Flame, RefreshCw, Loader2, Weight, Scan, BookOpen, Sparkles, TrendingUp } from "lucide-react";
import { toast } from "sonner";

export default function Dashboard() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const [plan, setPlan] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState({ total_completed: 0, current_streak: 0, total_volume_kg: 0 });
  const [regenerating, setRegenerating] = useState(false);
  const [adjustStatus, setAdjustStatus] = useState(null);

  const load = async () => {
    const [{ data: planData }, { data: sessData }, { data: hist }, { data: st }, statusRes] = await Promise.all([
      api.get("/plans/current"),
      api.get("/sessions/active"),
      api.get("/sessions/history"),
      api.get("/sessions/stats"),
      api.get("/coach/plan-adjust-status").catch(() => ({ data: null })),
    ]);
    setPlan(planData.plan);
    setActiveSession(sessData.session);
    setSessions(hist.sessions || []);
    setStats(st);
    setAdjustStatus(statusRes?.data || null);
  };

  useEffect(() => { load(); }, []);

  const startDay = async (dayIndex) => {
    try {
      const { data } = await api.post("/sessions/start", { day_index: dayIndex });
      navigate(`/workout/${data.session.id}`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Fehler");
    }
  };

  const adjustPlan = async () => {
    setRegenerating(true);
    try {
      const { data: startData } = await api.post("/coach/adjust-plan/start");
      const jobId = startData.job_id;
      const maxAttempts = 90;
      let result = null;
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const { data: st } = await api.get(`/coach/adjust-plan/status/${jobId}`);
        if (st.status === "done") { result = st; break; }
        if (st.status === "error") throw new Error(st.error || "KI-Anpassung fehlgeschlagen");
      }
      if (!result) throw new Error("Zeitüberschreitung - bitte erneut versuchen");
      setPlan(result.plan);
      toast.success("Plan wurde von KI angepasst!");
      await refresh();
    } catch (err) {
      toast.error(err?.response?.data?.detail || err?.message || "Fehler");
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <Layout>
      {/* Hero greeting */}
      <div className="mb-6 sm:mb-8" data-testid="dashboard-hero">
        <div className="text-[10px] sm:text-xs text-gray-500 font-chakra uppercase tracking-[0.3em]">WILLKOMMEN ZURÜCK</div>
        <h1 className="font-teko text-4xl sm:text-5xl md:text-6xl tracking-wide chrome-text mt-1 break-words">
          ALPHA <span className="electric-text glow-text">{user?.name?.toUpperCase()}</span>
        </h1>
      </div>

      {/* Resume Banner */}
      {activeSession && (
        <div className="af-card p-4 sm:p-5 mb-5 sm:mb-6 tracing-border clip-corner-tl-br relative" data-testid="resume-banner">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="text-[10px] sm:text-xs text-[#00BFFF] uppercase tracking-widest font-chakra">TRAINING LÄUFT</div>
              <div className="font-teko text-2xl sm:text-3xl mt-1 chrome-text">Setze dein Training fort</div>
              <div className="text-gray-500 text-xs sm:text-sm font-chakra">Tag {activeSession.day_index} · {activeSession.logged_sets?.length || 0} Sätze geloggt</div>
            </div>
            <button onClick={() => navigate(`/workout/${activeSession.id}`)} className="btn-primary flex items-center gap-2" data-testid="resume-workout-btn">
              <Play size={18} /> FORTSETZEN
            </button>
          </div>
        </div>
      )}

      {/* Streak Banner */}
      {stats.current_streak >= 3 && !activeSession && (
        <div className="af-card p-4 mb-5 sm:mb-6 clip-corner-tl-br relative overflow-hidden" data-testid="streak-banner" style={{ borderColor: "#FF5722" }}>
          <div className="absolute inset-0 opacity-20" style={{ background: "radial-gradient(circle at 20% 50%, #FF5722 0%, transparent 50%)" }} />
          <div className="relative flex items-center gap-3">
            <Flame size={36} className="text-[#FF5722] flex-shrink-0" style={{ filter: "drop-shadow(0 0 12px rgba(255,87,34,0.8))" }} />
            <div className="min-w-0">
              <div className="font-teko text-2xl sm:text-3xl chrome-text">{stats.current_streak}-TAGE STREAK</div>
              <div className="text-xs sm:text-sm text-gray-300 font-chakra">Verliere ihn nicht — trainiere heute!</div>
            </div>
          </div>
        </div>
      )}

      {/* Alpha Coach Insights (collapsible) */}
      <CollapsibleSection
        title="Alpha Coach"
        icon={Brain}
        hint="Deine Wochen-Analyse"
        defaultOpen={false}
        testid="section-coach"
      >
        <CoachInsights compact />
      </CollapsibleSection>

      {/* Daily Summary (collapsible) */}
      <CollapsibleSection
        title="Heute"
        icon={Sparkles}
        hint="Motivation · Kalorien · Gewicht"
        defaultOpen={false}
        testid="section-daily"
      >
        <DailySummary plan={plan} sessions={sessions} />
      </CollapsibleSection>

      {/* Week Schedule (always visible - primary today-focus) */}
      <WeekSchedule
        plan={plan}
        completedTodayDayIndex={(() => {
          const today = new Date().toISOString().slice(0, 10);
          const s = (sessions || []).find(
            (x) => x.status === "completed" && (x.completed_at || "").slice(0, 10) === today
          );
          return s?.day_index ?? null;
        })()}
        onStartDay={startDay}
      />

      {/* Stats Bento (collapsible) */}
      <CollapsibleSection
        title="Statistik"
        icon={TrendingUp}
        hint={`${stats.total_completed} Workouts · Streak ${stats.current_streak}`}
        defaultOpen={false}
        testid="section-stats"
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <StatCard icon={Flame} label="Workouts" value={stats.total_completed} testid="stat-workouts" />
          <StatCard icon={Calendar} label="Streak (Tage)" value={stats.current_streak} highlight={stats.current_streak >= 3} testid="stat-streak" />
          <StatCard icon={Weight} label="Volumen (kg)" value={formatVolume(stats.total_volume_kg)} testid="stat-volume" />
          <StatCard icon={Crown} label="Status" value={user?.is_premium ? "PREMIUM" : "FREE"} highlight={user?.is_premium} gold={user?.is_premium} testid="stat-status" />
        </div>
      </CollapsibleSection>

      {/* Training Plan */}
      <section className="mb-6 sm:mb-8">
        <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
          <h2 className="font-teko text-2xl sm:text-3xl tracking-wide chrome-text whitespace-nowrap">DEIN PLAN</h2>
          <div className="flex gap-2 flex-wrap">
            <button onClick={adjustPlan} disabled={regenerating} className="btn-outline text-xs flex items-center gap-1.5 whitespace-nowrap" data-testid="adjust-plan-btn">
              {regenerating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              KI&nbsp;ANPASSEN
            </button>
            <button onClick={() => navigate("/plan")} className="btn-outline text-xs whitespace-nowrap" data-testid="view-plan-btn">DETAILS</button>
          </div>
        </div>
        {adjustStatus && adjustStatus.status !== "no_plan" && (
          <div className="mb-3 flex items-center gap-2 text-[11px] font-chakra" data-testid="adjust-status-badge">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{
                background: adjustStatus.status === "ready" ? "#00FF7F" : adjustStatus.status === "cooldown" ? "#FFD740" : "#00BFFF",
                boxShadow: `0 0 8px ${adjustStatus.status === "ready" ? "#00FF7F" : adjustStatus.status === "cooldown" ? "#FFD740" : "#00BFFF"}`,
              }}
            />
            <span className="text-gray-400">Nächste KI-Anpassung:</span>
            <span className="text-gray-200">{adjustStatus.message}</span>
          </div>
        )}

        {plan ? (
          <div>
            <div className="text-[#00BFFF] font-teko text-xl mb-1 glow-text-soft">{plan.name}</div>
            <div className="text-body-muted text-sm sm:text-base font-chakra mb-4 leading-relaxed">{plan.progression_notes}</div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {plan.days?.map((day) => (
                <div key={day.day_index} className="af-card p-4 sm:p-5 clip-corner-tl-br hover:glow-box transition" data-testid={`plan-day-${day.day_index}`}>
                  <div className="flex items-center justify-between mb-3 gap-2">
                    <div className="text-xs text-gray-500 uppercase tracking-widest font-chakra">TAG {day.day_index}</div>
                    {day.focus && <span className="text-[10px] text-[#00BFFF] border border-[#00BFFF]/50 px-2 py-0.5 font-chakra uppercase tracking-widest whitespace-nowrap">{day.focus}</span>}
                  </div>
                  <div className="font-teko text-lg sm:text-xl tracking-wide mb-3 chrome-text break-words leading-tight">{day.name}</div>
                  <div className="text-xs text-gray-400 font-chakra mb-4">{day.exercises?.length || 0} Übungen</div>
                  <button onClick={() => startDay(day.day_index)} className="btn-primary w-full flex items-center justify-center gap-2 text-sm" data-testid={`start-day-${day.day_index}`}>
                    <Play size={14} /> STARTEN
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="af-card p-8 text-center">
            <Brain size={32} className="mx-auto text-[#00BFFF] mb-2" />
            <div className="text-gray-400 font-chakra">Plan wird generiert...</div>
          </div>
        )}
      </section>

      {/* Quick Actions (compact) */}
      <section className="mb-6 sm:mb-8 grid grid-cols-2 gap-3" data-testid="quick-actions">
        <button
          onClick={() => navigate("/bodyscan")}
          className="af-card p-3 sm:p-4 clip-corner-tl-br hover:border-[#00BFFF] transition w-full text-left flex items-center gap-3"
          data-testid="dashboard-bodyscan-cta"
        >
          <Scan size={20} className="text-[#00BFFF] flex-shrink-0" style={{ filter: "drop-shadow(0 0 8px rgba(0,191,255,0.5))" }} />
          <div className="flex-1 min-w-0">
            <div className="font-teko text-base sm:text-lg chrome-text tracking-wide leading-tight">BODY SCAN</div>
            <div className="text-[10px] sm:text-[11px] text-gray-500 font-chakra uppercase tracking-widest">KI-Analyse</div>
          </div>
        </button>
        <button
          onClick={() => navigate("/library")}
          className="af-card p-3 sm:p-4 clip-corner-tl-br hover:border-[#00BFFF] transition w-full text-left flex items-center gap-3"
          data-testid="dashboard-library-cta"
        >
          <BookOpen size={20} className="text-[#00BFFF] flex-shrink-0" style={{ filter: "drop-shadow(0 0 8px rgba(0,191,255,0.5))" }} />
          <div className="flex-1 min-w-0">
            <div className="font-teko text-base sm:text-lg chrome-text tracking-wide leading-tight">BIBLIOTHEK</div>
            <div className="text-[10px] sm:text-[11px] text-gray-500 font-chakra uppercase tracking-widest">54 Übungen</div>
          </div>
        </button>
      </section>
    </Layout>
  );
}

function StatCard({ icon: Icon, label, value, highlight, gold, testid }) {
  const iconColor = gold ? "text-[#E0B968]" : "text-[#00BFFF]";
  const boxClass = gold
    ? "gold-glow-box gold-border"
    : highlight ? "glow-box border-[#00BFFF]" : "";
  const valueClass = gold ? "gold-chrome" : "chrome-text";
  return (
    <div className={`af-card p-4 clip-corner-tl-br ${boxClass}`} data-testid={testid}>
      <Icon size={18} className={iconColor} />
      <div className={`font-teko text-3xl mt-2 tracking-wide ${valueClass}`}>{value}</div>
      <div className="text-[10px] text-body-muted uppercase tracking-[0.25em] font-chakra mt-1">{label}</div>
    </div>
  );
}

function formatVolume(kg) {
  if (!kg) return "0";
  if (kg >= 1000000) return `${(kg / 1000000).toFixed(1)}M`;
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}t`;
  return Math.round(kg).toLocaleString();
}
