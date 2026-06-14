import { Award, Flame, Zap, Trophy, Crown, Shield, Swords, Star, Skull, Mountain, Gem, Sparkles, Target, Heart, Calendar, CalendarDays, CalendarCheck, CalendarHeart, CalendarRange, CalendarClock, Weight, Dumbbell, Anchor, Layers, Sigma, Infinity as InfinityIcon } from "lucide-react";

const ICONS = {
  // Workout count
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
  // Streak
  streak_3: Calendar,
  streak_7: CalendarDays,
  streak_14: CalendarCheck,
  streak_30: CalendarHeart,
  streak_60: CalendarRange,
  streak_100: CalendarClock,
  // Volume
  vol_10t: Weight,
  vol_50t: Dumbbell,
  vol_100t: Anchor,
  vol_250t: Layers,
  vol_500t: Sigma,
  vol_1m: InfinityIcon,
};

const STREAK_IDS = ["streak_3", "streak_7", "streak_14", "streak_30", "streak_60", "streak_100"];
const VOLUME_IDS = ["vol_10t", "vol_50t", "vol_100t", "vol_250t", "vol_500t", "vol_1m"];

// Color tier by category + threshold (visual progression)
function tierColor(id) {
  // Streak: orange/red flame palette
  if (STREAK_IDS.includes(id)) {
    const idx = STREAK_IDS.indexOf(id);
    const palette = [
      { ring: "linear-gradient(180deg, #FFB74D, #E65100)", icon: "#FFB74D" }, // 3d
      { ring: "linear-gradient(180deg, #FF9800, #BF360C)", icon: "#FF9800" }, // 7d
      { ring: "linear-gradient(180deg, #FF5722, #B71C1C)", icon: "#FF5722" }, // 14d
      { ring: "linear-gradient(180deg, #F44336, #880E4F)", icon: "#FF1744" }, // 30d
      { ring: "linear-gradient(180deg, #E91E63, #4A148C)", icon: "#FF4081" }, // 60d
      { ring: "linear-gradient(180deg, #FF1744, #6A1B9A)", icon: "#FF1744" }, // 100d
    ];
    return palette[idx] || palette[0];
  }
  // Volume: blue/cyan plate-stack palette
  if (VOLUME_IDS.includes(id)) {
    const idx = VOLUME_IDS.indexOf(id);
    const palette = [
      { ring: "linear-gradient(180deg, #4FC3F7, #01579B)", icon: "#4FC3F7" }, // 10t
      { ring: "linear-gradient(180deg, #29B6F6, #0277BD)", icon: "#29B6F6" }, // 50t
      { ring: "linear-gradient(180deg, #00BFFF, #1E90FF)", icon: "#00BFFF" }, // 100t
      { ring: "linear-gradient(180deg, #00E5FF, #0091EA)", icon: "#00E5FF" }, // 250t
      { ring: "linear-gradient(180deg, #18FFFF, #006064)", icon: "#18FFFF" }, // 500t
      { ring: "linear-gradient(180deg, #84FFFF, #00838F)", icon: "#84FFFF" }, // 1M
    ];
    return palette[idx] || palette[0];
  }
  // Workout count: bronze → silver → gold → platinum → diamond → mythic
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
