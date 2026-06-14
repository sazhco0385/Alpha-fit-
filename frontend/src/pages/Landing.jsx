import { Link, useNavigate } from "react-router-dom";
import { Zap, Brain, TrendingUp, Award, ChevronRight, Crown, Dumbbell } from "lucide-react";
import Logo from "../components/Logo";
import { useAuth } from "../lib/auth";

export default function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleStart = () => {
    if (user) navigate(user.onboarding_completed ? "/dashboard" : "/onboarding");
    else navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Backgrounds */}
      <div className="absolute inset-0 bg-grid opacity-40" />
      <div className="absolute inset-0 bg-radial-blue" />
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1676655079738-af54dfd6318e?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA2MDV8MHwxfHNlYXJjaHwyfHxib2R5YnVpbGRlciUyMGRhcmslMjBneW18ZW58MHx8fHwxNzgxMzk2ODUzfDA&ixlib=rb-4.1.0&q=85')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          maskImage: "linear-gradient(180deg, black 0%, transparent 80%)",
          WebkitMaskImage: "linear-gradient(180deg, black 0%, transparent 80%)",
        }}
      />

      {/* Top */}
      <header className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 flex items-center justify-between">
        <Logo size={36} />
        <div className="flex gap-3">
          <Link to="/auth" className="btn-outline text-sm" data-testid="header-login-btn">Login</Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pt-8 sm:pt-16 pb-16 sm:pb-24 grid md:grid-cols-2 gap-8 md:gap-12 items-center">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 border border-[#00BFFF]/40 text-[#00BFFF] font-chakra text-[10px] sm:text-xs tracking-[0.3em] uppercase mb-4 sm:mb-6 glow-box" data-testid="hero-tag">
            <Zap size={12} /> KI-POWERED FITNESS
          </div>
          <h1 className="font-teko text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold leading-none tracking-wide uppercase">
            <span className="chrome-text block">Werde zum</span>
            <span className="electric-text glow-text block">Alpha.</span>
          </h1>
          <p className="mt-4 sm:mt-6 text-gray-400 text-base sm:text-lg max-w-md font-chakra leading-relaxed">
            Dein KI-Coach erstellt, optimiert und passt deinen Trainingsplan automatisch an –
            jedes Gewicht, jede Wiederholung. <span className="text-[#00BFFF]">7 Tage gratis.</span>
          </p>
          <div className="mt-6 sm:mt-10 flex gap-3 flex-wrap">
            <button onClick={handleStart} className="btn-primary text-base sm:text-lg flex items-center gap-2" data-testid="hero-cta-start">
              JETZT STARTEN <ChevronRight size={20} />
            </button>
            <Link to="/auth" className="btn-outline text-base sm:text-lg" data-testid="hero-cta-login">Login</Link>
          </div>
          <div className="mt-8 sm:mt-12 flex flex-wrap gap-4 sm:gap-8 text-xs sm:text-sm text-gray-500 font-chakra">
            <div><span className="text-[#00BFFF] font-bold text-base sm:text-lg">∞</span> Anpassungen</div>
            <div><span className="text-[#00BFFF] font-bold text-base sm:text-lg">24/7</span> KI-Coach</div>
            <div><span className="text-[#00BFFF] font-bold text-base sm:text-lg">100%</span> Personalisiert</div>
          </div>
        </div>

        {/* Right Visual */}
        <div className="relative order-first md:order-last">
          <div className="relative w-full max-w-xs sm:max-w-md mx-auto aspect-square">
            <div className="absolute inset-0 hex-shield pulse-glow" style={{
              background: "linear-gradient(180deg, #00E5FF, #0066CC)",
            }} />
            <div className="absolute inset-[4px] hex-shield bg-black flex items-center justify-center">
              <div className="text-center">
                <Zap size={80} className="mx-auto text-[#00BFFF] md:w-[120px] md:h-[120px]" style={{ filter: "drop-shadow(0 0 30px rgba(0,229,255,1))" }} />
                <div className="mt-4 font-teko text-3xl sm:text-5xl tracking-widest chrome-text">ALPHA</div>
                <div className="font-teko text-2xl sm:text-3xl electric-text glow-text">PROTOKOLL</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16 grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        {[
          { icon: Brain, title: "KI-COACH", desc: "GPT-5.2 erstellt deinen Plan. Passt sich automatisch an deinen Fortschritt an." },
          { icon: Dumbbell, title: "AUTO-PROGRESSION", desc: "Gewichte & Wiederholungen werden dynamisch optimiert. Du musst nicht denken." },
          { icon: Award, title: "GLOW BADGES", desc: "Sammle Badges. Werde zur Legende. Push die Grenzen." },
        ].map((f) => (
          <div key={f.title} className="af-card p-6 clip-corner-tl-br hover:glow-box transition" data-testid={`feature-${f.title.toLowerCase()}`}>
            <f.icon size={28} className="text-[#00BFFF] mb-3" style={{ filter: "drop-shadow(0 0 8px rgba(0,191,255,0.6))" }} />
            <div className="font-teko text-2xl tracking-wider chrome-text">{f.title}</div>
            <p className="text-gray-400 text-sm mt-2 font-chakra">{f.desc}</p>
          </div>
        ))}
      </section>

      {/* Pricing teaser */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-16 text-center">
        <Crown size={32} className="mx-auto text-[#FFD700]" style={{ filter: "drop-shadow(0 0 12px rgba(255,215,0,0.8))" }} />
        <h2 className="font-teko text-5xl mt-4 chrome-text">PREMIUM AB 9,99€</h2>
        <p className="text-gray-500 font-chakra mt-2">7 Tage kostenlos testen. Jederzeit kündbar.</p>
        <button onClick={handleStart} className="btn-primary mt-6" data-testid="pricing-cta">Premium starten</button>
      </section>

      <footer className="relative z-10 border-t border-[#1A1A24] py-8 mt-16">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-gray-600 font-chakra text-xs tracking-widest uppercase">
          <div>© 2026 Sky-Networks UG · alpha-fit</div>
          <div className="flex gap-6">
            <Link to="/impressum" className="hover:text-[#00BFFF]" data-testid="footer-impressum">Impressum</Link>
            <Link to="/agb" className="hover:text-[#00BFFF]" data-testid="footer-agb">AGB</Link>
            <Link to="/datenschutz" className="hover:text-[#00BFFF]" data-testid="footer-datenschutz">Datenschutz</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
