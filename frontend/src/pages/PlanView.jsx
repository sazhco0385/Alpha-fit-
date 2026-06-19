import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import api from "../lib/api";
import { Play, Loader2, RefreshCw, Sparkles, Pencil, Check, X, Plus, Trash2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { getExerciseImage } from "../lib/exerciseImages";

export default function PlanView() {
  const navigate = useNavigate();
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [adjusting, setAdjusting] = useState(false);
  const [adjustElapsed, setAdjustElapsed] = useState(0);
  const elapsedTimerRef = useRef(null);

  // Edit mode state
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(null); // { dayIdx } | null

  const load = async () => {
    setLoading(true);
    const { data } = await api.get("/plans/current");
    setPlan(data.plan);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => () => { if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current); }, []);

  const adjust = async () => {
    setAdjusting(true);
    setAdjustElapsed(0);
    const started = Date.now();
    elapsedTimerRef.current = setInterval(() => {
      setAdjustElapsed(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    try {
      const { data: startData } = await api.post("/coach/adjust-plan/start");
      const jobId = startData.job_id;
      const maxAttempts = 90;
      let result = null;
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const { data: st } = await api.get(`/coach/adjust-plan/status/${jobId}`);
        if (st.status === "done") { result = st; break; }
        if (st.status === "error") {
          throw new Error(st.error || "KI-Anpassung fehlgeschlagen");
        }
      }
      if (!result) throw new Error("Zeitüberschreitung - bitte erneut versuchen");
      setPlan(result.plan);
      toast.success("Plan angepasst!");
    } catch (err) {
      toast.error(err?.response?.data?.detail || err?.message || "Fehler");
    } finally {
      if (elapsedTimerRef.current) { clearInterval(elapsedTimerRef.current); elapsedTimerRef.current = null; }
      setAdjusting(false);
      setAdjustElapsed(0);
    }
  };

  const startDay = async (dayIndex) => {
    const { data } = await api.post("/sessions/start", { day_index: dayIndex });
    navigate(`/workout/${data.session.id}`);
  };

  // ===== Edit mode =====
  const enterEdit = async () => {
    setDraft(JSON.parse(JSON.stringify(plan))); // deep copy
    setEditMode(true);
    if (!suggestions) {
      try {
        const { data } = await api.get("/plans/exercise-suggestions");
        setSuggestions(data.groups || []);
      } catch {
        setSuggestions([]);
      }
    }
  };

  const cancelEdit = () => {
    setDraft(null);
    setEditMode(false);
    setPickerOpen(null);
  };

  const saveEdit = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const { data } = await api.put("/plans/current", {
        name: draft.name,
        progression_notes: draft.progression_notes,
        days: draft.days,
      });
      setPlan(data.plan);
      setEditMode(false);
      setDraft(null);
      setPickerOpen(null);
      toast.success(`Plan v${data.plan.version} gespeichert`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  };

  const updateExercise = (dayIdx, exIdx, field, value) => {
    setDraft((prev) => {
      const next = { ...prev, days: prev.days.map((d, i) => i === dayIdx ? { ...d, exercises: d.exercises.map((e, j) => j === exIdx ? { ...e, [field]: value } : e) } : d) };
      return next;
    });
  };

  const removeExercise = (dayIdx, exIdx) => {
    setDraft((prev) => ({
      ...prev,
      days: prev.days.map((d, i) => i === dayIdx ? { ...d, exercises: d.exercises.filter((_, j) => j !== exIdx) } : d),
    }));
  };

  const addExerciseFromPicker = (dayIdx, exName, muscle) => {
    setDraft((prev) => ({
      ...prev,
      days: prev.days.map((d, i) => i === dayIdx ? {
        ...d,
        exercises: [...d.exercises, { name: exName, target_muscle: muscle, sets: 3, reps: 10, weight_kg: 0, rest_seconds: 60, notes: "" }],
      } : d),
    }));
    setPickerOpen(null);
    toast.success(`${exName} hinzugefügt`);
  };

  const addCustomExercise = (dayIdx) => {
    const name = window.prompt("Name der Übung:");
    if (!name?.trim()) return;
    setDraft((prev) => ({
      ...prev,
      days: prev.days.map((d, i) => i === dayIdx ? {
        ...d,
        exercises: [...d.exercises, { name: name.trim(), target_muscle: "", sets: 3, reps: 10, weight_kg: 0, rest_seconds: 60, notes: "" }],
      } : d),
    }));
  };

  const updateDayName = (dayIdx, value) => {
    setDraft((prev) => ({ ...prev, days: prev.days.map((d, i) => i === dayIdx ? { ...d, name: value } : d) }));
  };

  if (loading) return <Layout><div className="text-center py-12 text-[#00BFFF] font-teko text-2xl">Lade...</div></Layout>;

  const displayPlan = editMode ? draft : plan;

  return (
    <Layout>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] sm:text-xs text-gray-500 font-chakra uppercase tracking-widest">TRAININGSPLAN V{displayPlan?.version || 1}</div>
          {editMode ? (
            <input
              value={draft?.name || ""}
              onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
              maxLength={120}
              className="af-input mt-1 w-full font-teko text-2xl sm:text-4xl text-white bg-transparent"
              data-testid="plan-edit-name"
            />
          ) : (
            <h1 className="font-teko text-3xl sm:text-5xl chrome-text mt-1 break-words">{plan?.name || "Plan"}</h1>
          )}
          {editMode ? (
            <textarea
              value={draft?.progression_notes || ""}
              onChange={(e) => setDraft((p) => ({ ...p, progression_notes: e.target.value }))}
              maxLength={500}
              rows={2}
              placeholder="Progression / Notizen…"
              className="af-input mt-2 w-full font-chakra"
              data-testid="plan-edit-notes"
            />
          ) : (
            <p className="prose-af font-chakra mt-2 max-w-2xl">{plan?.progression_notes}</p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {!editMode ? (
            <>
              <button onClick={enterEdit} className="btn-outline flex items-center gap-2 text-xs sm:text-sm" data-testid="plan-edit-btn">
                <Pencil size={16} /> BEARBEITEN
              </button>
              <button onClick={adjust} disabled={adjusting} className="btn-outline flex items-center gap-2 text-xs sm:text-sm" data-testid="plan-adjust-btn">
                {adjusting ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                {adjusting ? `ANPASSEN... ${adjustElapsed}s` : "KI ANPASSEN"}
              </button>
            </>
          ) : (
            <>
              <button onClick={saveEdit} disabled={saving} className="btn-primary flex items-center gap-2 text-xs sm:text-sm" data-testid="plan-save-btn">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} SPEICHERN
              </button>
              <button onClick={cancelEdit} disabled={saving} className="btn-outline flex items-center gap-2 text-xs sm:text-sm text-red-400 border-red-400/40 hover:border-red-400" data-testid="plan-cancel-btn">
                <X size={16} /> ABBRECHEN
              </button>
            </>
          )}
        </div>
      </div>

      {plan?.source === "auto_weekly" && !editMode && (
        <div className="af-card p-4 sm:p-5 mb-5 border-[#00BFFF] glow-box" data-testid="plan-auto-banner">
          <div className="flex items-start gap-3">
            <Sparkles size={20} className="text-[#00BFFF] flex-shrink-0 mt-0.5" style={{ filter: "drop-shadow(0 0 8px rgba(0,191,255,0.7))" }} />
            <div>
              <div className="font-teko text-xl sm:text-2xl chrome-text">AUTOMATISCH ANGEPASST</div>
              <p className="prose-af font-chakra text-sm mt-1">
                Du hast eine komplette Woche durchgezogen — Coach hat deinen Plan automatisch
                an deine Performance angepasst. <strong className="text-[#00BFFF]">Werde alpha.</strong>
              </p>
            </div>
          </div>
        </div>
      )}

      {editMode && (
        <div className="af-card p-4 mb-5 border-[#00BFFF]/40" data-testid="plan-edit-banner">
          <div className="flex items-start gap-3">
            <Pencil size={18} className="text-[#00BFFF] flex-shrink-0 mt-0.5" />
            <div className="font-chakra text-sm prose-af">
              <strong className="text-[#00BFFF]">Bearbeitungsmodus.</strong> Tippe auf eine Übung um Sets/Reps/Gewicht/Pause zu ändern.
              Mit „+ ÜBUNG&quot; Übungen hinzufügen, mit dem Mülleimer-Icon entfernen.
              Speichern erzeugt eine neue Plan-Version.
            </div>
          </div>
        </div>
      )}

      <div className="space-y-5 sm:space-y-6">
        {displayPlan?.days?.map((day, dayIdx) => (
          <div key={day.day_index} className="af-card p-4 sm:p-6 clip-corner-tl-br" data-testid={`plan-detail-day-${day.day_index}`}>
            <div className="flex items-center justify-between mb-4 sm:mb-5 flex-wrap gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-[10px] sm:text-xs text-[#00BFFF] uppercase tracking-widest font-chakra">TAG {day.day_index}</div>
                {editMode ? (
                  <input
                    value={day.name}
                    onChange={(e) => updateDayName(dayIdx, e.target.value)}
                    maxLength={80}
                    className="af-input mt-1 w-full font-teko text-xl sm:text-2xl text-white bg-transparent"
                    data-testid={`day-name-edit-${day.day_index}`}
                  />
                ) : (
                  <div className="font-teko text-xl sm:text-3xl chrome-text break-words leading-tight">{day.name}</div>
                )}
              </div>
              {!editMode && (
                <button onClick={() => startDay(day.day_index)} className="btn-primary flex items-center gap-2 text-sm flex-shrink-0" data-testid={`plan-start-${day.day_index}`}>
                  <Play size={16} /> STARTEN
                </button>
              )}
            </div>
            <div className="space-y-2">
              {day.exercises?.map((ex, i) => editMode ? (
                <EditableExerciseRow
                  key={i}
                  ex={ex}
                  onChange={(field, value) => updateExercise(dayIdx, i, field, value)}
                  onRemove={() => removeExercise(dayIdx, i)}
                  testid={`exercise-edit-${day.day_index}-${i}`}
                />
              ) : (
                <div key={i} className="flex items-center gap-3 sm:gap-4 p-2 sm:p-3 bg-[#0A0A10] border border-[#1A1A24] hover:border-[#00BFFF]/40 transition" data-testid={`exercise-${day.day_index}-${i}`}>
                  <img
                    src={getExerciseImage(ex.name, ex.target_muscle)}
                    alt={ex.name}
                    onError={(e) => { if (!e.currentTarget.dataset.fallback) { e.currentTarget.dataset.fallback = "1"; e.currentTarget.src = "/exercises/group-full.webp"; } }}
                    className="w-12 h-12 sm:w-16 sm:h-16 object-cover border border-[#1A1A24] flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-teko text-base sm:text-xl tracking-wide chrome-text truncate">{ex.name}</div>
                    <div className="text-[10px] sm:text-xs text-gray-500 font-chakra uppercase tracking-widest truncate">{ex.target_muscle}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-teko text-lg sm:text-2xl electric-text glow-text-soft whitespace-nowrap">{ex.sets} × {ex.reps}</div>
                    <div className="text-[10px] sm:text-xs text-gray-400 font-chakra whitespace-nowrap">{ex.weight_kg}kg · {ex.rest_seconds}s</div>
                  </div>
                </div>
              ))}

              {editMode && (
                <div className="space-y-2">
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => setPickerOpen(pickerOpen?.dayIdx === dayIdx ? null : { dayIdx })}
                      className="btn-outline text-xs flex items-center gap-2"
                      data-testid={`add-exercise-btn-${day.day_index}`}
                    >
                      <Plus size={14} /> ÜBUNG HINZUFÜGEN <ChevronDown size={12} className={pickerOpen?.dayIdx === dayIdx ? "rotate-180 transition" : "transition"} />
                    </button>
                    <button
                      onClick={() => addCustomExercise(dayIdx)}
                      className="btn-outline text-xs flex items-center gap-2"
                      data-testid={`add-custom-exercise-btn-${day.day_index}`}
                    >
                      <Plus size={14} /> EIGENE ÜBUNG
                    </button>
                  </div>
                  {pickerOpen?.dayIdx === dayIdx && (
                    <div className="af-card p-3 border-[#00BFFF]/40 max-h-72 overflow-y-auto" data-testid={`exercise-picker-${day.day_index}`}>
                      {(suggestions || []).map((g) => (
                        <div key={g.muscle} className="mb-3 last:mb-0">
                          <div className="text-[10px] text-[#00BFFF] uppercase tracking-widest font-chakra mb-1">{g.muscle}</div>
                          <div className="flex flex-wrap gap-1">
                            {g.exercises.map((name) => (
                              <button
                                key={name}
                                onClick={() => addExerciseFromPicker(dayIdx, name, g.muscle)}
                                className="text-[11px] px-2 py-1 border border-[#1A1A24] hover:border-[#00BFFF] hover:bg-[#00BFFF]/10 transition font-chakra"
                                data-testid={`pick-${name.replace(/\s+/g, '-')}`}
                              >
                                {name}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}

function EditableExerciseRow({ ex, onChange, onRemove, testid }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="bg-[#0A0A10] border border-[#1A1A24] hover:border-[#00BFFF]/40 transition" data-testid={testid}>
      <div className="flex items-center gap-2 p-2 sm:p-3">
        <button onClick={() => setExpanded((v) => !v)} className="text-[#00BFFF] flex-shrink-0" data-testid={`${testid}-expand`}>
          <ChevronDown size={16} className={expanded ? "rotate-180 transition" : "transition"} />
        </button>
        <input
          value={ex.name}
          onChange={(e) => onChange("name", e.target.value)}
          maxLength={120}
          placeholder="Übungsname"
          className="af-input flex-1 font-teko text-base sm:text-lg bg-transparent min-w-0"
          data-testid={`${testid}-name`}
        />
        <div className="text-right flex-shrink-0">
          <div className="text-[10px] text-gray-400 font-chakra whitespace-nowrap">{ex.sets}×{ex.reps} · {ex.weight_kg}kg</div>
        </div>
        <button onClick={onRemove} className="text-red-400 hover:text-red-300 p-1 flex-shrink-0" data-testid={`${testid}-remove`} title="Übung entfernen">
          <Trash2 size={16} />
        </button>
      </div>
      {expanded && (
        <div className="px-2 sm:px-3 pb-3 grid grid-cols-2 sm:grid-cols-5 gap-2">
          <NumField label="Sets" value={ex.sets} onChange={(v) => onChange("sets", v)} min={1} max={20} testid={`${testid}-sets`} />
          <NumField label="Reps" value={ex.reps} onChange={(v) => onChange("reps", v)} min={1} max={100} testid={`${testid}-reps`} />
          <NumField label="Gewicht kg" value={ex.weight_kg} onChange={(v) => onChange("weight_kg", v)} min={0} max={1000} step={0.5} testid={`${testid}-weight`} />
          <NumField label="Pause s" value={ex.rest_seconds} onChange={(v) => onChange("rest_seconds", v)} min={0} max={600} step={15} testid={`${testid}-rest`} />
          <div className="col-span-2 sm:col-span-1">
            <label className="text-[9px] text-gray-400 uppercase tracking-widest font-chakra block mb-1">Muskel</label>
            <input
              value={ex.target_muscle || ""}
              onChange={(e) => onChange("target_muscle", e.target.value)}
              maxLength={60}
              className="af-input w-full text-xs"
              data-testid={`${testid}-muscle`}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function NumField({ label, value, onChange, min, max, step = 1, testid }) {
  return (
    <div>
      <label className="text-[9px] text-gray-400 uppercase tracking-widest font-chakra block mb-1">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        className="af-input w-full text-sm font-teko"
        data-testid={testid}
      />
    </div>
  );
}
