import { Award, Flame, Zap, Trophy, Crown, Shield, Swords, Star, Skull, Mountain, Gem, Sparkles, Target, Heart } from "lucide-react";

const ICONS = {
  first_workout: Zap,
  warm_up: Flame,
  five_workouts: Flame,
  ten_workouts: Award,
  fifteen: Shield,
  warrior: Swords,
  granite: Mountain,
  alpha: Crown,
  titan: Star,
  centurion: Trophy,
  spartan: Shield,
  olympian: Gem,
  demigod: Sparkles,
  year_warrior: Target,
  immortal: Heart,
  myth: Skull,
  legend: Trophy,
};

// Color tier by threshold (visual progression)
function tierColor(id) {
  const bronze = ["first_workout", "warm_up", "five_workouts"];
  const silver = ["ten_workouts", "fifteen", "warrior"];
  const gold = ["granite", "alpha", "titan"];
  const platinum = ["centurion", "spartan", "olympian"];
  const diamond = ["demigod", "year_warrior", "immortal"];
  const mythic = ["myth", "legend"];
  if (bronze.includes(id)) return { ring: "linear-gradient(180deg, #FFA94D, #C77026)", icon: "#FFA94D" };
  if (silver.includes(id)) return { ring: "linear-gradient(180deg, #E0E0E0, #909090)", icon: "#E0E0E0" };
  if (gold.includes(id)) return { ring: "linear-gradient(180deg, #FFD700, #B8860B)", icon: "#FFD700" };
  if (platinum.includes(id)) return { ring: "linear-gradient(180deg, #00E5FF, #1E90FF)", icon: "#00E5FF" };
  if (diamond.includes(id)) return { ring: "linear-gradient(180deg, #B388FF, #6A1B9A)", icon: "#B388FF" };
  if (mythic.includes(id)) return { ring: "linear-gradient(180deg, #FF1744, #B71C1C)", icon: "#FF5252" };
  return { ring: "linear-gradient(180deg, #00E5FF, #1E90FF)", icon: "#00E5FF" };
}

export default function BadgeGlow({ badge, locked = false }) {
  const Icon = ICONS[badge.id] || Award;
  const tier = tierColor(badge.id);
  return (
    <div
      className={`relative flex flex-col items-center gap-2 w-[88px] sm:w-[100px] ${locked ? "opacity-25" : ""}`}
      data-testid={`badge-${badge.id}`}
    >
      <div
        className={`relative w-16 h-16 sm:w-20 sm:h-20 hex-shield flex items-center justify-center ${
          locked ? "" : "pulse-glow"
        }`}
        style={{ background: locked ? "linear-gradient(180deg, #303040, #1A1A24)" : tier.ring }}
      >
        <div className="absolute inset-[2px] hex-shield bg-black flex items-center justify-center">
          <Icon
            size={26}
            style={!locked ? { color: tier.icon, filter: `drop-shadow(0 0 8px ${tier.icon}99)` } : { color: "#404050" }}
          />
        </div>
      </div>
      <div className="text-center w-full">
        <div className="font-teko text-xs sm:text-sm tracking-wider chrome-text leading-tight">{badge.title}</div>
        <div className="text-[9px] sm:text-[10px] text-gray-500 font-chakra leading-tight">{badge.description}</div>
      </div>
    </div>
  );
}
