import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import api from "../lib/api";
import BadgeGlow from "../components/BadgeGlow";
import { useAuth } from "../lib/auth";
import { TrendingUp, Calendar, Dumbbell, Flame, Award, Weight, Lock } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { BADGE_WORKOUTS, BADGE_STREAKS, BADGE_VOLUMES, nextBadge } from "../lib/badges";

export default function Progress() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    api.get("/sessions/history").then(({ data }) => setSessions(data.sessions || []));
  }, []);

  const completed = sessions.filter((s) => s.status === "completed");

  // Volume per day
  const volByDate = {};
  completed.forEach((s) => {
    const date = (s.completed_at || s.started_at || "").slice(0, 10);
    const vol = (s.logged_sets || []).reduce((sum, l) => sum + (l.reps || 0) * (l.weight_kg || 0), 0);
    volByDate[date] = (volByDate[date] || 0) + vol;
  });
  const chartData = Object.entries(volByDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([date, vol]) => ({ date: date.slice(5), volume: Math.round(vol) }));

  const totalVolume = Object.values(volByDate).reduce((a, b) => a + b, 0);
  const totalSets = completed.reduce((s, x) => s + (x.logged_sets?.length || 0), 0);

  // Compute current streak (consecutive days with completed workouts up to today)
  const completedDays = new Set(
    completed.map((s) => (s.completed_at || s.started_at || "").slice(0, 10)).filter(Boolean)
  );
  let currentStreak = 0;
  const today = new Date();
  for (let i = 0; i < 400; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (completedDays.has(key)) currentStreak += 1;
    else if (i === 0) continue; // allow today to be missing (streak based on yesterday)
    else break;
  }

  return (
    <Layout>
      <h1 className="font-teko text-3xl sm:text-5xl chrome-text mb-6">PROGRESS</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <Stat icon={Calendar} label="Workouts" value={completed.length} testid="prog-workouts" />
        <Stat icon={Dumbbell} label="Sätze gesamt" value={totalSets} testid="prog-sets" />
        <Stat icon={TrendingUp} label="Volumen (kg)" value={Math.round(totalVolume).toLocaleString()} testid="prog-volume" />
        <Stat icon={Dumbbell} label="Badges" value={user?.badges?.length || 0} testid="prog-badges" />
      </div>

      {/* Chart */}
      <div className="af-card p-6 mb-8 clip-corner-tl-br" data-testid="progress-chart-card">
        <div className="font-teko text-2xl chrome-text mb-4">VOLUMEN (letzte 14 Tage)</div>
        {chartData.length === 0 ? (
          <div className="text-gray-500 font-chakra text-sm py-8 text-center">Noch keine Daten. Trainiere los!</div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData}>
              <CartesianGrid stroke="#1A1A24" strokeDasharray="3 3" />
              <XAxis dataKey="date" stroke="#606070" style={{ fontFamily: "Chakra Petch", fontSize: 12 }} />
              <YAxis stroke="#606070" style={{ fontFamily: "Chakra Petch", fontSize: 12 }} />
              <Tooltip contentStyle={{ background: "#000", border: "1px solid #00BFFF", color: "#fff" }} />
              <Line type="monotone" dataKey="volume" stroke="#00BFFF" strokeWidth={2.5} dot={{ fill: "#00E5FF", r: 4 }} activeDot={{ r: 6, fill: "#00E5FF" }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Badges */}
      <BadgeCollection
        user={user}
        completedCount={completed.length}
        totalVolume={totalVolume}
        currentStreak={currentStreak}
      />

      {/* History */}
      <div className="af-card p-6 mt-8 clip-corner-tl-br">
        <div className="font-teko text-2xl chrome-text mb-4">HISTORIE</div>
        <div className="space-y-2">
          {completed.slice(0, 10).map((s) => (
            <div key={s.id} className="flex items-center justify-between p-3 bg-[#0A0A10] border border-[#1A1A24]" data-testid={`history-${s.id}`}>
              <div>
                <div className="font-teko text-lg chrome-text">TAG {s.day_index}</div>
                <div className="text-xs text-gray-500 font-chakra">{(s.completed_at || "").slice(0, 16).replace("T", " ")}</div>
              </div>
              <div className="text-right">
                <div className="electric-text font-teko text-xl">{s.logged_sets?.length || 0} Sätze</div>
              </div>
            </div>
          ))}
          {completed.length === 0 && <div className="text-gray-500 font-chakra">Noch keine abgeschlossenen Trainings.</div>}
        </div>
      </div>
    </Layout>
  );
}

