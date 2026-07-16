import { useEffect, useState, useCallback } from "react";
import Layout from "../components/Layout";
import api from "../lib/api";
import {
  Swords, Plus, Loader2, Users, Trophy, Clock, X, Check,
  Flame, Dumbbell, Calendar, ChevronRight, Trash2, LogOut, Target, Crown
} from "lucide-react";
import { toast } from "sonner";

const METRIC_OPTS = [
  { value: "workouts", label: "Workouts", icon: Dumbbell, hint: "Anzahl abgeschlossener Workouts", unit: "" },
  { value: "volume_kg", label: "Volumen", icon: Flame, hint: "Gehobene kg gesamt (reps × weight)", unit: "kg" },
  { value: "active_days", label: "Aktive Tage", icon: Calendar, hint: "Tage mit mindestens 1 Workout", unit: "Tage" },
];

const formatValue = (v, metric) => {
  if (metric === "volume_kg") return `${Math.round(Number(v) || 0).toLocaleString("de-DE")} kg`;
  if (metric === "active_days") return `${Math.round(Number(v) || 0)} Tage`;
  return `${Math.round(Number(v) || 0)}`;
};

const timeLeft = (endIso) => {
  if (!endIso) return "—";
  const end = new Date(endIso).getTime();
  const now = Date.now();
  const ms = end - now;
  if (ms <= 0) return "Beendet";
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  if (days > 0) return `${days}d ${hours}h`;
  const mins = Math.floor((ms % 3600000) / 60000);
  return `${hours}h ${mins}m`;
};

