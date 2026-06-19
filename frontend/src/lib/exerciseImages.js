// AlphaFit exercise images
// All images are generated via Gemini Nano Banana in a consistent dark cyber-Spartan aesthetic.
// Stored locally at /public/exercises/{slug}.png — no external CDN dependency.

const BASE = "/exercises";
const EXT = ".webp";

// ---- Exact exercise slug map (German names → slug) ----
// Lowercase keys, matched after normalisation. Specific exercises win over muscle-group fallbacks.
const EXACT = {
  // Chest
  "bankdrücken": "bench-press",
  "bankdrucken": "bench-press",
  "bench press": "bench-press",
  "bench-press": "bench-press",
  "schrägbankdrücken": "incline-bench-press",
  "schraegbankdruecken": "incline-bench-press",
  "incline bench": "incline-bench-press",
  "incline press": "incline-bench-press",
  "kurzhantel-bankdrücken": "db-bench-press",
  "kurzhantelbankdrücken": "db-bench-press",
  "dumbbell bench": "db-bench-press",
  "db bench": "db-bench-press",
  "liegestütze": "push-up",
  "liegestütz": "push-up",
  "push-up": "push-up",
  "push up": "push-up",
  "pushup": "push-up",
  "kabel fliegende": "cable-fly",
  "fliegende": "cable-fly",
  "cable fly": "cable-fly",
  "cable crossover": "cable-fly",
  "dips": "dips",
  "dip": "dips",
  // Back
  "kreuzheben": "deadlift",
  "deadlift": "deadlift",
  "langhantelrudern": "barbell-row",
  "barbell row": "barbell-row",
  "klimmzug": "pull-up",
  "klimmzüge": "pull-up",
  "pull-up": "pull-up",
  "pull up": "pull-up",
  "pullup": "pull-up",
  "latzug": "lat-pulldown",
  "latziehen": "lat-pulldown",
  "lat pulldown": "lat-pulldown",
  "lat pull": "lat-pulldown",
  "kabelrudern sitzend": "seated-row",
  "kabelrudern": "seated-row",
  "rudern sitzend": "seated-row",
  "rudern kabel": "seated-row",
  "seated row": "seated-row",
  "cable row": "seated-row",
  "t-bar": "tbar-row",
  "t-bar rudern": "tbar-row",
  "tbar row": "tbar-row",
  "face pull": "face-pull",
  "face pulls": "face-pull",
  // Shoulders
  "schulterdrücken": "ohp",
  "schulterdruecken": "ohp",
  "overhead press": "ohp",
  "military press": "ohp",
  "ohp": "ohp",
  "seitheben": "lateral-raise",
  "lateral raise": "lateral-raise",
  "frontheben": "front-raise",
  "front raise": "front-raise",
  "schulterheben": "shrug",
  "shrug": "shrug",
  "shrugs": "shrug",
  "reverse fly": "rear-delt-fly",
  "rear delt": "rear-delt-fly",
  "reverse pec deck": "rear-delt-fly",
  "arnold press": "arnold-press",
  // Biceps
  "langhantelcurls": "barbell-curl",
  "langhantel curl": "barbell-curl",
  "barbell curl": "barbell-curl",
  "kurzhantelcurls": "db-curl",
  "kurzhantel curl": "db-curl",
  "dumbbell curl": "db-curl",
  "hammercurls": "hammer-curl",
  "hammer curl": "hammer-curl",
  "preacher curl": "preacher-curl",
  "preacher curls": "preacher-curl",
  // Triceps
  "trizepsdrücken": "triceps-pushdown",
  "trizepsdruecken": "triceps-pushdown",
  "pushdown": "triceps-pushdown",
  "triceps pushdown": "triceps-pushdown",
  "skullcrusher": "skullcrusher",
  "skullcrushers": "skullcrusher",
  "french press": "skullcrusher",
  "trizeps extension": "triceps-extension",
  "triceps extension": "triceps-extension",
  "enges bankdrücken": "close-grip-bench",
  "close grip bench": "close-grip-bench",
  // Legs
  "kniebeuge": "squat",
  "kniebeugen": "squat",
  "squat": "squat",
  "squats": "squat",
  "back squat": "squat",
  "frontkniebeuge": "front-squat",
  "front squat": "front-squat",
  "rumänisches kreuzheben": "rdl",
  "romanian deadlift": "rdl",
  "rdl": "rdl",
  "beinpresse": "leg-press",
  "leg press": "leg-press",
  "ausfallschritte": "lunge",
  "ausfallschritt": "lunge",
  "lunge": "lunge",
  "lunges": "lunge",
  "beinstrecker": "leg-extension",
  "leg extension": "leg-extension",
  "beinbeuger": "leg-curl",
  "leg curl": "leg-curl",
  "wadenheben": "calf-raise",
  "calf raise": "calf-raise",
  "calf raises": "calf-raise",
  "hip thrust": "hip-thrust",
  "hip thrusts": "hip-thrust",
  // Core
  "plank": "plank",
  "planks": "plank",
  "unterarmstütz": "plank",
  "crunch": "crunch",
  "crunches": "crunch",
  "hängendes beinheben": "hanging-leg-raise",
  "hanging leg raise": "hanging-leg-raise",
  "leg raise": "hanging-leg-raise",
  "russian twist": "russian-twist",
  "russian twists": "russian-twist",
  // Cardio
  "laufband": "treadmill",
  "treadmill": "treadmill",
  "sprint": "treadmill",
  "burpee": "burpee",
  "burpees": "burpee",
  "jumping jack": "jumping-jack",
  "jumping jacks": "jumping-jack",
  "rudergerät": "rowing-machine",
  "rowing machine": "rowing-machine",
  "rower": "rowing-machine",
  "seilspringen": "jump-rope",
  "jump rope": "jump-rope",
};

