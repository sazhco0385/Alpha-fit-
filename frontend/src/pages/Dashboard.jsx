import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import BadgeGlow from "../components/BadgeGlow";
import api from "../lib/api";
import { useAuth } from "../lib/auth";
import { Dumbbell, Brain, TrendingUp, Crown, Play, Calendar, Flame, Award, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Dashboard() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const [plan, setPlan] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [regenerating, setRegenerating] = useState(false);

  const load = async () => {
    const [{ data: planData }, { data: sessData }, { data: hist }] = await Promise.all([
      api.get("/plans/current"),
      api.get("/sessions/active"),
      api.get("/sessions/history"),
    ]);
    setPlan(planData.plan);
    setActiveSession(sessData.session);
    setSessions(hist.sessions || []);
  };

  useEffect(() => { load(); }, []);

  const completedCount = sessions.filter((s) => s.status === "completed").length;

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
      const { data } = await api.post("/coach/adjust-plan");
      setPlan(data.plan);
      toast.success("Plan wurde von KI angepasst!");
      await refresh();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Fehler");
    } finally {
      setRegenerating(false);
    }
  };

  const nextBadges = [
    { id: "first_workout", title: "Erstes Blut", description: "1 Training", threshold: 1 },
    { id: "warm_up", title: "Aufgewärmt", description: "3 Trainings", threshold: 3 },
    { id: "five_workouts", title: "5er Streak", description: "5 Trainings", threshold: 5 },
    { id: "ten_workouts", title: "Eisenwille", description: "10 Trainings", threshold: 10 },
    { id: "fifteen", title: "Stahlhart", description: "15 Trainings", threshold: 15 },
    { id: "warrior", title: "Krieger", description: "25 Trainings", threshold: 25 },
    { id: "granite", title: "Granit", description: "40 Trainings", threshold: 40 },
    { id: "alpha", title: "Alpha", description: "50 Trainings", threshold: 50 },
    { id: "titan", title: "Titan", description: "75 Trainings", threshold: 75 },
    { id: "centurion", title: "Zenturio", description: "100 Trainings", threshold: 100 },
    { id: "spartan", title: "Spartaner", description: "150 Trainings", threshold: 150 },
    { id: "olympian", title: "Olympier", description: "200 Trainings", threshold: 200 },
    { id: "demigod", title: "Halbgott", description: "300 Trainings", threshold: 300 },
    { id: "year_warrior", title: "Jahres-Krieger", description: "365 Trainings", threshold: 365 },
    { id: "immortal", title: "Unsterblich", description: "500 Trainings", threshold: 500 },
    { id: "myth", title: "Mythos", description: "750 Trainings", threshold: 750 },
    { id: "legend", title: "Legende", description: "1000 Trainings", threshold: 1000 },
  ];

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

      {/* Stats Bento */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <StatCard icon={Flame} label="Workouts" value={completedCount} testid="stat-workouts" />
        <StatCard icon={Award} label="Badges" value={user?.badges?.length || 0} testid="stat-badges" />
        <StatCard icon={Calendar} label="Plan Version" value={plan?.version || 0} testid="stat-version" />
        <StatCard icon={Crown} label="Status" value={user?.is_premium ? "PREMIUM" : "FREE"} highlight={user?.is_premium} testid="stat-status" />
      </div>

      {/* Training Plan */}
      <section className="mb-6 sm:mb-8">
        <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
          <h2 className="font-teko text-2xl sm:text-3xl tracking-wide chrome-text whitespace-nowrap">DEIN PLAN</h2>
          <div className="flex gap-2 flex-wrap">
            <button onClick={adjustPlan} disabled={regenerating} className="btn-outline text-xs flex items-center gap-1.5 whitespace-nowrap" data-testid="adjust-plan-btn">
              {regenerating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              KI&nbsp;ANPASSEN
            </button>
            <button onClick={() => navigate("/plan")} className="btn-outline text-xs whitespace-nowrap" data-testid="view-plan-btn">DETAILS</button>
          </div>
        </div>

        {plan ? (
          <div>
            <div className="text-[#00BFFF] font-teko text-xl mb-1 glow-text-soft">{plan.name}</div>
            <div className="text-gray-500 text-xs font-chakra mb-4">{plan.progression_notes}</div>
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

      {/* Badges */}
      <section>
        <h2 className="font-teko text-2xl sm:text-3xl tracking-wide chrome-text mb-4">BADGES</h2>
        <div className="flex flex-wrap gap-4 sm:gap-6 af-card p-4 sm:p-6 justify-center sm:justify-start">
          {nextBadges.map((b) => {
            const earned = user?.badges?.find((ub) => ub.id === b.id);
            return <BadgeGlow key={b.id} badge={earned || b} locked={!earned} />;
          })}
        </div>
      </section>
    </Layout>
  );
}

function StatCard({ icon: Icon, label, value, highlight, testid }) {
  return (
    <div className={`af-card p-4 clip-corner-tl-br ${highlight ? "glow-box border-[#00BFFF]" : ""}`} data-testid={testid}>
      <Icon size={18} className="text-[#00BFFF]" />
      <div className="font-teko text-3xl mt-2 tracking-wide chrome-text">{value}</div>
      <div className="text-[10px] text-gray-500 uppercase tracking-[0.25em] font-chakra mt-1">{label}</div>
    </div>
  );
}
