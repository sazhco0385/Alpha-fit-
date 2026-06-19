import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import api from "../lib/api";
import {
  Trophy, Flame, Dumbbell, Users, Globe, Loader2,
  Crown, ChevronUp, Medal, Award
} from "lucide-react";
import { toast } from "sonner";

const METRICS = [
  { value: "workouts", label: "Workouts", icon: Dumbbell, unit: "" },
  { value: "volume", label: "Volumen", icon: Flame, unit: "kg" },
  { value: "streak", label: "Streak", icon: Trophy, unit: "Tage" },
];
const PERIODS = [
  { value: "7d", label: "7T" },
  { value: "30d", label: "30T" },
  { value: "all", label: "All" },
];

const formatValue = (v, metric) => {
  const n = Math.round(Number(v) || 0);
  if (metric === "volume") return `${n.toLocaleString("de-DE")} kg`;
  if (metric === "streak") return `${n} ${n === 1 ? "Tag" : "Tage"}`;
  return `${n}`;
};

const medalFor = (rank) => {
  if (rank === 1) return { Icon: Trophy, cls: "text-yellow-400", bg: "bg-yellow-400/15" };
  if (rank === 2) return { Icon: Medal, cls: "text-gray-300", bg: "bg-gray-400/15" };
  if (rank === 3) return { Icon: Award, cls: "text-orange-300", bg: "bg-orange-400/15" };
  return null;
};

