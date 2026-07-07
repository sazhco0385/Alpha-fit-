import { useEffect, useState } from "react";
import api from "../lib/api";
import { Moon, Dumbbell, Check, Pencil, GripVertical, RotateCcw } from "lucide-react";
import { toast } from "sonner";

const WEEKDAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

// JS getDay() returns 0=Sun..6=Sat — remap to 0=Mon..6=Sun
function jsDayToMondayZero(jsDay) {
  return (jsDay + 6) % 7;
}

/** Compute effective mapping weekday -> plan day, honoring custom assignments,
 *  then filling remaining plan days sequentially onto free training weekdays. */
function computeDayIndexByWeekday(plan, weekdays, assignments) {
  const sortedTraining = [...(weekdays || [])].sort((a, b) => a - b);
  const trainingSet = new Set(sortedTraining);
  const map = {}; // weekday -> plan day object
  const takenWeekdays = new Set();
  const assignedDays = new Set();

  // 1) Honor explicit assignments (skip invalid ones)
  Object.entries(assignments || {}).forEach(([diStr, wd]) => {
    const di = Number(diStr);
    const day = (plan?.days || []).find((d) => d.day_index === di);
    if (day && trainingSet.has(wd) && !takenWeekdays.has(wd)) {
      map[wd] = day;
      takenWeekdays.add(wd);
      assignedDays.add(di);
    }
  });

  // 2) Fill remaining plan days sequentially into free training weekdays
  const freeWeekdays = sortedTraining.filter((w) => !takenWeekdays.has(w));
  const remainingDays = (plan?.days || []).filter((d) => !assignedDays.has(d.day_index));
  remainingDays.forEach((d, i) => {
    const w = freeWeekdays[i];
    if (w !== undefined) map[w] = d;
  });

  return map;
}

