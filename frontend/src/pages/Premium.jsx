import { useState } from "react";
import Layout from "../components/Layout";
import api from "../lib/api";
import { Crown, Check, Zap, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../lib/auth";

const PLANS = [
  { key: "monthly", price: "9,99 €", interval: "/ Monat", label: "1 MONAT", desc: "Flexibel testen", popular: false },
  { key: "quarterly", price: "19,99 €", interval: "/ 3 Monate", label: "3 MONATE", desc: "≈ 6,66 € / Monat", popular: true, save: "33% sparen" },
  { key: "yearly", price: "69,99 €", interval: "/ Jahr", label: "1 JAHR", desc: "≈ 5,83 € / Monat", popular: false, save: "42% sparen" },
];

const FEATURES = [
  "KI-Coach mit GPT-5.2",
  "Unbegrenzte Trainingspläne",
  "Auto-Progression (Gewicht & Whdh.)",
  "Volle Onboarding-Anpassung",
  "Alle Glow-Badges",
  "Workout-Resume jederzeit",
  "Premium Support",
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
      <div className="text-center mb-10">
        <Crown size={48} className="mx-auto text-[#FFD700]" style={{ filter: "drop-shadow(0 0 16px rgba(255,215,0,0.8))" }} />
        <h1 className="font-teko text-6xl mt-3 chrome-text">ALPHA <span className="electric-text glow-text">PREMIUM</span></h1>
        <p className="text-gray-400 font-chakra mt-2">7 Tage kostenlos. Jederzeit kündbar. Werde alpha.</p>
      </div>

      {user?.is_premium && (
        <div className="af-card p-4 mb-6 text-center border-[#00BFFF] glow-box" data-testid="already-premium">
          <Crown size={20} className="inline text-[#00BFFF] mr-2" />
          <span className="font-teko text-xl tracking-widest">DU BIST PREMIUM MITGLIED</span>
          <div className="text-xs text-gray-500 font-chakra mt-1">Aktiv bis: {user.premium_until?.slice(0, 10)}</div>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6 mb-12">
        {PLANS.map((p) => (
          <div
            key={p.key}
            className={`af-card p-6 clip-corner-tl-br relative ${p.popular ? "tracing-border glow-box-intense border-[#00BFFF]" : ""}`}
            data-testid={`plan-${p.key}`}
          >
            {p.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 font-teko text-xs tracking-widest text-black"
                style={{ background: "linear-gradient(180deg, #00E5FF, #00BFFF)", boxShadow: "0 0 20px rgba(0,229,255,0.8)" }}>
                ★ EMPFOHLEN ★
              </div>
            )}
            <div className="text-xs text-gray-500 uppercase tracking-widest font-chakra">{p.label}</div>
            <div className="mt-4">
              <span className="font-teko text-6xl chrome-text">{p.price}</span>
              <span className="text-gray-500 font-chakra ml-2 text-sm">{p.interval}</span>
            </div>
            <div className="text-[#00BFFF] font-chakra text-sm mt-1">{p.desc}</div>
            {p.save && <div className="text-[#00FF7F] font-chakra text-xs mt-1 uppercase tracking-widest">{p.save}</div>}

            <div className="mt-5 mb-6 inline-flex items-center gap-2 px-3 py-1 border border-[#00BFFF]/40 text-[#00BFFF] text-xs font-chakra tracking-widest uppercase">
              <Zap size={12} /> 7 TAGE GRATIS
            </div>

            <button
              onClick={() => subscribe(p.key)}
              disabled={loading !== null}
              className="btn-primary w-full flex items-center justify-center gap-2"
              data-testid={`subscribe-${p.key}`}
            >
              {loading === p.key ? <Loader2 size={16} className="animate-spin" /> : <Crown size={16} />}
              PLAN STARTEN
            </button>
          </div>
        ))}
      </div>

      <div className="af-card p-6 clip-corner-tl-br">
        <div className="font-teko text-2xl chrome-text mb-4">WAS DU BEKOMMST</div>
        <ul className="grid md:grid-cols-2 gap-3">
          {FEATURES.map((f) => (
            <li key={f} className="flex items-center gap-3 font-chakra">
              <Check size={18} className="text-[#00BFFF]" style={{ filter: "drop-shadow(0 0 6px rgba(0,191,255,0.6))" }} />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>
    </Layout>
  );
}
