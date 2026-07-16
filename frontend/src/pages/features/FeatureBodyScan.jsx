import FeatureLanding from "../../components/FeatureLanding";
import { Eye, Scan, Target, ShieldAlert, Camera } from "lucide-react";

export default function FeatureBodyScan() {
  return (
    <FeatureLanding
      title="Body-Scan — Vision-AI analysiert deinen Körper"
      description="Lade 3 Fotos hoch (Front, Seite, Rücken) und unser Vision-AI sagt dir, welche Muskelgruppen vernachlässigt sind und welche Übungen du priorisieren solltest. 7 Tage gratis."
      path="/features/body-scan"
      hero={
        <>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 mb-5 border border-[#FF4500]/40 rounded-full text-[10px] uppercase tracking-[0.25em] text-[#FF4500] font-chakra">
            <Eye size={12} /> Powered by GPT-5 Vision
          </div>
          <h1 className="font-teko text-4xl sm:text-6xl lg:text-7xl chrome-text leading-[0.95] mb-4">
            DEIN KÖRPER<br />ZEIGT DIE WAHRHEIT.
          </h1>
          <p className="prose-af font-chakra text-base sm:text-lg max-w-2xl mx-auto mb-7">
            Drei Fotos. Eine ehrliche Analyse. Alpha-Fit erkennt automatisch deine Asymmetrien, schwache Muskelgruppen und Posture-Issues — und passt deinen Trainingsplan in Echtzeit an.
          </p>
          <a href="/auth?mode=register" className="btn-primary inline-flex items-center gap-2 text-base px-8 py-3" data-testid="hero-cta">
            <Scan size={16} /> JETZT KOSTENLOS STARTEN
          </a>
          <div className="mt-4 text-[11px] text-gray-500 font-chakra uppercase tracking-widest">7 Tage gratis · DSGVO-konform · keine Speicherung</div>
        </>
      }
      benefits={[
        { icon: Camera, title: "3 Fotos. 60 Sekunden.", text: "Front, Seite, Rücken — Foto hochladen, kurz warten, fertig. Kein Coach-Termin, keine Vermessung beim Trainer, keine 50€-Beratung." },
        { icon: Target, title: "Konkrete Schwachstellen", text: "Statt vagen 'du musst mehr trainieren' liefert die AI präzise Empfehlungen: 'Hintere Schulter unterentwickelt' oder 'Rechte Quad asymmetrisch'." },
        { icon: ShieldAlert, title: "100% Privat", text: "Deine Fotos werden nur für die Analyse verwendet und sofort gelöscht. Kein Cloud-Speicher, keine Werbung mit deinen Daten, keine Weitergabe." },
      ]}
    >
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="af-card p-5 sm:p-8 clip-corner-tl-br">
          <div className="text-[10px] uppercase tracking-[0.3em] text-[#FF4500] font-chakra mb-3">BEISPIEL-ANALYSE</div>
          <div className="space-y-3 font-chakra text-sm">
            <div className="bg-[#0A0A10] border border-[#1A1A24] p-3 rounded">
              <div className="font-teko text-lg text-[#FF5722] mb-1">⚠️ Schwächen erkannt</div>
              <ul className="space-y-1 text-gray-300 list-disc list-inside">
                <li>Hintere Schultern unterentwickelt (vs. vordere)</li>
                <li>Oberer Rücken kleiner als unterer</li>
                <li>Leichte Beinasymmetrie rechts &gt; links</li>
              </ul>
            </div>
            <div className="bg-[#0A0F1A] border border-[#FF4500]/30 p-3 rounded">
              <div className="font-teko text-lg text-[#FF5A1F] mb-1">✓ Empfohlene Übungen</div>
              <ul className="space-y-1 text-gray-200 list-disc list-inside">
                <li><strong className="text-[#FF5A1F]">Face Pulls 3×15</strong> für hintere Schultern</li>
                <li><strong className="text-[#FF5A1F]">Rudern weiter Griff 4×10</strong> für oberen Rücken</li>
                <li><strong className="text-[#FF5A1F]">Bulgarische Splits</strong> für Bein-Symmetrie</li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </FeatureLanding>
  );
}
