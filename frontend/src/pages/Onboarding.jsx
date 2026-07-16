import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Target, User, Calendar, Ruler, Weight, Activity, Dumbbell, Heart, ChevronRight, ChevronLeft, Loader2 } from "lucide-react";
import Logo from "../components/Logo";
import api from "../lib/api";
import { useAuth } from "../lib/auth";
import { toast } from "sonner";

const STEPS = [
  { key: "goal", label: "Was ist dein Ziel?", icon: Target, options: [
    { v: "muscle_gain", l: "Muskelaufbau" },
    { v: "fat_loss", l: "Fettabbau" },
    { v: "strength", l: "Maximalkraft" },
    { v: "endurance", l: "Ausdauer" },
    { v: "general", l: "Allgemeine Fitness" },
  ]},
  { key: "experience", label: "Trainings-Erfahrung", icon: Activity, options: [
    { v: "beginner", l: "Anfänger (< 6 Monate)" },
    { v: "intermediate", l: "Fortgeschritten (6M - 2J)" },
    { v: "advanced", l: "Profi (2+ Jahre)" },
  ]},
  { key: "gender", label: "Geschlecht", icon: User, options: [
    { v: "male", l: "Männlich" },
    { v: "female", l: "Weiblich" },
    { v: "diverse", l: "Divers" },
  ]},
  { key: "age", label: "Wie alt bist du?", icon: Calendar, input: "number", placeholder: "z.B. 28", min: 14, max: 99 },
  { key: "height_cm", label: "Größe in cm", icon: Ruler, input: "number", placeholder: "z.B. 180", min: 100, max: 250 },
  { key: "weight_kg", label: "Gewicht in kg", icon: Weight, input: "number", placeholder: "z.B. 80", min: 30, max: 250 },
  { key: "days_per_week", label: "Trainingstage / Woche", icon: Calendar, options: [
    { v: 2, l: "2 Tage" }, { v: 3, l: "3 Tage" }, { v: 4, l: "4 Tage" }, { v: 5, l: "5 Tage" }, { v: 6, l: "6 Tage" },
  ]},
  { key: "equipment", label: "Equipment", icon: Dumbbell, options: [
    { v: "gym", l: "Gym (Vollausstattung)" },
    { v: "home", l: "Home Gym" },
    { v: "minimal", l: "Minimal (Bodyweight)" },
  ]},
  { key: "injuries", label: "Verletzungen / Einschränkungen?", icon: Heart, input: "text", placeholder: "z.B. Knie, oder leer lassen" },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [step, setStep] = useState(0);
  const [data, setData] = useState({ injuries: "" });
  const [loading, setLoading] = useState(false);

  const current = STEPS[step];
  const progress = ((step + 1) / STEPS.length) * 100;

  const setValue = (v) => setData({ ...data, [current.key]: v });

  const next = async () => {
    if (current.input && data[current.key] === undefined && current.key !== "injuries") {
      toast.error("Bitte ausfüllen");
      return;
    }
    if (current.options && data[current.key] === undefined) {
      toast.error("Bitte auswählen");
      return;
    }
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      setLoading(true);
      try {
        await api.post("/onboarding", {
          goal: data.goal,
          experience: data.experience,
          gender: data.gender,
          age: Number(data.age),
          height_cm: Number(data.height_cm),
          weight_kg: Number(data.weight_kg),
          days_per_week: Number(data.days_per_week),
          equipment: data.equipment,
          injuries: data.injuries || "",
        });
        toast.success("Plan wird generiert...");
        await refresh();
        navigate("/dashboard");
      } catch (err) {
        toast.error(err?.response?.data?.detail || "Fehler");
      } finally {
        setLoading(false);
      }
    }
  };

  const back = () => step > 0 && setStep(step - 1);

  const Icon = current.icon;

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden flex flex-col">
      <div className="absolute inset-0 bg-grid opacity-30" />
      <div className="absolute inset-0 bg-radial-blue" />

      <header className="relative z-10 p-6 flex items-center justify-between">
        <Logo size={36} />
        <div className="font-teko text-2xl tracking-widest chrome-text" data-testid="onboarding-step-indicator">
          {step + 1} / {STEPS.length}
        </div>
      </header>

      <div className="relative z-10 h-1 bg-[#0A0A10]">
        <div
          className="h-full transition-all duration-500"
          style={{
            width: `${progress}%`,
            background: "linear-gradient(90deg, #00E5FF, #00BFFF)",
            boxShadow: "0 0 12px rgba(0,229,255,0.8)",
          }}
        />
      </div>

      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-2xl" data-testid={`onboarding-step-${current.key}`}>
          <div className="flex items-start sm:items-center gap-3 mb-5 sm:mb-6">
            <div className="w-10 h-10 sm:w-12 sm:h-12 hex-shield flex items-center justify-center flex-shrink-0 relative" style={{
              background: "linear-gradient(180deg, #00E5FF, #1E90FF)",
            }}>
              <div className="absolute inset-[2px] hex-shield bg-black flex items-center justify-center">
                <Icon size={18} className="text-[#00BFFF]" />
              </div>
            </div>
            <h2 className="font-teko text-2xl sm:text-4xl md:text-5xl tracking-wide chrome-text leading-tight">{current.label}</h2>
          </div>

          {current.options && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 sm:mt-6">
              {current.options.map((opt) => (
                <button
                  key={opt.v}
                  onClick={() => setValue(opt.v)}
                  className={`af-card p-4 sm:p-5 text-left transition-all clip-corner-tl-br ${
                    data[current.key] === opt.v
                      ? "border-[#00BFFF] glow-box-intense"
                      : "hover:border-[#00BFFF]/50"
                  }`}
                  data-testid={`onboarding-option-${opt.v}`}
                >
                  <span className="font-teko text-lg sm:text-xl tracking-wide">{opt.l}</span>
                </button>
              ))}
            </div>
          )}

          {current.input && (
            <div className="mt-6">
              <input
                type={current.input}
                className="af-input text-xl sm:text-2xl font-teko"
                placeholder={current.placeholder}
                value={data[current.key] || ""}
                onChange={(e) => setValue(e.target.value)}
                min={current.min}
                max={current.max}
                data-testid={`onboarding-input-${current.key}`}
              />
            </div>
          )}

          <div className="mt-8 sm:mt-10 flex items-center justify-between gap-2">
            <button
              onClick={back}
              disabled={step === 0}
              className="btn-outline flex items-center gap-1 sm:gap-2 disabled:opacity-30 text-sm"
              data-testid="onboarding-back-btn"
            >
              <ChevronLeft size={16} /> ZURÜCK
            </button>
            <button onClick={next} disabled={loading} className="btn-primary flex items-center gap-1 sm:gap-2 text-sm" data-testid="onboarding-next-btn">
              {loading && <Loader2 size={16} className="animate-spin" />}
              {step === STEPS.length - 1 ? "PLAN GENERIEREN" : "WEITER"}
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
