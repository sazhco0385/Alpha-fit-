import { useEffect, useState, useCallback } from "react";
import Layout from "../components/Layout";
import api from "../lib/api";
import { Scale, TrendingDown, TrendingUp, Minus, Plus, Loader2, Trash2, Calendar, Target, X, Edit3, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";

const fmtDate = (iso) => {
  try { return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return ""; }
};
const fmtShort = (iso) => {
  try { return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }); }
  catch { return ""; }
};

export default function BodyWeight() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newWeight, setNewWeight] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/body-weight/history");
      setData(data);
      if (data.latest && !newWeight) setNewWeight(String(data.latest.weight_kg));
    } catch (e) {
      toast.error("Konnte Verlauf nicht laden");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    const w = parseFloat(newWeight);
    if (!w || w < 20 || w > 400) {
      toast.error("Bitte gültiges Gewicht eingeben");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/body-weight/log", { weight_kg: w });
      toast.success(`${w.toFixed(1)} kg gespeichert`);
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Speichern fehlgeschlagen");
    } finally {
      setSubmitting(false);
    }
  };

  const removeEntry = async (id) => {
    if (!window.confirm("Eintrag wirklich löschen?")) return;
    try {
      await api.delete(`/body-weight/${id}`);
      toast.success("Gelöscht");
      await load();
    } catch (e) {
      toast.error("Löschen fehlgeschlagen");
    }
  };

  if (loading) return <Layout><div className="text-center py-12 text-[#00BFFF]"><Loader2 size={28} className="inline animate-spin mr-2" />Lade...</div></Layout>;

  const latest = data?.latest;
  const stats = data?.stats || {};
  const history = data?.history || [];
  const chartData = [...history].reverse().map((r) => ({
    date: fmtShort(r.logged_at), iso: r.logged_at, weight: r.weight_kg,
  }));

  return (
    <Layout>
      <div className="mb-5">
        <h1 className="font-teko text-3xl sm:text-5xl chrome-text flex items-center gap-2">
          <Scale className="text-[#00BFFF]" size={28} /> KÖRPERGEWICHT
        </h1>
        <p className="prose-af font-chakra text-sm mt-1">Tracke deinen Fortschritt. Jeden Morgen ein Eintrag genügt.</p>
      </div>

      {/* Current weight + Quick log */}
      <div className="af-card p-5 clip-corner-tl-br mb-5 tracing-border" data-testid="current-weight">
        <div className="text-[10px] uppercase tracking-[0.3em] text-[#00BFFF] font-chakra mb-2">Aktuell</div>
        <div className="flex items-end justify-between gap-3 mb-4">
          <div className="font-teko text-6xl sm:text-7xl electric-text leading-none" style={{filter: "drop-shadow(0 0 16px rgba(0,229,255,0.5))"}}>
            {latest ? latest.weight_kg.toFixed(1) : "—"}
            <span className="text-2xl sm:text-3xl ml-2 text-gray-500">kg</span>
          </div>
          {latest && (
            <div className="text-right text-xs text-gray-500 font-chakra">
              <div>Zuletzt</div>
              <div className="text-gray-300">{fmtDate(latest.logged_at)}</div>
            </div>
          )}
        </div>

        {/* Quick log */}
        <div className="flex gap-2">
          <input
            type="number"
            step="0.1"
            min={20} max={400}
            value={newWeight}
            onChange={(e) => setNewWeight(e.target.value)}
            placeholder="z.B. 82.5"
            className="af-input flex-1"
            data-testid="weight-input"
          />
          <button
            onClick={submit}
            disabled={submitting}
            className="btn-primary px-5 flex items-center gap-1.5 disabled:opacity-40"
            data-testid="weight-submit"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} LOGGEN
          </button>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2 mb-5">
        <DeltaStat label="7 Tage"  delta={stats.delta_7d} />
        <DeltaStat label="30 Tage" delta={stats.delta_30d} />
        <DeltaStat label="90 Tage" delta={stats.delta_90d} />
        <DeltaStat label="Gesamt" delta={stats.delta_all} />
      </div>

      {/* Goal card */}
      <GoalCard goal={data?.goal} onOpen={() => setShowGoalModal(true)} hasWeight={!!latest} />

      {/* Trend chart */}
      {chartData.length >= 2 && (
        <div className="af-card p-3 sm:p-5 clip-corner-tl-br mb-5" data-testid="weight-chart">
          <div className="font-teko text-lg chrome-text mb-3">VERLAUF</div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 5, right: 12, bottom: 0, left: -12 }}>
              <CartesianGrid stroke="#1A1A24" strokeDasharray="3 3" />
              <XAxis dataKey="date" stroke="#666" tick={{ fontSize: 10 }} />
              <YAxis stroke="#666" tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
              <Tooltip
                contentStyle={{ background: "#03030A", border: "1px solid #00BFFF", fontSize: 12 }}
                labelStyle={{ color: "#00E5FF" }}
                formatter={(v) => [`${v} kg`, "Gewicht"]}
              />
              <Line type="monotone" dataKey="weight" stroke="#00E5FF" strokeWidth={2}
                dot={{ fill: "#00E5FF", r: 3 }} activeDot={{ r: 5, fill: "#00BFFF" }}
                style={{ filter: "drop-shadow(0 0 4px rgba(0,229,255,0.5))" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* History list */}
      <div className="af-card p-4 sm:p-5 clip-corner-tl-br" data-testid="weight-history">        <div className="flex items-center justify-between mb-3">
          <div className="font-teko text-lg chrome-text">EINTRÄGE</div>
          <div className="text-xs text-gray-500 font-chakra">{history.length} gesamt</div>
        </div>
        {history.length === 0 ? (
          <div className="text-center py-8 text-gray-500 font-chakra text-sm">
            Noch keine Einträge. Logge dein erstes Gewicht oben.
          </div>
        ) : (
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            {history.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-2 hover:bg-[#0A0A10] transition rounded group" data-testid={`entry-${r.id}`}>
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Calendar size={12} className="text-gray-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="font-teko text-base chrome-text leading-tight">{r.weight_kg.toFixed(1)} kg</div>
                    <div className="text-[10px] text-gray-500 truncate">
                      {fmtDate(r.logged_at)}{r.note ? ` · ${r.note}` : ""}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => removeEntry(r.id)}
                  className="opacity-0 group-hover:opacity-100 sm:opacity-30 hover:!opacity-100 hover:text-red-400 text-gray-500 p-1 transition"
                  data-testid={`delete-${r.id}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showGoalModal && (
        <GoalModal
          current={data?.goal}
          latestWeight={latest?.weight_kg}
          onClose={() => setShowGoalModal(false)}
          onSaved={() => { setShowGoalModal(false); load(); }}
        />
      )}
    </Layout>
  );
}

function DeltaStat({ label, delta }) {
  const hasData = delta !== null && delta !== undefined;
  let Icon = Minus;
  let color = "#666";
  if (hasData && delta > 0) { Icon = TrendingUp; color = "#FF5722"; }
  else if (hasData && delta < 0) { Icon = TrendingDown; color = "#00E5FF"; }
  return (
    <div className="af-card p-3" data-testid={`stat-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="text-[10px] uppercase tracking-widest text-gray-500 font-chakra mb-1">{label}</div>
      <div className="flex items-center gap-1.5">
        <Icon size={16} style={{ color }} />
        <div className="font-teko text-xl" style={{ color: hasData ? color : "#444" }}>
          {hasData ? `${delta > 0 ? "+" : ""}${delta.toFixed(1)} kg` : "—"}
        </div>
      </div>
    </div>
  );
}

function GoalCard({ goal, onOpen, hasWeight }) {
  if (!goal) {
    return (
      <button
        onClick={onOpen}
        disabled={!hasWeight}
        className="af-card p-4 mb-5 w-full text-left clip-corner-tl-br border border-dashed border-[#1A1A24] hover:border-[#00BFFF]/50 transition disabled:opacity-40 disabled:cursor-not-allowed"
        data-testid="set-goal-cta"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#FFD700]/20 to-[#1A1A24] flex items-center justify-center flex-shrink-0">
            <Target size={20} className="text-[#FFD700]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-teko text-lg chrome-text leading-tight">ZIEL-GEWICHT SETZEN</div>
            <div className="text-xs text-gray-400 font-chakra">
              {hasWeight ? "Definiere ein Ziel und sieh deinen Fortschritt." : "Logge erst dein aktuelles Gewicht."}
            </div>
          </div>
        </div>
      </button>
    );
  }

  const pct = goal.progress_pct;
  const reached = goal.reached;
  const direction = goal.direction;
  const directionLabel = direction === "lose" ? "ABNEHMEN" : direction === "gain" ? "ZUNEHMEN" : "HALTEN";
  const directionColor = reached ? "#00E5FF" : (direction === "lose" ? "#00E5FF" : direction === "gain" ? "#FFD740" : "#9E9E9E");

  return (
    <div className="af-card p-4 mb-5 clip-corner-tl-br" data-testid="goal-card">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Target size={18} className="text-[#FFD700] flex-shrink-0" style={{filter: "drop-shadow(0 0 8px #FFD70088)"}} />
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.3em] font-chakra" style={{color: directionColor}}>{directionLabel}</div>
            <div className="font-teko text-2xl chrome-text leading-tight">
              {goal.baseline_kg.toFixed(1)} <span className="text-gray-500 text-base">→</span> <span style={{color: directionColor}}>{goal.goal_kg.toFixed(1)}</span> <span className="text-gray-500 text-base">kg</span>
            </div>
          </div>
        </div>
        <button onClick={onOpen} className="text-gray-500 hover:text-[#00BFFF] p-1 transition" data-testid="edit-goal-btn">
          <Edit3 size={14} />
        </button>
      </div>

      <div className="relative h-3 bg-[#0A0A10] rounded-full overflow-hidden mb-2">
        <div
          className="absolute inset-y-0 left-0 transition-all"
          style={{
            width: `${pct}%`,
            background: reached
              ? "linear-gradient(90deg, #00E5FF, #FFD700)"
              : `linear-gradient(90deg, #00BFFF, ${directionColor})`,
            boxShadow: `0 0 8px ${directionColor}66`,
          }}
        />
      </div>

      <div className="flex items-center justify-between text-xs font-chakra">
        <div className="text-gray-400">
          {reached ? (
            <span className="text-[#00E5FF] font-bold flex items-center gap-1"><CheckCircle2 size={12} /> ZIEL ERREICHT 🎉</span>
          ) : (
            <>Noch <span className="text-white font-bold">{Math.abs(goal.remaining_kg).toFixed(1)} kg</span> zu gehen</>
          )}
        </div>
        <div className="text-gray-500">{pct.toFixed(0)}%</div>
      </div>
    </div>
  );
}

function GoalModal({ current, latestWeight, onClose, onSaved }) {
  const [value, setValue] = useState(current ? String(current.goal_kg) : (latestWeight ? String(Math.round(latestWeight - 5)) : ""));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const save = async () => {
    const g = parseFloat(value);
    if (!g || g < 20 || g > 400) {
      toast.error("Bitte gültiges Ziel-Gewicht eingeben");
      return;
    }
    setBusy(true);
    try {
      await api.put("/body-weight/goal", { goal_kg: g });
      toast.success(`Ziel gesetzt: ${g.toFixed(1)} kg`);
      onSaved();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Fehler");
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    if (!window.confirm("Ziel wirklich entfernen?")) return;
    setBusy(true);
    try {
      await api.put("/body-weight/goal", { goal_kg: null });
      toast.success("Ziel entfernt");
      onSaved();
    } catch (e) {
      toast.error("Fehler");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4" data-testid="goal-modal">
      <div className="w-full sm:max-w-md h-full sm:h-auto overflow-y-auto rounded-t-2xl sm:rounded-xl p-5 border-t-2 sm:border-2 border-[#FFD700]/40 bg-[#03030A]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-teko text-2xl chrome-text flex items-center gap-2">
            <Target size={20} className="text-[#FFD700]" /> ZIEL-GEWICHT
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white" data-testid="close-goal-modal">
            <X size={20} />
          </button>
        </div>

        <p className="prose-af font-chakra text-sm mb-4">
          Wo willst du hin? Wir tracken deinen Fortschritt vom aktuellen Gewicht ({latestWeight ? `${latestWeight.toFixed(1)} kg` : "—"}) bis zu deinem Ziel.
        </p>

        <label className="text-xs uppercase tracking-widest text-gray-500 font-chakra mb-1 block">Mein Ziel</label>
        <div className="flex items-center gap-2 mb-5">
          <input
            type="number"
            step="0.1"
            min={20} max={400}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="z.B. 75.0"
            className="af-input flex-1 text-2xl font-teko"
            data-testid="goal-input"
          />
          <span className="text-gray-500 font-chakra">kg</span>
        </div>

        <div className="flex gap-2">
          <button onClick={save} disabled={busy} className="btn-primary flex-1 disabled:opacity-40 flex items-center justify-center gap-1.5" data-testid="goal-save">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Target size={14} />} {current ? "AKTUALISIEREN" : "ZIEL SETZEN"}
          </button>
          {current && (
            <button onClick={clear} disabled={busy} className="btn-outline px-4 text-red-400 border-red-400/40 disabled:opacity-40 flex items-center justify-center" data-testid="goal-clear">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

