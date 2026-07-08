import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, ChevronRight, ChevronLeft } from "lucide-react";

/**
 * Lightweight guided onboarding tour. Highlights a sequence of DOM elements
 * (by data-testid), shows a floating card with the explanation, and offers
 * Next / Back / Skip. On completion or skip, persists `af_tour_seen=1` to
 * localStorage so it never nags again (unless explicitly restarted from Help).
 */
export const TOUR_STEPS = [
  {
    selector: '[data-testid="section-coach-toggle"]',
    title: "Alpha Coach",
    body: "Deine Wochen-Analyse. Klicke auf 'ALPHA COACH' um deine KI-Insights + Feedback anzuzeigen. Klick nochmal zum Einklappen.",
  },
  {
    selector: '[data-testid="week-schedule"]',
    title: "Deine Woche",
    body: "Mo-So im Blick. Trainings-Tage sind blau, Rest-Days grau. Drag & Drop Tage zwischen Wochentagen. 'GESCHAFFT' zeigt was du diese Woche schon abgehakt hast.",
  },
  {
    selector: '[data-testid="adjust-plan-btn"]',
    title: "KI-Plan-Anpassung",
    body: "Deine KI passt den Plan an dein Fortschritt an. Sie erhöht Gewichte wo du stärker geworden bist und variiert Übungen. Läuft auch automatisch nach jedem Workout.",
  },
  {
    selector: '[data-testid="dashboard-bodyscan-cta"]',
    title: "Body Scan",
    body: "Foto hochladen → KI analysiert deine Muskeln, Symmetrie & Fortschritt. Ideal alle 4 Wochen für ein visuelles Check-in.",
  },
  {
    selector: '[data-testid="help-btn"]',
    title: "Brauchst du Hilfe?",
    body: "Immer erreichbar oben rechts. Öffnet FAQ + Support-Kontakt und lässt dich diese Tour jederzeit erneut starten.",
  },
];

export default function TourGuide({ onFinish, autostart = false, storageKey = "af_tour_seen" }) {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState(null);
  const cardRef = useRef(null);

  useEffect(() => {
    if (autostart) {
      try {
        const seen = localStorage.getItem(storageKey);
        if (seen !== "1") setActive(true);
      } catch {
        setActive(true);
      }
    }
  }, [autostart, storageKey]);

  useEffect(() => {
    if (!active) return;
    const compute = () => {
      const s = TOUR_STEPS[step];
      if (!s) return;
      const el = document.querySelector(s.selector);
      if (!el) {
        setRect(null);
        return;
      }
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      // Delay a tick so scrolling lands before we read bounds
      setTimeout(() => {
        const r = el.getBoundingClientRect();
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      }, 350);
    };
    compute();
    const onResize = () => compute();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [active, step]);

  const finish = () => {
    try { localStorage.setItem(storageKey, "1"); } catch (_e) { /* ignore */ }
    setActive(false);
    setStep(0);
    onFinish?.();
  };

  const skip = () => finish();
  const next = () => {
    if (step < TOUR_STEPS.length - 1) setStep((s) => s + 1);
    else finish();
  };
  const prev = () => setStep((s) => Math.max(0, s - 1));

  // Imperative API: expose a global start hook so Help modal can start the tour
  useEffect(() => {
    window.__alphafit_start_tour = () => {
      setStep(0);
      setActive(true);
    };
    return () => { delete window.__alphafit_start_tour; };
  }, []);

  if (!active) return null;

  const cur = TOUR_STEPS[step];
  // Compute card position: prefer below the highlighted rect. Clamp into viewport.
  const cardW = 320;
  const cardH = 220;
  const margin = 16;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let cardTop = rect ? rect.top + rect.height + 12 : vh / 2 - cardH / 2;
  let cardLeft = rect ? rect.left + rect.width / 2 - cardW / 2 : vw / 2 - cardW / 2;
  if (rect && cardTop + cardH > vh - margin) {
    // Not enough space below — try above
    cardTop = rect.top - cardH - 12;
  }
  // Final clamp so the card is ALWAYS inside the viewport
  cardTop = Math.max(margin, Math.min(vh - cardH - margin, cardTop));
  cardLeft = Math.max(margin, Math.min(vw - cardW - margin, cardLeft));

  return createPortal(
    <div className="fixed inset-0 z-[9999]" data-testid="tour-overlay" aria-modal="true" role="dialog">
      {/* Dark backdrop click-to-skip */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={skip} />
      {rect && (
        <div
          className="fixed pointer-events-none rounded-md"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow: "0 0 0 3px #00BFFF, 0 0 22px rgba(0,191,255,0.75)",
            borderRadius: 10,
          }}
        />
      )}

      {/* Step card — position:fixed + clamped so it never leaves the viewport */}
      <div
        ref={cardRef}
        className="fixed af-card p-4 shadow-[0_0_28px_rgba(0,191,255,0.35)]"
        style={{ top: cardTop, left: cardLeft, width: cardW }}
        data-testid={`tour-step-${step}`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] text-gray-500 font-chakra uppercase tracking-widest">
            Schritt {step + 1} / {TOUR_STEPS.length}
          </div>
          <button
            type="button"
            onClick={skip}
            className="p-1 text-gray-400 hover:text-white transition"
            aria-label="Tour überspringen"
            data-testid="tour-skip-btn"
          >
            <X size={16} />
          </button>
        </div>
        <h3 className="font-teko text-2xl chrome-text mb-1 tracking-wider">{cur.title.toUpperCase()}</h3>
        <p className="text-sm text-gray-300 font-chakra leading-relaxed mb-4">{cur.body}</p>

        {/* Progress dots */}
        <div className="flex gap-1 mb-4">
          {TOUR_STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded ${i <= step ? "bg-[#00BFFF]" : "bg-gray-700"}`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={skip}
            className="text-xs text-gray-500 hover:text-gray-300 font-chakra uppercase tracking-wider"
            data-testid="tour-skip-link"
          >
            Überspringen
          </button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={prev}
                className="btn-outline text-xs flex items-center gap-1"
                data-testid="tour-prev-btn"
              >
                <ChevronLeft size={14} /> Zurück
              </button>
            )}
            <button
              type="button"
              onClick={next}
              className="btn-primary text-xs flex items-center gap-1"
              data-testid="tour-next-btn"
            >
              {step === TOUR_STEPS.length - 1 ? "FERTIG" : "WEITER"}
              {step < TOUR_STEPS.length - 1 && <ChevronRight size={14} />}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
