import { Award, Flame, Zap, Trophy, Crown, Shield } from "lucide-react";

const ICONS = {
  first_workout: Zap,
  five_workouts: Flame,
  ten_workouts: Award,
  warrior: Shield,
  alpha: Crown,
  legend: Trophy,
};

export default function BadgeGlow({ badge, locked = false }) {
  const Icon = ICONS[badge.id] || Award;
  return (
    <div
      className={`relative flex flex-col items-center gap-2 ${locked ? "opacity-30" : ""}`}
      data-testid={`badge-${badge.id}`}
    >
      <div
        className={`relative w-16 h-16 sm:w-20 sm:h-20 hex-shield flex items-center justify-center ${
          locked ? "" : "pulse-glow"
        }`}
        style={{
          background:
            "linear-gradient(180deg, #00E5FF 0%, #1E90FF 50%, #0066CC 100%)",
        }}
      >
        <div className="absolute inset-[2px] hex-shield bg-black flex items-center justify-center">
          <Icon
            size={26}
            className={locked ? "text-gray-700" : "text-[#00E5FF]"}
            style={!locked ? { filter: "drop-shadow(0 0 8px rgba(0,229,255,0.9))" } : {}}
          />
        </div>
      </div>
      <div className="text-center max-w-[100px]">
        <div className="font-teko text-xs sm:text-sm tracking-wider chrome-text">{badge.title}</div>
        {!locked && <div className="text-[9px] sm:text-[10px] text-gray-500 font-chakra leading-tight">{badge.description}</div>}
      </div>
    </div>
  );
}
