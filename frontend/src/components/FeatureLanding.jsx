import { useEffect } from "react";
import { Link } from "react-router-dom";
import Logo from "./Logo";
import { ArrowRight, CheckCircle2, Star, Shield, Zap } from "lucide-react";

/**
 * Reusable wrapper for marketing landing pages (Google Ads destinations).
 *
 * Props:
 *   title       - <title> tag content (SEO)
 *   description - <meta name="description"> content (SEO)
 *   path        - canonical path, e.g. "/features/ki-coach"
 *   hero        - hero JSX (icon + headline + subheadline)
 *   benefits    - array of {icon, title, text}
 *   children    - additional content blocks
 *   primaryCTA  - { label, href }
 */
export default function FeatureLanding({ title, description, path, hero, benefits = [], children, primaryCTA }) {
  useEffect(() => {
    const fullTitle = `${title} | alpha-fit`;
    const prev = document.title;
    document.title = fullTitle;

    const upsertMeta = (selector, attrs) => {
      let el = document.head.querySelector(selector);
      if (!el) { el = document.createElement("meta"); document.head.appendChild(el); }
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
      return el;
    };
    const upsertLink = (selector, attrs) => {
      let el = document.head.querySelector(selector);
      if (!el) { el = document.createElement("link"); document.head.appendChild(el); }
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
      return el;
    };
    const meta1 = upsertMeta('meta[name="description"]', { name: "description", content: description });
    const meta2 = upsertMeta('meta[property="og:title"]', { property: "og:title", content: fullTitle });
    const meta3 = upsertMeta('meta[property="og:description"]', { property: "og:description", content: description });
    const meta4 = upsertMeta('meta[property="og:type"]', { property: "og:type", content: "website" });
    const meta5 = upsertMeta('meta[property="og:url"]', { property: "og:url", content: `https://alpha-fit.fitness${path}` });
    const meta6 = upsertMeta('meta[name="twitter:card"]', { name: "twitter:card", content: "summary_large_image" });
    const linkCanon = upsertLink('link[rel="canonical"]', { rel: "canonical", href: `https://alpha-fit.fitness${path}` });
    return () => {
      document.title = prev;
      // Reset description to generic; remove OG to avoid stale tags
      meta1.setAttribute("content", "Alpha-Fit — KI-Powered Fitness Coaching");
      [meta2, meta3, meta4, meta5, meta6].forEach((m) => m.parentNode && m.parentNode.removeChild(m));
      linkCanon.parentNode && linkCanon.parentNode.removeChild(linkCanon);
    };
  }, [title, description, path]);

  const cta = primaryCTA || { label: "Jetzt kostenlos starten", href: "/auth?mode=register" };

  return (
    <div className="min-h-screen bg-[#03030A] text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-black/70 border-b border-[#1A1A24]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center" data-testid="landing-logo">
            <Logo size={32} />
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link to="/auth" className="text-xs font-chakra tracking-widest text-gray-400 hover:text-white uppercase hidden sm:inline" data-testid="landing-login">
              Login
            </Link>
            <Link to={cta.href} className="btn-primary text-[11px] sm:text-sm px-3 py-2 sm:px-4" data-testid="landing-cta-header">
              Gratis Start
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-10 sm:pt-16 pb-12 text-center" data-testid="landing-hero">
        {hero}
      </section>

      {/* Benefits */}
      {benefits.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-12">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {benefits.map((b, idx) => {
              const Icon = b.icon || CheckCircle2;
              return (
                <div key={idx} className="af-card p-5 sm:p-6 clip-corner-tl-br" data-testid={`benefit-${idx}`}>
                  <div className="w-10 h-10 mb-3 flex items-center justify-center rounded-lg bg-gradient-to-br from-[#FF4500]/30 to-[#1A1A24]">
                    <Icon size={20} className="text-[#FF4500]" style={{ filter: "drop-shadow(0 0 8px rgba(255,69,0,0.6))" }} />
                  </div>
                  <div className="font-teko text-xl sm:text-2xl chrome-text leading-tight mb-2">{b.title}</div>
                  <p className="prose-af font-chakra text-sm leading-relaxed">{b.text}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {children}

      {/* Trust Strip */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="af-card p-5 sm:p-6 clip-corner-tl-br flex flex-wrap items-center justify-center gap-4 sm:gap-8 text-center" data-testid="trust-strip">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-[#FF5A1F]" />
            <span className="font-chakra text-xs uppercase tracking-widest">SSL verschlüsselt</span>
          </div>
          <div className="hidden sm:block w-px h-6 bg-[#1A1A24]" />
          <div className="flex items-center gap-2">
            <Star size={18} className="text-[#FFD700]" />
            <span className="font-chakra text-xs uppercase tracking-widest">7 Tage gratis testen</span>
          </div>
          <div className="hidden sm:block w-px h-6 bg-[#1A1A24]" />
          <div className="flex items-center gap-2">
            <Zap size={18} className="text-[#FF5722]" />
            <span className="font-chakra text-xs uppercase tracking-widest">Jederzeit kündbar</span>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-16 text-center" data-testid="landing-bottom-cta">
        <h2 className="font-teko text-3xl sm:text-5xl chrome-text mb-3">BEREIT FÜR DEINEN ALPHA-MODUS?</h2>
        <p className="prose-af font-chakra text-sm sm:text-base mb-6 max-w-xl mx-auto">
          Starte heute. Erste 7 Tage Premium kostenlos. Kein Risiko — kündige jederzeit mit einem Klick.
        </p>
        <Link to={cta.href} className="btn-primary inline-flex items-center gap-2 text-base px-8 py-3" data-testid="landing-cta-footer">
          {cta.label} <ArrowRight size={16} />
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#1A1A24] py-6 px-4">
        <div className="max-w-6xl mx-auto flex flex-wrap justify-center gap-3 sm:gap-6 text-[10px] tracking-widest uppercase text-gray-600 font-chakra">
          <Link to="/legal" className="hover:text-gray-300">Impressum</Link>
          <Link to="/legal#agb" className="hover:text-gray-300">AGB</Link>
          <Link to="/legal#datenschutz" className="hover:text-gray-300">Datenschutz</Link>
          <span>© SKY-NETWORKS UG</span>
        </div>
      </footer>
    </div>
  );
}
