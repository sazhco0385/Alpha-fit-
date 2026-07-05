import { useEffect, useState } from "react";
import api from "../lib/api";
import { Moon, Dumbbell, Check, Pencil } from "lucide-react";
import { toast } from "sonner";

const WEEKDAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const WEEKDAY_LONG = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

// JS getDay() returns 0=Sun..6=Sat — remap to 0=Mon..6=Sun
function jsDayToMondayZero(jsDay) {
  return (jsDay + 6) % 7;
}

export default function WeekSchedule({ plan, completedTodayDayIndex, onStartDay }) {
  const [weekdays, setWeekdays] = useState(null); // list of ints 0-6, Mo=0
  const [isCustom, setIsCustom] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState([]);

  useEffect(() => {
    api.get("/profile/training-days")
      .then(({ data }) => {
        setWeekdays(data.weekdays || []);
        setIsCustom(!!data.is_custom);
      })
      .catch(() => setWeekdays([0, 1, 3, 4]));
  }, []);

  const todayMon = jsDayToMondayZero(new Date().getDay());

  const startEdit = () => {
    setDraft([...(weekdays || [])]);
    setEditing(true);
  };

  const toggleDraft = (d) => {
    setDraft((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort());
  };

  const save = async () => {
    if (draft.length === 0) {
      toast.error("Mindestens 1 Trainingstag wählen");
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.put("/profile/training-days", { weekdays: draft });
      setWeekdays(data.weekdays);
      setIsCustom(true);
      setEditing(false);
      toast.success("Trainingstage aktualisiert");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  };

  if (!weekdays) return null;

  // Map plan.days sequentially onto the sorted training weekdays.
  // e.g. weekdays=[0,1,3,4], plan has Tag1..Tag4 → Mo=Tag1, Di=Tag2, Do=Tag3, Fr=Tag4
  const sortedTraining = [...weekdays].sort((a, b) => a - b);
  const dayIndexByWeekday = {};
  (plan?.days || []).forEach((d, i) => {
    const wd = sortedTraining[i];
    if (wd !== undefined) dayIndexByWeekday[wd] = d;
  });

  return (
    <section className="mb-6 sm:mb-8" data-testid="week-schedule">
      <div className="flex items-end justify-between mb-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-teko tracking-wider chrome-text">DEINE WOCHE</h2>
          <div className="text-xs text-gray-500 font-chakra">Mo – So · {sortedTraining.length} Trainingstage</div>
        </div>
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
            <button
              onClick={() => setEditing(false)}
              className="btn-outline text-xs"
              data-testid="cancel-edit-days-btn"
            >ABBRECHEN</button>
            <button
              onClick={save}
              disabled={saving}
              className="btn-primary text-xs"
              data-testid="save-training-days-btn"
            >{saving ? "SPEICHERN…" : "SPEICHERN"}</button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {WEEKDAY_LABELS.map((lbl, d) => {
            const isTrainingDay = weekdays.includes(d);
            const planDay = dayIndexByWeekday[d];
            const isToday = d === todayMon;
            const isCompletedToday = isToday && planDay && completedTodayDayIndex === planDay.day_index;

            return (
              <div
                key={d}
                data-testid={`week-slot-${d}`}
                onClick={() => isTrainingDay && planDay && !isCompletedToday && isToday && onStartDay?.(planDay.day_index)}
                className={`af-card relative p-2 sm:p-3 flex flex-col items-center justify-between text-center min-h-[92px] transition ${
                  isToday ? "ring-1 ring-[#00BFFF] shadow-[0_0_14px_rgba(0,191,255,0.35)]" : ""
                } ${
                  isTrainingDay
                    ? "cursor-pointer hover:border-[#00BFFF]"
                    : "opacity-70"
                }`}
              >
                <div className={`text-[10px] font-chakra uppercase tracking-widest ${isToday ? "text-[#00BFFF]" : "text-gray-500"}`}>
                  {lbl}
                </div>
                {isTrainingDay && planDay ? (
                  <>
                    <Dumbbell size={16} className={isCompletedToday ? "text-[#00FF7F]" : "text-[#00BFFF]"} />
                    <div className={`text-[10px] sm:text-[11px] font-chakra leading-tight break-words ${isCompletedToday ? "text-[#00FF7F]" : "text-gray-300"}`}>
                      {isCompletedToday ? "GESCHAFFT" : (planDay.focus || `T${planDay.day_index}`)}
                    </div>
                    {isCompletedToday && (
                      <Check size={12} className="absolute top-1 right-1 text-[#00FF7F]" />
                    )}
                  </>
                ) : (
                  <>
                    <Moon size={16} className="text-gray-600" />
                    <div className="text-[10px] font-chakra text-gray-500">REST</div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
