const LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

// getDay(): 0=Sun..6=Sat  → remap so 0=Mon..6=Sun
function jsDayToMondayZero(d) { return (d + 6) % 7; }

/**
 * Compact week strip — 7 tiles, current day highlighted.
 * If a session was completed on that weekday (this week), shows a check dot.
 * Rest days stay muted.
 * @param {number[]} weekdays  training weekdays (0=Mon..6=Sun)
 * @param {Set<number>} completedWeekdays  Mo-indexed weekdays completed this week
 */
export default function WeekStrip({ weekdays = [], completedWeekdays = new Set() }) {
  const today = jsDayToMondayZero(new Date().getDay());
  const trainSet = new Set(weekdays);
  return (
    <div className="week-strip" data-testid="week-strip">
      {LABELS.map((lbl, d) => {
        const isToday = d === today;
        const isTraining = trainSet.has(d);
        const isDone = completedWeekdays.has(d);
        const cls = [
          "week-strip__day",
          isToday && "week-strip__day--today",
          !isTraining && !isToday && "week-strip__day--rest",
          isDone && !isToday && "week-strip__day--done",
        ].filter(Boolean).join(" ");
        return (
          <div key={d} className={cls} data-testid={`week-strip-day-${d}`}>
            <span className="week-strip__label">{lbl}</span>
            <span className="week-strip__marker">
              {isToday ? String(d + 1) : (isDone ? "✓" : (isTraining ? "•" : "·"))}
            </span>
          </div>
        );
      })}
    </div>
  );
}
