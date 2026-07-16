import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import api from "../lib/api";
import Logo from "../components/Logo";
import { CheckCircle2, XCircle, Loader2, ShieldCheck } from "lucide-react";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading"); // loading | success | already | error
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState(null);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Kein Token in der URL gefunden.");
      return;
    }
    api.get(`/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(({ data }) => {
        setEmail(data.email || null);
        setStatus(data.already_verified ? "already" : "success");
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err?.response?.data?.detail || "Verifizierung fehlgeschlagen.");
      });
  }, [token]);

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center relative overflow-hidden p-4 sm:p-6" data-testid="verify-email-page">
      <div className="absolute inset-0 bg-grid opacity-40" />
      <div className="absolute inset-0 bg-radial-blue" />
      <Link to="/" className="absolute top-4 left-4 sm:top-6 sm:left-6 z-10"><Logo size={32} /></Link>

      <div className="relative z-10 w-full max-w-md af-card p-6 sm:p-8 clip-corner-tl-br mt-16 sm:mt-0 text-center">
        {status === "loading" && (
          <>
            <div className="inline-flex items-center justify-center w-16 h-16 mb-4 border border-[#FF4500]/60 bg-[#FF4500]/10 rounded-full">
              <Loader2 size={28} className="text-[#FF4500] animate-spin" />
            </div>
            <h1 className="font-teko text-3xl chrome-text mb-2">PRÜFE TOKEN…</h1>
            <p className="text-gray-500 font-chakra text-sm">Einen Moment.</p>
          </>
        )}
        {status === "success" && (
          <>
            <div className="inline-flex items-center justify-center w-16 h-16 mb-4 border border-[#00FF7F]/60 bg-[#00FF7F]/10 rounded-full">
              <CheckCircle2 size={32} className="text-[#00FF7F]" style={{ filter: "drop-shadow(0 0 12px rgba(0,255,127,0.6))" }} />
            </div>
            <h1 className="font-teko text-4xl chrome-text mb-2" data-testid="verify-success-heading">E-MAIL BESTÄTIGT</h1>
            {email && <p className="text-[#d4af37] font-chakra text-sm mb-4 break-all">{email}</p>}
            <p className="text-gray-400 font-chakra text-sm mb-6">Willkommen bei alpha-fit. Dein Account ist jetzt scharfgeschaltet.</p>
            <button
              onClick={() => navigate("/auth")}
              className="btn-primary w-full"
              data-testid="verify-go-login-btn"
            >
              JETZT EINLOGGEN
            </button>
          </>
        )}
        {status === "already" && (
          <>
            <div className="inline-flex items-center justify-center w-16 h-16 mb-4 border border-[#FF4500]/60 bg-[#FF4500]/10 rounded-full">
              <ShieldCheck size={32} className="text-[#FF4500]" />
            </div>
            <h1 className="font-teko text-3xl chrome-text mb-2">BEREITS BESTÄTIGT</h1>
            <p className="text-gray-400 font-chakra text-sm mb-6">Diese E-Mail wurde bereits verifiziert. Du kannst dich direkt einloggen.</p>
            <button onClick={() => navigate("/auth")} className="btn-primary w-full">ZUM LOGIN</button>
          </>
        )}
        {status === "error" && (
          <>
            <div className="inline-flex items-center justify-center w-16 h-16 mb-4 border border-red-500/60 bg-red-500/10 rounded-full">
              <XCircle size={32} className="text-red-400" />
            </div>
            <h1 className="font-teko text-3xl chrome-text mb-2" data-testid="verify-error-heading">FEHLER</h1>
            <p className="text-gray-400 font-chakra text-sm mb-6">{message}</p>
            <button onClick={() => navigate("/auth")} className="btn-primary w-full">ZUM LOGIN</button>
          </>
        )}
      </div>
    </div>
  );
}
