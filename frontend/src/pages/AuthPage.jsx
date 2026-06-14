import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import Logo from "../components/Logo";
import { useAuth } from "../lib/auth";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function AuthPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ email: "", password: "", name: "" });
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      let user;
      if (mode === "login") user = await login(form.email, form.password);
      else user = await register(form.email, form.password, form.name);
      toast.success(mode === "login" ? "Willkommen zurück, Alpha." : "Account erstellt. Los geht's!");
      // Onboarding hat IMMER Vorrang - egal ob Admin oder normaler User
      if (!user.onboarding_completed) {
        navigate("/onboarding");
      } else if (user.is_admin) {
        navigate("/admin");
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Fehler");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center relative overflow-hidden p-4 sm:p-6">
      <div className="absolute inset-0 bg-grid opacity-40" />
      <div className="absolute inset-0 bg-radial-blue" />

      <Link to="/" className="absolute top-4 left-4 sm:top-6 sm:left-6 z-10" data-testid="back-to-home"><Logo size={32} /></Link>

      <div className="relative z-10 w-full max-w-md af-card p-6 sm:p-8 clip-corner-tl-br mt-16 sm:mt-0" data-testid="auth-card">
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
      </div>
    </div>
  );
}
