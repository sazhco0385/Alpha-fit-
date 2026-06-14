import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import api from "../lib/api";
import BadgeGlow from "../components/BadgeGlow";
import { useAuth } from "../lib/auth";
import { TrendingUp, Calendar, Dumbbell } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";

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
      <div className="af-card p-4 sm:p-6 clip-corner-tl-br">
        <div className="font-teko text-xl sm:text-2xl chrome-text mb-4">DEINE BADGES</div>
        {user?.badges?.length === 0 || !user?.badges ? (
          <div className="text-gray-500 font-chakra text-sm">Noch keine Badges. Absolviere dein erstes Training!</div>
        ) : (
          <div className="flex flex-wrap gap-4 sm:gap-6 justify-center sm:justify-start" data-testid="badges-earned">
            {user.badges.map((b) => <BadgeGlow key={b.id} badge={b} />)}
          </div>
        )}
      </div>

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
