import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import CoachInsights from "../components/CoachInsights";
import DailySummary from "../components/DailySummary";
import WeekSchedule from "../components/WeekSchedule";
import CollapsibleSection from "../components/CollapsibleSection";
import api from "../lib/api";
import { useAuth } from "../lib/auth";
import { Brain, Crown, Play, Calendar, Flame, RefreshCw, Loader2, Weight, Scan, BookOpen, Sparkles, TrendingUp, Activity } from "lucide-react";
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
      {/* Hero greeting - High Impact, Oversized Typography */}
      <div className="mb-8 sm:mb-12 mt-4" data-testid="dashboard-hero">
        <div className="text-xs text-muted-foreground font-chakra uppercase tracking-[0.3em] mb-2 flex items-center gap-2">
          <Activity size={14} className="text-primary animate-pulse" /> SYSTEM ONLINE
        </div>
        <h1 className="font-teko text-5xl sm:text-7xl md:text-8xl tracking-tight text-foreground leading-none break-words uppercase">
          ALPHA <span className="electric-text block sm:inline">{user?.name}</span>
        </h1>
      </div>

      {/* Grid Layout Strategy: Bento Grid Mode B (High Density) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6 mb-8">
        
        {/* Active Session - Hero Span */}
        {activeSession && (
          <div className="md:col-span-12 lg:col-span-8 af-card p-6 sm:p-8 tracing-border relative overflow-hidden group" data-testid="resume-banner">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none transition-transform group-hover:scale-110"></div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
              <div>
                <div className="text-[11px] sm:text-xs text-primary uppercase tracking-[0.2em] font-chakra mb-2 font-semibold">Training Läuft</div>
                <div className="font-teko text-3xl sm:text-4xl chrome-text uppercase mb-1">Setze dein Training fort</div>
                <div className="text-muted-foreground text-sm font-chakra flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse"></span>
                  Tag {activeSession.day_index} <span className="text-border">/</span> {activeSession.logged_sets?.length || 0} Sätze geloggt
                </div>
              </div>
              <button onClick={() => navigate(`/workout/${activeSession.id}`)} className="btn-primary flex-shrink-0" data-testid="resume-workout-btn">
                <Play size={20} className="mr-2" fill="currentColor" /> FORTSETZEN
              </button>
            </div>
          </div>
        )}

        {/* Streak Banner - Secondary Span */}
        {stats.current_streak >= 3 && !activeSession && (
          <div className="md:col-span-12 lg:col-span-8 af-card p-6 sm:p-8 relative overflow-hidden group" data-testid="streak-banner" style={{ borderColor: 'var(--af-primary)' }}>
            <div className="absolute inset-0 bg-primary/5 group-hover:bg-primary/10 transition-colors"></div>
            <div className="relative flex items-center gap-5 z-10">
              <div className="bg-primary/20 p-4 rounded-full">
                <Flame size={40} className="text-primary" />
              </div>
              <div className="min-w-0">
                <div className="font-teko text-3xl sm:text-4xl electric-text tracking-tight uppercase leading-none">{stats.current_streak}-TAGE STREAK</div>
                <div className="text-sm text-muted-foreground font-chakra mt-1">Verliere deinen Fokus nicht.</div>
              </div>
            </div>
          </div>
        )}

        {/* Quick Stats - Sidebar Spans */}
        <div className="md:col-span-12 lg:col-span-4 grid grid-cols-2 gap-4">
          <StatCard icon={Flame} label="Workouts" value={stats.total_completed} testid="stat-workouts" />
          <StatCard icon={Calendar} label="Streak" value={stats.current_streak} highlight={stats.current_streak >= 3} testid="stat-streak" />
          <StatCard icon={Weight} label="Volumen (kg)" value={formatVolume(stats.total_volume_kg)} testid="stat-volume" />
          <StatCard icon={Crown} label="Status" value={user?.is_premium ? "PRO" : "FREE"} gold={user?.is_premium} testid="stat-status" />
        </div>
      </div>

      {/* Week Schedule (Full Width Row) */}
      <div className="mb-8">
        <WeekSchedule plan={plan} sessions={sessions} onStartDay={startDay} />
      </div>

      {/* Two Column Layout for Insights & Plan */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 sm:gap-8 mb-8">
        
        {/* Left Column: Plan View */}
        <section className="xl:col-span-8">
          <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-4">
            <h2 className="font-teko text-3xl tracking-wide chrome-text m-0">DEIN PLAN</h2>
            <div className="flex gap-2">
              <button onClick={adjustPlan} disabled={regenerating} className="btn-outline px-3 py-1.5 min-h-[36px] text-xs flex items-center gap-1.5" data-testid="adjust-plan-btn">
                {regenerating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                <span className="hidden sm:inline">KI ANPASSEN</span>
              </button>
              <button onClick={() => navigate("/plan")} className="btn-outline px-3 py-1.5 min-h-[36px] text-xs" data-testid="view-plan-btn">DETAILS</button>
            </div>
          </div>
          
          {adjustStatus && adjustStatus.status !== "no_plan" && (
            <div className="mb-4 bg-secondary/50 border border-white/5 rounded p-3 flex items-center gap-3 text-xs font-chakra" data-testid="adjust-status-badge">
              <div className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${adjustStatus.status === 'ready' ? 'bg-[#39FF14]' : 'bg-primary'}`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${adjustStatus.status === 'ready' ? 'bg-[#39FF14]' : 'bg-primary'}`}></span>
              </div>
              <span className="text-muted-foreground uppercase tracking-wider">SYSTEM STATUS:</span>
              <span className="text-white font-medium">{adjustStatus.message}</span>
            </div>
          )}

          {plan ? (
            <div>
              <div className="flex flex-col sm:flex-row sm:items-baseline gap-3 mb-6">
                <h3 className="text-primary font-teko text-2xl m-0 leading-none">{plan.name}</h3>
                <p className="text-muted-foreground text-sm font-chakra flex-1 sm:border-l sm:border-white/10 sm:pl-3">{plan.progression_notes}</p>
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                {plan.days?.map((day) => (
                  <div key={day.day_index} className="af-card p-5 group flex flex-col h-full" data-testid={`plan-day-${day.day_index}`}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-xs text-muted-foreground font-chakra uppercase tracking-[0.2em]">TAG {day.day_index}</div>
                      {day.focus && <span className="text-[10px] text-primary border border-primary/30 bg-primary/5 px-2 py-0.5 rounded-sm font-chakra uppercase tracking-widest">{day.focus}</span>}
                    </div>
                    <div className="font-teko text-2xl tracking-wide mb-2 text-white group-hover:electric-text transition-colors leading-none uppercase">{day.name}</div>
                    <div className="text-sm text-muted-foreground font-chakra mb-6 flex-1 flex items-center gap-2">
                      <Activity size={14} /> {day.exercises?.length || 0} Übungen
                    </div>
                    <button onClick={() => startDay(day.day_index)} className="btn-outline w-full hover:bg-primary hover:text-black hover:border-primary group-hover:border-primary/50" data-testid={`start-day-${day.day_index}`}>
                      STARTEN
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="af-card p-12 text-center border-dashed border-white/20">
              <Brain size={48} className="mx-auto text-muted-foreground mb-4 opacity-50" />
              <div className="text-muted-foreground font-chakra uppercase tracking-widest">Plan wird generiert...</div>
            </div>
          )}
        </section>

        {/* Right Column: Insights & Quick Actions */}
        <section className="xl:col-span-4 flex flex-col gap-4">
          <div className="flex flex-col gap-4">
            <h2 className="font-teko text-2xl tracking-wide text-white m-0 border-b border-white/5 pb-2">COMMAND CENTER</h2>
            <button onClick={() => navigate("/bodyscan")} className="af-card p-4 hover:border-primary group text-left flex items-center gap-4 transition-all" data-testid="dashboard-bodyscan-cta">
              <div className="bg-white/5 p-3 rounded group-hover:bg-primary/10 group-hover:text-primary transition-colors text-white">
                <Scan size={24} />
              </div>
              <div>
                <div className="font-teko text-xl text-white uppercase tracking-wide leading-none mb-1">Body Scan</div>
                <div className="text-xs text-muted-foreground font-chakra uppercase tracking-wider">KI-Analyse Starten</div>
              </div>
            </button>
            
            <button onClick={() => navigate("/library")} className="af-card p-4 hover:border-primary group text-left flex items-center gap-4 transition-all" data-testid="dashboard-library-cta">
              <div className="bg-white/5 p-3 rounded group-hover:bg-primary/10 group-hover:text-primary transition-colors text-white">
                <BookOpen size={24} />
              </div>
              <div>
                <div className="font-teko text-xl text-white uppercase tracking-wide leading-none mb-1">Bibliothek</div>
                <div className="text-xs text-muted-foreground font-chakra uppercase tracking-wider">Datenbank Öffnen</div>
              </div>
            </button>
          </div>

          <div className="mt-4">
            <CollapsibleSection title="Alpha Coach" icon={Brain} hint="Wochen-Analyse" defaultOpen={true} storageKey="coach" testid="section-coach">
              <CoachInsights compact />
            </CollapsibleSection>
          </div>
          
          <div className="mt-2">
            <CollapsibleSection title="Heute" icon={Sparkles} hint="Kalorien · Gewicht" defaultOpen={false} storageKey="daily" testid="section-daily">
              <DailySummary plan={plan} sessions={sessions} />
            </CollapsibleSection>
          </div>
        </section>

      </div>
    </Layout>
  );
}

function StatCard({ icon: Icon, label, value, highlight, gold, testid }) {
  const isGold = gold;
  const isHighlight = highlight;
  
  let borderClass = "border-white/10";
  let textClass = "text-white";
  let iconClass = "text-muted-foreground";
  
  if (isGold) {
    borderClass = "border-[#D4AF37]/50 shadow-[0_0_15px_rgba(212,175,55,0.1)]";
    textClass = "text-[#FFDF00]";
    iconClass = "text-[#D4AF37]";
  } else if (isHighlight) {
    borderClass = "border-primary/50 shadow-[0_0_15px_rgba(255,69,0,0.1)]";
    textClass = "text-primary";
    iconClass = "text-primary";
  }

  return (
    <div className={`af-card p-4 sm:p-5 flex flex-col justify-between ${borderClass} h-full`} data-testid={testid}>
      <Icon size={20} className={`${iconClass} mb-3`} />
      <div>
        <div className={`font-teko text-3xl sm:text-4xl leading-none tracking-tight mb-1 ${textClass}`}>{value}</div>
        <div className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-chakra">{label}</div>
      </div>
    </div>
  );
}

function formatVolume(kg) {
  if (!kg) return "0";
  if (kg >= 1000000) return `${(kg / 1000000).toFixed(1)}M`;
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}t`;
  return Math.round(kg).toLocaleString();
}
