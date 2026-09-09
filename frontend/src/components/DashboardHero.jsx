import { useEffect, useState } from "react";
import { getDailyQuote } from "../lib/quotes";
import { Flame, Play, Quote as QuoteIcon, Zap } from "lucide-react";

/**
 * DashboardHero — MEGA KRASS edition.
 * Cinematic aurora, animated beam border, scanline, staggered entrances,
 * breathing streak pill, glow headline, oversized resume CTA.
 */
function greeting(hour) {
  if (hour < 5) return "GUTE NACHT";
  if (hour < 11) return "GUTEN MORGEN";
  if (hour < 17) return "GUTEN TAG";
  if (hour < 22) return "GUTEN ABEND";
  return "GUTE NACHT";
}

export default function DashboardHero({ user, streak = 0, onResume, resumeLabel }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const quote = getDailyQuote(now);
  const hour = now.getHours();
  const hi = greeting(hour);
  const name = (user?.name || "Alpha").toUpperCase();
  const dateStr = now.toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "long" });

  return (
    <section className="dash-hero--mega enter" data-testid="dashboard-hero">
      <div className="dash-hero__aurora" aria-hidden />
      <div className="dash-hero__grain" aria-hidden />

      <div className="relative z-10 px-1">
        {/* Top row — greeting + streak pill */}
        <div className="flex items-center justify-between gap-3 mb-3 enter enter-d1">
          <div className="flex items-center gap-2">
            <Zap size={12} className="text-[#00E5FF]" style={{ filter: "drop-shadow(0 0 6px rgba(0,229,255,0.8))" }} />
            <div
              className="text-[10px] sm:text-xs text-white/60 font-chakra uppercase tracking-[0.35em]"
              data-testid="hero-greeting"
            >
              {hi}
            </div>
          </div>
          {streak > 0 && (
            <div className="streak-pill" data-testid="hero-streak">
              <Flame size={14} className="text-[#FF6B35] flame-pulse" />
              <span className="font-teko text-lg leading-none text-[#FFB79A] tracking-wider">
                {streak}
                <span className="text-[10px] text-[#FF6B35]/80 tracking-widest ml-1">
                  {streak === 1 ? "TAG" : "TAGE"}
                </span>
              </span>
            </div>
          )}
        </div>

        {/* Headline */}
        <h1
          className="font-teko text-[2.8rem] leading-[0.92] sm:text-7xl md:text-8xl tracking-tight break-words enter enter-d2"
          data-testid="hero-name"
        >
          <span className="chrome-text">HEY </span>
          <span className="electric-text glow-text">{name}</span>
        </h1>

        <div className="text-[11px] sm:text-xs text-white/40 font-chakra uppercase tracking-[0.28em] mt-2 enter enter-d3">
          {dateStr}
        </div>

        {/* Daily quote */}
        <div className="dash-quote--mega enter enter-d4" data-testid="daily-quote-hero">
          <QuoteIcon size={16} className="text-[#00E5FF] shrink-0 opacity-80 mt-0.5" style={{ filter: "drop-shadow(0 0 6px rgba(0,229,255,0.6))" }} />
          <div className="min-w-0">
            <p className="font-teko text-xl sm:text-2xl leading-snug text-white tracking-wide">
              „{quote.text}"
            </p>
            <div className="text-[9px] sm:text-[10px] text-white/40 mt-2 font-chakra tracking-[0.3em]">
              — {quote.author}
            </div>
          </div>
        </div>

        {/* Resume CTA */}
        {onResume && (
          <button
            onClick={onResume}
            className="btn-resume-mega btn-primary w-full mt-5 flex items-center justify-center gap-2 text-base sm:text-lg py-4 enter enter-d5"
            data-testid="hero-resume-btn"
          >
            <Play size={20} />
            {resumeLabel || "TRAINING FORTSETZEN"}
          </button>
        )}
      </div>
    </section>
  );
}
