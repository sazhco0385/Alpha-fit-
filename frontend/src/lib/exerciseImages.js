// Map exercise name / muscle group keywords -> Unsplash image URLs
// Keep lowercase. Order matters - first match wins.

const IMAGE_MAP = [
  // Compound lifts
  { keys: ["bankdrücken", "bench press", "bench"], url: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?crop=entropy&cs=srgb&fm=jpg&w=600&q=70" },
  { keys: ["kniebeuge", "squat"], url: "https://images.unsplash.com/photo-1567598508481-65985588e295?crop=entropy&cs=srgb&fm=jpg&w=600&q=70" },
  { keys: ["kreuzheben", "deadlift"], url: "https://images.unsplash.com/photo-1517963879433-6ad2b056d712?crop=entropy&cs=srgb&fm=jpg&w=600&q=70" },
  { keys: ["klimmzug", "pull-up", "pullup", "pull up"], url: "https://images.unsplash.com/photo-1598971639058-fab3c3109a00?crop=entropy&cs=srgb&fm=jpg&w=600&q=70" },
  { keys: ["rudern", "row", "langhantelrudern"], url: "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?crop=entropy&cs=srgb&fm=jpg&w=600&q=70" },
  { keys: ["schulterdrücken", "shoulder press", "overhead press"], url: "https://images.unsplash.com/photo-1532029837206-abbe2b7620e3?crop=entropy&cs=srgb&fm=jpg&w=600&q=70" },
  { keys: ["latziehen", "lat pulldown", "lat"], url: "https://images.unsplash.com/photo-1623874514711-0f321325f318?crop=entropy&cs=srgb&fm=jpg&w=600&q=70" },
  { keys: ["beinpresse", "leg press"], url: "https://images.unsplash.com/photo-1434608519344-49d77a699e1d?crop=entropy&cs=srgb&fm=jpg&w=600&q=70" },
  { keys: ["bizeps", "curl"], url: "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?crop=entropy&cs=srgb&fm=jpg&w=600&q=70" },
  { keys: ["trizeps", "triceps"], url: "https://images.unsplash.com/photo-1581009137042-c552e485697a?crop=entropy&cs=srgb&fm=jpg&w=600&q=70" },
  { keys: ["seitheben", "lateral raise"], url: "https://images.unsplash.com/photo-1532029837206-abbe2b7620e3?crop=entropy&cs=srgb&fm=jpg&w=600&q=70" },
  { keys: ["wadenheben", "calf"], url: "https://images.unsplash.com/photo-1434608519344-49d77a699e1d?crop=entropy&cs=srgb&fm=jpg&w=600&q=70" },
  { keys: ["face pull"], url: "https://images.unsplash.com/photo-1623874514711-0f321325f318?crop=entropy&cs=srgb&fm=jpg&w=600&q=70" },
  { keys: ["ausfallschritt", "lunge"], url: "https://images.unsplash.com/photo-1434608519344-49d77a699e1d?crop=entropy&cs=srgb&fm=jpg&w=600&q=70" },
  { keys: ["plank"], url: "https://images.unsplash.com/photo-1566241142559-40e1dab266c6?crop=entropy&cs=srgb&fm=jpg&w=600&q=70" },
  { keys: ["sit-up", "crunch", "bauch"], url: "https://images.unsplash.com/photo-1566241142559-40e1dab266c6?crop=entropy&cs=srgb&fm=jpg&w=600&q=70" },
  { keys: ["dip"], url: "https://images.unsplash.com/photo-1581009137042-c552e485697a?crop=entropy&cs=srgb&fm=jpg&w=600&q=70" },
  // Muscle group fallbacks
  { keys: ["brust", "chest"], url: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?crop=entropy&cs=srgb&fm=jpg&w=600&q=70" },
  { keys: ["rücken", "back", "lat"], url: "https://images.unsplash.com/photo-1623874514711-0f321325f318?crop=entropy&cs=srgb&fm=jpg&w=600&q=70" },
  { keys: ["schulter", "shoulder"], url: "https://images.unsplash.com/photo-1532029837206-abbe2b7620e3?crop=entropy&cs=srgb&fm=jpg&w=600&q=70" },
  { keys: ["bein", "leg", "quad", "hamstring"], url: "https://images.unsplash.com/photo-1434608519344-49d77a699e1d?crop=entropy&cs=srgb&fm=jpg&w=600&q=70" },
  { keys: ["core", "abs"], url: "https://images.unsplash.com/photo-1566241142559-40e1dab266c6?crop=entropy&cs=srgb&fm=jpg&w=600&q=70" },
];

// Generic dark gym fallback
const DEFAULT_IMG = "https://images.unsplash.com/photo-1672344048213-76b6e77304bd?crop=entropy&cs=srgb&fm=jpg&w=600&q=70";

export function getExerciseImage(name = "", muscle = "") {
  const haystack = `${name} ${muscle}`.toLowerCase();
  for (const entry of IMAGE_MAP) {
    if (entry.keys.some((k) => haystack.includes(k))) {
      return entry.url;
    }
  }
  return DEFAULT_IMG;
}
