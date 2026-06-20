import FeatureLanding from "../../components/FeatureLanding";
import { Brain, MessageSquareText, RefreshCw, TrendingUp, Sparkles } from "lucide-react";

export default function FeatureKICoach() {
  return (
    <FeatureLanding
      title="KI Coach — 24/7 Persönlicher Trainer im Chat"
      description="Dein persönlicher KI-Trainer schreibt dir individuelle Trainingspläne, antwortet 24/7 auf Fragen und passt sich an deine Fortschritte an. 7 Tage gratis testen."
      path="/features/ki-coach"
      hero={
        <>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 mb-5 border border-[#00BFFF]/40 rounded-full text-[10px] uppercase tracking-[0.25em] text-[#00BFFF] font-chakra">
            <Brain size={12} /> Powered by GPT-5
          </div>
          <h1 className="font-teko text-4xl sm:text-6xl lg:text-7xl chrome-text leading-[0.95] mb-4">
            DEIN KI COACH<br />SCHREIBT DEN PLAN.
          </h1>
          <p className="prose-af font-chakra text-base sm:text-lg max-w-2xl mx-auto mb-7">
            Vergiss generische Pläne aus dem Internet. Alpha Coach generiert dir einen individuellen Trainingsplan in unter 30 Sekunden — basierend auf deinem Ziel, deinem Level und deiner verfügbaren Zeit.
          </p>
          <a href="/auth?mode=register" className="btn-primary inline-flex items-center gap-2 text-base px-8 py-3" data-testid="hero-cta">
            <Brain size={16} /> JETZT KOSTENLOS STARTEN
          </a>
          <div className="mt-4 text-[11px] text-gray-500 font-chakra uppercase tracking-widest">7 Tage gratis · kein Risiko</div>
        </>
      }
      benefits={[
        { icon: MessageSquareText, title: "Chat statt App-Geklicker", text: "Frag den Coach alles — von 'Wie soll mein Bizeps-Training aussehen?' bis 'Warum stagniert mein Bankdrücken?'. Antwort sofort, ohne Termin." },
        { icon: RefreshCw, title: "Plan passt sich automatisch an", text: "Schaffst du die Reps nicht? Coach reduziert. Knackst du jedes Set? Coach erhöht. Dein Plan bleibt immer in der perfekten Schwierigkeit." },
        { icon: TrendingUp, title: "Daten-driven Insights", text: "Wöchentliche Analyse: Volumen-Trend, Stagnations-Warnungen, Streak-Push. Du siehst nicht nur was du trainierst, sondern warum es wirkt." },
      ]}
    >
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="af-card p-5 sm:p-8 clip-corner-tl-br">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={16} className="text-[#FFD700]" />
            <span className="text-[10px] uppercase tracking-[0.3em] text-[#FFD700] font-chakra">Beispiel-Chat</span>
          </div>
          <div className="space-y-3">
            <div className="bg-[#0A0A10] border border-[#1A1A24] p-3 rounded">
              <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">DU</div>
              <div className="font-chakra text-sm text-gray-200">Ich habe heute keine Lust auf Beine. Was kann ich stattdessen machen?</div>
            </div>
            <div className="bg-[#0A0F1A] border border-[#00BFFF]/30 p-3 rounded">
              <div className="text-[10px] uppercase tracking-widest text-[#00BFFF] mb-1">ALPHA COACH</div>
              <div className="font-chakra text-sm text-gray-200">
                Verstehe. Lass uns deine Brust prio-isieren. Aber wir verschieben Beine auf morgen — sonst hast du Mo + Sa die gleichen Belastungen, was nicht optimal regeneriert.<br /><br />
                Mein Vorschlag: <strong className="text-[#00E5FF]">Bankdrücken 4×6 → Schrägbank 3×8 → Dips 3×AMRAP → Trizeps Pushdown 3×12</strong>. 45min, dann bist du raus. Ready?
              </div>
            </div>
          </div>
        </div>
      </section>
    </FeatureLanding>
  );
}
