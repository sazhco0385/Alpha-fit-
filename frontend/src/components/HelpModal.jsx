import { useState } from "react";
import { createPortal } from "react-dom";
import { X, ChevronDown, PlayCircle, Mail } from "lucide-react";

const FAQ = [
  {
    q: "Wie passt die KI meinen Plan an?",
    a: "Nach jedem abgeschlossenen Training checkt die KI dein Volumen, Gewichte und deine Ziel-Reps. Sie erhöht Gewichte (2.5-5 kg) wo du die Ziel-Wiederholungen geschafft hast und variiert Übungen wenn du zu lange den gleichen Reiz hattest. Du kannst die Anpassung jederzeit manuell mit 'KI ANPASSEN' triggern.",
  },
  {
    q: "Wie funktioniert die Wochen-Ansicht?",
    a: "Deine Trainingstage werden aus deinem Onboarding-Profil auf die Wochentage verteilt (z.B. 4 Tage = Mo/Di/Do/Fr). Du kannst die Zuordnung per Drag & Drop ändern oder in 'ANPASSEN' die Wochentage neu wählen. GESCHAFFT-Badges bleiben die ganze Kalenderwoche stehen.",
  },
  {
    q: "Was ist Body Scan?",
    a: "Foto hoch → GPT-5 Vision analysiert Muskeln, Symmetrie und Körperfett-Schätzung. Ideal alle 3-4 Wochen um Fortschritt visuell zu tracken. Kombiniere mit Progress-Fotos + Gym-Light-Filter für maximalen Effekt.",
  },
  {
    q: "Wie funktioniert Nutrition Tracking?",
    a: "Foto vom Essen aufnehmen → KI erkennt Zutaten + berechnet Kalorien/Makros. Oder Barcode scannen (Open Food Facts). 'Kürzlich gegessen' Quick-Add merkt sich deine typischen Meals.",
  },
  {
    q: "Kann ich die Tour später erneut starten?",
    a: "Ja — jederzeit hier im Hilfe-Menü auf 'Tour starten' klicken. Wir zeigen dir die 5 wichtigsten Dashboard-Bereiche.",
  },
  {
    q: "Wo bekomme ich Support?",
    a: "Schreib uns direkt an support@alpha-fit.fitness — wir melden uns meist innerhalb von 24 Stunden. Für dringende Bug-Reports gerne mit Screenshot.",
  },
];

export default function HelpModal({ open, onClose }) {
  const [expanded, setExpanded] = useState(null);
  if (!open) return null;

  const startTour = () => {
    onClose();
    // Small delay so modal closes before tour scrolls
    setTimeout(() => {
      try { localStorage.removeItem("af_tour_seen"); } catch (_e) { /* ignore */ }
      if (window.__alphafit_start_tour) window.__alphafit_start_tour();
    }, 220);
  };

  return createPortal(
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4" data-testid="help-modal" aria-modal="true" role="dialog">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl af-card p-5 sm:p-6 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-teko text-3xl chrome-text tracking-wider">HILFE</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white transition"
            aria-label="Schließen"
            data-testid="help-close-btn"
          >
            <X size={18} />
          </button>
        </div>

        {/* Action row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          <button
            type="button"
            onClick={startTour}
            className="af-card p-3 flex items-center gap-3 hover:border-[#00BFFF] transition text-left"
            data-testid="help-start-tour-btn"
          >
            <PlayCircle size={22} className="text-[#00BFFF] flex-shrink-0" style={{ filter: "drop-shadow(0 0 8px rgba(0,191,255,0.5))" }} />
            <div className="min-w-0">
              <div className="font-teko text-lg chrome-text leading-tight">TOUR STARTEN</div>
              <div className="text-[10px] text-gray-500 font-chakra uppercase tracking-widest">Die 5 wichtigsten Bereiche</div>
            </div>
          </button>
          <a
            href="mailto:support@alpha-fit.fitness"
            className="af-card p-3 flex items-center gap-3 hover:border-[#00BFFF] transition text-left"
            data-testid="help-support-link"
          >
            <Mail size={22} className="text-[#00BFFF] flex-shrink-0" style={{ filter: "drop-shadow(0 0 8px rgba(0,191,255,0.5))" }} />
            <div className="min-w-0">
              <div className="font-teko text-lg chrome-text leading-tight">SUPPORT</div>
              <div className="text-[10px] text-gray-500 font-chakra uppercase tracking-widest truncate">support@alpha-fit.fitness</div>
            </div>
          </a>
        </div>

        <div className="text-[11px] text-gray-500 font-chakra uppercase tracking-widest mb-2">Häufige Fragen</div>
        <div className="space-y-2">
          {FAQ.map((f, i) => {
            const open = expanded === i;
            return (
              <div key={i} className="af-card p-0" data-testid={`faq-item-${i}`}>
                <button
                  type="button"
                  onClick={() => setExpanded(open ? null : i)}
                  className="w-full flex items-center justify-between gap-2 p-3 text-left"
                  aria-expanded={open}
                  data-testid={`faq-toggle-${i}`}
                >
                  <span className="font-chakra text-sm text-gray-200">{f.q}</span>
                  <ChevronDown size={16} className={`text-gray-400 flex-shrink-0 transition-transform ${open ? "rotate-180 text-[#00BFFF]" : ""}`} />
                </button>
                {open && (
                  <div className="px-3 pb-3 text-xs sm:text-sm text-gray-400 font-chakra leading-relaxed" data-testid={`faq-body-${i}`}>
                    {f.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}
