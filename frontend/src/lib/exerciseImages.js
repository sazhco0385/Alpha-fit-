// Reliable exercise image mapping by muscle group
// Each muscle group has ONE high-quality verified Unsplash image

const MUSCLE_IMAGES = {
  chest: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&q=70",      // bench press
  back: "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=600&q=70",       // back row
  legs: "https://images.unsplash.com/photo-1434608519344-49d77a699e1d?w=600&q=70",       // squat / legs
  shoulders: "https://images.unsplash.com/photo-1532029837206-abbe2b7620e3?w=600&q=70",  // shoulder press
  biceps: "https://images.unsplash.com/photo-1581009137042-c552e485697a?w=600&q=70",     // bicep curl
  triceps: "https://images.unsplash.com/photo-1581009137042-c552e485697a?w=600&q=70",    // tricep
  core: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&q=70",       // abs (placeholder gym)
  cardio: "https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=600&q=70",     // cardio
  full: "https://images.unsplash.com/photo-1599058917212-d750089bc07e?w=600&q=70",       // full body gym
};

const FALLBACK = "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&q=70"; // generic gym

// Keywords (lowercase) → muscle group
const KEYWORD_MAP = [
  // Chest
  { keys: ["bank", "bench", "brust", "chest", "push-up", "liegestütz", "fliegende", "fly", "pec"], group: "chest" },
  // Back
  { keys: ["rudern", "row", "klimmzug", "pull-up", "pullup", "pull up", "latzieh", "lat pull", "latissimus", "rücken", "back", "kreuzheben", "deadlift"], group: "back" },
  // Shoulders
  { keys: ["schulter", "shoulder", "press", "seitheb", "lateral raise", "front raise", "face pull", "shrug", "nacken", "delta"], group: "shoulders" },
  // Biceps
  { keys: ["bizeps", "biceps", "curl", "hammer", "preacher", "concentration"], group: "biceps" },
  // Triceps
  { keys: ["trizeps", "triceps", "dip", "skull", "kickback", "extension", "pushdown"], group: "triceps" },
  // Legs
  { keys: ["kniebeug", "squat", "beinpresse", "leg press", "ausfallschritt", "lunge", "wadenheb", "calf", "beinstreck", "leg extension", "beinbeug", "leg curl", "rumänisch", "romanian", "hip thrust", "bein", "leg", "quad", "hamstring", "gesäß", "glute", "po ", "waden"], group: "legs" },
  // Core
  { keys: ["plank", "crunch", "sit-up", "situp", "bauch", "abs", "core", "russian twist", "leg raise", "hängende"], group: "core" },
  // Cardio
  { keys: ["laufen", "run", "lauf", "cardio", "rad", "bike", "burpee", "jumping jack", "rope", "seilspring", "rudergerät"], group: "cardio" },
];

export function getExerciseImage(name = "", muscle = "") {
  const haystack = `${name} ${muscle}`.toLowerCase();
  for (const entry of KEYWORD_MAP) {
    if (entry.keys.some((k) => haystack.includes(k))) {
      return MUSCLE_IMAGES[entry.group] || FALLBACK;
    }
  }
  return MUSCLE_IMAGES.full || FALLBACK;
}
