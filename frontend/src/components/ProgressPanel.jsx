import { Dumbbell, Utensils, Flame, Moon } from "lucide-react";

/**
 * Big cyan progress ring + 4 sub-progress bars (Training, Ernährung, Motivation, Schlaf).
 * All values are 0-100.
 */
export default function ProgressPanel({ training = 0, nutrition = 0, motivation = 0, sleep = 0 }) {
  const overall = Math.round((training + nutrition + motivation + sleep) / 4);
  const bars = [
    { key: "training", label: "Training", val: training, icon: Dumbbell },
    { key: "nutrition", label: "Ernährung", val: nutrition, icon: Utensils },
    { key: "motivation", label: "Motivation", val: motivation, icon: Flame },
    { key: "sleep", label: "Schlaf", val: sleep, icon: Moon },
  ];

  const R = 42;
  const CIRC = 2 * Math.PI * R;
  const dash = (Math.max(0, Math.min(100, overall)) / 100) * CIRC;

  return (
    <div className="progress-panel enter enter-d2" data-testid="progress-panel">
      <div className="progress-grid">
        <div className="big-ring-wrap" data-testid="overall-progress-ring">
          <svg viewBox="0 0 100 100" className="big-ring-svg">
            <defs>
              <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#66E4FF" />
                <stop offset="55%" stopColor="#00BFFF" />
                <stop offset="100%" stopColor="#0080D8" />
              </linearGradient>
            </defs>
            <circle
              cx="50"
              cy="50"
              r={R}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="8"
              fill="none"
            />
            <circle
              cx="50"
              cy="50"
              r={R}
              stroke="url(#ringGrad)"
              strokeWidth="8"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${CIRC - dash}`}
              style={{
                filter: "drop-shadow(0 0 6px rgba(0,191,255,0.9))",
                transition: "stroke-dasharray 900ms cubic-bezier(0.2,0.9,0.3,1)",
              }}
            />
          </svg>
          <div className="big-ring-center">
            <div className="big-ring-value" data-testid="overall-progress-value">{overall}%</div>
            <div className="big-ring-label">Ziel erreicht</div>
          </div>
        </div>

        <div className="mini-bars">
          {bars.map(({ key, label, val, icon: Icon }) => (
            <div className="mini-bar" key={key} data-testid={`mini-bar-${key}`}>
              <div className="mini-bar__icon"><Icon size={11} /></div>
              <div className="mini-bar__body">
                <div className="mini-bar__row">
                  <span className="mini-bar__label">{label}</span>
                  <span className="mini-bar__val">{Math.round(val)}%</span>
                </div>
                <div className="mini-bar__track">
                  <div className="mini-bar__fill" style={{ width: `${Math.max(0, Math.min(100, val))}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