export default function Leaderboard() {
  const navigate = useNavigate();
  const [metric, setMetric] = useState("workouts");
  const [period, setPeriod] = useState("30d");
  const [scope, setScope] = useState("friends");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/leaderboard", { params: { metric, period, scope, limit: 50 } });
      setData(data);
    } catch (e) {
      toast.error("Konnte Rangliste nicht laden");
    } finally {
      setLoading(false);
    }
  }, [metric, period, scope]);

  useEffect(() => { load(); }, [load]);

  const rows = data?.rows || [];
  const youInList = rows.some((r) => r.is_self);
  const showStickyYou = data?.you && !youInList;
  const maxValue = rows.length > 0 ? Math.max(...rows.map((r) => r.value), 1) : 1;

  return (
    <Layout>
      <div className="mb-5">
        <h1 className="font-teko text-3xl sm:text-5xl chrome-text flex items-center gap-2">
          <Trophy className="text-[#00BFFF]" size={28} /> RANGLISTE
        </h1>
        <p className="prose-af font-chakra text-sm mt-1">Vergleiche dich. Domiere deine Crew.</p>
      </div>

      {/* Scope toggle */}
      <div className="af-card p-1 mb-4 flex" data-testid="scope-toggle">
        <ScopeBtn active={scope === "friends"} onClick={() => setScope("friends")} testid="scope-friends">
          <Users size={14} className="inline mr-1.5" /> Freunde
        </ScopeBtn>
        <ScopeBtn active={scope === "global"} onClick={() => setScope("global")} testid="scope-global">
          <Globe size={14} className="inline mr-1.5" /> Global
        </ScopeBtn>
      </div>

      {/* Metric pills */}
      <div className="grid grid-cols-3 gap-2 mb-3" data-testid="metric-pills">
        {METRICS.map((m) => {
          const Icon = m.icon;
          const active = metric === m.value;
          return (
            <button
              key={m.value}
              onClick={() => setMetric(m.value)}
              className={`p-2.5 rounded-lg border text-center transition ${
                active ? "border-[#00BFFF] bg-[#00BFFF]/10 text-white" : "border-[#1A1A24] text-gray-500 hover:text-gray-300"
              }`}
              data-testid={`metric-${m.value}`}
            >
              <Icon size={16} className={`mx-auto mb-0.5 ${active ? "text-[#00BFFF]" : ""}`} />
              <div className="font-teko text-sm tracking-wide">{m.label}</div>
            </button>
          );
        })}
      </div>

      {/* Period chips - only for workouts + volume */}
      {metric !== "streak" && (
        <div className="flex gap-2 mb-4" data-testid="period-chips">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-teko tracking-wider transition border ${
                period === p.value
                  ? "bg-[#00BFFF] text-black border-[#00BFFF]"
                  : "border-[#1A1A24] text-gray-500 hover:text-gray-300"
              }`}
              data-testid={`period-${p.value}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-[#00BFFF] font-teko text-2xl">
          <Loader2 size={28} className="inline animate-spin mr-2" /> Lade...
        </div>
      ) : rows.length === 0 ? (
        <EmptyState scope={scope} metric={metric} onGoToFriends={() => navigate("/friends")} />
      ) : (
        <div className="space-y-2 mb-24" data-testid="leaderboard-rows">
          {rows.map((row) => {
            const medal = medalFor(row.rank);
            const pct = Math.round((row.value / maxValue) * 100);
            return (
              <div
                key={row.user_id}
                className={`af-card p-3 relative overflow-hidden ${row.is_self ? "border-[#00BFFF] bg-[#00BFFF]/5" : ""}`}
                data-testid={`row-${row.user_id}`}
              >
                {/* Background progress bar */}
                <div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#00BFFF]/8 to-transparent pointer-events-none"
                  style={{ width: `${pct}%` }}
                />
                <div className="relative flex items-center gap-3">
                  {/* Rank */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    medal ? medal.bg : "bg-[#1A1A24]"
                  }`}>
                    {medal ? (
                      <medal.Icon size={14} className={medal.cls} />
                    ) : (
                      <span className="font-teko text-base text-gray-400">{row.rank}</span>
                    )}
                  </div>
                  {/* Avatar + name */}
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#00BFFF]/30 to-[#1A1A24] flex items-center justify-center font-teko text-base chrome-text flex-shrink-0">
                    {(row.name || "?")[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-teko text-base chrome-text truncate flex items-center gap-1.5">
                      {row.name}
                      {row.is_premium && <Crown size={11} className="text-[#FFD700] flex-shrink-0" />}
                      {row.is_self && <span className="text-[10px] text-[#00BFFF] uppercase tracking-widest ml-1">DU</span>}
                    </div>
                  </div>
                  <div className="font-teko text-lg electric-text flex-shrink-0">
                    {formatValue(row.value, metric)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sticky "Your rank" pill if not in list */}
      {showStickyYou && data?.you && (
        <div className="fixed bottom-20 left-3 right-3 sm:left-1/2 sm:-translate-x-1/2 sm:max-w-md z-30 pointer-events-none">
          <div className="af-card glow-box p-3 flex items-center gap-3 border-[#00BFFF]/60 pointer-events-auto" data-testid="sticky-you">
            <div className="text-[10px] uppercase tracking-widest text-[#00BFFF] font-chakra">Dein Rang</div>
            <ChevronUp size={14} className="text-gray-500" />
            <div className="font-teko text-2xl chrome-text">{data.you.rank ? `#${data.you.rank}` : "—"}</div>
            <div className="flex-1" />
            <div className="font-teko text-lg electric-text">{formatValue(data.you.value, metric)}</div>
          </div>
        </div>
      )}
    </Layout>
  );
}

function ScopeBtn({ active, onClick, children, testid }) {
  return (
    <button
      onClick={onClick}
      data-testid={testid}
      className={`flex-1 py-2 rounded font-teko text-sm tracking-wide transition ${
        active ? "bg-[#00BFFF] text-black" : "text-gray-400 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function EmptyState({ scope, metric, onGoToFriends }) {
  if (scope === "friends") {
    return (
      <div className="text-center py-12 px-4">
        <Users size={48} className="mx-auto text-gray-600 mb-3" />
        <div className="font-teko text-2xl chrome-text mb-1">Noch keine Freunde</div>
        <p className="prose-af font-chakra text-sm mb-4">Füge Freunde hinzu, um eine Rangliste zu sehen.</p>
        <button onClick={onGoToFriends} className="btn-primary text-sm" data-testid="goto-friends-from-leaderboard">
          FREUNDE FINDEN
        </button>
      </div>
    );
  }
  return (
    <div className="text-center py-12 px-4">
      <Trophy size={48} className="mx-auto text-gray-600 mb-3" />
      <div className="font-teko text-2xl chrome-text mb-1">Noch keine Daten</div>
      <p className="prose-af font-chakra text-sm">
        Sobald genug User Workouts loggen, erscheinen sie hier.
      </p>
    </div>
  );
}
