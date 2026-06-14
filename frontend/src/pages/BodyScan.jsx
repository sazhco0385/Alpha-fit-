import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import api from "../lib/api";
import { useAuth } from "../lib/auth";
import { toast } from "sonner";
import {
  Scan,
  Camera,
  Loader2,
  Trash2,
  Crown,
  Sparkles,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight,
  ShieldAlert,
  X,
} from "lucide-react";

const MUSCLES = [
  { key: "chest", label: "Brust" },
  { key: "shoulders", label: "Schultern" },
  { key: "back", label: "Rücken" },
  { key: "arms", label: "Arme" },
  { key: "core", label: "Bauch" },
  { key: "legs", label: "Beine" },
  { key: "glutes", label: "Gesäß" },
];

export default function BodyScan() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [current, setCurrent] = useState(null); // latest result shown after scan
  const [compareIds, setCompareIds] = useState([]); // up to 2 scan IDs
  const [notes, setNotes] = useState("");
  const fileRef = useRef(null);

  const isPremium = !!user?.is_premium;

  const load = async () => {
    try {
      const { data } = await api.get("/bodyscan/history");
      setScans(data.scans || []);
    } catch (err) {
      if (err?.response?.status === 403) {
        // not premium - keep list empty
      } else {
        toast.error("Verlauf konnte nicht geladen werden");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isPremium) {
      setLoading(false);
      return;
    }
    load();
  }, [isPremium]);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Bild zu groß (max 8 MB)");
      return;
    }
    setAnalyzing(true);
    setCurrent(null);
    try {
      const b64 = await fileToBase64(file);
      const { data } = await api.post("/bodyscan/analyze", {
        image_base64: b64,
        notes: notes.trim(),
      });
      setCurrent(data);
      setNotes("");
      toast.success("Analyse abgeschlossen");
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "KI-Analyse fehlgeschlagen");
    } finally {
      setAnalyzing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const deleteScan = async (id) => {
    if (!window.confirm("Diesen Scan endgültig löschen?")) return;
    await api.delete(`/bodyscan/${id}`);
    toast.success("Gelöscht");
    setCompareIds((prev) => prev.filter((x) => x !== id));
    if (current?.id === id) setCurrent(null);
    load();
  };

  const toggleCompare = (id) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  };

  // PREMIUM GATE
  if (!isPremium) {
    return (
      <Layout>
        <PageHeader />
        <div className="af-card p-6 sm:p-10 clip-corner-tl-br text-center max-w-2xl mx-auto" data-testid="bodyscan-premium-gate">
          <Crown size={48} className="mx-auto text-[#00BFFF] mb-4" style={{ filter: "drop-shadow(0 0 12px rgba(0,191,255,0.7))" }} />
          <h2 className="font-teko text-3xl sm:text-4xl chrome-text mb-2">PREMIUM FEATURE</h2>
          <p className="text-gray-400 font-chakra text-sm mb-6 leading-relaxed">
            AI Body Scan analysiert dein Foto, schätzt Muskelentwicklung,
            Körperfett, Symmetrie und gibt dir Empfehlungen.
            Nur für Premium-Mitglieder verfügbar.
          </p>
          <button
            onClick={() => navigate("/premium")}
            className="btn-primary inline-flex items-center gap-2"
            data-testid="bodyscan-upgrade-btn"
          >
            <Crown size={16} /> JETZT FREISCHALTEN
          </button>
        </div>
      </Layout>
    );
  }

  const compareLeft = compareIds[0] ? scans.find((s) => s.id === compareIds[0]) : null;
  const compareRight = compareIds[1] ? scans.find((s) => s.id === compareIds[1]) : null;

  return (
    <Layout>
      <PageHeader />

      {/* Disclaimer */}
      <div
        className="border border-[#00BFFF]/30 bg-[#00BFFF]/5 p-3 sm:p-4 mb-5 sm:mb-6 flex gap-3 items-start"
        data-testid="bodyscan-disclaimer"
      >
        <ShieldAlert size={18} className="text-[#00BFFF] flex-shrink-0 mt-0.5" />
        <div className="text-xs sm:text-sm text-gray-300 font-chakra leading-relaxed">
          <strong className="text-[#00BFFF]">Hinweis:</strong> Diese Analyse ist
          eine <strong>Fitness-Einschätzung</strong>, keine medizinische Diagnose.
          Werte sind Schätzungen aus einem Foto – nutze sie zur Trendbeobachtung,
          nicht als absolute Wahrheit.
        </div>
      </div>

      {/* Upload action */}
      <div className="af-card p-5 sm:p-6 clip-corner-tl-br mb-5 sm:mb-6" data-testid="bodyscan-upload">
        <div className="flex items-center gap-3 mb-3">
          <Sparkles size={20} className="text-[#00BFFF]" />
          <h2 className="font-teko text-2xl sm:text-3xl chrome-text">NEUER SCAN</h2>
        </div>
        <p className="text-xs sm:text-sm text-gray-400 font-chakra mb-4">
          Foto in Sportkleidung (T-Shirt/Tanktop & Shorts), gerade Pose, gute Beleuchtung.
          Dein Foto wird <strong className="text-[#00BFFF]">nicht gespeichert</strong> – nur die Analyse.
        </p>

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value.slice(0, 300))}
          placeholder="Notiz (optional): z.B. 'Nach 6 Wochen Cut'"
          className="w-full bg-black border border-[#1A1A24] focus:border-[#00BFFF] outline-none p-3 text-sm font-chakra text-white mb-3 resize-none transition"
          rows={2}
          data-testid="bodyscan-notes-input"
        />

        <button
          onClick={() => fileRef.current?.click()}
          disabled={analyzing}
          className="w-full af-card p-6 clip-corner-tl-br hover:glow-box transition tracing-border text-center disabled:opacity-50"
          data-testid="bodyscan-upload-btn"
        >
          {analyzing ? (
            <>
              <Loader2 size={36} className="mx-auto animate-spin text-[#00BFFF]" />
              <div className="font-teko text-xl mt-3 chrome-text">ANALYSIERE...</div>
              <div className="text-[10px] text-gray-500 font-chakra mt-1">KI prüft Muskelgruppen, Symmetrie & Schwachstellen</div>
            </>
          ) : (
            <>
              <Camera size={36} className="mx-auto text-[#00BFFF]" style={{ filter: "drop-shadow(0 0 10px rgba(0,191,255,0.6))" }} />
              <div className="font-teko text-xl mt-3 chrome-text">FOTO HOCHLADEN</div>
              <div className="text-[10px] text-gray-500 font-chakra mt-1">KI-Body-Analyse starten</div>
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
          data-testid="bodyscan-file-input"
        />
      </div>

      {/* Current scan result */}
      {current && <ScanResultCard scan={current} highlighted />}

      {/* Compare view */}
      {compareLeft && compareRight && (
        <CompareView left={compareLeft} right={compareRight} onClose={() => setCompareIds([])} />
      )}

      {/* History */}
      <div className="af-card p-4 sm:p-6 clip-corner-tl-br" data-testid="bodyscan-history">
        <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
          <h2 className="font-teko text-2xl sm:text-3xl chrome-text">VERLAUF ({scans.length})</h2>
          {compareIds.length > 0 && (
            <button
              onClick={() => setCompareIds([])}
              className="text-xs text-gray-400 hover:text-[#00BFFF] flex items-center gap-1 font-chakra"
              data-testid="bodyscan-clear-compare"
            >
              <X size={12} /> Auswahl löschen ({compareIds.length}/2)
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-6">
            <Loader2 size={24} className="animate-spin text-[#00BFFF] mx-auto" />
          </div>
        ) : scans.length === 0 ? (
          <div className="text-center text-gray-500 font-chakra py-6 text-sm">
            Noch keine Scans. Lade dein erstes Foto hoch!
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-[10px] text-gray-500 font-chakra uppercase tracking-widest">
              Tippe 2 Scans an für Vergleich
            </div>
            {scans.map((s) => {
              const selected = compareIds.includes(s.id);
              return (
                <div
                  key={s.id}
                  className={`border p-3 sm:p-4 flex items-center gap-3 cursor-pointer transition ${
                    selected
                      ? "border-[#00BFFF] bg-[#00BFFF]/5 glow-box"
                      : "border-[#1A1A24] hover:border-[#00BFFF]/50"
                  }`}
                  onClick={() => toggleCompare(s.id)}
                  data-testid={`bodyscan-history-item-${s.id}`}
                >
                  <div className={`w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center font-teko text-xl sm:text-2xl border ${
                    selected ? "border-[#00BFFF] text-[#00BFFF]" : "border-[#1A1A24] text-gray-300"
                  }`}>
                    {s.overall_score}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-teko text-base sm:text-lg chrome-text">
                      {formatDate(s.created_at)}
                    </div>
                    <div className="text-[10px] sm:text-xs text-gray-500 font-chakra truncate">
                      KFA {s.body_fat_estimate}% · Symmetrie {s.symmetry_score}/10
                      {s.notes ? ` · ${s.notes}` : ""}
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setCurrent(s); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    className="text-gray-500 hover:text-[#00BFFF] p-2"
                    aria-label="Details"
                    data-testid={`bodyscan-view-${s.id}`}
                  >
                    <ChevronRight size={18} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteScan(s.id); }}
                    className="text-gray-500 hover:text-red-400 p-2"
                    aria-label="Löschen"
                    data-testid={`bodyscan-delete-${s.id}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}

function PageHeader() {
  return (
    <div className="flex items-center gap-3 mb-5 sm:mb-6 flex-wrap">
      <Scan size={28} className="text-[#00BFFF]" style={{ filter: "drop-shadow(0 0 12px rgba(0,191,255,0.6))" }} />
      <h1 className="font-teko text-3xl sm:text-5xl chrome-text">BODY SCAN</h1>
      <span className="text-[10px] text-[#00BFFF] border border-[#00BFFF]/50 px-2 py-0.5 font-chakra uppercase tracking-widest">
        PREMIUM
      </span>
    </div>
  );
}

function ScanResultCard({ scan, highlighted }) {
  const delta = scan.delta_vs_previous;
  return (
    <div
      className={`af-card p-5 sm:p-6 clip-corner-tl-br mb-5 sm:mb-6 ${highlighted ? "glow-box border-[#00BFFF]" : ""}`}
      data-testid="bodyscan-result"
    >
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div>
          <div className="text-[10px] text-gray-500 uppercase tracking-widest font-chakra">
            ERGEBNIS · {formatDate(scan.created_at)}
          </div>
          <div className="font-teko text-3xl sm:text-4xl chrome-text">
            SCORE {scan.overall_score}/100
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-gray-500 uppercase tracking-widest font-chakra">KFA-Schätzung</div>
          <div className="font-teko text-2xl sm:text-3xl text-[#00BFFF] glow-text-soft">
            {scan.body_fat_estimate}%
          </div>
          {scan.body_fat_range && (
            <div className="text-[10px] text-gray-500 font-chakra">Range: {scan.body_fat_range}</div>
          )}
        </div>
      </div>

      {/* Delta vs previous */}
      {delta && (
        <div className="border border-[#1A1A24] p-3 mb-4 grid grid-cols-3 gap-2 text-center" data-testid="bodyscan-delta">
          <DeltaCell label="Score" value={delta.overall_score} suffix="" />
          <DeltaCell label="KFA" value={-delta.body_fat_estimate} suffix="%" hint="weniger = besser" invert />
          <DeltaCell label="Symmetrie" value={delta.symmetry_score} suffix="" />
        </div>
      )}

      {/* Muscle development */}
      <div className="mb-4">
        <div className="text-[10px] text-gray-500 uppercase tracking-widest font-chakra mb-2">
          MUSKELENTWICKLUNG (1-10)
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {MUSCLES.map((m) => {
            const v = scan.muscle_development?.[m.key] ?? 0;
            const d = delta?.muscle_development?.[m.key];
            return (
              <div key={m.key} className="border border-[#1A1A24] p-2" data-testid={`muscle-${m.key}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400 font-chakra">{m.label}</span>
                  {d !== undefined && d !== 0 && (
                    <span className={`text-[10px] font-teko ${d > 0 ? "text-green-400" : "text-red-400"}`}>
                      {d > 0 ? `+${d}` : d}
                    </span>
                  )}
                </div>
                <div className="flex items-end gap-1 mt-1">
                  <div className="font-teko text-2xl text-[#00BFFF] leading-none">{v}</div>
                  <div className="text-[10px] text-gray-500 font-chakra mb-1">/10</div>
                </div>
                <div className="mt-1 h-1 bg-[#1A1A24]">
                  <div
                    className="h-full bg-[#00BFFF]"
                    style={{ width: `${v * 10}%`, boxShadow: "0 0 6px rgba(0,191,255,0.6)" }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Symmetry */}
      <div className="mb-4">
        <div className="text-[10px] text-gray-500 uppercase tracking-widest font-chakra mb-1">
          SYMMETRIE {scan.symmetry_score}/10
        </div>
        <div className="text-sm text-gray-300 font-chakra leading-relaxed">{scan.symmetry_notes}</div>
      </div>

      {/* Strengths & Weak points */}
      <div className="grid sm:grid-cols-2 gap-3 mb-4">
        <div className="border border-green-500/30 bg-green-500/5 p-3">
          <div className="text-[10px] text-green-400 uppercase tracking-widest font-chakra mb-2 flex items-center gap-1">
            <TrendingUp size={12} /> STÄRKEN
          </div>
          <ul className="text-sm text-gray-300 font-chakra space-y-1">
            {scan.strengths?.map((s, i) => <li key={i}>• {s}</li>)}
            {(!scan.strengths || scan.strengths.length === 0) && <li className="text-gray-500">—</li>}
          </ul>
        </div>
        <div className="border border-orange-500/30 bg-orange-500/5 p-3">
          <div className="text-[10px] text-orange-400 uppercase tracking-widest font-chakra mb-2 flex items-center gap-1">
            <AlertTriangle size={12} /> SCHWACHSTELLEN
          </div>
          <ul className="text-sm text-gray-300 font-chakra space-y-1">
            {scan.weak_points?.map((w, i) => <li key={i}>• {w}</li>)}
            {(!scan.weak_points || scan.weak_points.length === 0) && <li className="text-gray-500">—</li>}
          </ul>
        </div>
      </div>

      {/* Posture */}
      {scan.posture_notes && (
        <div className="mb-4">
          <div className="text-[10px] text-gray-500 uppercase tracking-widest font-chakra mb-1">HALTUNG</div>
          <div className="text-sm text-gray-300 font-chakra leading-relaxed">{scan.posture_notes}</div>
        </div>
      )}

      {/* Recommendations */}
      <div className="border border-[#00BFFF]/30 bg-[#00BFFF]/5 p-3" data-testid="bodyscan-recommendations">
        <div className="text-[10px] text-[#00BFFF] uppercase tracking-widest font-chakra mb-2 flex items-center gap-1">
          <Sparkles size={12} /> KI-EMPFEHLUNGEN
        </div>
        <ul className="text-sm text-gray-200 font-chakra space-y-1.5">
          {scan.recommendations?.map((r, i) => <li key={i}>→ {r}</li>)}
        </ul>
        {scan.next_focus && (
          <div className="mt-3 pt-3 border-t border-[#00BFFF]/20">
            <div className="text-[10px] text-gray-500 uppercase tracking-widest font-chakra mb-1">NÄCHSTER FOKUS</div>
            <div className="font-teko text-lg sm:text-xl text-[#00BFFF] glow-text-soft">{scan.next_focus}</div>
          </div>
        )}
      </div>

      <div className="text-[10px] text-gray-600 font-chakra mt-3 text-right">
        Konfidenz: {(scan.confidence * 100).toFixed(0)}%
      </div>
    </div>
  );
}

function DeltaCell({ label, value, suffix, hint, invert }) {
  const v = Number(value) || 0;
  const positive = invert ? v >= 0 : v >= 0;
  const Icon = v === 0 ? Minus : positive ? TrendingUp : TrendingDown;
  const color = v === 0 ? "text-gray-400" : positive ? "text-green-400" : "text-red-400";
  return (
    <div>
      <div className="text-[10px] text-gray-500 uppercase tracking-widest font-chakra">{label}</div>
      <div className={`font-teko text-2xl flex items-center justify-center gap-1 ${color}`}>
        <Icon size={16} />
        {v > 0 ? "+" : ""}{v}{suffix}
      </div>
      {hint && <div className="text-[9px] text-gray-600 font-chakra">{hint}</div>}
    </div>
  );
}

function CompareView({ left, right, onClose }) {
  // Sort: older = left, newer = right
  const [a, b] = new Date(left.created_at) <= new Date(right.created_at) ? [left, right] : [right, left];
  return (
    <div className="af-card p-4 sm:p-6 clip-corner-tl-br mb-5 sm:mb-6 border-[#00BFFF]" data-testid="bodyscan-compare">
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <h2 className="font-teko text-2xl sm:text-3xl chrome-text">VERGLEICH</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-[#00BFFF] p-2" data-testid="bodyscan-compare-close">
          <X size={18} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <CompareSide scan={a} label="VORHER" />
        <CompareSide scan={b} label="NACHHER" />
      </div>

      {/* Deltas */}
      <div className="mt-4 border-t border-[#1A1A24] pt-4">
        <div className="text-[10px] text-gray-500 uppercase tracking-widest font-chakra mb-2">FORTSCHRITT</div>
        <div className="grid grid-cols-3 gap-2">
          <DeltaCell label="Score" value={b.overall_score - a.overall_score} suffix="" />
          <DeltaCell label="KFA" value={-(b.body_fat_estimate - a.body_fat_estimate)} suffix="%" hint="weniger = besser" />
          <DeltaCell label="Symmetrie" value={b.symmetry_score - a.symmetry_score} suffix="" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
          {MUSCLES.map((m) => {
            const d = (b.muscle_development?.[m.key] || 0) - (a.muscle_development?.[m.key] || 0);
            return (
              <div key={m.key} className="border border-[#1A1A24] p-2 text-center">
                <div className="text-[10px] text-gray-500 font-chakra uppercase tracking-widest">{m.label}</div>
                <div className={`font-teko text-xl ${d > 0 ? "text-green-400" : d < 0 ? "text-red-400" : "text-gray-400"}`}>
                  {d > 0 ? "+" : ""}{d}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CompareSide({ scan, label }) {
  return (
    <div className="border border-[#1A1A24] p-3">
      <div className="text-[10px] text-[#00BFFF] uppercase tracking-widest font-chakra mb-1">{label}</div>
      <div className="text-[10px] text-gray-500 font-chakra">{formatDate(scan.created_at)}</div>
      <div className="font-teko text-3xl chrome-text mt-1">{scan.overall_score}<span className="text-base text-gray-500">/100</span></div>
      <div className="text-xs text-gray-400 font-chakra mt-1">KFA {scan.body_fat_estimate}%</div>
      <div className="text-xs text-gray-400 font-chakra">Sym {scan.symmetry_score}/10</div>
      {scan.notes && <div className="text-[10px] text-gray-500 font-chakra mt-2 italic truncate">&ldquo;{scan.notes}&rdquo;</div>}
    </div>
  );
}

function formatDate(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" }) +
      " · " + d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