export default function Challenges() {
  const [tab, setTab] = useState("active");
  const [data, setData] = useState({ active: [], invited: [], completed: [], counts: { active: 0, invited: 0, completed: 0 } });
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [detailId, setDetailId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/challenges");
      setData(data);
    } catch (e) {
      toast.error("Konnte Challenges nicht laden");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const list = data[tab] || [];

  return (
    <Layout>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-teko text-3xl sm:text-5xl chrome-text flex items-center gap-2">
            <Swords className="text-[#FF4500]" size={28} /> CHALLENGES
          </h1>
          <p className="prose-af font-chakra text-sm mt-1">Stell dich. Hetz deine Crew. Gewinne.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="btn-primary flex items-center gap-1.5 text-sm flex-shrink-0"
          data-testid="open-create-challenge"
        >
          <Plus size={14} /> NEU
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 sm:gap-2 mb-5 border-b border-[#1A1A24]" data-testid="challenge-tabs">
        <TabBtn active={tab === "active"} onClick={() => setTab("active")} testid="tab-ch-active">
          Aktiv <span className="ml-1 text-[10px] text-[#FF4500]">({data.counts.active})</span>
        </TabBtn>
        <TabBtn active={tab === "invited"} onClick={() => setTab("invited")} testid="tab-ch-invited">
          Einladungen
          {data.counts.invited > 0 && (
            <span className="ml-1 inline-block bg-[#FF4500] text-black rounded-full px-1.5 text-[10px] font-bold">
              {data.counts.invited}
            </span>
          )}
        </TabBtn>
        <TabBtn active={tab === "completed"} onClick={() => setTab("completed")} testid="tab-ch-completed">
          Beendet <span className="ml-1 text-[10px] text-gray-400">({data.counts.completed})</span>
        </TabBtn>
      </div>

      {loading ? (
        <div className="text-center py-12 text-[#FF4500] font-teko text-2xl">
          <Loader2 size={28} className="inline animate-spin mr-2" /> Lade...
        </div>
      ) : list.length === 0 ? (
        <EmptyState tab={tab} onCreate={() => setShowCreate(true)} />
      ) : (
        <div className="space-y-3" data-testid={`list-${tab}`}>
          {list.map((c) => (
            <ChallengeCard key={c.id} challenge={c} onOpen={() => setDetailId(c.id)} />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateChallengeModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); }}
        />
      )}

      {detailId && (
        <ChallengeDetailModal
          challengeId={detailId}
          onClose={() => setDetailId(null)}
          onChanged={() => { load(); setDetailId(null); }}
        />
      )}
    </Layout>
  );
}

function TabBtn({ active, onClick, children, testid }) {
  return (
    <button
      onClick={onClick}
      data-testid={testid}
      className={`px-3 py-2 font-teko text-base tracking-wide transition border-b-2 ${
        active ? "border-[#FF4500] text-white" : "border-transparent text-gray-500 hover:text-gray-300"
      }`}
    >
      {children}
    </button>
  );
}

function EmptyState({ tab, onCreate }) {
  if (tab === "active") {
    return (
      <div className="text-center py-12 px-4">
        <Swords size={48} className="mx-auto text-gray-600 mb-3" />
        <div className="font-teko text-2xl chrome-text mb-1">Keine aktive Challenge</div>
        <p className="prose-af font-chakra text-sm mb-4">Starte eine Challenge und fordere deine Crew heraus.</p>
        <button onClick={onCreate} className="btn-primary text-sm" data-testid="empty-create-btn">
          <Plus size={14} className="inline mr-1" /> CHALLENGE STARTEN
        </button>
      </div>
    );
  }
  if (tab === "invited") {
    return (
      <div className="text-center py-12 text-gray-500 font-chakra text-sm">
        Keine offenen Einladungen.
      </div>
    );
  }
  return (
    <div className="text-center py-12 text-gray-500 font-chakra text-sm">
      Noch keine abgeschlossenen Challenges.
    </div>
  );
}

function ChallengeCard({ challenge, onOpen }) {
  const c = challenge;
  const me = c.standings?.find((s) => s.user_id === c.is_creator ? c.created_by : null);
  // Get current user's progress from standings (we don't have current_user_id passed; rely on first match by your_status)
  // Simpler: compute leader + show your value via "is_creator-aware" lookup using current_user_id from local storage is overkill;
  // We just show the leader value here. The detail modal handles per-user breakdown.
  const leader = c.standings?.[0];
  const targetReached = leader && c.target && leader.value >= c.target;

  return (
    <button
      onClick={onOpen}
      className="af-card w-full text-left p-4 hover:border-[#FF4500]/40 transition group"
      data-testid={`challenge-card-${c.id}`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-teko text-xl chrome-text truncate">{c.title}</h3>
            {c.status === "active" && (
              <span className="text-[10px] uppercase tracking-widest text-[#FF4500] flex items-center gap-1">
                <Clock size={10} /> {timeLeft(c.end_at)}
              </span>
            )}
            {c.status === "completed" && (
              <span className="text-[10px] uppercase tracking-widest text-yellow-400 flex items-center gap-1">
                <Trophy size={10} /> Beendet
              </span>
            )}
          </div>
          <div className="text-xs text-gray-400 font-chakra mt-0.5">
            Ziel: <span className="electric-text">{formatValue(c.target, c.metric)}</span> · {c.metric_label}
          </div>
        </div>
        <ChevronRight size={16} className="text-gray-500 group-hover:text-[#FF4500] flex-shrink-0 mt-1" />
      </div>

      {/* Leader preview */}
      {leader && (
        <div className="mt-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <Trophy size={12} className={targetReached ? "text-yellow-400" : "text-gray-500"} />
            <span className="truncate font-chakra text-gray-300">{leader.name}</span>
            {leader.is_premium && <Crown size={10} className="text-[#FFD700] flex-shrink-0" />}
          </div>
          <div className="font-teko text-base electric-text flex-shrink-0">
            {formatValue(leader.value, c.metric)}
          </div>
        </div>
      )}

      {/* Progress bar (best participant vs target) */}
      <div className="mt-2 h-1.5 bg-[#1A1A24] rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[#FF4500] to-[#FF5A1F] transition-all"
          style={{ width: `${Math.min(100, Math.round(((leader?.value || 0) / (c.target || 1)) * 100))}%` }}
        />
      </div>

      <div className="mt-2 flex items-center gap-3 text-[11px] text-gray-500 font-chakra">
        <span className="flex items-center gap-1"><Users size={11} /> {c.participants_count} Teilnehmer</span>
        {c.your_status === "invited" && (
          <span className="text-yellow-400 font-bold">DU BIST EINGELADEN</span>
        )}
        {c.is_creator && (
          <span className="text-[#FF4500]">DU BIST ERSTELLER</span>
        )}
      </div>
    </button>
  );
}

function CreateChallengeModal({ onClose, onCreated }) {
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [metric, setMetric] = useState("workouts");
  const [target, setTarget] = useState(5);
  const [days, setDays] = useState(7);
  const [friends, setFriends] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/friends/list");
        setFriends(data.friends || []);
      } catch (e) {
        // no friends, no problem — user can still create solo challenge
      } finally {
        setLoadingFriends(false);
      }
    })();
  }, []);

  const toggleFriend = (id) => {
    setSelectedIds((arr) => arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);
  };

  const submit = async () => {
    if (title.trim().length < 2) {
      toast.error("Titel zu kurz");
      return;
    }
    if (!target || target <= 0) {
      toast.error("Ziel muss > 0 sein");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/challenges", {
        title: title.trim(),
        description: description.trim(),
        metric,
        target: Number(target),
        days: Number(days),
        invitee_ids: selectedIds,
      });
      toast.success("Challenge erstellt!");
      onCreated();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Erstellen fehlgeschlagen");
    } finally {
      setSubmitting(false);
    }
  };

  const metricObj = METRIC_OPTS.find((m) => m.value === metric);

  return (
    <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4" data-testid="create-challenge-modal">
      <div className="w-full sm:max-w-lg h-full sm:h-auto sm:max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-xl p-5 border-t-2 sm:border-2 border-[#FF4500]/40 bg-[#03030A]" style={{boxShadow: "0 -20px 60px rgba(255,69,0,0.08)"}}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-teko text-2xl chrome-text">NEUE CHALLENGE</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white" data-testid="close-create-modal">
            <X size={20} />
          </button>
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="text-xs uppercase tracking-widest text-gray-500 font-chakra mb-1 block">Titel</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="z.B. 100 Squats diese Woche"
                maxLength={80}
                className="af-input w-full"
                data-testid="challenge-title-input"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-gray-500 font-chakra mb-1 block">Beschreibung (optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Zusatz-Infos"
                maxLength={300}
                rows={2}
                className="af-input w-full resize-none"
                data-testid="challenge-description-input"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-gray-500 font-chakra mb-2 block">Metrik</label>
              <div className="grid grid-cols-3 gap-2">
                {METRIC_OPTS.map((m) => {
                  const Icon = m.icon;
                  const active = metric === m.value;
                  return (
                    <button
                      key={m.value}
                      onClick={() => setMetric(m.value)}
                      className={`p-3 rounded-lg border text-center transition ${
                        active ? "border-[#FF4500] bg-[#FF4500]/10 text-white" : "border-[#1A1A24] text-gray-500 hover:text-gray-300"
                      }`}
                      data-testid={`metric-${m.value}`}
                    >
                      <Icon size={20} className={`mx-auto mb-1 ${active ? "text-[#FF4500]" : ""}`} />
                      <div className="font-teko text-sm">{m.label}</div>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-gray-500 font-chakra mt-1">{metricObj?.hint}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase tracking-widest text-gray-500 font-chakra mb-1 block">
                  Ziel {metricObj?.unit && `(${metricObj.unit})`}
                </label>
                <input
                  type="number"
                  min={1}
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  className="af-input w-full"
                  data-testid="challenge-target-input"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest text-gray-500 font-chakra mb-1 block">Dauer (Tage)</label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                  className="af-input w-full"
                  data-testid="challenge-days-input"
                />
              </div>
            </div>
            <button
              onClick={() => setStep(2)}
              disabled={title.trim().length < 2 || !target || target <= 0}
              className="btn-primary w-full disabled:opacity-40"
              data-testid="next-to-invite"
            >
              Weiter: Crew einladen →
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <div className="text-xs uppercase tracking-widest text-gray-500 font-chakra">Freunde einladen (optional)</div>
            {loadingFriends ? (
              <div className="text-center py-6 text-gray-500"><Loader2 size={20} className="inline animate-spin" /></div>
            ) : friends.length === 0 ? (
              <div className="text-center py-4 text-gray-500 font-chakra text-sm">
                Du hast noch keine Freunde. Du startest solo.
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto space-y-2 -mx-2 px-2">
                {friends.map((f) => {
                  const checked = selectedIds.includes(f.id);
                  return (
                    <button
                      key={f.id}
                      onClick={() => toggleFriend(f.id)}
                      className={`w-full af-card p-2.5 flex items-center gap-3 transition ${
                        checked ? "border-[#FF4500] bg-[#FF4500]/10" : ""
                      }`}
                      data-testid={`invite-toggle-${f.id}`}
                    >
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#FF4500]/30 to-[#1A1A24] flex items-center justify-center font-teko text-base chrome-text flex-shrink-0">
                        {(f.name || "?")[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <div className="font-teko text-base chrome-text truncate flex items-center gap-1.5">
                          {f.name} {f.is_premium && <Crown size={10} className="text-[#FFD700]" />}
                        </div>
                        <div className="text-[10px] text-gray-500">{f.workouts_30d || 0} Workouts in 30d</div>
                      </div>
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                        checked ? "border-[#FF4500] bg-[#FF4500]" : "border-[#1A1A24]"
                      }`}>
                        {checked && <Check size={12} className="text-black" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="text-[11px] text-gray-500 font-chakra">
              {selectedIds.length} Freund{selectedIds.length === 1 ? "" : "e"} ausgewählt
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setStep(1)} className="btn-outline flex-1" data-testid="back-to-step1">← Zurück</button>
              <button
                onClick={submit}
                disabled={submitting}
                className="btn-primary flex-1 disabled:opacity-40 flex items-center justify-center gap-1.5"
                data-testid="submit-create-challenge"
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Swords size={14} />} STARTEN
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ChallengeDetailModal({ challengeId, onClose, onChanged }) {
  const [challenge, setChallenge] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/challenges/${challengeId}`);
      setChallenge(data.challenge);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Konnte Challenge nicht laden");
      onClose();
    } finally {
      setLoading(false);
    }
  }, [challengeId, onClose]);

  useEffect(() => { load(); }, [load]);

  const accept = async () => {
    setBusy(true);
    try {
      await api.post("/challenges/accept", { challenge_id: challengeId });
      toast.success("Du bist dabei 🔥");
      onChanged();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Fehler");
      setBusy(false);
    }
  };

  const decline = async () => {
    setBusy(true);
    try {
      await api.post("/challenges/decline", { challenge_id: challengeId });
      toast.success("Abgelehnt");
      onChanged();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Fehler");
      setBusy(false);
    }
  };

  const leave = async () => {
    if (!window.confirm("Challenge wirklich verlassen?")) return;
    setBusy(true);
    try {
      await api.post("/challenges/leave", { challenge_id: challengeId });
      toast.success("Verlassen");
      onChanged();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Fehler");
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!window.confirm("Challenge wirklich abbrechen?")) return;
    setBusy(true);
    try {
      await api.delete(`/challenges/${challengeId}`);
      toast.success("Abgebrochen");
      onChanged();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Fehler");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4" data-testid="challenge-detail-modal">
      <div className="w-full sm:max-w-lg h-full sm:h-auto sm:max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-xl border-t-2 sm:border-2 border-[#FF4500]/40 bg-[#03030A]" style={{boxShadow: "0 -20px 60px rgba(255,69,0,0.08)"}}>
        {loading || !challenge ? (
          <div className="p-10 text-center text-[#FF4500]"><Loader2 size={28} className="inline animate-spin" /></div>
        ) : (
          <div className="p-5">
            <div className="flex items-start justify-between mb-3 gap-3">
              <div className="min-w-0">
                <h2 className="font-teko text-2xl chrome-text">{challenge.title}</h2>
                <div className="text-xs text-gray-400 font-chakra">von {challenge.created_by_name}</div>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-white flex-shrink-0" data-testid="close-detail-modal">
                <X size={20} />
              </button>
            </div>

            {challenge.description && (
              <p className="prose-af font-chakra text-sm mb-4">{challenge.description}</p>
            )}

            {/* Meta */}
            <div className="grid grid-cols-3 gap-2 mb-5 text-center">
              <Stat icon={Target} label="Ziel" value={formatValue(challenge.target, challenge.metric)} />
              <Stat
                icon={Clock}
                label={challenge.status === "active" ? "Restzeit" : "Status"}
                value={challenge.status === "active" ? timeLeft(challenge.end_at) : (challenge.status === "completed" ? "Beendet" : "Abgebrochen")}
              />
              <Stat icon={Users} label="Crew" value={`${challenge.participants_count}`} />
            </div>

            {/* Winner banner (completed) */}
            {challenge.status === "completed" && challenge.winner && (
              <div className="af-card p-4 mb-4 border-yellow-400/40 bg-yellow-400/5">
                <div className="flex items-center gap-3">
                  <Trophy size={28} className="text-yellow-400" />
                  <div>
                    <div className="font-teko text-xl chrome-text">SIEGER</div>
                    <div className="font-chakra text-sm text-yellow-200">
                      {challenge.winner.name} {challenge.target_reached ? "hat das Ziel erreicht 🎯" : ""}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Standings */}
            <div className="mb-5">
              <div className="text-xs uppercase tracking-widest text-gray-500 font-chakra mb-2">
                {challenge.status === "completed" ? "Endstand" : "Live Rangliste"}
              </div>
              <div className="space-y-2" data-testid="standings-list">
                {challenge.standings?.length === 0 && (
                  <div className="text-center py-4 text-gray-500 font-chakra text-sm">Noch keine Teilnehmer.</div>
                )}
                {challenge.standings?.map((s, idx) => {
                  const pct = Math.min(100, Math.round((s.value / (challenge.target || 1)) * 100));
                  const isWinner = challenge.winner?.user_id === s.user_id;
                  return (
                    <div key={s.user_id} className="af-card p-2.5" data-testid={`standing-${s.user_id}`}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center font-teko text-xs flex-shrink-0 ${
                          idx === 0 ? "bg-yellow-400/20 text-yellow-400" :
                          idx === 1 ? "bg-gray-400/20 text-gray-300" :
                          idx === 2 ? "bg-orange-400/20 text-orange-300" : "bg-[#1A1A24] text-gray-500"
                        }`}>{idx + 1}</div>
                        <div className="flex-1 min-w-0 flex items-center gap-1.5">
                          <span className="font-teko text-base chrome-text truncate">{s.name}</span>
                          {s.is_premium && <Crown size={10} className="text-[#FFD700] flex-shrink-0" />}
                          {isWinner && <Trophy size={12} className="text-yellow-400 flex-shrink-0" />}
                        </div>
                        <div className="font-teko text-base electric-text flex-shrink-0">
                          {formatValue(s.value, challenge.metric)}
                        </div>
                      </div>
                      <div className="h-1 bg-[#0A0A10] rounded-full overflow-hidden">
                        <div className={`h-full transition-all ${
                          pct >= 100 ? "bg-gradient-to-r from-yellow-400 to-yellow-200" : "bg-gradient-to-r from-[#FF4500] to-[#FF5A1F]"
                        }`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Pending invites preview */}
            {challenge.invites?.filter((i) => i.status === "pending").length > 0 && (
              <div className="mb-5">
                <div className="text-xs uppercase tracking-widest text-gray-500 font-chakra mb-2">Offene Einladungen</div>
                <div className="flex flex-wrap gap-2">
                  {challenge.invites.filter((i) => i.status === "pending").map((i) => (
                    <span key={i.user_id} className="text-xs font-chakra text-gray-300 bg-[#1A1A24] rounded px-2 py-1">
                      {i.name} <Clock size={10} className="inline ml-1 text-yellow-400" />
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-2 pt-2 border-t border-[#1A1A24]">
              {challenge.your_status === "invited" && (
                <div className="flex gap-2">
                  <button onClick={accept} disabled={busy} className="btn-primary flex-1 disabled:opacity-40 flex items-center justify-center gap-1.5" data-testid="detail-accept">
                    {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} ANNEHMEN
                  </button>
                  <button onClick={decline} disabled={busy} className="btn-outline flex-1 disabled:opacity-40 text-red-400 border-red-400/40 flex items-center justify-center gap-1.5" data-testid="detail-decline">
                    <X size={14} /> ABLEHNEN
                  </button>
                </div>
              )}
              {challenge.status === "active" && challenge.your_status === "participant" && !challenge.is_creator && (
                <button onClick={leave} disabled={busy} className="btn-outline text-red-400 border-red-400/40 disabled:opacity-40 flex items-center justify-center gap-1.5" data-testid="detail-leave">
                  <LogOut size={14} /> VERLASSEN
                </button>
              )}
              {challenge.status === "active" && challenge.is_creator && (
                <button onClick={cancel} disabled={busy} className="btn-outline text-red-400 border-red-400/40 disabled:opacity-40 flex items-center justify-center gap-1.5" data-testid="detail-cancel">
                  <Trash2 size={14} /> CHALLENGE ABBRECHEN
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="af-card p-2">
      <Icon size={14} className="text-[#FF4500] mx-auto mb-1" />
      <div className="font-teko text-base chrome-text leading-tight">{value}</div>
      <div className="text-[9px] uppercase tracking-widest text-gray-500">{label}</div>
    </div>
  );
}
