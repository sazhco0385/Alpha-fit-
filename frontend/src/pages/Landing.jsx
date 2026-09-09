import { Link, useNavigate } from "react-router-dom";
import {
  Zap, Brain, TrendingUp, Award, ChevronRight, Crown, Dumbbell,
  Flame, Sparkles, Camera, Utensils, HeartPulse, ShieldCheck, Star,
} from "lucide-react";
import Logo from "../components/Logo";
import { useAuth } from "../lib/auth";
import FeatureShowcase from "../components/FeatureShowcase";

export default function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleStart = () => {
    if (user) navigate(user.onboarding_completed ? "/dashboard" : "/onboarding");
    else navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* ═══ Aurora backdrop ═══ */}
      <div className="landing-aurora" aria-hidden />
      <div className="landing-grain" aria-hidden />
      <div className="absolute inset-0 bg-grid opacity-20 pointer-events-none" />

      {/* ═══ Header ═══ */}
      <header className="relative z-20 max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Logo size={32} />
          <span className="font-teko text-2xl tracking-widest hidden sm:inline chrome-text">ALPHA-FIT</span>
        </div>
        <Link to="/auth" className="text-[11px] font-chakra uppercase tracking-[0.25em] text-white/70 hover:text-[#00BFFF] transition px-3 py-2" data-testid="header-login-btn">
          Login
        </Link>
      </header>

      {/* ═══ HERO ═══ */}
      <section className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pt-4 sm:pt-10 pb-10 sm:pb-16" data-testid="landing-hero">
        {/* Trust pill */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#00BFFF]/40 bg-black/40 backdrop-blur mb-5 sm:mb-7" data-testid="trust-pill">
          <span className="w-1.5 h-1.5 rounded-full bg-[#39FF14]" style={{ boxShadow: "0 0 8px #39FF14" }} />
          <span className="text-[10px] sm:text-xs font-chakra tracking-[0.3em] uppercase text-white/85">
            <span className="text-[#00BFFF]">GPT-5.6</span> POWERED · MADE IN 🇩🇪
          </span>
        </div>

        <h1 className="font-teko text-[3.2rem] sm:text-7xl md:text-8xl leading-[0.9] tracking-tight uppercase">
          <span className="chrome-text block">Kein Plan?</span>
          <span className="chrome-text block">Kein Problem.</span>
          <span className="electric-text glow-text block mt-1">Werde Alpha.</span>
        </h1>

        <p className="mt-5 sm:mt-7 text-white/70 text-base sm:text-lg leading-relaxed font-chakra max-w-xl">
          Dein persönlicher <span className="text-white">KI-Coach</span> baut dir jede Woche einen frischen Plan – 
          Gewicht, Wiederholungen, Ernährung, alles automatisch angepasst.  
          <span className="text-[#00BFFF] font-semibold"> 7 Tage gratis. Keine Kreditkarte.</span>
        </p>

        {/* Primary CTA */}
        <div className="mt-7 sm:mt-9 flex flex-col gap-3">
          <button
            onClick={handleStart}
            className="cta-primary group"
            data-testid="hero-cta-start"
          >
            <span>Jetzt starten</span>
            <Sparkles size={18} className="cta-sparkle" />
            <ChevronRight size={20} className="ml-1 transition-transform group-hover:translate-x-1" />
          </button>
          <div className="text-[10px] sm:text-xs font-chakra text-white/45 tracking-[0.2em] uppercase text-center">
            ⚡ 30-Sek-Onboarding · Kündbar jederzeit
          </div>
        </div>

        {/* Live stats */}
        <div className="mt-8 sm:mt-12 grid grid-cols-3 gap-3 sm:gap-6" data-testid="landing-stats">
          <StatCol value="∞" label="Anpassungen" />
          <StatCol value="24/7" label="KI-Coach" />
          <StatCol value="100%" label="Individuell" />
        </div>
      </section>

      {/* ═══ SOCIAL PROOF ═══ */}
      <section className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8" data-testid="social-proof">
        <div className="flex items-center gap-1 justify-center mb-2">
          {[1, 2, 3, 4, 5].map((s) => (
            <Star key={s} size={16} className="text-[#FFD700]" fill="#FFD700" />
          ))}
          <span className="ml-2 font-chakra text-[11px] tracking-[0.2em] text-white/70 uppercase">4.9 / 5</span>
        </div>
        <p className="text-center text-white/60 font-chakra text-sm max-w-lg mx-auto italic">
          {"„Endlich eine App die mir sagt was ich machen soll — und nicht umgekehrt.\""}
        </p>
        <div className="text-center text-[10px] font-chakra text-white/35 tracking-[0.3em] mt-1">
          — MARCO, 27, HAMBURG
        </div>
      </section>

      {/* ═══ FEATURE SHOWCASE — Autoplay demo tiles ═══ */}
      <FeatureShowcase />

      {/* ═══ FEATURE STRIP ═══ */}
      <section className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16" data-testid="features">
        <div className="mb-6 sm:mb-8">
          <div className="text-[10px] sm:text-xs font-chakra text-[#00BFFF] tracking-[0.3em] uppercase mb-2">FEATURES</div>
          <h2 className="font-teko text-4xl sm:text-5xl md:text-6xl leading-tight chrome-text">
            Alles was du brauchst.<br />
            <span className="text-white/50">Nix was du nicht brauchst.</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <FeatureCard
            icon={Brain}
            title="KI-COACH"
            desc="Erstellt & optimiert deinen Plan automatisch. Passt Gewichte an deine Leistung an."
            accent="#00BFFF"
            testid="feature-ki"
          />
          <FeatureCard
            icon={Camera}
            title="BODY-SCAN"
            desc="Foto machen, KI-Analyse deiner Schwachstellen, Plan wird automatisch angepasst."
            accent="#9333EA"
            testid="feature-scan"
          />
          <FeatureCard
            icon={Utensils}
            title="NUTRITION KI"
            desc="Foto vom Essen, Barcode scannen oder manuell. Kalorien & Makros ohne Rechnen."
            accent="#FFD700"
            testid="feature-nutrition"
          />
          <FeatureCard
            icon={HeartPulse}
            title="MUSCLE-HEATMAP"
            desc="Sieh sofort welche Muskelgruppen genug trainiert werden – Live-3D-Silhouette."
            accent="#FF6B35"
            testid="feature-heatmap"
          />
          <FeatureCard
            icon={Award}
            title="GLOW BADGES"
            desc="20+ freischaltbare Badges, Streaks, PR-Feuerwerk. Wie ein Videospiel für's Gym."
            accent="#39FF14"
            testid="feature-badges"
          />
          <FeatureCard
            icon={TrendingUp}
            title="AUTO-PROGRESSION"
            desc="Nach jedem Workout schlägt die KI dir Gewichts- & Rep-Anpassungen für nächstes Mal vor."
            accent="#FF1493"
            testid="feature-progression"
          />
        </div>
      </section>

      {/* ═══ COMPARISON — Us vs Them ═══ */}
      <section className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-14" data-testid="comparison">
        <div className="text-[10px] sm:text-xs font-chakra text-[#00BFFF] tracking-[0.3em] uppercase mb-2 text-center">WARUM ALPHA-FIT</div>
        <h2 className="font-teko text-3xl sm:text-4xl chrome-text text-center leading-tight mb-6">
          Fitness-Apps sind langweilig.<br />
          <span className="electric-text">Wir nicht.</span>
        </h2>

        <div className="af-card p-4 sm:p-6 space-y-3">
          <CompareRow bad="Statische PDF-Pläne" good="Plan passt sich WÖCHENTLICH an" />
          <CompareRow bad="Kalorienrechner-Frust" good="Foto vom Teller, Rest macht die KI" />
          <CompareRow bad="Motivations-Sprüche fake" good="Aurora-PR-Feuerwerk bei jedem neuen Rekord" />
          <CompareRow bad="Coach kostet 200€/Monat" good="9,99€/Monat · 7 Tage gratis" />
        </div>
      </section>

      {/* ═══ PRICING ═══ */}
      <section className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16 text-center" data-testid="pricing">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFD700]/10 border border-[#FFD700]/30 mb-4">
          <Crown size={14} className="text-[#FFD700]" style={{ filter: "drop-shadow(0 0 6px #FFD700)" }} />
          <span className="text-[10px] font-chakra tracking-[0.3em] uppercase text-[#FFD700]">PREMIUM</span>
        </div>
        <h2 className="font-teko text-5xl sm:text-6xl">
          <span className="chrome-text">Ab</span> <span className="electric-text glow-text">9,99€</span> <span className="chrome-text">im Monat</span>
        </h2>
        <p className="text-white/60 font-chakra mt-3 text-sm sm:text-base">
          7 Tage kostenlos testen · Jederzeit kündbar · Keine versteckten Kosten
        </p>

        <button onClick={handleStart} className="cta-primary mt-6 sm:mt-8 mx-auto" data-testid="pricing-cta">
          Kostenlos starten <ChevronRight size={20} />
        </button>

        <div className="mt-6 flex items-center justify-center gap-3 text-[10px] font-chakra text-white/40 tracking-widest uppercase">
          <span className="flex items-center gap-1"><ShieldCheck size={12} className="text-[#39FF14]" /> DSGVO</span>
          <span>·</span>
          <span className="flex items-center gap-1"><Flame size={12} className="text-[#FF6B35]" /> Made in Berlin</span>
          <span>·</span>
          <span>Stripe secure</span>
        </div>
      </section>

      {/* ═══ FINAL AURORA CTA ═══ */}
      <section className="relative z-10 mx-4 sm:mx-6 my-10 sm:my-16 max-w-4xl md:mx-auto rounded-3xl overflow-hidden border border-white/8" style={{background: "linear-gradient(180deg, rgba(10,10,20,0.8), rgba(0,0,0,0.9))"}} data-testid="final-cta">
        <div className="landing-final-aurora" aria-hidden />
        <div className="relative z-10 px-6 sm:px-10 py-12 sm:py-16 text-center">
          <div className="text-[10px] sm:text-xs font-chakra text-[#39FF14] tracking-[0.35em] uppercase mb-3">
            NUR HEUTE
          </div>
          <h2 className="font-teko text-4xl sm:text-6xl leading-none chrome-text">
            Dein neuer<br />
            <span className="electric-text glow-text">Alpha-Ich</span><br />
            wartet.
          </h2>
          <button onClick={handleStart} className="cta-primary mt-6 mx-auto" data-testid="final-cta-btn">
            Jetzt loslegen <ChevronRight size={20} />
          </button>
        </div>
      </section>

      {/* ═══ Footer ═══ */}
      <footer className="relative z-10 border-t border-white/5 py-8 mt-4">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-white/40 font-chakra text-[10px] tracking-widest uppercase">
          <div>© 2026 S.L solutions UG · alpha-fit</div>
          <div className="flex gap-4 sm:gap-6">
            <Link to="/impressum" className="hover:text-[#00BFFF] transition" data-testid="footer-impressum">Impressum</Link>
            <Link to="/agb" className="hover:text-[#00BFFF] transition" data-testid="footer-agb">AGB</Link>
            <Link to="/datenschutz" className="hover:text-[#00BFFF] transition" data-testid="footer-datenschutz">Datenschutz</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function StatCol({ value, label }) {
  return (
    <div className="text-center py-2 border-t border-white/10">
      <div className="font-teko text-3xl sm:text-4xl electric-text glow-text leading-none">{value}</div>
      <div className="text-[9px] sm:text-[10px] font-chakra tracking-[0.3em] uppercase text-white/50 mt-1">{label}</div>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, desc, accent, testid }) {
  return (
    <div
      className="feature-tile"
      style={{ "--accent": accent }}
      data-testid={testid}
    >
      <div className="feature-tile__icon">
        <Icon size={22} style={{ color: accent, filter: `drop-shadow(0 0 8px ${accent}80)` }} />
      </div>
      <div className="font-teko text-xl tracking-wide text-white leading-tight">{title}</div>
      <p className="text-white/55 text-xs sm:text-sm mt-1.5 font-chakra leading-relaxed">{desc}</p>
    </div>
  );
}

function CompareRow({ bad, good }) {
  return (
    <div className="grid grid-cols-2 gap-3 items-center py-1.5 border-b border-white/5 last:border-0">
      <div className="flex items-center gap-2 text-white/40 line-through text-xs sm:text-sm font-chakra">
        <span className="text-red-400">✕</span> {bad}
      </div>
      <div className="flex items-center gap-2 text-white text-xs sm:text-sm font-chakra">
        <span className="text-[#39FF14]">✓</span> {good}
      </div>
    </div>
  );
}
