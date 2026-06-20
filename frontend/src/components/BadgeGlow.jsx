import { Award, Flame, Zap, Trophy, Crown, Shield, Swords, Star, Skull, Mountain, Gem, Sparkles, Target, Heart, Calendar, CalendarDays, CalendarCheck, CalendarHeart, CalendarRange, CalendarClock, Weight, Dumbbell, Anchor, Layers, Sigma, Infinity as InfinityIcon } from "lucide-react";

const ICONS = {
  first_workout: Zap, warm_up: Flame, five_workouts: Flame, ten_workouts: Award,
  fifteen: Shield, warrior: Swords, granite: Mountain, alpha: Crown, titan: Star,
  centurion: Trophy, spartan: Shield, olympian: Gem, demigod: Sparkles,
  year_warrior: Target, immortal: Heart, myth: Skull, legend: Trophy,
  streak_3: Calendar, streak_7: CalendarDays, streak_14: CalendarCheck,
  streak_30: CalendarHeart, streak_60: CalendarRange, streak_100: CalendarClock,
  vol_10t: Weight, vol_50t: Dumbbell, vol_100t: Anchor, vol_250t: Layers,
  vol_500t: Sigma, vol_1m: InfinityIcon,
};

const STREAK_IDS = ["streak_3", "streak_7", "streak_14", "streak_30", "streak_60", "streak_100"];
const VOLUME_IDS = ["vol_10t", "vol_50t", "vol_100t", "vol_250t", "vol_500t", "vol_1m"];

/**
 * Returns tier styling per badge id.
 *  c1/c2  → conic gradient stops (outer rotating ring)
 *  icon   → icon color
 *  glow   → bezel pulse box-shadow color
 *  spark  → particle color (only used on highTier)
 *  highTier → whether to render the 5 floating sparks
 */
function tierFor(id) {
  // STREAK — orange→red→violet flame palette
  if (STREAK_IDS.includes(id)) {
    const palette = [
      { c1: "#FFB74D", c2: "#E65100", icon: "#FFB74D", glow: "rgba(255,152,0,0.55)" },
      { c1: "#FF9800", c2: "#BF360C", icon: "#FFA726", glow: "rgba(255,87,34,0.6)" },
      { c1: "#FF5722", c2: "#B71C1C", icon: "#FF7043", glow: "rgba(244,67,54,0.65)" },
      { c1: "#FF1744", c2: "#880E4F", icon: "#FF1744", glow: "rgba(244,67,54,0.7)" },
      { c1: "#E91E63", c2: "#4A148C", icon: "#FF4081", glow: "rgba(233,30,99,0.7)" },
      { c1: "#FF1744", c2: "#6A1B9A", icon: "#FF1744", glow: "rgba(255,23,68,0.75)", spark: "#FF6B6B", highTier: true },
    ];
    return palette[STREAK_IDS.indexOf(id)] || palette[0];
  }
  // VOLUME — cyan/blue plate-stack
  if (VOLUME_IDS.includes(id)) {
    const palette = [
      { c1: "#4FC3F7", c2: "#01579B", icon: "#4FC3F7", glow: "rgba(79,195,247,0.5)" },
      { c1: "#29B6F6", c2: "#0277BD", icon: "#29B6F6", glow: "rgba(41,182,246,0.55)" },
      { c1: "#00BFFF", c2: "#1E90FF", icon: "#00BFFF", glow: "rgba(0,191,255,0.65)" },
      { c1: "#00E5FF", c2: "#0091EA", icon: "#00E5FF", glow: "rgba(0,229,255,0.7)" },
      { c1: "#18FFFF", c2: "#006064", icon: "#18FFFF", glow: "rgba(24,255,255,0.75)", spark: "#00E5FF", highTier: true },
      { c1: "#84FFFF", c2: "#00838F", icon: "#84FFFF", glow: "rgba(132,255,255,0.8)", spark: "#84FFFF", highTier: true },
    ];
    return palette[VOLUME_IDS.indexOf(id)] || palette[0];
  }
  // WORKOUT COUNT — bronze → silver → gold → platinum → diamond → mythic
  const bronze   = ["first_workout", "warm_up", "five_workouts"];
  const silver   = ["ten_workouts", "fifteen", "warrior"];
  const gold     = ["granite", "alpha", "titan"];
  const platinum = ["centurion", "spartan", "olympian"];
  const diamond  = ["demigod", "year_warrior", "immortal"];
  const mythic   = ["myth", "legend"];
  if (bronze.includes(id))   return { c1: "#FFA94D", c2: "#7E3B0E", icon: "#FFA94D", glow: "rgba(199,112,38,0.55)" };
  if (silver.includes(id))   return { c1: "#F5F5F5", c2: "#707070", icon: "#E0E0E0", glow: "rgba(192,192,192,0.6)" };
  if (gold.includes(id))     return { c1: "#FFD700", c2: "#B8860B", icon: "#FFD700", glow: "rgba(255,215,0,0.65)", spark: "#FFE56C", highTier: true };
  if (platinum.includes(id)) return { c1: "#00E5FF", c2: "#1E90FF", icon: "#00E5FF", glow: "rgba(0,229,255,0.7)", spark: "#FFFFFF", highTier: true };
  if (diamond.includes(id))  return { c1: "#B388FF", c2: "#4A148C", icon: "#E1BEE7", glow: "rgba(179,136,255,0.75)", spark: "#E1BEE7", highTier: true };
  if (mythic.includes(id))   return { c1: "#FF1744", c2: "#4A148C", icon: "#FF5252", glow: "rgba(255,23,68,0.85)", spark: "#FFAB91", highTier: true };
  return { c1: "#00E5FF", c2: "#1E90FF", icon: "#00E5FF", glow: "rgba(0,229,255,0.65)" };
}

export default function BadgeGlow({ badge, locked = false }) {
  const Icon = ICONS[badge.id] || Award;
  const t = tierFor(badge.id);
  const cssVars = locked ? {} : {
    "--bg-c1":   t.c1,
    "--bg-c2":   t.c2,
    "--bg-glow": t.glow,
    "--bg-spark": t.spark || t.icon,
  };

  return (
    <div className="badge-v2-card flex flex-col items-center gap-2 w-[88px] sm:w-[108px]" data-testid={`badge-${badge.id}`}>
      <div className={`badge-v2 ${locked ? "locked" : ""}`} style={cssVars}>
        <div className="badge-v2-ring" />
        <div className="badge-v2-bezel" />
        <div className="badge-v2-face">
          <Icon
            size={32}
            strokeWidth={1.75}
            style={!locked ? {
              color: t.icon,
              filter: `drop-shadow(0 0 10px ${t.icon}cc) drop-shadow(0 0 18px ${t.icon}66)`,
            } : { color: "#3a3a44" }}
          />
        </div>
        <div className="badge-v2-shine" />
        {!locked && t.highTier && (
          <div className="badge-v2-sparks">
            <i /><i /><i /><i /><i />
          </div>
        )}
      </div>
      <div className="text-center w-full">
        <div className="font-teko text-xs sm:text-sm tracking-wider chrome-text leading-tight">{badge.title}</div>
        <div className="text-[9px] sm:text-[10px] text-gray-500 font-chakra leading-tight line-clamp-2">{badge.description}</div>
      </div>
    </div>
  );
}
