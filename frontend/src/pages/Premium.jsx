import { useState } from "react";
import Layout from "../components/Layout";
import api from "../lib/api";
import { Crown, Check, Zap, Loader2, Scan, Apple, Brain, Award, Sparkles, Shield, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../lib/auth";

const PLANS = [
  { key: "monthly",   price: "9,99 €",  interval: "/ Monat",      label: "1 MONAT",   desc: "Flexibel testen", popular: false },
  { key: "quarterly", price: "19,99 €", interval: "/ 3 Monate",   label: "3 MONATE",  desc: "≈ 6,66 € / Monat", popular: true,  save: "33% sparen" },
  { key: "yearly",    price: "69,99 €", interval: "/ Jahr",       label: "1 JAHR",    desc: "≈ 5,83 € / Monat", popular: false, save: "42% sparen" },
];

const BENEFITS = [
  { icon: Brain,      title: "KI-Coach 24/7",        desc: "GPT-5.5 powered. Plan-Anpassung & Chat ohne Limits." },
  { icon: Scan,       title: "AI Body Scan",         desc: "Foto-Analyse: Muskelgruppen, Symmetrie, Schwachstellen." },
  { icon: Apple,      title: "AI Nutrition Tracker", desc: "Foto-Erkennung + Makros automatisch berechnet." },
  { icon: TrendingUp, title: "Auto-Progression",     desc: "Gewichte & Wiederholungen passen sich automatisch an." },
  { icon: Award,      title: "Alle Glow-Badges",     desc: "29+ Achievements mit Streaks & Volumen-Meilensteinen." },
  { icon: Shield,     title: "Premium Support",      desc: "Prio-Antworten direkt vom AlphaFit Team." },
];

export default function Premium() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(null);

  const subscribe = async (planKey) => {
    setLoading(planKey);
    try {
      const { data } = await api.post("/payments/checkout", {
        plan: planKey,
        origin_url: window.location.origin,
      });
      window.location.href = data.url;
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Fehler beim Checkout");
      setLoading(null);
    }
  };

  return (
    <Layout>
      {/* Hero */}
      <div className="text-center mb-10 sm:mb-12 relative">
        <div className="absolute inset-0 pointer-events-none opacity-30"
             style={{ background: "radial-gradient(circle at 50% 30%, rgba(201,160,78,0.35) 0%, transparent 55%)" }} />
        <div className="relative">
          <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 mb-4 gold-glow-box gold-pulse" style={{ borderRadius: "50%" }}>
            <Crown size={36} className="text-[#E0B968]" style={{ filter: "drop-shadow(0 0 14px rgba(224,185,104,0.8))" }} />
          </div>
          <h1 className="font-teko text-5xl sm:text-7xl mt-2 tracking-wide">
            <span className="chrome-text">ALPHA </span>
            <span className="gold-chrome" style={{ textShadow: "0 0 30px rgba(224,185,104,0.4)" }}>PREMIUM</span>
          </h1>
          <p className="text-body mt-3 font-chakra text-base sm:text-lg">
            7 Tage kostenlos. Jederzeit kündbar. <span className="gold-text-soft">Werde alpha.</span>
          </p>
        </div>
      </div>

      {user?.is_premium && (
        <div className="af-card p-4 mb-8 text-center gold-border gold-glow-box" data-testid="already-premium">
          <Crown size={20} className="inline text-[#E0B968] mr-2" />
          <span className="font-teko text-lg sm:text-xl tracking-widest gold-chrome">DU BIST PREMIUM MITGLIED</span>
          <div className="text-xs text-body-muted font-chakra mt-1">Aktiv bis: {user.premium_until?.slice(0, 10)}</div>
        </div>
      )}

      {/* Plans */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-12 sm:mb-14">
        {PLANS.map((p) => (
          <div
            key={p.key}
            className={`af-card p-6 clip-corner-tl-br relative ${p.popular ? "gold-glow-box-intense" : ""}`}
            style={p.popular ? { borderColor: "rgba(201,160,78,0.6)" } : undefined}
            data-testid={`plan-${p.key}`}
          >
            {p.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 font-teko text-xs tracking-widest text-[#1A1208]"
                style={{ background: "linear-gradient(180deg, #E8C76E, #C9A04E)", boxShadow: "0 0 24px rgba(201,160,78,0.7)" }}>
                ★ EMPFOHLEN ★
              </div>
            )}
            <div className="text-xs text-body-muted uppercase tracking-widest font-chakra">{p.label}</div>
            <div className="mt-4 flex items-baseline gap-2 flex-wrap">
              <span className={`font-teko text-5xl sm:text-6xl ${p.popular ? "gold-chrome" : "chrome-text"}`}>{p.price}</span>
              <span className="text-body-muted font-chakra text-sm">{p.interval}</span>
            </div>
            <div className={`font-chakra text-sm mt-1 ${p.popular ? "gold-text-soft" : "text-[#00BFFF]"}`}>{p.desc}</div>
            {p.save && <div className="text-[#00FF7F] font-chakra text-xs mt-1 uppercase tracking-widest">{p.save}</div>}

            <div className="mt-5 mb-6 inline-flex items-center gap-2 px-3 py-1 border border-[#00BFFF]/40 text-[#00BFFF] text-xs font-chakra tracking-widest uppercase">
              <Zap size={12} /> 7 TAGE GRATIS
            </div>

            <button
              onClick={() => subscribe(p.key)}
              disabled={loading !== null}
              className={`w-full flex items-center justify-center gap-2 ${p.popular ? "btn-gold" : "btn-primary"}`}
              data-testid={`subscribe-${p.key}`}
            >
              {loading === p.key ? <Loader2 size={16} className="animate-spin" /> : <Crown size={16} />}
              PLAN STARTEN
            </button>
          </div>
        ))}
      </div>

      {/* Benefits */}
      <div className="text-center mb-6">
        <div className="text-[10px] gold-text-soft uppercase tracking-[0.4em] font-chakra mb-1">
          <Sparkles size={12} className="inline mr-1" /> ALPHA VORTEILE
        </div>
        <h2 className="font-teko text-3xl sm:text-4xl gold-chrome">WAS DU BEKOMMST</h2>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-10">
        {BENEFITS.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="af-card p-4 sm:p-5 clip-corner-tl-br transition hover:gold-glow-box" data-testid={`benefit-${title.replace(/\s+/g,'-').toLowerCase()}`}>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 flex items-center justify-center gold-border bg-[#1A140A]" style={{ borderRadius: "8px" }}>
                <Icon size={18} className="text-[#E0B968]" style={{ filter: "drop-shadow(0 0 6px rgba(224,185,104,0.6))" }} />
              </div>
              <h3 className="font-teko text-xl tracking-wide text-white">{title}</h3>
            </div>
            <p className="text-body text-sm font-chakra leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>

      {/* Final CTA */}
      {!user?.is_premium && (
        <div className="af-card p-6 sm:p-8 clip-corner-tl-br text-center gold-border gold-glow-box" data-testid="premium-cta-bottom">
          <Crown size={32} className="inline text-[#E0B968] mb-2" style={{ filter: "drop-shadow(0 0 12px rgba(224,185,104,0.7))" }} />
          <h2 className="font-teko text-3xl sm:text-4xl gold-chrome">BEREIT FÜR DEN ALPHA STATUS?</h2>
          <p className="text-body font-chakra mt-2 mb-5 max-w-xl mx-auto">
            7 Tage kostenlos. Voller Zugriff. Keine Verpflichtung.
          </p>
          <button
            onClick={() => subscribe("quarterly")}
            disabled={loading !== null}
            className="btn-gold inline-flex items-center gap-2"
            data-testid="cta-bottom-subscribe"
          >
            {loading === "quarterly" ? <Loader2 size={16} className="animate-spin" /> : <Crown size={16} />}
            JETZT FREISCHALTEN
          </button>
        </div>
      )}

      {/* Compact checklist */}
      <div className="af-card p-5 sm:p-6 clip-corner-tl-br mt-8">
        <div className="font-teko text-xl gold-chrome mb-3">ALLES INKLUSIVE</div>
        <ul className="grid md:grid-cols-2 gap-2 sm:gap-3">
          {[
            "Unbegrenzte KI-Coach Anfragen",
            "AI Body Scan (Phase 2)",
            "AI Nutrition Tracker mit Foto",
            "Auto-Progression bei jedem Workout",
            "Alle 29+ Glow-Badges",
            "Workout-Resume jederzeit",
            "Volle Onboarding-Anpassung",
            "Premium Support",
          ].map((f) => (
            <li key={f} className="flex items-center gap-3 font-chakra text-body text-sm">
              <Check size={16} className="text-[#E0B968] flex-shrink-0" style={{ filter: "drop-shadow(0 0 4px rgba(224,185,104,0.6))" }} />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>
    </Layout>
  );
}
