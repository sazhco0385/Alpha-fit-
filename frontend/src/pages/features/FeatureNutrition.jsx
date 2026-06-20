import FeatureLanding from "../../components/FeatureLanding";
import { Apple, Camera, PieChart, Zap, Coffee } from "lucide-react";

export default function FeatureNutrition() {
  return (
    <FeatureLanding
      title="Foto-Ernährungs-Tracker — Makros automatisch"
      description="Fotografiere deine Mahlzeit, KI erkennt automatisch Kalorien, Eiweiß, Kohlenhydrate und Fett. Schluss mit nervigem Eintippen. 7 Tage gratis testen."
      path="/features/ernaehrung"
      hero={
        <>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 mb-5 border border-[#00BFFF]/40 rounded-full text-[10px] uppercase tracking-[0.25em] text-[#00BFFF] font-chakra">
            <Apple size={12} /> Foto-AI Ernährungs-Tracker
          </div>
          <h1 className="font-teko text-4xl sm:text-6xl lg:text-7xl chrome-text leading-[0.95] mb-4">
            FOTOGRAFIEREN.<br />FERTIG.
          </h1>
          <p className="prose-af font-chakra text-base sm:text-lg max-w-2xl mx-auto mb-7">
            Vergiss MyFitnessPal-Eintippen. Halte die Kamera auf deinen Teller — Alpha-Fit erkennt jede Komponente und berechnet Makros sofort. Schneller als Bewerten in der Mensa.
          </p>
          <a href="/auth?mode=register" className="btn-primary inline-flex items-center gap-2 text-base px-8 py-3" data-testid="hero-cta">
            <Camera size={16} /> JETZT KOSTENLOS STARTEN
          </a>
          <div className="mt-4 text-[11px] text-gray-500 font-chakra uppercase tracking-widest">7 Tage gratis · auch ohne Kalorienzählen nutzbar</div>
        </>
      }
      benefits={[
        { icon: Camera, title: "Ein Foto. Alle Makros.", text: "Foto vom Teller hochladen → AI erkennt Reis, Hähnchen, Salat, Avocado — und liefert Kalorien, Eiweiß, Carbs und Fett in unter 5 Sekunden." },
        { icon: PieChart, title: "Tages-Übersicht in Echtzeit", text: "Sieh sofort wo du stehst: Protein-Soll erreicht? Carbs zu hoch? Visuell aufbereitet als Donut-Chart. Klar verständlich, nicht nur Zahlen." },
        { icon: Zap, title: "Coach gibt Empfehlungen", text: "Alpha Coach kennt deine Ziele und deine Werte: 'Heute fehlen dir noch 32g Protein — willst du ein Snack-Vorschlag?'. Aktive Hilfe statt nur Tracken." },
      ]}
    >
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="af-card p-5 sm:p-8 clip-corner-tl-br">
          <div className="text-[10px] uppercase tracking-[0.3em] text-[#00BFFF] font-chakra mb-3">SO FUNKTIONIERT'S</div>
          <div className="grid gap-3">
            <Step n="1" icon={Camera} title="Foto knipsen" text="Halte die Kamera auf deinen Teller. Funktioniert auch mit Restaurant-Essen, Snacks, Drinks." />
            <Step n="2" icon={Apple} title="AI erkennt automatisch" text="Reis, Hähnchen, Salat — die KI identifiziert jede Zutat und schätzt die Mengen." />
            <Step n="3" icon={Coffee} title="Makros werden geloggt" text="Speicher mit einem Tap. Frühstück/Mittag/Abendessen/Snack — alles automatisch sortiert." />
          </div>
        </div>
      </section>
    </FeatureLanding>
  );
}

function Step({ n, icon: Icon, title, text }) {
  return (
    <div className="flex items-start gap-3 bg-[#0A0A10] border border-[#1A1A24] p-3 rounded">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00BFFF] to-[#1E90FF] flex items-center justify-center font-teko text-base text-black flex-shrink-0">{n}</div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <Icon size={14} className="text-[#00BFFF]" />
          <span className="font-teko text-base chrome-text">{title}</span>
        </div>
        <div className="text-xs text-gray-300 font-chakra leading-relaxed">{text}</div>
      </div>
    </div>
  );
}