function Stat({ icon: Icon, label, value, testid }) {
  return (
    <div className="af-card p-4 clip-corner-tl-br" data-testid={testid}>
      <Icon size={18} className="text-[#00BFFF]" />
      <div className="font-teko text-3xl chrome-text mt-2">{value}</div>
      <div className="text-[10px] text-gray-500 uppercase tracking-[0.25em] font-chakra mt-1">{label}</div>
    </div>
  );
}

function BadgeCollection({ user, completedCount, totalVolume, currentStreak }) {
  const earned = user?.badges || [];
  const earnedIds = earned.map((b) => b.id);
  const earnedById = Object.fromEntries(earned.map((b) => [b.id, b]));
  const totalBadgeCount = BADGE_WORKOUTS.length + BADGE_STREAKS.length + BADGE_VOLUMES.length;
  const earnedCount = earnedIds.length;
  const pct = Math.round((earnedCount / totalBadgeCount) * 100);

  const sections = [
    { id: "workouts", title: "TRAININGS-MEILENSTEINE", icon: Award, color: "#FFD700", list: BADGE_WORKOUTS, currentValue: completedCount, unit: "Trainings" },
    { id: "streaks",  title: "STREAK-SERIEN",          icon: Flame, color: "#FF5722", list: BADGE_STREAKS,  currentValue: currentStreak,  unit: "Tage Streak" },
    { id: "volumes",  title: "VOLUMEN-LEGENDEN",       icon: Weight, color: "#00E5FF", list: BADGE_VOLUMES, currentValue: totalVolume,   unit: "kg" },
  ];

  return (
    <div className="af-card p-4 sm:p-6 clip-corner-tl-br mb-8" data-testid="badge-collection">
      {/* Header with overall progress */}
      <div className="flex items-end justify-between flex-wrap gap-2 mb-4">
        <div>
          <div className="font-teko text-xl sm:text-2xl chrome-text">DEINE BADGES</div>
          <div className="text-[11px] text-gray-500 font-chakra uppercase tracking-widest">Sammle alle. Werde unsterblich.</div>
        </div>
        <div className="text-right">
          <div className="font-teko text-3xl electric-text leading-none">{earnedCount}<span className="text-gray-500 text-xl">/{totalBadgeCount}</span></div>
          <div className="text-[10px] text-gray-500 uppercase tracking-widest">{pct}% komplett</div>
        </div>
      </div>
      <div className="h-1.5 bg-[#0A0A10] rounded-full overflow-hidden mb-6">
        <div
          className="h-full bg-gradient-to-r from-[#00BFFF] via-[#00E5FF] to-[#FFD700] transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      {sections.map((sec) => {
        const next = nextBadge(sec.id, sec.currentValue, earnedIds);
        const SecIcon = sec.icon;
        return (
          <div key={sec.id} className="mb-7 last:mb-0" data-testid={`badge-section-${sec.id}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <SecIcon size={16} style={{ color: sec.color, filter: `drop-shadow(0 0 6px ${sec.color}aa)` }} />
                <div className="font-teko text-base sm:text-lg tracking-widest text-gray-300">{sec.title}</div>
              </div>
              <div className="text-[11px] text-gray-500 font-chakra">
                {sec.list.filter((b) => earnedIds.includes(b.id)).length}/{sec.list.length}
              </div>
            </div>

            {/* Next milestone hint */}
            {next && (
              <div className="text-[11px] text-gray-400 font-chakra mb-3 flex items-center gap-1.5">
                <Lock size={11} />
                Nächste: <span className="text-white">{next.title}</span> bei{" "}
                <span className="electric-text font-teko text-sm">{next.threshold.toLocaleString("de-DE")}</span> {sec.unit}
                <span className="text-gray-500">— noch {Math.max(0, next.threshold - sec.currentValue).toLocaleString("de-DE")}</span>
              </div>
            )}

            {/* Badge grid */}
            <div className="flex flex-wrap gap-3 sm:gap-5 justify-start">
              {sec.list.map((def) => {
                const earnedBadge = earnedById[def.id];
                const badge = earnedBadge || { id: def.id, title: def.title, description: def.description };
                return <BadgeGlow key={def.id} badge={badge} locked={!earnedBadge} />;
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

