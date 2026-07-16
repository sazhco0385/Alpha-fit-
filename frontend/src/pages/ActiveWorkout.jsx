import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../lib/api";
import { Check, X, Pause, Play, ChevronRight, Loader2, Trophy, TrendingUp, Sparkles, Activity, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { getExerciseImage } from "../lib/exerciseImages";
import ExerciseVideoModal from "../components/ExerciseVideoModal";
import BadgeGlow from "../components/BadgeGlow";
import PRCard from "../components/PRCard";
import { playCountdownBeep, playRestOverChime, isSoundEnabled } from "../lib/sound";
import { getRestCategory } from "../lib/restCategory";

export default function ActiveWorkout() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [plan, setPlan] = useState(null);
  const [day, setDay] = useState(null);
  const [exIdx, setExIdx] = useState(0);
  const [setIdx, setSetIdx] = useState(0);
  const [reps, setReps] = useState(0);
  const [weight, setWeight] = useState(0);
  const [showVideo, setShowVideo] = useState(false);
  const [resting, setResting] = useState(false);
  const [restLeft, setRestLeft] = useState(0);
  const [restTotal, setRestTotal] = useState(0);
  const [restPaused, setRestPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [finishing, setFinishing] = useState(false);
  const [done, setDone] = useState(false);
  const [newBadges, setNewBadges] = useState([]);
  const [newPRs, setNewPRs] = useState([]);
  const [suggestion, setSuggestion] = useState(null);
  const restRef = useRef(null);

  // Load session & plan
  useEffect(() => {
    (async () => {
      try {
        const [{ data: actData }, { data: planData }] = await Promise.all([
          api.get("/sessions/active"),
          api.get("/plans/current"),
        ]);
        let s = actData.session;
        if (!s || s.id !== sessionId) {
          // session might be loaded by id
          const hist = await api.get("/sessions/history");
          s = hist.data.sessions.find((x) => x.id === sessionId);
        }
        if (!s) { toast.error("Session nicht gefunden"); navigate("/dashboard"); return; }
        setSession(s);
        setPlan(planData.plan);
        const d = planData.plan?.days?.find((x) => x.day_index === s.day_index);
        setDay(d);
        const startEx = s.current_exercise_index || 0;
        const startSet = s.current_set_index || 0;
        setExIdx(startEx);
        setSetIdx(startSet);
        if (d?.exercises?.[startEx]) {
          setReps(d.exercises[startEx].reps);
          setWeight(d.exercises[startEx].weight_kg);
        }
      } catch (err) {
        toast.error("Fehler beim Laden");
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionId, navigate]);

  // when exercise changes, set default reps/weight + fetch suggestion
  useEffect(() => {
    if (day?.exercises?.[exIdx]) {
      setReps(day.exercises[exIdx].reps);
      setWeight(day.exercises[exIdx].weight_kg);
    }
    // Fetch AI suggestion
    if (session && day?.exercises?.[exIdx]) {
      setSuggestion(null);
      api.get(`/sessions/suggestion/${session.day_index}/${exIdx}`)
        .then(({ data }) => setSuggestion(data))
        .catch(() => setSuggestion(null));
    }
  }, [exIdx, day, session]);

  // Rest timer
  useEffect(() => {
    if (!resting || restPaused) return;
    restRef.current = setInterval(() => {
      setRestLeft((p) => {
        if (p <= 1) {
          clearInterval(restRef.current);
          setResting(false);
          if (isSoundEnabled()) playRestOverChime();
          return 0;
        }
        // 3-2-1 countdown beep
        if (p <= 4 && isSoundEnabled()) playCountdownBeep();
        return p - 1;
      });
    }, 1000);
    return () => clearInterval(restRef.current);
  }, [resting, restPaused]);

  const persistProgress = useCallback(async (newEx, newSet) => {
    try { await api.post("/sessions/update-progress", { session_id: sessionId, exercise_index: newEx, set_index: newSet }); } catch {}
  }, [sessionId]);

  if (loading) return <FullScreenLoader text="LADE TRAINING..." />;
  if (!day) return <FullScreenLoader text="KEIN PLAN GEFUNDEN" />;
  if (done) return <CompleteView newBadges={newBadges} newPRs={newPRs} onClose={() => navigate("/dashboard")} />;

  const exercise = day.exercises[exIdx];
  const totalSets = exercise?.sets || 0;
  const isLastSet = setIdx >= totalSets - 1;
  const isLastExercise = exIdx >= day.exercises.length - 1;
  const totalExercises = day.exercises.length;

  const overallProgress = ((exIdx + setIdx / Math.max(totalSets, 1)) / totalExercises) * 100;

  const completeSet = async () => {
    try {
      await api.post("/sessions/log-set", {
        session_id: sessionId,
        exercise_index: exIdx,
        set_index: setIdx,
        reps: Number(reps),
        weight_kg: Number(weight),
      });
    } catch (err) {
      toast.error("Logging fehlgeschlagen");
      return;
    }
    // Auto-advance
    if (isLastSet) {
      if (isLastExercise) {
        await finishWorkout();
      } else {
        const newEx = exIdx + 1;
        setExIdx(newEx);
        setSetIdx(0);
        persistProgress(newEx, 0);
        startRest(exercise.rest_seconds || 60);
      }
    } else {
      const newSet = setIdx + 1;
      setSetIdx(newSet);
      persistProgress(exIdx, newSet);
      startRest(exercise.rest_seconds || 60);
    }
  };

  const startRest = (sec) => {
    setRestLeft(sec);
    setRestTotal(sec);
    setRestPaused(false);
    setResting(true);
  };

  const skipRest = () => { setResting(false); setRestLeft(0); };

  const finishWorkout = async () => {
    setFinishing(true);
    try {
      const { data } = await api.post("/sessions/complete", { session_id: sessionId });
      setNewBadges(data.new_badges || []);
      setNewPRs(data.new_prs || []);
      setDone(true);
    } catch (err) {
      toast.error("Fehler beim Abschließen");
    } finally {
      setFinishing(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-grid opacity-25" />
      <div className="absolute inset-0 bg-radial-blue" />
      {/* Aurora backdrop — cranks up during rest */}
      <div className={`workout-aurora ${resting ? "workout-aurora--rest" : ""}`} aria-hidden />
      <div className="workout-grain" aria-hidden />

      {/* Top bar */}
      <div className="relative z-10 p-2 sm:p-6 flex items-center justify-between gap-2">
        <button onClick={() => navigate("/dashboard")} className="text-gray-400 hover:text-[#00BFFF] font-chakra uppercase tracking-widest text-xs flex-shrink-0 w-11 h-11 flex items-center justify-center sm:w-auto sm:px-3" data-testid="workout-exit-btn">
          <X size={20} /> <span className="hidden sm:inline ml-1">PAUSE</span>
        </button>
        <div className="font-teko text-base sm:text-2xl tracking-widest chrome-text text-center min-w-0 truncate">
          TAG {day.day_index} · <span className="electric-text glow-text-soft">{day.name}</span>
        </div>
        <div className="text-xs text-gray-500 font-chakra tracking-widest flex-shrink-0">
          {exIdx + 1}/{totalExercises}
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative z-10 h-[3px] bg-[#0A0A10] mx-3 sm:mx-4">
        <div className="h-full transition-all duration-500" style={{
          width: `${overallProgress}%`,
          background: "linear-gradient(90deg, #00E5FF, #00BFFF)",
          boxShadow: "0 0 12px rgba(0,229,255,0.8)",
        }} />
      </div>

      <main className="relative z-10 max-w-3xl mx-auto px-3 sm:px-4 py-4 sm:py-12">
        {resting ? (
          <div className="text-center py-2 sm:py-4" data-testid="rest-timer-view">
            <div className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-[0.4em] font-chakra mb-4">PAUSE</div>

            {/* ═══════ Rest-Timer Ring ═══════ */}
            <RestTimerRing
              value={restLeft}
              total={restTotal || 1}
              paused={restPaused}
              category={getRestCategory(day.exercises[exIdx])}
            />

            {(() => {
              const cat = getRestCategory(day.exercises[exIdx]);
              if (!cat) return null;
              return (
                <div className="mx-auto max-w-md mb-4 mt-6" data-testid="rest-category-badge">
                  <div
                    className="inline-flex items-center gap-2 px-3 py-1 border font-chakra text-[10px] sm:text-xs tracking-[0.25em] uppercase rounded-full"
                    style={{
                      borderColor: cat.color,
                      color: cat.color,
                      background: `${cat.color}12`,
                      boxShadow: `0 0 12px ${cat.color}55`,
                    }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: cat.color, boxShadow: `0 0 6px ${cat.color}` }} />
                    {cat.label}
                  </div>
                  <div className="text-gray-400 font-chakra text-xs sm:text-sm mt-2 px-2 leading-relaxed" data-testid="rest-category-hint">
                    {cat.hint}
                  </div>
                </div>
              );
            })()}
            <div className="flex justify-center gap-2 sm:gap-3 mt-6 sm:mt-8 flex-wrap">
              <button onClick={() => setRestPaused(!restPaused)} className="btn-outline flex items-center gap-2" data-testid="rest-pause-btn">
                {restPaused ? <Play size={16} /> : <Pause size={16} />}
                {restPaused ? "WEITER" : "PAUSE"}
              </button>
              <button onClick={skipRest} className="btn-primary flex items-center gap-2" data-testid="rest-skip-btn">
                <ChevronRight size={18} /> SKIP & WEITER
              </button>
            </div>
            <div className="mt-8 text-gray-400 font-chakra text-xs sm:text-sm">
              Nächste Übung: <span className="text-[#00BFFF] font-teko text-base tracking-wide">{day.exercises[exIdx]?.name}</span>
              <br /><span className="text-gray-500">Satz {setIdx + 1} von {totalSets}</span>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Exercise image */}
            <div className="relative w-full aspect-[16/9] sm:aspect-[16/8] overflow-hidden af-card clip-corner-tl-br" data-testid="exercise-image">
              <img
                src={getExerciseImage(exercise.name, exercise.target_muscle)}
                alt={exercise.name}
                onError={(e) => { if (!e.currentTarget.dataset.fallback) { e.currentTarget.dataset.fallback = "1"; e.currentTarget.src = "/exercises/group-full.webp"; } }}
                className="w-full h-full object-cover opacity-80"
              />
              <div className="absolute inset-0" style={{
                background: "linear-gradient(180deg, transparent 30%, rgba(0,0,0,0.95) 100%)",
              }} />
              <div className="absolute bottom-2 left-3 right-3 sm:bottom-3 sm:left-4 sm:right-4">
                <div className="text-[9px] sm:text-[10px] text-[#00BFFF] uppercase tracking-[0.3em] font-chakra">ÜBUNG {exIdx + 1} / {totalExercises}</div>
                <div className="font-teko text-2xl sm:text-4xl md:text-5xl chrome-text leading-none mt-1 break-words" data-testid="exercise-name">{exercise.name}</div>
                <div className="text-[#00BFFF] font-chakra uppercase tracking-widest text-[10px] sm:text-xs mt-1">{exercise.target_muscle}</div>
              </div>
              {/* Tutorial Video shortcut */}
              <button
                onClick={() => setShowVideo(true)}
                className="absolute top-2 right-2 sm:top-3 sm:right-3 px-2 sm:px-3 py-1.5 bg-black/70 border border-[#00BFFF]/60 hover:border-[#00BFFF] hover:bg-[#00BFFF]/10 transition flex items-center gap-1.5 backdrop-blur-sm"
                data-testid="active-video-btn"
                aria-label="Tutorial-Video"
              >
                <PlayCircle size={14} className="text-[#00BFFF]" />
                <span className="text-[10px] sm:text-xs font-chakra tracking-widest uppercase text-white">Video</span>
              </button>
              {/* Form-Check shortcut */}
              <button
                onClick={() => navigate(`/formcheck?exercise=${encodeURIComponent(exercise.name)}&muscle=${encodeURIComponent(exercise.target_muscle || "")}`)}
                className="absolute top-12 right-2 sm:top-14 sm:right-3 px-2 sm:px-3 py-1.5 bg-black/70 border border-[#00BFFF]/60 hover:border-[#00BFFF] hover:bg-[#00BFFF]/10 transition flex items-center gap-1.5 backdrop-blur-sm"
                data-testid="active-formcheck-btn"
                aria-label="Form-Check"
              >
                <Activity size={14} className="text-[#00BFFF]" />
                <span className="text-[10px] sm:text-xs font-chakra tracking-widest uppercase text-white">Form-Check</span>
              </button>
            </div>

            {exercise.notes && <div className="text-gray-500 text-xs sm:text-sm italic font-chakra text-center px-2">"{exercise.notes}"</div>}

            {/* KI Progression Suggestion */}
            {suggestion && (
              <div className="af-card p-3 sm:p-4 clip-corner-tl-br border-[#00BFFF]/40 glow-box" data-testid="progression-suggestion">
                <div className="flex items-start gap-2 sm:gap-3">
                  <Sparkles size={18} className="text-[#00E5FF] mt-0.5 flex-shrink-0" style={{ filter: "drop-shadow(0 0 8px rgba(0,229,255,0.8))" }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[9px] sm:text-[10px] text-[#00BFFF] uppercase tracking-[0.3em] font-chakra">KI EMPFEHLUNG</div>
                    <div className="font-chakra text-xs sm:text-sm mt-1 text-gray-200">{suggestion.message}</div>
                    {suggestion.has_history && (
                      <button
                        onClick={() => {
                          setWeight(suggestion.suggested_weight);
                          setReps(suggestion.suggested_reps);
                          toast.success("KI Empfehlung übernommen");
                        }}
                        className="mt-2 text-[10px] sm:text-xs text-[#00E5FF] hover:text-white font-chakra uppercase tracking-widest inline-flex items-center gap-1 flex-wrap"
                        data-testid="apply-suggestion-btn"
                      >
                        <TrendingUp size={12} /> ÜBERNEHMEN ({suggestion.suggested_weight}kg × {suggestion.suggested_reps})
                        {suggestion.delta_weight > 0 && <span className="text-[#00FF7F]"> +{suggestion.delta_weight}kg</span>}
                        {suggestion.delta_weight < 0 && <span className="text-yellow-500"> {suggestion.delta_weight}kg</span>}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="af-card p-4 sm:p-6 clip-corner-tl-br">
              <div className="grid grid-cols-3 text-center gap-2 mb-5 sm:mb-6">
                <div>
                  <div className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-widest font-chakra">SATZ</div>
                  <div className="font-teko text-3xl sm:text-4xl electric-text glow-text-soft mt-1" data-testid="current-set">{setIdx + 1}/{totalSets}</div>
                </div>
                <div>
                  <div className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-widest font-chakra">ZIEL WHDH.</div>
                  <div className="font-teko text-3xl sm:text-4xl chrome-text mt-1">{exercise.reps}</div>
                </div>
                <div>
                  <div className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-widest font-chakra">PAUSE</div>
                  <div className="font-teko text-3xl sm:text-4xl chrome-text mt-1">{exercise.rest_seconds}s</div>
                </div>
              </div>

              {/* Input controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <NumberStepper label="WIEDERHOLUNGEN" value={reps} onChange={setReps} step={1} testid="reps-input" />
                <NumberStepper label="GEWICHT (KG)" value={weight} onChange={setWeight} step={2.5} testid="weight-input" />
              </div>

              <button onClick={completeSet} disabled={finishing} className="btn-primary w-full mt-5 sm:mt-6 text-base sm:text-xl flex items-center justify-center gap-2" data-testid="complete-set-btn">
                {finishing ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}
                SATZ ABSCHLIESSEN
              </button>
            </div>

            {/* Up next preview */}
            {!isLastExercise && (
              <div className="text-center text-xs text-gray-500 font-chakra uppercase tracking-widest">
                ALS NÄCHSTES: <span className="text-[#00BFFF]">{day.exercises[exIdx+1]?.name}</span>
              </div>
            )}
          </div>
        )}
      </main>
      {showVideo && (
        <ExerciseVideoModal
          exerciseName={exercise.name}
          muscle={exercise.target_muscle}
          onClose={() => setShowVideo(false)}
        />
      )}
    </div>
  );
}

function NumberStepper({ label, value, onChange, step, testid }) {
  return (
    <div>
      <div className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-widest font-chakra mb-2">{label}</div>
      <div className="flex items-stretch gap-2 h-12 sm:h-14">
        <button onClick={() => onChange(Math.max(0, Number(value) - step))} className="w-12 sm:w-14 border border-[#1A1A24] hover:border-[#00BFFF] active:bg-[#00BFFF]/10 font-teko text-2xl text-[#00BFFF] transition flex-shrink-0 flex items-center justify-center" data-testid={`${testid}-minus`}>−</button>
        <input
          type="number"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="bg-[#0A0A10] border border-[#1A1A24] text-center font-chakra text-2xl text-white flex-1 min-w-0 outline-none focus:border-[#00BFFF] transition"
          style={{ fontFamily: "'Chakra Petch', sans-serif", fontSize: "20px", lineHeight: "1" }}
          data-testid={testid}
        />
        <button onClick={() => onChange(Number(value) + step)} className="w-12 sm:w-14 border border-[#1A1A24] hover:border-[#00BFFF] active:bg-[#00BFFF]/10 font-teko text-2xl text-[#00BFFF] transition flex-shrink-0 flex items-center justify-center" data-testid={`${testid}-plus`}>+</button>
      </div>
    </div>
  );
}

function FullScreenLoader({ text }) {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <Loader2 size={40} className="animate-spin text-[#00BFFF] mx-auto" />
        <div className="font-teko text-2xl tracking-widest text-[#00BFFF] mt-4 glow-text">{text}</div>
      </div>
    </div>
  );
}

function CompleteView({ newBadges, newPRs = [], onClose }) {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-grid opacity-30" />
      <div className="absolute inset-0 bg-radial-blue" />
      <div className="relative z-10 text-center max-w-xl w-full" data-testid="workout-complete-view">
        <Trophy size={64} className="mx-auto text-[#00E5FF] sm:hidden" style={{ filter: "drop-shadow(0 0 24px rgba(0,229,255,1))" }} />
        <Trophy size={80} className="mx-auto text-[#00E5FF] hidden sm:block" style={{ filter: "drop-shadow(0 0 24px rgba(0,229,255,1))" }} />
        <h1 className="font-teko text-4xl sm:text-6xl lg:text-7xl mt-4 electric-text glow-text leading-[0.95] tracking-wide">
          TRAINING<br />ABGESCHLOSSEN
        </h1>
        <p className="text-gray-400 font-chakra text-sm sm:text-base mt-3 px-2">Du hast geliefert. Alpha-Mode aktiviert.</p>

        {newBadges.length > 0 && (
          <div className="mt-8 af-card p-5 sm:p-6 clip-corner-tl-br" data-testid="new-badges-section">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Sparkles size={14} className="text-[#FFD700]" style={{filter: "drop-shadow(0 0 6px #FFD70088)"}} />
              <div className="text-[#FFD700] uppercase tracking-widest text-[11px] sm:text-xs font-chakra">
                {newBadges.length === 1 ? "NEUER BADGE FREIGESCHALTET" : `${newBadges.length} NEUE BADGES FREIGESCHALTET`}
              </div>
              <Sparkles size={14} className="text-[#FFD700]" style={{filter: "drop-shadow(0 0 6px #FFD70088)"}} />
            </div>
            <div className="text-[10px] text-gray-400 font-chakra mb-4">Tippe oder schau zu wie sie animieren.</div>
            <div className="flex flex-wrap justify-center gap-4 sm:gap-6">
              {newBadges.map((b) => (
                <BadgeGlow key={b.id} badge={b} />
              ))}
            </div>
          </div>
        )}

        {newPRs.length > 0 && (
          <div className="mt-8 af-card p-4 sm:p-6 clip-corner-tl-br" data-testid="new-prs-section">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Trophy size={14} className="text-[#FFD700]" style={{filter: "drop-shadow(0 0 6px #FFD70088)"}} />
              <div className="text-[#FFD700] uppercase tracking-widest text-[11px] sm:text-xs font-chakra">
                {newPRs.length === 1 ? "NEUER PERSONAL RECORD" : `${newPRs.length} NEUE PERSONAL RECORDS`}
              </div>
              <Trophy size={14} className="text-[#FFD700]" style={{filter: "drop-shadow(0 0 6px #FFD70088)"}} />
            </div>
            <div className="text-[10px] text-gray-400 font-chakra mb-5">Sammelkarten zum Teilen — tap auf TEILEN oder DOWNLOAD.</div>
            <div className="flex flex-wrap justify-center gap-6">
              {newPRs.map((pr) => (
                <PRCard key={pr.id} pr={pr} />
              ))}
            </div>
          </div>
        )}

        <button onClick={onClose} className="btn-primary mt-8" data-testid="workout-done-btn">ZURÜCK ZUM DASHBOARD</button>
      </div>
    </div>
  );
}


/* ═══════════════════ Rest-Timer Ring ═══════════════════
 * Circular SVG progress ring with animated gradient stroke,
 * inner glow, and category-tinted breathing pulse. Mobile-first.
 */
function RestTimerRing({ value, total, paused, category }) {
  const clamped = Math.max(0, Math.min(value, total));
  const pct = 1 - clamped / Math.max(total, 1); // 0 = full, 1 = empty
  const size = 260;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const dashOffset = circ * pct;
  const color = category?.color || "#00BFFF";
  const urgent = clamped <= 5;

  return (
    <div
      className={`rest-ring-wrap ${paused ? "rest-ring-wrap--paused" : ""} ${urgent ? "rest-ring-wrap--urgent" : ""}`}
      style={{ "--ring-color": color }}
      data-testid="rest-timer-ring"
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rest-ring-svg">
        <defs>
          <linearGradient id="rt-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00E5FF" />
            <stop offset="50%" stopColor={color} />
            <stop offset="100%" stopColor="#9333EA" />
          </linearGradient>
          <filter id="rt-glow">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={stroke}
        />
        {/* Progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#rt-grad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={dashOffset}
          filter="url(#rt-glow)"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.4, 0, 0.2, 1)" }}
        />
      </svg>
      <div className="rest-ring-center">
        <div className="rest-ring-value" data-testid="rest-countdown">{clamped}</div>
        <div className="rest-ring-label">SEK</div>
      </div>
    </div>
  );
}
