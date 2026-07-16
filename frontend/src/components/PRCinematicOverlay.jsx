import { useEffect, useRef, useState } from "react";
import { Trophy, Zap } from "lucide-react";

/**
 * PRCinematicOverlay — Volt-Green Aurora flash + canvas confetti + kinetic "PR!" text.
 * Renders fullscreen when `pr` is provided. Auto-dismisses after `duration` ms.
 *
 * Props:
 *   pr: {exercise_name, weight_kg, reps, rarity, improvement_pct, is_first, e1rm}
 *   duration: ms before auto-close (default 3000)
 *   onDone: callback when overlay closes
 */
export default function PRCinematicOverlay({ pr, duration = 3000, onDone }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!pr) return undefined;
    // Haptic if supported
    if (navigator?.vibrate) {
      try { navigator.vibrate([15, 30, 15, 30, 15]); } catch { /* noop */ }
    }
    // Confetti physics
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);

    const rarityColors = {
      mythic:  ["#39FF14", "#00FFB3", "#FFD700", "#FF1493", "#00E5FF"],
      gold:    ["#39FF14", "#FFD700", "#FFB800", "#00E5FF"],
      silver:  ["#39FF14", "#C0C0C0", "#00E5FF", "#FFFFFF"],
      bronze:  ["#39FF14", "#CD7F32", "#00E5FF"],
    };
    const palette = rarityColors[pr.rarity] || rarityColors.bronze;

    const particles = [];
    const shapes = ["rect", "circle", "triangle"];
    const count = pr.rarity === "mythic" ? 240 : pr.rarity === "gold" ? 180 : 120;
    for (let i = 0; i < count; i++) {
      particles.push({
        x: w / 2 + (Math.random() - 0.5) * 60,
        y: h / 2 + (Math.random() - 0.5) * 30,
        vx: (Math.random() - 0.5) * 14,
        vy: -Math.random() * 12 - 3,
        g: 0.35 + Math.random() * 0.15,
        drag: 0.985,
        size: 5 + Math.random() * 7,
        color: palette[Math.floor(Math.random() * palette.length)],
        angle: Math.random() * Math.PI * 2,
        vAngle: (Math.random() - 0.5) * 0.4,
        shape: shapes[Math.floor(Math.random() * shapes.length)],
        life: 1,
      });
    }

    const start = performance.now();
    const durationMs = duration;

    const tick = (t) => {
      const elapsed = t - start;
      const fade = elapsed > durationMs - 600 ? Math.max(0, (durationMs - elapsed) / 600) : 1;
      ctx.clearRect(0, 0, w, h);
      for (const p of particles) {
        p.vy += p.g;
        p.vx *= p.drag;
        p.vy *= 0.995;
        p.x += p.vx;
        p.y += p.vy;
        p.angle += p.vAngle;
        p.life = fade;

        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        if (p.shape === "rect") {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        } else if (p.shape === "circle") {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.moveTo(0, -p.size / 2);
          ctx.lineTo(p.size / 2, p.size / 2);
          ctx.lineTo(-p.size / 2, p.size / 2);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }

      if (elapsed < durationMs) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setVisible(false);
        setTimeout(() => onDone?.(), 250);
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    // Escape / tap-to-close (skips gracefully)
    const dismiss = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setVisible(false);
      setTimeout(() => onDone?.(), 200);
    };
    const onKey = (e) => { if (e.key === "Escape") dismiss(); };
    window.addEventListener("keydown", onKey);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("keydown", onKey);
    };
  }, [pr, duration, onDone]);

  if (!pr) return null;

  const label = pr.is_first ? "ERSTER PR" : `+${pr.improvement_pct ?? 0}%`;
  const rarityLabel = { mythic: "MYTHIC", gold: "GOLD", silver: "SILVER", bronze: "BRONZE" }[pr.rarity] || "PR";

  return (
    <div
      className={`pr-overlay ${visible ? "pr-overlay--in" : "pr-overlay--out"}`}
      data-testid="pr-cinematic-overlay"
      onClick={() => { setVisible(false); setTimeout(() => onDone?.(), 200); }}
    >
      <div className="pr-aurora" aria-hidden />
      <div className="pr-flash" aria-hidden />
      <canvas ref={canvasRef} className="pr-confetti" aria-hidden />

      <div className="pr-content">
        <div className="pr-rarity" data-testid="pr-rarity">
          <Trophy size={14} /> {rarityLabel}
        </div>
        <div className="pr-title">
          <span className="pr-title__glitch" data-text="NEW PR">NEW PR</span>
        </div>
        <div className="pr-exercise" data-testid="pr-exercise">{pr.exercise_name}</div>
        <div className="pr-lift">
          <span className="pr-lift__num">{pr.weight_kg}</span>
          <span className="pr-lift__unit">kg</span>
          <span className="pr-lift__x">×</span>
          <span className="pr-lift__num">{pr.reps}</span>
        </div>
        <div className="pr-improvement">
          <Zap size={12} /> {label}
        </div>
      </div>
    </div>
  );
}
