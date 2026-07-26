import { useEffect, useRef, useState } from "react";
import { Trophy, Zap } from "lucide-react";

/**
 * FeatureShowcase — 3 mini "hero moments" that autoplay on loop.
 * Pure CSS/SVG/Canvas — no video files. Lightweight, buttery, no autoplay-policy issues.
 * Screens: (1) PR Cinematic (2) Rest-Timer Ring (3) Muscle-Heatmap Sweep.
 */
export default function FeatureShowcase() {
  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16 relative z-10" data-testid="feature-showcase">
      <div className="mb-6 sm:mb-8">
        <div className="text-[10px] sm:text-xs font-chakra text-[#00BFFF] tracking-[0.3em] uppercase mb-2">LIVE VORSCHAU</div>
        <h2 className="font-teko text-4xl sm:text-5xl md:text-6xl leading-tight chrome-text">
          So fühlt sich Training an.<br />
          <span className="electric-text glow-text">Wie ein Videospiel.</span>
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <ShowcaseTile
          title="PR-EXPLOSION"
          subtitle="Jeder neue Rekord wird gefeiert"
          accent="#39FF14"
          testid="showcase-pr"
        >
          <PRPreview />
        </ShowcaseTile>

        <ShowcaseTile
          title="REST-TIMER RING"
          subtitle="Wissenschaftliche Pausen pro Übung"
          accent="#00BFFF"
          testid="showcase-timer"
        >
          <RestRingPreview />
        </ShowcaseTile>

        <ShowcaseTile
          title="MUSKEL-HEATMAP"
          subtitle="Sieh live welche Muskeln fehlen"
          accent="#FF1493"
          testid="showcase-heatmap"
        >
          <HeatmapPreview />
        </ShowcaseTile>
      </div>
    </section>
  );
}

function ShowcaseTile({ title, subtitle, accent, children, testid }) {
  return (
    <div
      className="showcase-tile"
      style={{ "--accent": accent }}
      data-testid={testid}
    >
      <div className="showcase-tile__stage">{children}</div>
      <div className="showcase-tile__meta">
        <div className="font-teko text-lg sm:text-xl tracking-wide text-white leading-tight">{title}</div>
        <div className="text-white/50 text-[11px] sm:text-xs mt-0.5 font-chakra">{subtitle}</div>
      </div>
    </div>
  );
}

