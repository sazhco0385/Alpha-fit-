import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../lib/api";
import { Check, X, Pause, Play, ChevronRight, Loader2, Flame, Trophy } from "lucide-react";
import { toast } from "sonner";

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
  const [resting, setResting] = useState(false);
  const [restLeft, setRestLeft] = useState(0);
  const [restPaused, setRestPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [finishing, setFinishing] = useState(false);
  const [done, setDone] = useState(false);
  const [newBadges, setNewBadges] = useState([]);
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

  // when exercise changes, set default reps/weight
  useEffect(() => {
    if (day?.exercises?.[exIdx]) {
      setReps(day.exercises[exIdx].reps);
      setWeight(day.exercises[exIdx].weight_kg);
    }
  }, [exIdx, day]);

  // Rest timer
  useEffect(() => {
    if (!resting || restPaused) return;
    restRef.current = setInterval(() => {
      setRestLeft((p) => {
        if (p <= 1) {
          clearInterval(restRef.current);
          setResting(false);
          return 0;
        }
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
  if (done) return <CompleteView newBadges={newBadges} onClose={() => navigate("/dashboard")} />;

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
    setRestPaused(false);
    setResting(true);
  };

  const skipRest = () => { setResting(false); setRestLeft(0); };

  const finishWorkout = async () => {
    setFinishing(true);
    try {
      const { data } = await api.post("/sessions/complete", { session_id: sessionId });
      setNewBadges(data.new_badges || []);
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

      {/* Top bar */}
      <div className="relative z-10 p-4 md:p-6 flex items-center justify-between">
        <button onClick={() => navigate("/dashboard")} className="text-gray-400 hover:text-[#00BFFF] font-chakra uppercase tracking-widest text-xs" data-testid="workout-exit-btn">
          <X size={20} className="inline mr-1" /> PAUSE
        </button>
        <div className="font-teko text-2xl tracking-widest chrome-text">
          TAG {day.day_index} · <span className="electric-text glow-text-soft">{day.name}</span>
        </div>
        <div className="text-xs text-gray-500 font-chakra tracking-widest">
          {exIdx + 1}/{totalExercises}
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative z-10 h-[3px] bg-[#0A0A10] mx-4">
        <div className="h-full transition-all duration-500" style={{
          width: `${overallProgress}%`,
          background: "linear-gradient(90deg, #00E5FF, #00BFFF)",
          boxShadow: "0 0 12px rgba(0,229,255,0.8)",
        }} />
      </div>

      <main className="relative z-10 max-w-3xl mx-auto px-4 py-6 md:py-12">
        {resting ? (
          <div className="text-center py-8" data-testid="rest-timer-view">
            <div className="text-xs text-gray-500 uppercase tracking-[0.3em] font-chakra">PAUSE</div>
            <div className="my-6 relative inline-block">
              <div className="font-teko text-9xl md:text-[180px] electric-text glow-text leading-none" data-testid="rest-countdown">
                {restLeft}
              </div>
              <div className="text-2xl font-teko chrome-text tracking-widest">SEKUNDEN</div>
            </div>
            <div className="flex justify-center gap-3 mt-8">
              <button onClick={() => setRestPaused(!restPaused)} className="btn-outline flex items-center gap-2" data-testid="rest-pause-btn">
                {restPaused ? <Play size={16} /> : <Pause size={16} />}
                {restPaused ? "WEITER" : "PAUSE"}
              </button>
              <button onClick={skipRest} className="btn-primary flex items-center gap-2" data-testid="rest-skip-btn">
                <ChevronRight size={18} /> SKIP & WEITER
              </button>
            </div>
            <div className="mt-10 text-gray-500 font-chakra text-sm">
              Nächste Übung: <span className="text-[#00BFFF]">{day.exercises[exIdx]?.name}</span>
              <br />Satz {setIdx + 1} von {totalSets}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Exercise card */}
            <div className="text-center">
              <div className="text-xs text-gray-500 uppercase tracking-[0.3em] font-chakra">ÜBUNG {exIdx + 1}</div>
              <h1 className="font-teko text-5xl md:text-7xl mt-2 chrome-text tracking-wide" data-testid="exercise-name">{exercise.name}</h1>
              <div className="text-[#00BFFF] font-chakra uppercase tracking-widest text-sm mt-2">{exercise.target_muscle}</div>
              {exercise.notes && <div className="text-gray-500 text-sm mt-2 italic font-chakra">"{exercise.notes}"</div>}
            </div>

            <div className="af-card p-6 clip-corner-tl-br">
              <div className="grid grid-cols-3 text-center gap-2 mb-6">
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-widest font-chakra">SATZ</div>
                  <div className="font-teko text-4xl electric-text glow-text-soft mt-1" data-testid="current-set">{setIdx + 1}/{totalSets}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-widest font-chakra">ZIEL WHDH.</div>
                  <div className="font-teko text-4xl chrome-text mt-1">{exercise.reps}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-widest font-chakra">PAUSE</div>
                  <div className="font-teko text-4xl chrome-text mt-1">{exercise.rest_seconds}s</div>
                </div>
              </div>

              {/* Input controls */}
              <div className="grid grid-cols-2 gap-4">
                <NumberStepper label="WIEDERHOLUNGEN" value={reps} onChange={setReps} step={1} testid="reps-input" />
                <NumberStepper label="GEWICHT (KG)" value={weight} onChange={setWeight} step={2.5} testid="weight-input" />
              </div>

              <button onClick={completeSet} disabled={finishing} className="btn-primary w-full mt-6 text-xl flex items-center justify-center gap-2" data-testid="complete-set-btn">
                {finishing ? <Loader2 size={20} className="animate-spin" /> : <Check size={22} />}
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
    </div>
  );
}

function NumberStepper({ label, value, onChange, step, testid }) {
  return (
    <div>
      <div className="text-xs text-gray-500 uppercase tracking-widest font-chakra mb-2">{label}</div>
      <div className="flex items-center gap-2">
        <button onClick={() => onChange(Math.max(0, Number(value) - step))} className="w-12 h-12 border border-[#1A1A24] hover:border-[#00BFFF] font-teko text-2xl text-[#00BFFF] transition" data-testid={`${testid}-minus`}>-</button>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="af-input text-center font-teko text-3xl flex-1"
          data-testid={testid}
        />
        <button onClick={() => onChange(Number(value) + step)} className="w-12 h-12 border border-[#1A1A24] hover:border-[#00BFFF] font-teko text-2xl text-[#00BFFF] transition" data-testid={`${testid}-plus`}>+</button>
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

function CompleteView({ newBadges, onClose }) {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-grid opacity-30" />
      <div className="absolute inset-0 bg-radial-blue" />
      <div className="relative z-10 text-center max-w-xl" data-testid="workout-complete-view">
        <Trophy size={80} className="mx-auto text-[#00E5FF]" style={{ filter: "drop-shadow(0 0 24px rgba(0,229,255,1))" }} />
        <h1 className="font-teko text-7xl mt-4 electric-text glow-text">TRAINING ABGESCHLOSSEN</h1>
        <p className="text-gray-400 font-chakra mt-2">Du hast geliefert. Alpha-Mode aktiviert.</p>

        {newBadges.length > 0 && (
          <div className="mt-8 af-card p-6 clip-corner-tl-br" data-testid="new-badges-section">
            <div className="text-[#00BFFF] uppercase tracking-widest text-xs font-chakra mb-3">NEUE BADGES FREIGESCHALTET</div>
            <div className="flex flex-wrap justify-center gap-4">
              {newBadges.map((b) => (
                <div key={b.id} className="text-center">
                  <Flame size={36} className="text-[#FFD700] mx-auto" style={{ filter: "drop-shadow(0 0 12px rgba(255,215,0,0.8))" }} />
                  <div className="font-teko text-lg mt-1 chrome-text">{b.title}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <button onClick={onClose} className="btn-primary mt-8" data-testid="workout-done-btn">ZURÜCK ZUM DASHBOARD</button>
      </div>
    </div>
  );
}
