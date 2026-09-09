import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import TodayTrainingCard from "../components/TodayTrainingCard";
import ProgressPanel from "../components/ProgressPanel";
import WeekStrip from "../components/WeekStrip";
import api from "../lib/api";
import { useAuth } from "../lib/auth";
import { toast } from "sonner";
import { Crown, Zap, Calendar } from "lucide-react";
import { getDailyQuote } from "../lib/quotes";

// Weekday helpers: JS getDay() → 0=Sun..6=Sat  ; we want 0=Mon..6=Sun
const jsDayToMondayZero = (js) => (js + 6) % 7;

function timeGreeting(h) {
  if (h < 5) return "GUTE NACHT";
  if (h < 11) return "GUTEN MORGEN";
  if (h < 17) return "GUTEN TAG";
  if (h < 22) return "GUTEN ABEND";
  return "GUTE NACHT";
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [plan, setPlan] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState({ total_completed: 0, current_streak: 0 });
  const [weekdays, setWeekdays] = useState([]);
  const [nutritionToday, setNutritionToday] = useState(null);

  const load = async () => {
    try {
      const [
        { data: planData },
        { data: sessData },
        { data: hist },
        { data: st },
        weekdaysRes,
        nutritionRes,
      ] = await Promise.all([
        api.get("/plans/current"),
        api.get("/sessions/active"),
        api.get("/sessions/history"),
        api.get("/sessions/stats"),
        api.get("/profile/training-days").catch(() => ({ data: { weekdays: [0, 1, 3, 4] } })),
        api.get("/nutrition/today").catch(() => ({ data: null })),
      ]);
      setPlan(planData.plan);
      setActiveSession(sessData.session);
      setSessions(hist.sessions || []);
      setStats(st);
      setWeekdays(weekdaysRes.data?.weekdays || []);
      setNutritionToday(nutritionRes.data);
    } catch (e) {
      // silent — dashboard still renders defaults
    }
  };

  useEffect(() => { load(); }, []);

  // ---- Today's training resolution ----
  const todayMon = jsDayToMondayZero(new Date().getDay());
  const isTrainingDayToday = weekdays.includes(todayMon);

  // Pick today's plan day: active session > weekday assignment > first plan day fallback
  let todaysDay = null;
  if (activeSession && plan?.days) {
    todaysDay = plan.days.find((d) => d.day_index === activeSession.day_index) || null;
  }
  if (!todaysDay && isTrainingDayToday && plan?.days?.length) {
    // pick day where day_index === (position among training weekdays)
    const sortedTraining = [...weekdays].sort((a, b) => a - b);
    const idxWithinTraining = sortedTraining.indexOf(todayMon); // 0-based
    todaysDay = plan.days[idxWithinTraining] || plan.days[0];
  }
  if (!todaysDay && plan?.days?.length) {
    // rest day OR active-session day_index doesn't match plan → show first planned day
    todaysDay = plan.days[0];
  }

  const activeSetCount = (activeSession?.logged_sets || []).length;
  const activeExercisesTouched = new Set((activeSession?.logged_sets || []).map((s) => s.exercise_index)).size;
  const exercisesCount = todaysDay?.exercises?.length || 0;
  const completedExercises = activeSession ? Math.min(activeExercisesTouched, exercisesCount) : 0;
  const durationEstimate = Math.max(20, exercisesCount * 8); // 8min/exercise, floor 20

  const startToday = async () => {
    if (activeSession) {
      navigate(`/workout/${activeSession.id}`);
      return;
    }
    if (!todaysDay) {
      toast.error("Kein Trainingstag geplant");
      return;
    }
    try {
      const { data } = await api.post("/sessions/start", { day_index: todaysDay.day_index });
      navigate(`/workout/${data.session.id}`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Fehler beim Starten");
    }
  };

  // ---- 4 sub-progress metrics ----
  // Training: completed sessions this ISO week vs. planned weekdays.length
  const startOfWeek = (() => {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - jsDayToMondayZero(d.getDay()));
    return d;
  })();
  const completedThisWeek = sessions.filter((s) => {
    if (s.status !== "completed" || !s.completed_at) return false;
    const d = new Date(s.completed_at);
    return !isNaN(d.getTime()) && d >= startOfWeek;
  });
  const trainingTarget = weekdays.length || 3;
  const trainingPct = Math.min(100, Math.round((completedThisWeek.length / trainingTarget) * 100));

  // Nutrition: today's calories / goal
  const kcalConsumed = nutritionToday?.totals?.calories || 0;
  const kcalGoal = nutritionToday?.goals?.calories || 0;
  const nutritionPct = kcalGoal > 0
    ? Math.min(100, Math.round((kcalConsumed / kcalGoal) * 100))
    : 0;

  // Motivation: streak, cap at 14-day streak = 100%
  const motivationPct = Math.min(100, Math.round(((stats.current_streak || 0) / 14) * 100));

  // Schlaf: feature later — mocked 0%
  const sleepPct = 0;

  // Which weekdays this week got a completed session (for week strip)
  const completedWeekdays = new Set(
    completedThisWeek.map((s) => jsDayToMondayZero(new Date(s.completed_at).getDay()))
  );

  const hour = new Date().getHours();
  const greetingStr = timeGreeting(hour);
  const nameFirst = (user?.name || "Alpha").split(" ")[0];
  const quote = getDailyQuote(new Date());

  return (
    <Layout>
      <div className="blue-page-bg">
        {/* Greeting */}
        <div className="mb-4 enter" data-testid="dashboard-greeting">
          <div className="big-greeting" data-testid="hero-greeting">
            {greetingStr === "GUTEN MORGEN" ? "Guten Morgen," :
             greetingStr === "GUTEN TAG" ? "Guten Tag," :
             greetingStr === "GUTEN ABEND" ? "Guten Abend," : "Gute Nacht,"}
          </div>
          <div className="big-name" data-testid="hero-name">
            {nameFirst}
            {user?.is_premium && <Crown size={22} className="crown" style={{ color: "#FFD24B" }} />}
          </div>
        </div>

        {/* Today's Training Card */}
        <TodayTrainingCard
          title={todaysDay?.name || (isTrainingDayToday ? "Training bereit" : "Ruhetag")}
          focus={todaysDay?.focus}
          durationMin={durationEstimate}
          exercisesCount={exercisesCount}
          completed={completedExercises}
          onStart={todaysDay ? startToday : null}
          ctaLabel={activeSession ? "Fortsetzen" : "Starten"}
        />

        {/* Progress Panel */}
        <div className="section-title-blue mt-6" data-testid="section-progress-title">
          <Zap size={14} className="icon" /> Deine Fortschritte
        </div>
        <ProgressPanel
          training={trainingPct}
          nutrition={nutritionPct}
          motivation={motivationPct}
          sleep={sleepPct}
        />

        {/* Current Week */}
        <div className="section-title-blue" data-testid="section-week-title">
          <Calendar size={14} className="icon" /> Aktuelle Woche
        </div>
        <div className="enter enter-d3" data-testid="week-section">
          <WeekStrip weekdays={weekdays} completedWeekdays={completedWeekdays} />
        </div>

        {/* Daily Quote — kept as emotional anchor */}
        <div className="dash-quote--mega enter enter-d4 mt-5" data-testid="daily-quote">
          <div style={{ width: 3, background: "#00BFFF", borderRadius: 2, alignSelf: "stretch" }} />
          <div className="min-w-0 flex-1">
            <p className="font-teko text-lg leading-snug text-white tracking-wide">
              „{quote.text}"
            </p>
            <div className="text-[10px] text-white/45 mt-1.5 font-chakra tracking-[0.3em] uppercase">
              — {quote.author}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
