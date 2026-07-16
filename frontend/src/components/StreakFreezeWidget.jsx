import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import { Shield, Lock, Snowflake } from "lucide-react";

/**
 * Streak-Freeze Widget for the Dashboard.
 * Premium: shows current freeze count + monthly refresh date
 * Free:    shows Premium upsell with "Schütz deine Streak" message
 */
export default function StreakFreezeWidget() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/streak/status").then(({ data }) => setData(data)).catch(() => {});
  }, []);

  if (!data) return null;

  const refreshDate = data.next_refresh_at ? new Date(data.next_refresh_at).toLocaleDateString("de-DE", { day: "2-digit", month: "short" }) : "—";

  if (!data.is_premium) {
    return (
      <Link to="/premium" className="af-card p-3 sm:p-4 clip-corner-tl-br block hover:border-[#FFD700]/40 transition group" data-testid="streak-freeze-upsell">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 flex items-center justify-center rounded-lg bg-gradient-to-br from-[#FFD700]/20 to-[#1A1A24] flex-shrink-0">
            <Snowflake size={18} className="text-[#FFD700]/60" />
            <Lock size={10} className="absolute -bottom-0.5 -right-0.5 text-[#FFD700] bg-black rounded-full p-[1.5px]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-[0.3em] font-chakra text-[#FFD700]">PREMIUM</div>
            <div className="font-teko text-base sm:text-lg chrome-text leading-tight">STREAK-FREEZE</div>
            <div className="text-[11px] text-gray-400 font-chakra">Verpass 1 Tag — Streak bleibt. Premium-Feature.</div>
          </div>
          <div className="text-[#FFD700] font-teko text-sm uppercase tracking-wider group-hover:translate-x-1 transition">→</div>
        </div>
      </Link>
    );
  }

  const has = data.freezes_available > 0;
  return (
    <div className="af-card p-3 sm:p-4 clip-corner-tl-br" data-testid="streak-freeze-widget">
      <div className="flex items-center gap-3">
        <div className={`relative w-10 h-10 flex items-center justify-center rounded-lg flex-shrink-0 ${
          has ? "bg-gradient-to-br from-[#FF5A1F]/30 to-[#1A1A24]" : "bg-[#1A1A24]"
        }`}>
          <Shield size={18} className={has ? "text-[#FF5A1F]" : "text-gray-600"} style={has ? {filter: "drop-shadow(0 0 8px rgba(255,90,31,0.6))"} : {}} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-[0.3em] font-chakra text-[#FF4500]">STREAK-FREEZE</div>
          <div className="font-teko text-base sm:text-lg chrome-text leading-tight">
            {has ? <><span className="electric-text">{data.freezes_available}</span> verfügbar</> : <span className="text-gray-500">Verbraucht</span>}
          </div>
          <div className="text-[11px] text-gray-400 font-chakra">
            {has ? "Schützt deine Streak bei 1 Tag Pause" : `Neuer Freeze am ${refreshDate}`}
          </div>
        </div>
      </div>
    </div>
  );
}