/* ═══════════ 1. PR Cinematic Preview ═══════════ */
function PRPreview() {
  const canvasRef = useRef(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    // Loop the burst every 3.5s
    const start = performance.now();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;

    const palette = ["#39FF14", "#FFD700", "#00E5FF", "#FF1493", "#FFFFFF"];
    let particles = [];
    let lastBurst = -1e6;
    let raf;

    const burst = () => {
      particles = [];
      for (let i = 0; i < 45; i++) {
        particles.push({
          x: w / 2 + (Math.random() - 0.5) * 12,
          y: h / 2 + (Math.random() - 0.5) * 6,
          vx: (Math.random() - 0.5) * 4.2,
          vy: -Math.random() * 3.5 - 0.5,
          g: 0.12,
          size: 2 + Math.random() * 3,
          color: palette[Math.floor(Math.random() * palette.length)],
          ang: Math.random() * Math.PI * 2,
          vAng: (Math.random() - 0.5) * 0.2,
          life: 1,
        });
      }
    };

    const draw = (t) => {
      const elapsed = t - start;
      // Loop every 3500ms
      if (elapsed - lastBurst > 3500 || lastBurst < 0) {
        burst();
        lastBurst = elapsed;
        setTick((x) => x + 1);
      }
      ctx.clearRect(0, 0, w, h);
      for (const p of particles) {
        p.vy += p.g;
        p.vx *= 0.98;
        p.x += p.vx;
        p.y += p.vy;
        p.ang += p.vAng;
        p.life = Math.max(0, p.life - 0.008);
        if (p.life <= 0) continue;
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.ang);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 5;
        ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size / 1.5);
        ctx.restore();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  const flashKey = tick; // re-trigger flash keyframe per burst

  return (
    <div className="pr-preview">
      <div className="pr-preview__aurora" />
      <div className="pr-preview__flash" key={flashKey} />
      <canvas ref={canvasRef} width={220} height={220} className="pr-preview__canvas" />
      <div className="pr-preview__content">
        <div className="pr-preview__badge">
          <Trophy size={9} /> GOLD
        </div>
        <div className="pr-preview__title">NEW PR</div>
        <div className="pr-preview__lift">
          <span>120</span>
          <span className="pr-preview__unit">kg × 8</span>
        </div>
        <div className="pr-preview__improvement">
          <Zap size={9} /> +5.2%
        </div>
      </div>
    </div>
  );
}

/* ═══════════ 2. Rest-Timer Ring Preview ═══════════ */
function RestRingPreview() {
  const [progress, setProgress] = useState(1); // 1 = full, 0 = empty
  const [count, setCount] = useState(90);
  const startRef = useRef(performance.now());

  useEffect(() => {
    const total = 90;
    let raf;
    const tick = (t) => {
      const elapsed = ((t - startRef.current) / 1000) % (total + 1.5);
      const sec = Math.max(0, total - Math.floor(elapsed));
      setCount(sec);
      setProgress(1 - elapsed / total);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const size = 200;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const dashOffset = circ * (1 - Math.max(0, Math.min(1, progress)));

  return (
    <div className="ring-preview">
      <div className="ring-preview__inner-glow" />
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="ring-preview__svg">
        <defs>
          <linearGradient id="ring-grad-lp" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00E5FF" />
            <stop offset="50%" stopColor="#00BFFF" />
            <stop offset="100%" stopColor="#9333EA" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="url(#ring-grad-lp)" strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ filter: "drop-shadow(0 0 6px rgba(0,191,255,0.6))" }}
        />
      </svg>
      <div className="ring-preview__center">
        <div className="ring-preview__count">{count}</div>
        <div className="ring-preview__label">SEK</div>
      </div>
      <div className="ring-preview__chip">GRUNDÜBUNG</div>
    </div>
  );
}

/* ═══════════ 3. Muscle Heatmap Preview ═══════════ */
function HeatmapPreview() {
  // Loop through muscle groups being "hit"
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setPhase((p) => (p + 1) % 6), 700);
    return () => clearInterval(t);
  }, []);

  // Each phase highlights different muscle group with different intensity
  const groups = ["chest", "delt", "biceps", "quads", "abs", "back"];
  const getIntensity = (g) => {
    // Cycling wave through groups
    const idx = groups.indexOf(g);
    const dist = Math.abs(idx - phase);
    if (dist === 0) return 1;
    if (dist === 1) return 0.65;
    if (dist === 2) return 0.35;
    return 0.15;
  };
  const heat = (g) => {
    const i = getIntensity(g);
    if (i >= 0.9) return "#FF1493"; // hot
    if (i >= 0.6) return "#FF6B35";
    if (i >= 0.3) return "#FFD700";
    return "#00BFFF";
  };

  return (
    <div className="heatmap-preview">
      <svg viewBox="0 0 120 180" className="heatmap-preview__svg" preserveAspectRatio="xMidYMid meet">
        {/* Body silhouette - simplified male torso */}
        <defs>
          <filter id="glow-hm" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {/* Head */}
        <circle cx="60" cy="18" r="10" fill="#1a1a24" stroke="#333" strokeWidth="0.5" />
        {/* Torso outline */}
        <path
          d="M 42 30 Q 42 26 46 26 L 74 26 Q 78 26 78 30 L 82 52 Q 90 56 90 65 L 88 80 L 82 78 L 82 100 Q 78 112 76 122 L 70 148 L 64 175 L 56 175 L 50 148 L 44 122 Q 42 112 38 100 L 38 78 L 32 80 L 30 65 Q 30 56 38 52 Z"
          fill="#0f0f18" stroke="#2a2a38" strokeWidth="0.6"
        />
        {/* Chest */}
        <ellipse cx="52" cy="45" rx="8" ry="7" fill={heat("chest")} opacity={getIntensity("chest") * 0.85} filter="url(#glow-hm)" />
        <ellipse cx="68" cy="45" rx="8" ry="7" fill={heat("chest")} opacity={getIntensity("chest") * 0.85} filter="url(#glow-hm)" />
        {/* Delts */}
        <circle cx="36" cy="42" r="6" fill={heat("delt")} opacity={getIntensity("delt") * 0.85} filter="url(#glow-hm)" />
        <circle cx="84" cy="42" r="6" fill={heat("delt")} opacity={getIntensity("delt") * 0.85} filter="url(#glow-hm)" />
        {/* Biceps */}
        <ellipse cx="30" cy="60" rx="4" ry="8" fill={heat("biceps")} opacity={getIntensity("biceps") * 0.85} filter="url(#glow-hm)" />
        <ellipse cx="90" cy="60" rx="4" ry="8" fill={heat("biceps")} opacity={getIntensity("biceps") * 0.85} filter="url(#glow-hm)" />
        {/* Abs */}
        <rect x="54" y="68" width="12" height="26" rx="2" fill={heat("abs")} opacity={getIntensity("abs") * 0.85} filter="url(#glow-hm)" />
        {/* Quads */}
        <ellipse cx="52" cy="130" rx="7" ry="16" fill={heat("quads")} opacity={getIntensity("quads") * 0.85} filter="url(#glow-hm)" />
        <ellipse cx="68" cy="130" rx="7" ry="16" fill={heat("quads")} opacity={getIntensity("quads") * 0.85} filter="url(#glow-hm)" />
      </svg>

      {/* Live label */}
      <div className="heatmap-preview__label">
        <span className="heatmap-preview__dot" style={{ background: heat(groups[phase]) }} />
        {groups[phase].toUpperCase()} · {(getIntensity(groups[phase]) * 100).toFixed(0)}%
      </div>

      {/* Legend */}
      <div className="heatmap-preview__legend">
        <span style={{ background: "#00BFFF" }} />
        <span style={{ background: "#FFD700" }} />
        <span style={{ background: "#FF6B35" }} />
        <span style={{ background: "#FF1493" }} />
      </div>
    </div>
  );
}
