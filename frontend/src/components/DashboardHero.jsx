import { useEffect, useState } from "react";
import { getDailyQuote } from "../lib/quotes";
import { Flame, Play, Quote as QuoteIcon } from "lucide-react";

/**
 * DashboardHero — mobile-first, cinematic aurora hero.
 * - Time-aware greeting (Morgen / Nachmittag / Abend / Nacht)
 * - Streak flame with live pulse
 * - Daily quote as the emotional anchor (always visible)
 * - Optional resume-workout CTA
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
    <section className="dash-hero" data-testid="dashboard-hero">
      {/* Aurora background */}
      <div className="dash-hero__aurora" aria-hidden />
      <div className="dash-hero__grain" aria-hidden />

      <div className="relative z-10 px-1">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="text-[10px] sm:text-xs text-white/60 font-chakra uppercase tracking-[0.35em]" data-testid="hero-greeting">
            {hi}
          </div>
          {streak > 0 && (
            <div
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[#FF6B35]/40 bg-[#FF6B35]/10"
              data-testid="hero-streak"
              style={{ boxShadow: "0 0 14px rgba(255,107,53,0.25)" }}
            >
              <Flame size={13} className="text-[#FF6B35] flame-pulse" />
              <span className="font-teko text-base leading-none text-[#FFB79A] tracking-wider">
                {streak} <span className="text-[10px] text-[#FF6B35]/80 tracking-widest">{streak === 1 ? "TAG" : "TAGE"}</span>
              </span>
            </div>
          )}
        </div>

        <h1
          className="font-teko text-[2.4rem] leading-[0.95] sm:text-6xl md:text-7xl tracking-tight break-words"
          data-testid="hero-name"
        >
          <span className="chrome-text">HEY </span>
          <span className="electric-text glow-text">{name}</span>
        </h1>

        <div className="text-[11px] sm:text-xs text-white/40 font-chakra uppercase tracking-[0.28em] mt-1">
          {dateStr}
        </div>

        {/* Daily quote — always visible */}
        <div className="dash-quote" data-testid="daily-quote-hero">
          <QuoteIcon size={16} className="text-[#00BFFF] shrink-0 opacity-70 mt-0.5" />
          <div className="min-w-0">
            <p className="font-teko text-lg sm:text-2xl leading-snug text-white tracking-wide">
              „{quote.text}"
            </p>
            <div className="text-[9px] sm:text-[10px] text-white/40 mt-1.5 font-chakra tracking-[0.3em]">
              — {quote.author}
            </div>
          </div>
        </div>

        {onResume && (
          <button
            onClick={onResume}
            className="dash-hero__resume btn-primary w-full mt-4 flex items-center justify-center gap-2"
            data-testid="hero-resume-btn"
          >
            <Play size={18} /> {resumeLabel || "TRAINING FORTSETZEN"}
          </button>
        )}
      </div>
    </section>
  );
}
