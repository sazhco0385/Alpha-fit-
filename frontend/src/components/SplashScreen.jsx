import { useEffect, useState } from "react";

const SESSION_KEY = "alphafit_splash_seen";

export default function SplashScreen() {
  // Skip if already shown this session
  const [stage, setStage] = useState(() => {
    if (typeof window === "undefined") return "hidden";
    return sessionStorage.getItem(SESSION_KEY) ? "hidden" : "showing";
  });

  useEffect(() => {
    if (stage === "hidden") return;
    if (stage === "showing") {
      sessionStorage.setItem(SESSION_KEY, "1");
      const t = setTimeout(() => setStage("fading"), 1900);
      return () => clearTimeout(t);
    }
    if (stage === "fading") {
      const t = setTimeout(() => setStage("hidden"), 600);
      return () => clearTimeout(t);
    }
  }, [stage]);

  if (stage === "hidden") return null;

  return (
    <div
      className={`splash-root ${stage === "fading" ? "splash-fading" : ""}`}
      data-testid="splash-screen"
    >
      {/* Background grid + radial */}
      <div className="splash-grid" />
      <div className="splash-radial" />
      {/* Scan line */}
      <div className="splash-scanline" />

      <div className="splash-content">
        {/* Helmet with pulsing glow */}
        <div className="splash-helmet-wrap">
          <div className="splash-helmet-glow" />
          <img
            src="/alphafit-helmet.png?v=2"
            alt="alpha-fit"
            className="splash-helmet"
            data-testid="splash-helmet"
          />
        </div>

        {/* Glitch text reveal */}
        <div className="splash-title" data-testid="splash-title">
          <span className="splash-title-base" data-text="ALPHAFIT">ALPHAFIT</span>
        </div>

        {/* Loading bar */}
        <div className="splash-bar">
          <div className="splash-bar-fill" />
        </div>

        <div className="splash-tagline">WERDE ZUM ALPHA</div>
      </div>

      <style>{`
        .splash-root {
          position: fixed;
          inset: 0;
          z-index: 99999;
          background: #000;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          animation: splash-fade-in 220ms ease-out;
          opacity: 1;
          transition: opacity 580ms cubic-bezier(.4,0,.2,1);
        }
        .splash-fading { opacity: 0; pointer-events: none; }

        .splash-grid {
          position: absolute; inset: 0;
          background-image:
            linear-gradient(rgba(0,191,255,0.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,191,255,0.07) 1px, transparent 1px);
          background-size: 48px 48px;
          opacity: .55;
        }
        .splash-radial {
          position: absolute; inset: 0;
          background: radial-gradient(circle at center, rgba(0,191,255,0.18) 0%, transparent 60%);
        }
        .splash-scanline {
          position: absolute;
          left: 0; right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, rgba(0,229,255,0.85), transparent);
          box-shadow: 0 0 14px rgba(0,229,255,0.9);
          animation: splash-scan 1.8s cubic-bezier(.55,.05,.45,.95) infinite;
        }

        .splash-content {
          position: relative;
          z-index: 2;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 22px;
          padding: 24px;
        }

        .splash-helmet-wrap {
          position: relative;
          width: clamp(140px, 36vw, 240px);
          height: clamp(140px, 36vw, 240px);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .splash-helmet-glow {
          position: absolute;
          inset: -25%;
          background: radial-gradient(circle, rgba(0,191,255,0.55) 0%, rgba(0,191,255,0.15) 35%, transparent 70%);
          filter: blur(8px);
          animation: splash-pulse 1.6s ease-in-out infinite;
        }
        .splash-helmet {
          position: relative;
          width: 100%;
          height: 100%;
          object-fit: contain;
          filter:
            drop-shadow(0 0 18px rgba(0,191,255,0.75))
            drop-shadow(0 0 38px rgba(0,191,255,0.35));
          animation: splash-helmet-in 900ms cubic-bezier(.16,1,.3,1) both;
        }

        .splash-title {
          font-family: 'Teko', 'Chakra Petch', sans-serif;
          font-weight: 700;
          letter-spacing: 0.18em;
          font-size: clamp(38px, 8vw, 64px);
          line-height: 1;
          position: relative;
        }
        .splash-title-base {
          position: relative;
          background: linear-gradient(180deg, #ffffff 0%, #a0c8db 55%, #00BFFF 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          text-shadow: 0 0 26px rgba(0,191,255,0.45);
          display: inline-block;
          animation: splash-glitch 1.6s steps(1, end) both;
        }
        .splash-title-base::before,
        .splash-title-base::after {
          content: attr(data-text);
          position: absolute;
          inset: 0;
          background: none;
          -webkit-background-clip: initial;
          background-clip: initial;
          mix-blend-mode: screen;
          pointer-events: none;
        }
        .splash-title-base::before {
          color: #00E5FF;
          transform: translate(-2px, 0);
          clip-path: polygon(0 0, 100% 0, 100% 45%, 0 45%);
          animation: splash-glitch-a 1.6s steps(1, end) both;
        }
        .splash-title-base::after {
          color: #ff3df0;
          transform: translate(2px, 0);
          clip-path: polygon(0 55%, 100% 55%, 100% 100%, 0 100%);
          animation: splash-glitch-b 1.6s steps(1, end) both;
          opacity: .55;
        }

        .splash-bar {
          width: clamp(180px, 32vw, 280px);
          height: 2px;
          background: rgba(0,191,255,0.18);
          position: relative;
          overflow: hidden;
        }
        .splash-bar-fill {
          position: absolute;
          left: 0; top: 0; bottom: 0;
          width: 0;
          background: linear-gradient(90deg, #00BFFF, #00E5FF);
          box-shadow: 0 0 10px rgba(0,229,255,0.9);
          animation: splash-bar 1.8s cubic-bezier(.6,.05,.35,1) forwards;
        }

        .splash-tagline {
          font-family: 'Chakra Petch', sans-serif;
          letter-spacing: 0.45em;
          font-size: 10px;
          color: rgba(0,191,255,0.7);
          text-transform: uppercase;
          opacity: 0;
          animation: splash-tag-in 600ms ease-out 800ms forwards;
        }

        @keyframes splash-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes splash-scan {
          0%   { top: -2px; }
          100% { top: 100%; }
        }
        @keyframes splash-pulse {
          0%, 100% { opacity: 0.65; transform: scale(0.92); }
          50%      { opacity: 1;    transform: scale(1.08); }
        }
        @keyframes splash-helmet-in {
          0%   { opacity: 0; transform: scale(0.6) translateY(8px); filter: drop-shadow(0 0 0 rgba(0,191,255,0)); }
          60%  { opacity: 1; transform: scale(1.05); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes splash-bar {
          0%   { width: 0; }
          100% { width: 100%; }
        }
        @keyframes splash-tag-in {
          to { opacity: 1; }
        }
        @keyframes splash-glitch {
          0%   { opacity: 0; transform: translateY(8px); }
          18%  { opacity: 1; transform: translateY(0); }
          22%  { transform: translate(-2px, 1px); }
          24%  { transform: translate(2px, -1px); }
          26%  { transform: translate(0,0); }
          50%  { transform: translate(-1px, 0); }
          52%  { transform: translate(1px, 0); }
          54%  { transform: translate(0,0); }
          100% { opacity: 1; transform: translate(0,0); }
        }
        @keyframes splash-glitch-a {
          0%, 17% { opacity: 0; }
          18%     { opacity: 1; transform: translate(-3px, 0); clip-path: polygon(0 0, 100% 0, 100% 30%, 0 30%); }
          22%     { transform: translate(2px, 0);  clip-path: polygon(0 10%, 100% 10%, 100% 55%, 0 55%); }
          28%     { transform: translate(-2px, 0); clip-path: polygon(0 0, 100% 0, 100% 45%, 0 45%); }
          42%, 100% { transform: translate(0,0); opacity: 0; }
        }
        @keyframes splash-glitch-b {
          0%, 17% { opacity: 0; }
          18%     { opacity: .6; transform: translate(3px, 0); clip-path: polygon(0 60%, 100% 60%, 100% 100%, 0 100%); }
          24%     { transform: translate(-3px, 0); clip-path: polygon(0 50%, 100% 50%, 100% 90%, 0 90%); }
          30%     { transform: translate(2px, 0);  clip-path: polygon(0 70%, 100% 70%, 100% 100%, 0 100%); }
          42%, 100% { transform: translate(0,0); opacity: 0; }
        }

        @media (prefers-reduced-motion: reduce) {
          .splash-helmet, .splash-helmet-glow, .splash-scanline,
          .splash-title-base, .splash-title-base::before, .splash-title-base::after,
          .splash-bar-fill, .splash-tagline {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