// ---- Muscle group fallbacks ----
const GROUP_FALLBACK = {
  chest: "group-chest",
  back: "group-back",
  shoulders: "group-shoulders",
  biceps: "group-biceps",
  triceps: "group-triceps",
  legs: "group-legs",
  core: "group-core",
  cardio: "group-cardio",
  full: "group-full",
};

const KEYWORD_TO_GROUP = [
  { keys: ["bank", "bench", "brust", "chest", "push-up", "liegestütz", "fliegende", "fly", "pec", "dip"], group: "chest" },
  { keys: ["rudern", "row", "klimmzug", "pull-up", "pullup", "pull up", "latzieh", "lat pull", "latissimus", "rücken", "back", "kreuzheben", "deadlift", "face pull"], group: "back" },
  { keys: ["schulter", "shoulder", "press", "seitheb", "lateral raise", "front raise", "shrug", "nacken", "delta", "ohp", "military", "arnold"], group: "shoulders" },
  { keys: ["bizeps", "biceps", "curl", "hammer", "preacher", "concentration"], group: "biceps" },
  { keys: ["trizeps", "triceps", "skull", "kickback", "pushdown", "extension"], group: "triceps" },
  { keys: ["kniebeug", "squat", "beinpresse", "leg press", "ausfallschritt", "lunge", "wadenheb", "calf", "beinstreck", "leg extension", "beinbeug", "leg curl", "rumänisch", "romanian", "hip thrust", "bein", "leg", "quad", "hamstring", "gesäß", "glute", "po ", "waden"], group: "legs" },
  { keys: ["plank", "crunch", "sit-up", "situp", "bauch", "abs", "core", "russian twist", "leg raise", "hängende"], group: "core" },
  { keys: ["laufen", "run", "lauf", "cardio", "rad", "bike", "burpee", "jumping jack", "rope", "seilspring", "rudergerät", "rower", "treadmill"], group: "cardio" },
];

function normalise(s) {
  return (s || "").toString().toLowerCase().trim();
}

export function getExerciseImage(name = "", muscle = "") {
  const n = normalise(name);
  const m = normalise(muscle);

  // 1. Exact slug match
  if (EXACT[n]) return `${BASE}/${EXACT[n]}${EXT}`;
  // 2. Partial substring scan against EXACT keys (longer first to avoid clashing)
  const keys = Object.keys(EXACT).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (n.includes(k)) return `${BASE}/${EXACT[k]}${EXT}`;
  }
  // 3. Muscle group fallback by explicit muscle field
  if (GROUP_FALLBACK[m]) return `${BASE}/${GROUP_FALLBACK[m]}${EXT}`;
  // 4. Keyword scan for muscle group
  const haystack = `${n} ${m}`;
  for (const entry of KEYWORD_TO_GROUP) {
    if (entry.keys.some((k) => haystack.includes(k))) {
      return `${BASE}/${GROUP_FALLBACK[entry.group]}${EXT}`;
    }
  }
  // 5. Final fallback
  return `${BASE}/group-full${EXT}`;
}
