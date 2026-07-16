import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Layout from "../components/Layout";
import api from "../lib/api";
import { useAuth } from "../lib/auth";
import { toast } from "sonner";
import { Camera, Loader2, Crown, ShieldAlert, Activity, Check, AlertTriangle, Sparkles, Target, Trash2, ChevronRight, Eye } from "lucide-react";

export default function FormCheck() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialExercise = searchParams.get("exercise") || "";
  const initialMuscle = searchParams.get("muscle") || "";

  const [exercise, setExercise] = useState(initialExercise);
  const [muscle, setMuscle] = useState(initialMuscle);
  const [notes, setNotes] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [current, setCurrent] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadingHist, setLoadingHist] = useState(true);
  const fileRef = useRef(null);

  const isPremium = !!user?.is_premium;

  const loadHistory = async () => {
    try {
      const { data } = await api.get("/formcheck/history");
      setHistory(data.checks || []);
    } catch {
      // 403 or net error -> empty
    } finally {
      setLoadingHist(false);
    }
  };

  useEffect(() => {
    if (!isPremium) { setLoadingHist(false); return; }
    loadHistory();
  }, [isPremium]);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!exercise.trim()) {
      toast.error("Bitte zuerst Übung auswählen");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Bild zu groß (max 8 MB)");
      return;
    }
    setAnalyzing(true);
    setCurrent(null);
    try {
      const b64 = await fileToBase64(file);
      const { data } = await api.post("/formcheck/analyze", {
        image_base64: b64,
        exercise_name: exercise.trim(),
        target_muscle: muscle.trim(),
        notes: notes.trim(),
      });
      setCurrent(data);
      toast.success("Analyse abgeschlossen");
      setNotes("");
      await loadHistory();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "KI-Analyse fehlgeschlagen");
    } finally {
      setAnalyzing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const deleteCheck = async (id) => {
    if (!window.confirm("Diesen Form-Check löschen?")) return;
    await api.delete(`/formcheck/${id}`);
    if (current?.id === id) setCurrent(null);
    loadHistory();
  };

  // Premium gate
  if (!isPremium) {
    return (
      <Layout>
        <Header />
        <div className="af-card p-6 sm:p-10 clip-corner-tl-br text-center max-w-2xl mx-auto gold-glow-box gold-border" data-testid="formcheck-premium-gate">
          <Crown size={48} className="mx-auto text-[#E0B968] mb-4" style={{ filter: "drop-shadow(0 0 12px rgba(224,185,104,0.7))" }} />
          <h2 className="font-teko text-3xl sm:text-4xl gold-chrome mb-2">PREMIUM FEATURE</h2>
          <p className="text-body font-chakra text-sm mb-6 leading-relaxed">
            Form-Check analysiert deine Ausführung per KI-Vision: Technik-Score, Sicherheits-Score, konkrete Tipps.
          </p>
          <button onClick={() => navigate("/premium")} className="btn-gold inline-flex items-center gap-2" data-testid="formcheck-upgrade-btn">
            <Crown size={16} /> JETZT FREISCHALTEN
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Header />

      {/* Disclaimer */}
      <div className="border border-[#FF4500]/30 bg-[#FF4500]/5 p-3 sm:p-4 mb-5 sm:mb-6 flex gap-3 items-start" data-testid="formcheck-disclaimer">
        <ShieldAlert size={18} className="text-[#FF4500] flex-shrink-0 mt-0.5" />
        <div className="text-xs sm:text-sm text-body font-chakra leading-relaxed">
          <strong className="text-[#FF4500]">Hinweis:</strong> Foto-basierte Form-Analyse ist eine
          KI-Einschätzung, kein medizinischer/physiotherapeutischer Rat. Bei Schmerzen sofort abbrechen.
          Dein Foto wird <strong className="text-[#FF4500]">nicht gespeichert</strong>.
        </div>
      </div>

      {/* Setup + Upload */}
      <div className="af-card p-5 sm:p-6 clip-corner-tl-br mb-5 sm:mb-6" data-testid="formcheck-upload">
        <div className="flex items-center gap-3 mb-3">
          <Sparkles size={20} className="text-[#FF4500]" />
          <h2 className="font-teko text-2xl sm:text-3xl chrome-text">NEUER FORM-CHECK</h2>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 mb-3">
          <input
            value={exercise}
            onChange={(e) => setExercise(e.target.value.slice(0, 100))}
            placeholder="Übung (z.B. Bankdrücken) *"
            className="af-input"
            data-testid="formcheck-exercise-input"
          />
          <input
            value={muscle}
            onChange={(e) => setMuscle(e.target.value.slice(0, 60))}
            placeholder="Zielmuskel (optional)"
            className="af-input"
            data-testid="formcheck-muscle-input"
          />
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value.slice(0, 300))}
          placeholder="Notiz (optional): z.B. 'Phase: Stange auf Brust'"
          className="w-full bg-black border border-[#1A1A24] focus:border-[#FF4500] outline-none p-3 text-sm font-chakra text-white mb-3 resize-none transition"
          rows={2}
          data-testid="formcheck-notes-input"
        />

        <button
          onClick={() => fileRef.current?.click()}
          disabled={analyzing || !exercise.trim()}
          className="w-full af-card p-6 clip-corner-tl-br hover:glow-box transition tracing-border text-center disabled:opacity-50"
          data-testid="formcheck-upload-btn"
        >
          {analyzing ? (
            <>
              <Loader2 size={36} className="mx-auto animate-spin text-[#FF4500]" />
              <div className="font-teko text-xl mt-3 chrome-text">ANALYSIERE FORM...</div>
              <div className="text-[10px] text-gray-500 font-chakra mt-1">KI prüft Technik, Haltung, Risiko</div>
            </>
          ) : (
            <>
              <Camera size={36} className="mx-auto text-[#FF4500]" style={{ filter: "drop-shadow(0 0 10px rgba(255,69,0,0.6))" }} />
              <div className="font-teko text-xl mt-3 chrome-text">FOTO HOCHLADEN</div>
              <div className="text-[10px] text-gray-500 font-chakra mt-1">{exercise.trim() ? "Foto während der Übung aufnehmen" : "Erst Übung eingeben"}</div>
            </>
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onFile}
          className="hidden"
          data-testid="formcheck-file-input"
        />
      </div>

      {/* Current result */}
      {current && <ResultCard check={current} highlighted />}

      {/* History */}
      <div className="af-card p-4 sm:p-6 clip-corner-tl-br" data-testid="formcheck-history">
        <h2 className="font-teko text-2xl sm:text-3xl chrome-text mb-4">VERLAUF ({history.length})</h2>
        {loadingHist ? (
          <div className="text-center py-6"><Loader2 size={24} className="animate-spin text-[#FF4500] mx-auto" /></div>
        ) : history.length === 0 ? (
          <div className="text-body-muted font-chakra py-6 text-sm text-center">
            Noch keine Form-Checks. Lade dein erstes Foto hoch!
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((c) => (
              <div key={c.id}
                className={`border p-3 sm:p-4 flex items-center gap-3 transition cursor-pointer ${
                  current?.id === c.id ? "border-[#FF4500] bg-[#FF4500]/5 glow-box" : "border-[#1A1A24] hover:border-[#FF4500]/50"
                }`}
                onClick={() => { setCurrent(c); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                data-testid={`formcheck-history-item-${c.id}`}
              >
                <div className={`w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center font-teko text-xl border ${scoreToColor(c.form_score)}`}>
                  {c.form_score}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-teko text-base sm:text-lg chrome-text truncate">{c.exercise_recognized || c.exercise_name}</div>
                  <div className="text-[10px] sm:text-xs text-gray-500 font-chakra">
                    {formatDate(c.created_at)} · Sicherheit {c.safety_score}/10
                  </div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); setCurrent(c); }} className="text-gray-500 hover:text-[#FF4500] p-2" aria-label="Details">
                  <ChevronRight size={18} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); deleteCheck(c.id); }} className="text-gray-500 hover:text-red-400 p-2" aria-label="Löschen">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

function Header() {
  return (
    <div className="flex items-center gap-3 mb-5 sm:mb-6 flex-wrap">
      <Activity size={28} className="text-[#FF4500]" style={{ filter: "drop-shadow(0 0 12px rgba(255,69,0,0.6))" }} />
      <h1 className="font-teko text-3xl sm:text-5xl chrome-text">FORM-CHECK</h1>
      <span className="text-[10px] text-[#FF4500] border border-[#FF4500]/50 px-2 py-0.5 font-chakra uppercase tracking-widest">PREMIUM</span>
    </div>
  );
}

function ResultCard({ check, highlighted }) {
  return (
    <div className={`af-card p-5 sm:p-6 clip-corner-tl-br mb-5 sm:mb-6 ${highlighted ? "glow-box border-[#FF4500]" : ""}`} data-testid="formcheck-result">
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div>
          <div className="text-[10px] text-gray-500 uppercase tracking-widest font-chakra">ERGEBNIS · {formatDate(check.created_at)}</div>
          <div className="font-teko text-2xl sm:text-3xl chrome-text">{check.exercise_recognized || check.exercise_name}</div>
          {check.phase && <div className="text-xs text-[#FF4500] font-chakra mt-1">Phase: {check.phase}</div>}
        </div>
        <div className="flex gap-3">
          <ScoreBadge label="TECHNIK" value={check.form_score} />
          <ScoreBadge label="SICHERHEIT" value={check.safety_score} />
        </div>
      </div>

      {/* Primary correction */}
      {check.primary_correction && (
        <div className="border border-[#FF4500]/40 bg-[#FF4500]/5 p-3 sm:p-4 mb-4 flex items-start gap-3">
          <Target size={18} className="text-[#FF4500] flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-[10px] text-[#FF4500] uppercase tracking-widest font-chakra">WICHTIGSTE KORREKTUR</div>
            <div className="font-teko text-xl sm:text-2xl chrome-text mt-0.5">{check.primary_correction}</div>
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-3 mb-4">
        {/* Issues */}
        <div className="border border-orange-500/30 bg-orange-500/5 p-3" data-testid="formcheck-issues">
          <div className="text-[10px] text-orange-400 uppercase tracking-widest font-chakra mb-2 flex items-center gap-1">
            <AlertTriangle size={12} /> FEHLER
          </div>
          <ul className="space-y-1.5">
            {(check.issues || []).map((s, i) => (
              <li key={i} className="prose-af font-chakra text-sm">• {s}</li>
            ))}
            {(!check.issues || check.issues.length === 0) && <li className="text-gray-500 text-sm">Keine erkannt — top!</li>}
          </ul>
        </div>
        {/* Good points */}
        <div className="border border-green-500/30 bg-green-500/5 p-3" data-testid="formcheck-good">
          <div className="text-[10px] text-green-400 uppercase tracking-widest font-chakra mb-2 flex items-center gap-1">
            <Check size={12} /> GUT GEMACHT
          </div>
          <ul className="space-y-1.5">
            {(check.good_points || []).map((s, i) => (
              <li key={i} className="prose-af font-chakra text-sm">• {s}</li>
            ))}
            {(!check.good_points || check.good_points.length === 0) && <li className="text-gray-500 text-sm">—</li>}
          </ul>
        </div>
      </div>

      {/* Tips */}
      <div className="border border-[#FF4500]/30 bg-[#FF4500]/5 p-3 sm:p-4" data-testid="formcheck-tips">
        <div className="text-[10px] text-[#FF4500] uppercase tracking-widest font-chakra mb-2 flex items-center gap-1">
          <Sparkles size={12} /> KI-TIPPS
        </div>
        <ul className="space-y-2">
          {(check.tips || []).map((s, i) => (
            <li key={i} className="prose-af font-chakra flex items-start gap-2">
              <Eye size={14} className="text-[#FF4500] mt-1 flex-shrink-0" />
              <span>{s}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="text-[10px] text-gray-600 font-chakra mt-3 text-right">Konfidenz: {(check.confidence * 100).toFixed(0)}%</div>
    </div>
  );
}

function ScoreBadge({ label, value }) {
  const colorClass = scoreToColor(value);
  return (
    <div className="text-center">
      <div className="text-[10px] text-gray-500 uppercase tracking-widest font-chakra">{label}</div>
      <div className={`font-teko text-3xl border w-14 h-14 flex items-center justify-center mt-1 ${colorClass}`}>{value}</div>
    </div>
  );
}

function scoreToColor(score) {
  if (score >= 8) return "border-green-400 text-green-400";
  if (score >= 5) return "border-[#FF4500] text-[#FF4500]";
  return "border-orange-400 text-orange-400";
}

function formatDate(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("de-DE", { day: "2-digit", month: "short" }) + " " +
      d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
