import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { Trophy, TrendingUp, Crown, Sparkles, Download, Share2, Zap } from "lucide-react";
import { toast } from "sonner";

/**
 * PR-Card — visual collectible card shown when user breaks a personal record.
 * Rarities: bronze | silver | gold | mythic
 *
 * Props:
 *   pr: { exercise_name, weight_kg, reps, e1rm, improvement_pct, is_first, rarity, achieved_at, user_name?, multi_pr? }
 *   userName?: fallback user name override
 *   compact?: smaller layout (no actions)
 */

const RARITY_STYLES = {
  bronze: {
    label: "BRONZE",
    border: "#CD7F32",
    glow: "rgba(205,127,50,0.55)",
    bg: "linear-gradient(135deg, #2a1a0e 0%, #1a0f06 60%, #2a1a0e 100%)",
    accent: "#FFA94D",
    chrome: "linear-gradient(180deg, #FFB070 0%, #B8741E 100%)",
    icon: Trophy,
    sparkCount: 0,
  },
  silver: {
    label: "SILBER",
    border: "#C0C0C0",
    glow: "rgba(220,220,220,0.5)",
    bg: "linear-gradient(135deg, #1a1d23 0%, #0d0f12 60%, #1a1d23 100%)",
    accent: "#E0E0E0",
    chrome: "linear-gradient(180deg, #F5F5F5 0%, #707070 100%)",
    icon: TrendingUp,
    sparkCount: 4,
  },
  gold: {
    label: "GOLD",
    border: "#FFD700",
    glow: "rgba(255,215,0,0.7)",
    bg: "linear-gradient(135deg, #2a200a 0%, #1a1305 60%, #2a200a 100%)",
    accent: "#FFD700",
    chrome: "linear-gradient(180deg, #FFE56C 0%, #B8860B 100%)",
    icon: Crown,
    sparkCount: 7,
  },
  mythic: {
    label: "MYTHIC",
    border: "#FF1744",
    glow: "rgba(255,23,68,0.85)",
    bg: "linear-gradient(135deg, #2a0a14 0%, #1a0510 35%, #1a0a2e 65%, #2a0a14 100%)",
    accent: "#FF5252",
    chrome: "linear-gradient(180deg, #FF6B6B 0%, #4A148C 100%)",
    icon: Sparkles,
    sparkCount: 12,
  },
};

const formatDate = (iso) => {
  try { return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return ""; }
};

