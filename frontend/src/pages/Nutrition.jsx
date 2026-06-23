import { useEffect, useRef, useState } from "react";
import Layout from "../components/Layout";
import api from "../lib/api";
import { toast } from "sonner";
import { Camera, Plus, Trash2, Loader2, Apple, Flame, Beef, Wheat, Droplet, X, Check, ChevronRight, Edit3, Sparkles } from "lucide-react";

const MEAL_TYPES = [
  { v: "breakfast", l: "Frühstück" },
  { v: "lunch", l: "Mittag" },
  { v: "dinner", l: "Abend" },
  { v: "snack", l: "Snack" },
];

export default function Nutrition() {
  const [data, setData] = useState({ entries: [], totals: {}, goals: {} });
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzed, setAnalyzed] = useState(null); // result from AI -> edit modal
  const [manualOpen, setManualOpen] = useState(false);
  const fileRef = useRef(null);

  const load = async () => {
    const { data } = await api.get("/nutrition/today");
    setData(data);
  };
  useEffect(() => { load(); }, []);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Bild zu groß (max 8 MB)");
      return;
    }
    setAnalyzing(true);
    try {
      const b64 = await fileToBase64(file);
      const { data: r } = await api.post("/nutrition/analyze", {
        image_base64: b64,
      });
      setAnalyzed({ ...r, meal_type: guessMeal() });
    } catch (err) {
      toast.error(err?.response?.data?.detail || "KI-Analyse fehlgeschlagen");
    } finally {
      setAnalyzing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const saveEntry = async (entry) => {
    try {
      await api.post("/nutrition/log", entry);
      toast.success(`${entry.food_name} hinzugefügt`);
      setAnalyzed(null);
      setManualOpen(false);
      await load();
    } catch (err) {
      toast.error("Fehler beim Speichern");
    }
  };

  const deleteEntry = async (id) => {
    if (!window.confirm("Eintrag löschen?")) return;
    await api.delete(`/nutrition/log/${id}`);
    toast.success("Gelöscht");
    load();
  };

  const t = data.totals || {};
  const g = data.goals || {};

  return (
    <Layout>
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <Apple size={28} className="text-[#00BFFF]" style={{ filter: "drop-shadow(0 0 12px rgba(0,191,255,0.6))" }} />
        <h1 className="font-teko text-3xl sm:text-5xl chrome-text">ERNÄHRUNG</h1>
      </div>

      {/* Today summary */}
      <div className="af-card p-4 sm:p-6 mb-5 sm:mb-6 clip-corner-tl-br" data-testid="nutrition-summary">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="font-teko text-xl sm:text-2xl chrome-text">HEUTE</div>
          <div className="text-xs text-gray-500 font-chakra">{data.date}</div>
        </div>

        {/* Calories big */}
        <div className="text-center mb-5">
          <div className="font-teko text-6xl sm:text-7xl electric-text glow-text leading-none" data-testid="cal-total">
            {Math.round(t.calories || 0)}
          </div>
          <div className="font-chakra text-xs text-gray-500 uppercase tracking-widest mt-1">
            / {g.calories} kcal
          </div>
          <div className="text-[10px] text-[#00BFFF] mt-1">
            Noch {Math.max(0, (g.calories || 0) - Math.round(t.calories || 0))} kcal verfügbar
          </div>
        </div>

        {/* Macros */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <MacroBar icon={Beef} label="Protein" value={t.protein_g} goal={g.protein_g} unit="g" color="#FF5252" testid="macro-protein" />
          <MacroBar icon={Wheat} label="Kohlenh." value={t.carbs_g} goal={g.carbs_g} unit="g" color="#FFD740" testid="macro-carbs" />
          <MacroBar icon={Droplet} label="Fett" value={t.fat_g} goal={g.fat_g} unit="g" color="#00E5FF" testid="macro-fat" />
        </div>

        {/* Micros */}
        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-[#1A1A24] text-center">
          <Micro label="Ballast." value={t.fiber_g} goal={g.fiber_g} unit="g" />
          <Micro label="Zucker" value={t.sugar_g} goal={g.sugar_g} unit="g" />
          <Micro label="Natrium" value={t.sodium_mg} goal={g.sodium_mg} unit="mg" />
        </div>
      </div>

      {/* Add actions */}
      <div className="grid grid-cols-2 gap-3 mb-5 sm:mb-6">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={analyzing}
          className="af-card p-5 clip-corner-tl-br hover:glow-box transition tracing-border text-center"
          data-testid="photo-scan-btn"
        >
          {analyzing ? (
            <Loader2 size={32} className="mx-auto animate-spin text-[#00BFFF]" />
          ) : (
            <Camera size={32} className="mx-auto text-[#00BFFF]" style={{ filter: "drop-shadow(0 0 8px rgba(0,191,255,0.6))" }} />
          )}
          <div className="font-teko text-lg sm:text-xl mt-2 chrome-text">
            {analyzing ? "ANALYSIERE..." : "FOTO SCAN"}
          </div>
          <div className="text-[10px] text-gray-500 font-chakra mt-1">KI-Erkennung</div>
        </button>
        <button
          onClick={() => setManualOpen(true)}
          className="af-card p-5 clip-corner-tl-br hover:glow-box transition text-center"
          data-testid="manual-add-btn"
        >
          <Plus size={32} className="mx-auto text-[#00BFFF]" />
          <div className="font-teko text-lg sm:text-xl mt-2 chrome-text">MANUELL</div>
          <div className="text-[10px] text-gray-500 font-chakra mt-1">Selbst eingeben</div>
        </button>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onFile} className="hidden" data-testid="photo-input" />
      </div>

      {/* Today's entries */}
      <div className="af-card p-4 sm:p-6 clip-corner-tl-br">
        <div className="font-teko text-xl sm:text-2xl chrome-text mb-4">EINTRÄGE HEUTE ({data.entries?.length || 0})</div>
        {(!data.entries || data.entries.length === 0) ? (
          <div className="text-center text-gray-500 font-chakra py-6">
            Noch nichts geloggt. Mach ein Foto von deinem Essen!
          </div>
        ) : (
          <div className="space-y-2">
            {data.entries.map((e) => (
              <div key={e.id} className="flex items-center gap-3 p-3 bg-[#0A0A10] border border-[#1A1A24] hover:border-[#00BFFF]/40 transition" data-testid={`entry-${e.id}`}>
                <div className="w-10 text-center flex-shrink-0">
                  <div className="font-teko text-2xl chrome-text">{Math.round(e.calories)}</div>
                  <div className="text-[9px] text-gray-500 font-chakra">kcal</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-teko text-base sm:text-lg tracking-wide chrome-text truncate">{e.food_name}</div>
                  <div className="text-[10px] text-gray-500 font-chakra">
                    {Math.round(e.portion_grams)}g · P {Math.round(e.protein_g)} · K {Math.round(e.carbs_g)} · F {Math.round(e.fat_g)}
                    {" · "}
                    <span className="text-[#00BFFF] uppercase">{MEAL_TYPES.find(m => m.v === e.meal_type)?.l || e.meal_type}</span>
                  </div>
                </div>
                <button onClick={() => deleteEntry(e.id)} className="w-11 h-11 flex items-center justify-center text-red-400 hover:bg-red-500/10 transition flex-shrink-0" data-testid={`delete-entry-${e.id}`}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI Result Modal */}
      {analyzed && (
        <EditEntryModal
          initial={analyzed}
          title="KI ERKENNUNG"
          subtitle={`Vertrauen: ${Math.round((analyzed.confidence || 0) * 100)}%`}
          onSave={saveEntry}
          onClose={() => setAnalyzed(null)}
          showComponents
        />
      )}
      {/* Manual Add Modal */}
      {manualOpen && (
        <EditEntryModal
          initial={{
            food_name: "",
            portion_grams: 100,
            calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, sugar_g: 0, sodium_mg: 0,
            meal_type: guessMeal(),
          }}
          title="MANUELL HINZUFÜGEN"
          onSave={saveEntry}
          onClose={() => setManualOpen(false)}
        />
      )}
    </Layout>
  );
}

function MacroBar({ icon: Icon, label, value = 0, goal = 0, unit, color, testid }) {
  const pct = goal > 0 ? Math.min(100, Math.round((value / goal) * 100)) : 0;
  return (
    <div data-testid={testid}>
      <div className="flex items-center gap-1 mb-1">
        <Icon size={12} style={{ color }} />
        <span className="text-[10px] text-gray-400 font-chakra uppercase tracking-widest">{label}</span>
      </div>
      <div className="font-teko text-xl chrome-text leading-none">{Math.round(value)}<span className="text-xs text-gray-500"> / {goal}{unit}</span></div>
      <div className="w-full h-1.5 bg-[#1A1A24] mt-1.5 overflow-hidden">
        <div className="h-full transition-all duration-500" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}, ${color}aa)`, boxShadow: `0 0 8px ${color}66` }} />
      </div>
    </div>
  );
}

function Micro({ label, value, goal, unit }) {
  return (
    <div>
      <div className="text-[10px] text-gray-500 font-chakra uppercase tracking-widest">{label}</div>
      <div className="font-teko text-base chrome-text">{Math.round(value || 0)}/{goal}{unit}</div>
    </div>
  );
}

function guessMeal() {
  const h = new Date().getHours();
  if (h < 11) return "breakfast";
  if (h < 15) return "lunch";
  if (h < 21) return "dinner";
  return "snack";
}

function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

function EditEntryModal({ initial, title, subtitle, onSave, onClose, showComponents }) {
  const [form, setForm] = useState(initial);
  const [aiLoading, setAiLoading] = useState(false);
  const [recent, setRecent] = useState([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const suggestRef = useRef(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Load recent foods (and refilter as user types) — skips for AI-photo result mode
  useEffect(() => {
    if (showComponents) return; // photo-result mode doesn't need recent suggestions
    const q = (form.food_name || "").trim();
    const handler = setTimeout(async () => {
      try {
        const { data } = await api.get(`/nutrition/recent-foods${q ? `?q=${encodeURIComponent(q)}` : ""}`);
        setRecent(data.items || []);
      } catch { /* ignore */ }
    }, q.length === 0 ? 0 : 180);
    return () => clearTimeout(handler);
  }, [form.food_name, showComponents]);

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e) => {
      if (suggestRef.current && !suggestRef.current.contains(e.target)) setShowSuggest(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const pickRecent = (item) => {
    setForm((f) => ({
      ...f,
      food_name: item.food_name,
      portion_grams: item.portion_grams || 100,
      calories: item.calories || 0,
      protein_g: item.protein_g || 0,
      carbs_g: item.carbs_g || 0,
      fat_g: item.fat_g || 0,
      fiber_g: item.fiber_g || 0,
      sugar_g: item.sugar_g || 0,
      sodium_mg: item.sodium_mg || 0,
    }));
    setShowSuggest(false);
    toast.success(`Übernommen: ${item.food_name}`);
  };

  const autoFill = async () => {
    const name = (form.food_name || "").trim();
    if (name.length < 2) {
      toast.error("Bitte Namen eingeben (min. 2 Zeichen)");
      return;
    }
    setAiLoading(true);
    try {
      const { data: r } = await api.post("/nutrition/analyze-name", {
        food_name: name,
        portion_grams: Number(form.portion_grams) || 100,
      });
      setForm((f) => ({
        ...f,
        food_name: r.food_name || f.food_name,
        portion_grams: r.portion_grams,
        calories: r.calories,
        protein_g: r.protein_g,
        carbs_g: r.carbs_g,
        fat_g: r.fat_g,
        fiber_g: r.fiber_g,
        sugar_g: r.sugar_g,
        sodium_mg: r.sodium_mg,
      }));
      const conf = Math.round((r.confidence || 0) * 100);
      toast.success(`Werte ausgefüllt (${conf}% sicher)`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "KI-Schätzung fehlgeschlagen");
    } finally {
      setAiLoading(false);
    }
  };

  const num = (k) => (
    <input
      type="number"
      step="0.1"
      value={form[k] || 0}
      onChange={(e) => setForm({ ...form, [k]: parseFloat(e.target.value) || 0 })}
      className="af-input text-right font-chakra"
      style={{ fontSize: "16px", minHeight: 44 }}
      data-testid={`edit-${k}`}
    />
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/90 backdrop-blur-md p-0 sm:p-4 overflow-y-auto" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-[#03030A] border-t-2 sm:border border-[#00BFFF]/40 sm:border-[#1A1A24] p-5 sm:p-6 max-w-lg w-full h-full sm:h-auto overflow-y-auto sm:clip-corner-tl-br sm:my-4 rounded-t-2xl sm:rounded-none" data-testid="edit-entry-modal">
        <div className="flex items-start justify-between mb-3 gap-2">
          <div className="min-w-0">
            <div className="text-[10px] text-[#00BFFF] uppercase tracking-widest font-chakra">{title}</div>
            <div className="font-teko text-2xl sm:text-3xl chrome-text mt-1 break-words">{form.food_name || "Neues Lebensmittel"}</div>
            {subtitle && <div className="text-xs text-gray-500 font-chakra mt-1">{subtitle}</div>}
          </div>
          <button onClick={onClose} className="w-11 h-11 flex items-center justify-center text-gray-500 hover:text-[#00BFFF] flex-shrink-0" data-testid="edit-close-btn">
            <X size={20} />
          </button>
        </div>

        {showComponents && form.components?.length > 0 && (
          <div className="text-[10px] text-gray-500 font-chakra mb-3">
            Erkannt: <span className="text-[#00BFFF]">{form.components.join(", ")}</span>
          </div>
        )}

        <div className="space-y-3">
          <div ref={suggestRef} className="relative">
            <label className="block text-[10px] text-gray-500 uppercase tracking-widest font-chakra mb-1">Name</label>
            <div className="flex gap-2">
              <input
                value={form.food_name || ""}
                onChange={(e) => { setForm({ ...form, food_name: e.target.value }); setShowSuggest(true); }}
                onFocus={() => setShowSuggest(true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !showComponents && !aiLoading) {
                    e.preventDefault();
                    setShowSuggest(false);
                    autoFill();
                  } else if (e.key === "Escape") {
                    setShowSuggest(false);
                  }
                }}
                className="af-input font-chakra flex-1 min-w-0"
                style={{ fontSize: "16px" }}
                placeholder="z.B. Pizza Margherita"
                autoComplete="off"
                required
                data-testid="edit-food-name"
              />
              {!showComponents && (
                <button
                  type="button"
                  onClick={autoFill}
                  disabled={aiLoading || (form.food_name || "").trim().length < 2}
                  className="shrink-0 px-3 sm:px-4 border border-[#00BFFF]/60 text-[#00BFFF] font-chakra text-[11px] tracking-widest uppercase hover:bg-[#00BFFF]/10 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 transition"
                  style={{ minHeight: 44 }}
                  data-testid="ai-autofill-btn"
                  title="Nährwerte automatisch schätzen"
                >
                  {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  <span className="hidden sm:inline">{aiLoading ? "ANALYSIERT..." : "AI"}</span>
                </button>
              )}
            </div>
            {!showComponents && showSuggest && recent.length > 0 && (
              <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-[#03030A] border border-[#1A1A24] max-h-60 overflow-y-auto shadow-2xl" data-testid="recent-foods-dropdown">
                <div className="px-3 py-2 text-[10px] text-gray-500 font-chakra uppercase tracking-widest border-b border-[#1A1A24] bg-[#0A0A10]">
                  Häufig gegessen
                </div>
                {recent.map((it, idx) => (
                  <button
                    key={`${it.food_name}-${idx}`}
                    type="button"
                    onClick={() => pickRecent(it)}
                    className="w-full text-left px-3 py-2.5 hover:bg-[#00BFFF]/10 border-b border-[#1A1A24] last:border-b-0 font-chakra transition flex items-center justify-between gap-2"
                    data-testid={`recent-food-${idx}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm chrome-text truncate">{it.food_name}</div>
                      <div className="text-[10px] text-gray-500 mt-0.5">
                        {Math.round(it.calories || 0)} kcal · {Math.round(it.portion_grams || 0)} g · {it.count}× geloggt
                      </div>
                    </div>
                    <ChevronRight size={14} className="text-[#00BFFF] shrink-0" />
                  </button>
                ))}
              </div>
            )}
            {!showComponents && !showSuggest && (
              <div className="text-[10px] text-gray-500 font-chakra mt-1">
                Tipp: Name eingeben + AI-Button (oder Enter), oder aus der Liste wählen.
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-gray-500 uppercase tracking-widest font-chakra mb-1">Portion (g)</label>
              {num("portion_grams")}
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 uppercase tracking-widest font-chakra mb-1">Kalorien</label>
              {num("calories")}
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 uppercase tracking-widest font-chakra mb-1">Protein (g)</label>
              {num("protein_g")}
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 uppercase tracking-widest font-chakra mb-1">Kohlenhydrate (g)</label>
              {num("carbs_g")}
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 uppercase tracking-widest font-chakra mb-1">Fett (g)</label>
              {num("fat_g")}
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 uppercase tracking-widest font-chakra mb-1">Ballaststoffe (g)</label>
              {num("fiber_g")}
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 uppercase tracking-widest font-chakra mb-1">Zucker (g)</label>
              {num("sugar_g")}
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 uppercase tracking-widest font-chakra mb-1">Natrium (mg)</label>
              {num("sodium_mg")}
            </div>
          </div>

          <div>
            <label className="block text-[10px] text-gray-500 uppercase tracking-widest font-chakra mb-1">Mahlzeit</label>
            <div className="grid grid-cols-4 gap-1.5">
              {MEAL_TYPES.map((m) => (
                <button
                  key={m.v}
                  type="button"
                  onClick={() => setForm({ ...form, meal_type: m.v })}
                  className={`py-2 text-[11px] font-chakra uppercase tracking-widest border transition ${
                    form.meal_type === m.v ? "border-[#00BFFF] text-[#00BFFF] glow-box" : "border-[#1A1A24] text-gray-400"
                  }`}
                  data-testid={`meal-${m.v}`}
                >
                  {m.l}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="btn-outline flex-1">ABBRECHEN</button>
          <button onClick={() => onSave(form)} className="btn-primary flex-1 flex items-center justify-center gap-2" data-testid="save-entry-btn">
            <Check size={16} /> SPEICHERN
          </button>
        </div>
      </div>
    </div>
  );
}