export default function WeekSchedule({ plan, sessions, onStartDay }) {
  const [weekdays, setWeekdays] = useState(null);
  const [assignments, setAssignments] = useState({}); // { "1": 0, "2": 3, ... }
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState([]);
  const [dragging, setDragging] = useState(null); // day_index being dragged
  const [dropHover, setDropHover] = useState(null); // weekday index highlighting

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const { data } = await api.get("/profile/training-days");
      setWeekdays(data.weekdays || []);
      setAssignments(data.plan_day_assignments || {});
    } catch {
      setWeekdays([0, 1, 3, 4]);
      setAssignments({});
    }
  };

  const todayMon = jsDayToMondayZero(new Date().getDay());

  // Compute Monday 00:00 of the current calendar week (local time)
  const startOfWeek = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    const offset = jsDayToMondayZero(d.getDay());
    d.setDate(d.getDate() - offset);
    return d;
  })();
  // Set of day_indices completed since start of the week + their weekday
  const completedThisWeek = new Set();
  const completedWeekdays = new Set();
  (sessions || []).forEach((s) => {
    if (s.status !== "completed" || !s.completed_at || !s.day_index) return;
    const d = new Date(s.completed_at);
    if (isNaN(d.getTime())) return;
    if (d >= startOfWeek) {
      completedThisWeek.add(s.day_index);
      completedWeekdays.add(jsDayToMondayZero(d.getDay()));
    }
  });

  const startEdit = () => {
    setDraft([...(weekdays || [])]);
    setEditing(true);
  };

  const toggleDraft = (d) => {
    setDraft((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  };

  const saveWeekdays = async () => {
    if (draft.length === 0) {
      toast.error("Mindestens 1 Trainingstag wählen");
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.put("/profile/training-days", { weekdays: draft });
      setWeekdays(data.weekdays);
      // Refetch assignments (backend may have dropped stale ones)
      const { data: refreshed } = await api.get("/profile/training-days");
      setAssignments(refreshed.plan_day_assignments || {});
      setEditing(false);
      toast.success("Trainingstage aktualisiert");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  };

  const persistAssignments = async (newAssignments) => {
    try {
      const { data } = await api.put("/profile/plan-day-assignments", { assignments: newAssignments });
      setAssignments(data.plan_day_assignments || {});
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Zuordnung fehlgeschlagen");
      // Revert by reloading truth
      load();
    }
  };

  const resetAssignments = async () => {
    try {
      await persistAssignments({});
      toast.success("Zuordnung zurückgesetzt");
    } catch {
      // persistAssignments already surfaces its own error toast
    }
  };

  // Handle drop: place `draggedDayIndex` on `targetWeekday`. If that weekday was already used,
  // swap with the previous plan day so nothing gets lost.
  const handleDrop = (targetWeekday) => {
    if (dragging == null) return;
    setDropHover(null);
    if (!weekdays.includes(targetWeekday)) {
      toast.error("Nur auf Trainingstage droppen");
      setDragging(null);
      return;
    }

    const cur = computeDayIndexByWeekday(plan, weekdays, assignments);
    // Find source weekday of the dragged day (if any)
    let sourceWeekday = null;
    Object.entries(cur).forEach(([wd, d]) => {
      if (d && d.day_index === dragging) sourceWeekday = Number(wd);
    });
    if (sourceWeekday === targetWeekday) { setDragging(null); return; }

    // Build new assignments starting from current effective map
    const nextMap = { ...cur };
    const targetPrev = nextMap[targetWeekday]; // possibly another plan day
    // Place dragged day on target
    const draggedDayObj = (plan?.days || []).find((d) => d.day_index === dragging);
    nextMap[targetWeekday] = draggedDayObj;
    if (sourceWeekday !== null) {
      // Move previous target-day to source (swap)
      if (targetPrev) nextMap[sourceWeekday] = targetPrev;
      else delete nextMap[sourceWeekday];
    }

    // Convert map -> assignments payload { day_index -> weekday }
    const payload = {};
    Object.entries(nextMap).forEach(([wd, d]) => {
      if (d) payload[String(d.day_index)] = Number(wd);
    });
    setDragging(null);
    persistAssignments(payload);
  };

  if (!weekdays) return null;

  const dayIndexByWeekday = computeDayIndexByWeekday(plan, weekdays, assignments);
  const sortedTraining = [...weekdays].sort((a, b) => a - b);
  const hasCustomAssignments = Object.keys(assignments || {}).length > 0;

  return (
    <section className="mb-6 sm:mb-8" data-testid="week-schedule">
      <div className="flex items-end justify-between mb-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-teko tracking-wider chrome-text">DEINE WOCHE</h2>
          <div className="text-xs text-gray-500 font-chakra">
            Mo – So · {sortedTraining.length} Trainingstage{plan?.days ? ` · ziehe Tage zum Umsortieren` : ""}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasCustomAssignments && !editing && (
            <button
              onClick={resetAssignments}
              className="btn-outline text-[11px] flex items-center gap-1"
              data-testid="reset-assignments-btn"
              title="Automatische Zuordnung wiederherstellen"
            >
              <RotateCcw size={12} /> RESET
            </button>
          )}
          {!editing && (
            <button
              onClick={startEdit}
              className="btn-outline text-[11px] flex items-center gap-1"
              data-testid="edit-training-days-btn"
            >
              <Pencil size={12} /> ANPASSEN
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <div className="af-card p-3 sm:p-4" data-testid="training-days-editor">
          <div className="text-xs text-gray-400 font-chakra mb-3 uppercase tracking-widest">Wähle deine Trainingstage</div>
          <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-3">
            {WEEKDAY_LABELS.map((lbl, d) => {
              const on = draft.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDraft(d)}
                  data-testid={`edit-day-${d}`}
                  className={`aspect-square rounded-md border transition font-chakra text-xs sm:text-sm ${
                    on
                      ? "bg-[#00BFFF]/20 border-[#00BFFF] text-[#00BFFF] shadow-[0_0_10px_rgba(0,191,255,0.4)]"
                      : "border-gray-700 text-gray-500 hover:border-gray-500"
                  }`}
                >
                  {lbl}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setEditing(false)} className="btn-outline text-xs" data-testid="cancel-edit-days-btn">ABBRECHEN</button>
            <button onClick={saveWeekdays} disabled={saving} className="btn-primary text-xs" data-testid="save-training-days-btn">
              {saving ? "SPEICHERN…" : "SPEICHERN"}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {WEEKDAY_LABELS.map((lbl, d) => {
            const isTrainingDay = weekdays.includes(d);
            const planDay = dayIndexByWeekday[d];
            const isToday = d === todayMon;
            // "GESCHAFFT" persists for the whole calendar week:
            // if the plan_day mapped to this weekday was completed anywhere between Mo and now, show ✓.
            const isCompletedThisWeek = planDay && completedThisWeek.has(planDay.day_index);
            const isDropTarget = dragging != null && isTrainingDay;
            const isDropHover = dropHover === d;

            return (
              <div
                key={d}
                data-testid={`week-slot-${d}`}
                onDragOver={(e) => {
                  if (isDropTarget) {
                    e.preventDefault();
                    setDropHover(d);
                  }
                }}
                onDragLeave={() => setDropHover((cur) => (cur === d ? null : cur))}
                onDrop={(e) => {
                  e.preventDefault();
                  if (isDropTarget) handleDrop(d);
                }}
                onClick={() => {
                  if (isTrainingDay && planDay && !isCompletedThisWeek && isToday && !dragging) onStartDay?.(planDay.day_index);
                }}
                className={`af-card relative p-2 sm:p-3 flex flex-col items-center justify-between text-center min-h-[96px] transition ${
                  isToday ? "ring-1 ring-[#00BFFF] shadow-[0_0_14px_rgba(0,191,255,0.35)]" : ""
                } ${isDropHover ? "ring-2 ring-[#00FF7F] shadow-[0_0_16px_rgba(0,255,127,0.5)]" : ""} ${
                  isTrainingDay ? "cursor-pointer hover:border-[#00BFFF]" : "opacity-70"
                }`}
              >
                <div className={`text-[10px] font-chakra uppercase tracking-widest ${isToday ? "text-[#00BFFF]" : "text-gray-500"}`}>
                  {lbl}
                </div>
                {isTrainingDay && planDay ? (
                  <div
                    className="flex flex-col items-center gap-1 w-full flex-1 justify-center"
                    draggable
                    onDragStart={(e) => {
                      setDragging(planDay.day_index);
                      try { e.dataTransfer.effectAllowed = "move"; } catch (_err) { /* ignore */ }
                    }}
                    onDragEnd={() => { setDragging(null); setDropHover(null); }}
                    data-testid={`week-day-drag-${planDay.day_index}`}
                  >
                    <div className="flex items-center gap-0.5 text-gray-500">
                      <GripVertical size={10} />
                      <Dumbbell size={16} className={isCompletedThisWeek ? "text-[#00FF7F]" : "text-[#00BFFF]"} />
                    </div>
                    <div className={`text-[10px] sm:text-[11px] font-chakra leading-tight break-words px-1 ${isCompletedThisWeek ? "text-[#00FF7F]" : "text-gray-300"}`}>
                      {isCompletedThisWeek ? "GESCHAFFT" : (planDay.focus || `T${planDay.day_index}`)}
                    </div>
                    <div className="text-[9px] text-gray-600 font-chakra">TAG {planDay.day_index}</div>
                    {isCompletedThisWeek && <Check size={12} className="absolute top-1 right-1 text-[#00FF7F]" />}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1 flex-1 justify-center">
                    <Moon size={16} className="text-gray-600" />
                    <div className="text-[10px] font-chakra text-gray-500">REST</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