export default function PRCard({ pr, userName, compact = false }) {
  const cardRef = useRef(null);
  const [working, setWorking] = useState(false);
  const r = RARITY_STYLES[pr.rarity] || RARITY_STYLES.bronze;
  const Icon = r.icon;
  const name = userName || pr.user_name || "Champion";
  const e1rm = Number(pr.e1rm || 0).toFixed(1);
  const dateStr = formatDate(pr.achieved_at);

  const downloadPng = async () => {
    if (!cardRef.current) return;
    setWorking(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true, pixelRatio: 3, backgroundColor: "#000000",
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `alpha-fit-PR-${pr.exercise_name.replace(/\s+/g, "_")}-${pr.weight_kg}kg.png`;
      a.click();
      toast.success("PR-Card gespeichert!");
    } catch (e) {
      toast.error("Konnte Card nicht generieren");
    } finally {
      setWorking(false);
    }
  };

  const sharePng = async () => {
    if (!cardRef.current) return;
    setWorking(true);
    try {
      const dataUrl = await toPng(cardRef.current, { cacheBust: true, pixelRatio: 3, backgroundColor: "#000000" });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `pr-${pr.exercise_name}.png`, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Neuer PR @ alpha-fit",
          text: `🏆 ${pr.exercise_name}: ${pr.weight_kg}kg × ${pr.reps} — Alpha-Mode aktiviert. 💪`,
        });
      } else {
        // Fallback: download
        await downloadPng();
      }
    } catch (e) {
      if (e.name !== "AbortError") toast.error("Share fehlgeschlagen");
    } finally {
      setWorking(false);
    }
  };

  // Generate spark positions (deterministic by seed)
  const sparks = Array.from({ length: r.sparkCount }, (_, i) => ({
    top: `${10 + (i * 73) % 80}%`,
    left: `${5 + (i * 47) % 90}%`,
    delay: `${(i * 0.25) % 2}s`,
  }));

  return (
    <div className="flex flex-col items-center gap-3" data-testid={`pr-card-${pr.id || pr.exercise_name}`}>
      <div
        ref={cardRef}
        className="relative overflow-hidden rounded-2xl"
        style={{
          width: compact ? 280 : 340,
          aspectRatio: "5/7",
          background: r.bg,
          border: `3px solid ${r.border}`,
          boxShadow: `0 0 32px ${r.glow}, 0 0 64px ${r.glow}, inset 0 0 0 1px rgba(255,255,255,0.05)`,
        }}
      >
        {/* Outer chrome frame */}
        <div className="absolute inset-1.5 rounded-xl pointer-events-none" style={{
          background: `linear-gradient(135deg, ${r.border}33 0%, transparent 30%, transparent 70%, ${r.border}33 100%)`,
        }} />

        {/* Sparkle layer */}
        {sparks.map((s, i) => (
          <div key={i} className="absolute pointer-events-none" style={{
            top: s.top, left: s.left, width: 6, height: 6, borderRadius: "50%",
            background: r.accent,
            filter: `drop-shadow(0 0 8px ${r.accent})`,
            animation: `pr-spark 2s ease-in-out ${s.delay} infinite`,
          }} />
        ))}

        {/* Top: Rarity tag */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
          <div className="text-[10px] font-chakra uppercase tracking-[0.3em]" style={{ color: r.accent }}>
            ALPHA-FIT · PR
          </div>
          <div className="text-[10px] font-chakra uppercase tracking-[0.25em] px-2 py-0.5 rounded-full" style={{
            background: r.border + "22", color: r.accent, border: `1px solid ${r.border}66`,
          }}>
            {r.label}
          </div>
        </div>

        {/* Center icon */}
        <div className="absolute top-[18%] left-1/2 -translate-x-1/2">
          <div className="relative w-20 h-20 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full opacity-30" style={{ background: `radial-gradient(circle, ${r.accent} 0%, transparent 70%)` }} />
            <Icon size={48} style={{ color: r.accent, filter: `drop-shadow(0 0 12px ${r.accent}cc) drop-shadow(0 0 24px ${r.accent}66)` }} />
          </div>
        </div>

        {/* Center text - exercise name + weight */}
        <div className="absolute top-[44%] left-0 right-0 px-5 text-center">
          <div className="text-[10px] uppercase tracking-[0.3em] mb-1 opacity-70" style={{ color: r.accent }}>
            {pr.is_first ? "Erster PR" : pr.improvement_pct ? `+${pr.improvement_pct}%` : "PR"}
          </div>
          <div className="font-teko text-2xl leading-tight text-white" style={{
            background: r.chrome, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            backgroundClip: "text", filter: `drop-shadow(0 0 6px ${r.glow})`,
          }}>
            {pr.exercise_name.toUpperCase()}
          </div>
          <div className="font-teko text-6xl leading-none mt-2" style={{
            color: r.accent, filter: `drop-shadow(0 0 16px ${r.accent}88)`,
          }}>
            {pr.weight_kg}<span className="text-2xl ml-1 opacity-80">kg</span>
          </div>
          <div className="font-chakra text-xs mt-1 text-gray-300">
            × <span className="text-white font-bold">{pr.reps}</span> {pr.reps === 1 ? "Wiederholung" : "Wiederholungen"}
          </div>
        </div>

        {/* Bottom stats row */}
        <div className="absolute bottom-12 left-0 right-0 px-5">
          <div className="flex items-center justify-between text-[10px] font-chakra uppercase tracking-widest text-gray-400">
            <span>e1RM</span>
            <span style={{ color: r.accent }}>{e1rm} kg</span>
          </div>
          <div className="h-px mt-1 mb-2" style={{ background: `linear-gradient(90deg, transparent, ${r.border}88, transparent)` }} />
          {pr.multi_pr && (
            <div className="flex items-center justify-center gap-1 text-[10px] font-chakra uppercase tracking-widest" style={{ color: r.accent }}>
              <Zap size={10} /> TRIPLE-PR SESSION <Zap size={10} />
            </div>
          )}
        </div>

        {/* Footer: name + date */}
        <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-[10px] font-chakra">
          <span className="text-white/80 font-bold truncate max-w-[60%]">{name}</span>
          <span className="text-gray-500 uppercase tracking-widest">{dateStr}</span>
        </div>
      </div>

      {!compact && (
        <div className="flex gap-2 w-full max-w-[340px]">
          <button onClick={sharePng} disabled={working} className="flex-1 btn-primary text-xs flex items-center justify-center gap-1.5 disabled:opacity-40" data-testid="pr-card-share">
            <Share2 size={12} /> TEILEN
          </button>
          <button onClick={downloadPng} disabled={working} className="flex-1 btn-outline text-xs flex items-center justify-center gap-1.5 disabled:opacity-40" data-testid="pr-card-download">
            <Download size={12} /> DOWNLOAD
          </button>
        </div>
      )}
    </div>
  );
}
