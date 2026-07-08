import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import Logo from "../components/Logo";
import { useAuth } from "../lib/auth";
import api from "../lib/api";
import { toast } from "sonner";
import { Loader2, MailCheck, Send } from "lucide-react";
import { trackConversion } from "../lib/gads";

export default function AuthPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ email: "", password: "", name: "" });
  const [loading, setLoading] = useState(false);
  // Pending-verification state: shown after register OR when login returns 403 email_not_verified
  const [pendingEmail, setPendingEmail] = useState(null);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const startCooldown = (secs = 60) => {
    setResendCooldown(secs);
    const id = setInterval(() => {
      setResendCooldown((v) => {
        if (v <= 1) { clearInterval(id); return 0; }
        return v - 1;
      });
    }, 1000);
  };

  const resend = async () => {
    if (!pendingEmail || resendLoading || resendCooldown > 0) return;
    setResendLoading(true);
    try {
      const { data } = await api.post("/auth/resend-verification", { email: pendingEmail });
      if (data?.already_verified) {
        toast.success("E-Mail bereits bestätigt — du kannst dich jetzt einloggen.");
        setPendingEmail(null);
        setMode("login");
      } else {
        toast.success(data?.message || "Bestätigungsmail versendet");
        startCooldown(60);
      }
    } catch (err) {
      const detail = err?.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "Erneutes Senden fehlgeschlagen");
      if (err?.response?.status === 429) startCooldown(60);
    } finally {
      setResendLoading(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        const user = await login(form.email, form.password);
        toast.success("Willkommen zurück, Alpha.");
        if (!user.onboarding_completed) navigate("/onboarding");
        else if (user.is_admin) navigate("/admin");
        else navigate("/dashboard");
      } else {
        const res = await register(form.email, form.password, form.name);
        trackConversion("signup");
        if (res?.pendingVerification) {
          setPendingEmail(res.email || form.email);
          toast.success("Account erstellt. Bitte E-Mail bestätigen.");
          startCooldown(60);
        } else if (res?.onboarding_completed !== undefined) {
          // Legacy path (auto-login)
          if (!res.onboarding_completed) navigate("/onboarding");
          else navigate("/dashboard");
        }
      }
    } catch (err) {
      const detail = err?.response?.data?.detail;
      // Handle structured email_not_verified 403 error
      if (err?.response?.status === 403 && detail && typeof detail === "object" && detail.code === "email_not_verified") {
        setPendingEmail(detail.email || form.email);
        toast.error(detail.message || "Bitte bestätige deine E-Mail-Adresse.");
        startCooldown(0);
      } else {
        toast.error(typeof detail === "string" ? detail : "Fehler");
      }
    } finally {
      setLoading(false);
    }
  };

  const backToForm = () => {
    setPendingEmail(null);
    setResendCooldown(0);
    setMode("login");
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center relative overflow-hidden p-4 sm:p-6">
      <div className="absolute inset-0 bg-grid opacity-40" />
      <div className="absolute inset-0 bg-radial-blue" />

      <Link to="/" className="absolute top-4 left-4 sm:top-6 sm:left-6 z-10" data-testid="back-to-home"><Logo size={32} /></Link>

      <div className="relative z-10 w-full max-w-md af-card p-6 sm:p-8 clip-corner-tl-br mt-16 sm:mt-0" data-testid="auth-card">
        {pendingEmail ? (
          <div className="text-center" data-testid="verify-pending-card">
            <div className="inline-flex items-center justify-center w-16 h-16 mb-4 border border-[#00BFFF]/60 bg-[#00BFFF]/10 rounded-full">
              <MailCheck size={32} className="text-[#00BFFF]" style={{ filter: "drop-shadow(0 0 10px rgba(0,191,255,0.6))" }} />
            </div>
            <h1 className="font-teko text-3xl sm:text-4xl chrome-text mb-2">E-MAIL BESTÄTIGEN</h1>
            <p className="text-gray-400 font-chakra text-sm mb-2">Wir haben dir eine Mail geschickt an:</p>
            <p className="text-[#d4af37] font-chakra font-bold text-sm mb-6 break-all" data-testid="verify-email-address">{pendingEmail}</p>
            <p className="text-gray-500 font-chakra text-xs mb-6">Klick den Button in der Mail — der Link ist 24 h gültig. Danach kannst du dich einloggen. Prüfe ggf. deinen <strong className="text-gray-300">Spam-Ordner</strong>.</p>
            <button
              type="button"
              onClick={resend}
              disabled={resendLoading || resendCooldown > 0}
              className="btn-outline w-full flex items-center justify-center gap-2 mb-3 disabled:opacity-50"
              data-testid="resend-verify-btn"
            >
              {resendLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={14} />}
              {resendCooldown > 0 ? `Erneut senden in ${resendCooldown}s` : "Bestätigungsmail erneut senden"}
            </button>
            <button
              type="button"
              onClick={backToForm}
              className="text-[#00BFFF] hover:text-[#00E5FF] glow-text-soft uppercase tracking-widest text-xs font-chakra"
              data-testid="verify-back-btn"
            >
              Zurück zum Login
            </button>
          </div>
        ) : (
          <>
            <div className="text-center mb-6">
              <h1 className="font-teko text-3xl sm:text-5xl chrome-text">
                {mode === "login" ? "LOGIN" : "REGISTRIEREN"}
              </h1>
              <p className="text-gray-500 font-chakra text-xs sm:text-sm mt-2 tracking-wider uppercase">
                {mode === "login" ? "Komm zurück, Alpha." : "Tritt dem Alpha-Protokoll bei."}
              </p>
            </div>

            <form onSubmit={submit} className="space-y-5">
              {mode === "register" && (
                <div>
                  <label className="block text-xs text-gray-500 font-chakra uppercase tracking-widest mb-2">Name</label>
                  <input
                    className="af-input"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                    data-testid="auth-name-input"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs text-gray-500 font-chakra uppercase tracking-widest mb-2">E-Mail</label>
                <input
                  type="email"
                  className="af-input"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  data-testid="auth-email-input"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 font-chakra uppercase tracking-widest mb-2">Passwort</label>
                <input
                  type="password"
                  className="af-input"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  minLength={6}
                  data-testid="auth-password-input"
                />
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2" data-testid="auth-submit-btn">
                {loading && <Loader2 size={16} className="animate-spin" />}
                {mode === "login" ? "EINLOGGEN" : "ACCOUNT ERSTELLEN"}
              </button>
            </form>

            <div className="mt-6 text-center text-sm font-chakra text-gray-500">
              {mode === "login" ? "Noch kein Account?" : "Schon registriert?"}{" "}
              <button
                type="button"
                onClick={() => setMode(mode === "login" ? "register" : "login")}
                className="text-[#00BFFF] hover:text-[#00E5FF] glow-text-soft uppercase tracking-widest text-xs"
                data-testid="auth-toggle-mode"
              >
                {mode === "login" ? "Registrieren" : "Login"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
