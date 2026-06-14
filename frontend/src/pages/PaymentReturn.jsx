import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../lib/auth";
import { Loader2, CheckCircle2, XCircle, Crown } from "lucide-react";

export default function PaymentReturn() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [status, setStatus] = useState("checking");
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    const sessionId = params.get("session_id");
    if (!sessionId) { setStatus("error"); return; }

    let cancelled = false;
    let count = 0;

    const poll = async () => {
      if (cancelled || count >= 8) {
        if (!cancelled) setStatus("timeout");
        return;
      }
      try {
        const { data } = await api.get(`/payments/status/${sessionId}`);
        if (data.payment_status === "paid" || data.status === "complete") {
          await refresh();
          setStatus("success");
          return;
        }
        if (data.status === "expired") { setStatus("expired"); return; }
      } catch {}
      count += 1;
      setAttempts(count);
      setTimeout(poll, 2500);
    };

    poll();
    return () => { cancelled = true; };
  }, [params, refresh]);

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-grid opacity-30" />
      <div className="absolute inset-0 bg-radial-blue" />
      <div className="relative z-10 text-center max-w-md af-card p-10 clip-corner-tl-br" data-testid="payment-return-card">
        {status === "checking" && (
          <>
            <Loader2 size={56} className="mx-auto text-[#00BFFF] animate-spin" />
            <h1 className="font-teko text-4xl mt-4 chrome-text">PRÜFE ZAHLUNG</h1>
            <p className="text-gray-500 font-chakra text-sm mt-2">Versuch {attempts + 1}/8</p>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle2 size={64} className="mx-auto text-[#00FF7F]" style={{ filter: "drop-shadow(0 0 16px rgba(0,255,127,0.7))" }} />
            <h1 className="font-teko text-5xl mt-4 electric-text glow-text">PREMIUM AKTIVIERT</h1>
            <p className="text-gray-400 font-chakra mt-2">Willkommen im Alpha-Kreis. 7 Tage kostenlos starten jetzt.</p>
            <Crown size={28} className="mx-auto text-[#FFD700] mt-4" />
            <button onClick={() => navigate("/dashboard")} className="btn-primary mt-6" data-testid="payment-done-btn">WEITER ZUM TRAINING</button>
          </>
        )}
        {(status === "error" || status === "expired" || status === "timeout") && (
          <>
            <XCircle size={56} className="mx-auto text-[#FF3B30]" />
            <h1 className="font-teko text-4xl mt-4 chrome-text">FEHLER</h1>
            <p className="text-gray-400 font-chakra mt-2">
              {status === "timeout" ? "Zeitüberschreitung. Bitte prüfe deine Email." : "Zahlung konnte nicht abgeschlossen werden."}
            </p>
            <button onClick={() => navigate("/premium")} className="btn-outline mt-6" data-testid="payment-retry-btn">ERNEUT VERSUCHEN</button>
          </>
        )}
      </div>
    </div>
  );
}
