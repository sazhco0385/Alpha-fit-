import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import CoachInsights from "../components/CoachInsights";
import WeekSchedule from "../components/WeekSchedule";
import CollapsibleSection from "../components/CollapsibleSection";
import DashboardHero from "../components/DashboardHero";
import api from "../lib/api";
import { useAuth } from "../lib/auth";
import { Brain, Crown, Play, Calendar, Flame, RefreshCw, Loader2, Weight, Scan, BookOpen, TrendingUp, ChevronRight, Zap, Target } from "lucide-react";
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
      {/* ═══════════ HERO ═══════════ */}
      <DashboardHero
        user={user}
        streak={stats.current_streak}
        onResume={activeSession ? () => navigate(`/workout/${activeSession.id}`) : null}
        resumeLabel={activeSession ? `TRAINING FORTSETZEN · TAG ${activeSession.day_index}` : null}
      />

      {/* ═══════════ QUICK STATS ═══════════ */}
      <section className="grid grid-cols-3 gap-2 sm:gap-3 mb-6 enter enter-d1" data-testid="dashboard-stats-row">
        <StatTile
          icon={Flame}
          label="Workouts"
          value={stats.total_completed || 0}
          testid="stat-workouts"
        />
        <StatTile
          icon={Weight}
          label="Volumen"
          value={formatVolume(stats.total_volume_kg)}
          testid="stat-volume"
        />
        <StatTile
          icon={Crown}
          label="Status"
          value={user?.is_premium ? "PRO" : "FREE"}
          highlight={user?.is_premium}
          testid="stat-status"
        />
      </section>

      {/* ═══════════ WEEK SCHEDULE ═══════════ */}
      <div className="mb-6 enter enter-d2">
        <WeekSchedule plan={plan} sessions={sessions} onStartDay={startDay} />
      </div>

      {/* ═══════════ TRAINING PLAN ═══════════ */}
      <section className="mb-6 enter enter-d3" data-testid="dashboard-plan-section">
        <div className="dash-section-title">
          <h2>DEIN PLAN</h2>
          <button
            onClick={() => navigate("/plan")}
            className="text-[11px] font-chakra uppercase tracking-[0.25em] text-[#00E5FF] flex items-center gap-1 hover:text-white transition"
            data-testid="view-plan-btn"
          >
            Details <ChevronRight size={12} />
          </button>
        </div>

        {plan && (
          <>
            <div className="text-[#00E5FF] font-teko text-xl sm:text-2xl leading-tight mb-1" style={{ textShadow: "0 0 12px rgba(0,229,255,0.4)" }}>{plan.name}</div>
            {plan.progression_notes && (
              <p className="text-white/55 text-xs sm:text-sm font-chakra leading-relaxed mb-3">{plan.progression_notes}</p>
            )}

            {/* Mesocycle phase pill */}
            {plan.mesocycle_phase && (
              <div className="mb-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border" style={{
                borderColor:
                  plan.mesocycle_phase.week === 4 ? "#FFD740"
                  : plan.mesocycle_phase.week === 3 ? "#FF6B35"
                  : plan.mesocycle_phase.week === 2 ? "#39FF14"
                  : "#00E5FF",
                background:
                  plan.mesocycle_phase.week === 4 ? "rgba(255,215,64,0.08)"
                  : plan.mesocycle_phase.week === 3 ? "rgba(255,107,53,0.08)"
                  : plan.mesocycle_phase.week === 2 ? "rgba(57,255,20,0.08)"
                  : "rgba(0,229,255,0.08)",
                boxShadow: `0 0 16px ${
                  plan.mesocycle_phase.week === 4 ? "rgba(255,215,64,0.20)"
                  : plan.mesocycle_phase.week === 3 ? "rgba(255,107,53,0.20)"
                  : plan.mesocycle_phase.week === 2 ? "rgba(57,255,20,0.20)"
                  : "rgba(0,229,255,0.20)"
                }`,
              }} data-testid="mesocycle-badge">
                <span className="text-[10px] font-chakra tracking-[0.3em] uppercase" style={{
                  color:
                    plan.mesocycle_phase.week === 4 ? "#FFD740"
                    : plan.mesocycle_phase.week === 3 ? "#FF6B35"
                    : plan.mesocycle_phase.week === 2 ? "#39FF14"
                    : "#00E5FF",
                }}>
                  Block {plan.mesocycle_phase.block} · Woche {plan.mesocycle_phase.week}
                </span>
                <span className="w-1 h-1 rounded-full bg-white/30" />
                <span className="text-[10px] font-chakra tracking-widest uppercase text-white/70">
                  {plan.mesocycle_phase.name}
                </span>
              </div>
            )}

            {plan.plateaus_detected && plan.plateaus_detected.length > 0 && (
              <div className="mb-3 p-3 rounded-xl border border-[#FF1493]/50 bg-[#FF1493]/8" style={{ boxShadow: "0 0 18px rgba(255,20,147,0.15)" }} data-testid="plateau-warning">
                <div className="flex items-center gap-2 text-[11px] font-chakra">
                  <span className="w-2 h-2 rounded-full bg-[#FF1493] animate-pulse" style={{ boxShadow: "0 0 8px #FF1493" }} />
                  <span className="text-[#FF1493] tracking-widest uppercase">Plateau erkannt</span>
                </div>
                <div className="text-xs text-white/65 mt-1 font-chakra">
                  {plan.plateaus_detected.slice(0, 3).join(", ")} — KI passt beim nächsten Adjust an
                </div>
              </div>
            )}

            {adjustStatus && adjustStatus.status !== "no_plan" && (
              <div className="mb-3 flex items-center gap-2 text-[11px] font-chakra" data-testid="adjust-status-badge">
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{
                    background: adjustStatus.status === "ready" ? "#00FF7F" : adjustStatus.status === "cooldown" ? "#FFD740" : "#00E5FF",
                    boxShadow: `0 0 10px ${adjustStatus.status === "ready" ? "#00FF7F" : adjustStatus.status === "cooldown" ? "#FFD740" : "#00E5FF"}`,
                  }}
                />
                <span className="text-white/50">Nächste KI-Anpassung:</span>
                <span className="text-white/80">{adjustStatus.message}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {plan.days?.map((day, idx) => {
                const isToday = activeSession?.day_index === day.day_index;
                return (
                  <div
                    key={day.day_index}
                    className={`af-card tile-3d p-4 clip-corner-tl-br enter ${isToday ? "tracing-border--active" : ""}`}
                    style={{ animationDelay: `${0.3 + idx * 0.08}s` }}
                    data-testid={`plan-day-${day.day_index}`}
                  >
                    <div className="flex items-center justify-between mb-2 gap-2">
                      <div className="text-[10px] text-white/40 uppercase tracking-[0.3em] font-chakra">TAG {day.day_index}</div>
                      {day.focus && (
                        <span className="text-[9px] text-[#00E5FF] border border-[#00E5FF]/40 px-1.5 py-0.5 font-chakra uppercase tracking-widest rounded" style={{ textShadow: "0 0 8px rgba(0,229,255,0.4)" }}>
                          {day.focus}
                        </span>
                      )}
                    </div>
                    <div className="font-teko text-xl sm:text-2xl tracking-wide chrome-text leading-tight mb-2 break-words">{day.name}</div>
                    <div className="text-[11px] text-white/50 font-chakra mb-3 flex items-center gap-1">
                      <Zap size={11} className="text-[#00E5FF]" /> {day.exercises?.length || 0} Übungen
                    </div>
                    <button
                      onClick={() => startDay(day.day_index)}
                      className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
                      data-testid={`start-day-${day.day_index}`}
                    >
                      <Play size={14} /> STARTEN
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex gap-2 flex-wrap">
              <button
                onClick={adjustPlan}
                disabled={regenerating}
                className="btn-outline text-xs flex items-center gap-1.5"
                data-testid="adjust-plan-btn"
              >
                {regenerating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                KI ANPASSEN
              </button>
              <button
                onClick={() => navigate("/plan-history")}
                className="btn-outline text-xs"
                data-testid="plan-history-btn"
              >
                HISTORIE
              </button>
            </div>
          </>
        )}
        {!plan && (
          <div className="af-card p-8 text-center">
            <Brain size={32} className="mx-auto text-[#00E5FF] mb-2" />
            <div className="text-white/50 font-chakra">Plan wird generiert...</div>
          </div>
        )}
      </section>

      {/* ═══════════ QUICK ACTIONS ═══════════ */}
      <section className="grid grid-cols-2 gap-3 mb-6 enter enter-d4" data-testid="quick-actions">
        <QuickAction
          icon={Scan}
          title="BODY SCAN"
          subtitle="KI-Analyse"
          onClick={() => navigate("/bodyscan")}
          testid="dashboard-bodyscan-cta"
        />
        <QuickAction
          icon={BookOpen}
          title="BIBLIOTHEK"
          subtitle="54 Übungen"
          onClick={() => navigate("/library")}
          testid="dashboard-library-cta"
        />
        <QuickAction
          icon={TrendingUp}
          title="FORTSCHRITT"
          subtitle="Statistiken"
          onClick={() => navigate("/progress")}
          testid="dashboard-progress-cta"
        />
        <QuickAction
          icon={Target}
          title="ERNÄHRUNG"
          subtitle="Tracking"
          onClick={() => navigate("/nutrition")}
          testid="dashboard-nutrition-cta"
        />
      </section>

      {/* ═══════════ COLLAPSIBLE — Alpha Coach ═══════════ */}
      <div className="enter enter-d5">
        <CollapsibleSection
          title="Alpha Coach"
          icon={Brain}
          hint="Deine Wochen-Analyse"
          defaultOpen={false}
          storageKey="coach"
          testid="section-coach"
        >
          <CoachInsights compact />
        </CollapsibleSection>
      </div>

      {/* ═══════════ COLLAPSIBLE — Detail-Stats ═══════════ */}
      <div className="enter enter-d6">
        <CollapsibleSection
          title="Statistik"
          icon={TrendingUp}
          hint={`Streak ${stats.current_streak} · ${stats.total_completed} Workouts`}
          defaultOpen={false}
          storageKey="stats"
          testid="section-stats"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={Flame} label="Workouts" value={stats.total_completed} testid="stat-workouts-detail" />
            <StatCard icon={Calendar} label="Streak (Tage)" value={stats.current_streak} highlight={stats.current_streak >= 3} testid="stat-streak-detail" />
            <StatCard icon={Weight} label="Volumen (kg)" value={formatVolume(stats.total_volume_kg)} testid="stat-volume-detail" />
            <StatCard icon={Crown} label="Status" value={user?.is_premium ? "PREMIUM" : "FREE"} highlight={user?.is_premium} gold={user?.is_premium} testid="stat-status-detail" />
          </div>
        </CollapsibleSection>
      </div>
    </Layout>
  );
}

function StatTile({ icon: Icon, label, value, highlight, testid }) {
  return (
    <div className="stat-tile--mega" data-testid={testid}>
      <div className="relative z-10">
        <Icon size={15} className={highlight ? "text-[#E0B968]" : "text-[#00E5FF]"} style={{ filter: highlight ? "drop-shadow(0 0 6px rgba(224,185,104,0.7))" : "drop-shadow(0 0 6px rgba(0,229,255,0.7))" }} />
        <div className={`stat-tile__value mt-1 ${highlight ? "gold-chrome" : "chrome-text"}`}>{value}</div>
        <div className="stat-tile__label">{label}</div>
      </div>
    </div>
  );
}

function QuickAction({ icon: Icon, title, subtitle, onClick, testid }) {
  return (
    <button
      onClick={onClick}
      className="glass-tile p-4 text-left flex items-center gap-3 w-full"
      data-testid={testid}
    >
      <div className="glow-icon-box">
        <Icon size={19} className="text-[#00E5FF]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-teko text-lg sm:text-xl chrome-text tracking-wide leading-tight">{title}</div>
        <div className="text-[10px] text-white/45 font-chakra uppercase tracking-widest mt-0.5">{subtitle}</div>
      </div>
      <ChevronRight size={14} className="text-white/25" />
    </button>
  );
}

function StatCard({ icon: Icon, label, value, highlight, gold, testid }) {
  const iconColor = gold ? "text-[#E0B968]" : "text-[#00E5FF]";
  const boxClass = gold
    ? "gold-glow-box gold-border"
    : highlight ? "glow-box border-[#00E5FF]" : "";
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
