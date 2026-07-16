import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, Check, BellOff, AlertTriangle } from "lucide-react";

const TRIGGERS = [
  { key: "trial_ending", title: "Trial-Erinnerung", desc: "48h vor Ablauf deiner 7-Tage-Testphase" },
  { key: "streak_reminder", title: "Streak-Reminder", desc: "Wenn du 3+ Tage nicht trainiert hast" },
  { key: "weekly_summary", title: "Wochen-Zusammenfassung", desc: "Jeden Sonntag mit Workouts, Volumen, Streak" },
  { key: "winback", title: "Comeback-Angebot", desc: "Nach Premium-Ende, Rabatt-Email" },
];

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("t") || params.get("token") || "";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [user, setUser] = useState(null);
  const [prefs, setPrefs] = useState(null);
  const [allOff, setAllOff] = useState(false);

  const BACKEND = process.env.REACT_APP_BACKEND_URL;

  useEffect(() => {
    (async () => {
      if (!token) {
        setError("Kein Token in der URL gefunden");
        setLoading(false);
        return;
      }
      try {
        const r = await fetch(`${BACKEND}/api/unsubscribe/verify?token=${encodeURIComponent(token)}`);
        if (!r.ok) {
          const data = await r.json().catch(() => ({}));
          throw new Error(data.detail || "Token ungültig oder abgelaufen");
        }
        const data = await r.json();
        setUser({ email: data.email, name: data.name });
        setPrefs(data.email_prefs);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [token, BACKEND]);

  const togglePref = async (key, next) => {
    if (!prefs) return;
    const updated = { ...prefs, [key]: next };
    setPrefs(updated);
    setSaving(true);
    try {
      const r = await fetch(`${BACKEND}/api/unsubscribe/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, email_prefs: updated }),
      });
      if (!r.ok) throw new Error("Speichern fehlgeschlagen");
      toast.success(next ? "Aktiviert" : "Abbestellt");
    } catch (e) {
      toast.error(e.message);
      setPrefs(prefs); // rollback
    } finally {
      setSaving(false);
    }
  };

  const unsubAll = async () => {
    if (!window.confirm("Wirklich ALLE Marketing-Emails abbestellen? (Welcome + Zahlungsbestätigungen kommen weiterhin)")) return;
    setSaving(true);
    try {
      const r = await fetch(`${BACKEND}/api/unsubscribe/all`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!r.ok) throw new Error("Fehler beim Abbestellen");
      const data = await r.json();
      setPrefs(data.email_prefs);
      setAllOff(true);
      toast.success("Alle Marketing-Emails abbestellt");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#05050A] flex items-center justify-center px-4">
        <Loader2 className="animate-spin text-[#00BFFF]" size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#05050A] flex items-center justify-center px-4">
        <div className="af-card p-6 max-w-md w-full text-center" data-testid="unsub-error">
          <AlertTriangle className="mx-auto text-red-400 mb-3" size={40} />
          <div className="font-teko text-2xl chrome-text mb-2">Link ungültig</div>
          <p className="prose-af font-chakra text-sm mb-4">{error}</p>
          <Link to="/" className="btn-outline inline-block">ZUR STARTSEITE</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#05050A] py-8 px-4">
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-8">
          <div className="font-teko text-5xl chrome-text tracking-widest mb-1">ALPHA-FIT</div>
          <div className="text-[10px] tracking-[3px] text-[#00BFFF]/70 uppercase">Email-Einstellungen</div>
        </div>

        <div className="af-card p-5 sm:p-6 mb-5" data-testid="unsub-card">
          <div className="text-xs text-gray-400 font-chakra uppercase tracking-widest mb-1">Eingeloggt als</div>
          <div className="font-teko text-2xl chrome-text break-words">{user?.name || "Champion"}</div>
          <div className="text-sm font-chakra text-gray-300 break-all">{user?.email}</div>
        </div>

        {allOff && (
          <div className="af-card p-4 mb-5 border-green-400/40 bg-green-500/5 flex items-center gap-3" data-testid="unsub-all-confirm">
            <Check className="text-green-400 flex-shrink-0" size={20} />
            <div className="font-chakra text-sm">Alle Marketing-Emails wurden abbestellt. Du erhältst weiterhin Welcome- und Zahlungs-Bestätigungen (rechtlich notwendig).</div>
          </div>
        )}

        <div className="af-card p-5 sm:p-6 mb-5">
          <h2 className="font-teko text-2xl chrome-text mb-2">EMAIL-TRIGGER</h2>
          <p className="prose-af font-chakra text-sm mb-4">
            Wähle aus, welche Emails du erhalten möchtest. Welcome- und Zahlungsbestätigungen
            werden immer gesendet (rechtlich notwendig).
          </p>
          <div className="space-y-2" data-testid="unsub-triggers">
            {TRIGGERS.map((t) => (
              <button
                key={t.key}
                onClick={() => togglePref(t.key, !prefs?.[t.key])}
                role="switch"
                aria-checked={!!prefs?.[t.key]}
                disabled={saving}
                className={`w-full flex items-start gap-3 p-3 border transition text-left ${
                  prefs?.[t.key] ? "border-[#00BFFF] bg-[#00BFFF]/5" : "border-[#1A1A24] hover:border-[#00BFFF]/40"
                }`}
                data-testid={`unsub-toggle-${t.key}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-teko text-lg chrome-text">{t.title}</div>
                  <div className="text-xs text-gray-400 font-chakra mt-1">{t.desc}</div>
                </div>
                <div className={`w-12 h-7 flex-shrink-0 rounded-full p-0.5 transition ${
                  prefs?.[t.key] ? "bg-[#00BFFF]" : "bg-[#1A1A24]"
                }`}>
                  <div className={`w-6 h-6 rounded-full bg-white transition ${
                    prefs?.[t.key] ? "translate-x-5" : "translate-x-0"
                  }`} />
                </div>
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={unsubAll}
          disabled={saving || allOff}
          className="w-full af-card p-4 flex items-center justify-center gap-2 border-red-400/40 hover:border-red-400 text-red-300 font-teko text-lg tracking-widest transition disabled:opacity-40"
          data-testid="unsub-all-btn"
        >
          {saving ? <Loader2 className="animate-spin" size={18} /> : <BellOff size={18} />}
          ALLE MARKETING-EMAILS ABBESTELLEN
        </button>

        <div className="text-center mt-8 text-xs text-gray-500 font-chakra">
          <Link to="/" className="hover:text-[#00BFFF] transition">Zurück zur Startseite</Link>
          <span className="mx-2 opacity-50">·</span>
          <Link to="/settings" className="hover:text-[#00BFFF] transition">Vollständige Einstellungen (Login nötig)</Link>
        </div>
      </div>
    </div>
  );
}
