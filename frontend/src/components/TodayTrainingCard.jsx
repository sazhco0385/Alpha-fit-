import { Play, ChevronRight } from "lucide-react";

const HERO_IMG =
  "https://images.unsplash.com/photo-1605296867304-46d5465a13f1?crop=entropy&cs=srgb&fm=jpg&q=85&w=900";

/**
 * Today's Training hero card — deep-blue overkill.
 * Athlete image right, headline left, 3-stat row, glowing play button bottom-right.
 */
export default function TodayTrainingCard({
  title = "Kein Training",
  focus,
  durationMin = 45,
  exercisesCount = 0,
  completed = 0,
  onStart,
  ctaLabel,
}) {
  const total = exercisesCount || 0;
  const done = Math.min(completed || 0, total);
  return (
    <div className="today-card enter enter-d1" data-testid="today-training-card">
      <div
        className="today-card__bg"
        style={{ backgroundImage: `url(${HERO_IMG})` }}
        aria-hidden
      />
      <div className="today-card__scrim" aria-hidden />
      <div className="today-card__content">
        <div className="today-card__label">Dein heutiges Training</div>
        <div className="today-card__title" data-testid="today-training-title">{title}</div>
        {focus && (
          <div className="today-card__chip" data-testid="today-training-focus">
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#00E5FF", boxShadow: "0 0 6px #00E5FF" }} />
            {focus}
          </div>
        )}
        <div className="today-card__stats">
          <div className="today-card__stat">
            <span className="today-card__stat-val" data-testid="today-training-duration">{durationMin} Min</span>
            <span className="today-card__stat-label">Dauer</span>
          </div>
          <div className="today-card__stat">
            <span className="today-card__stat-val" data-testid="today-training-exercises">{total}</span>
            <span className="today-card__stat-label">Übungen</span>
          </div>
          <div className="today-card__stat">
            <span className="today-card__stat-val" data-testid="today-training-progress">{done}/{total || 0}</span>
            <span className="today-card__stat-label">Erledigt</span>
          </div>
        </div>
      </div>
      {onStart && (
        <button
          onClick={onStart}
          className="today-card__play"
          data-testid="today-training-start-btn"
          aria-label={ctaLabel || "Training starten"}
        >
          {done > 0 ? <ChevronRight size={26} strokeWidth={3} /> : <Play size={22} strokeWidth={3} fill="#001523" />}
        </button>
      )}
    </div>
  );
}
