// Curated YouTube tutorial video IDs for exercise demos.
// All videos are short-form (under 2 min) and from trusted fitness channels
// (Jeff Nippard, Athlean-X, Renaissance Periodization, etc.).
// To add more: find the video on YouTube, copy the ID after "v=" in the URL.

const VIDEO_MAP = {
  // === Chest ===
  "bankdrücken": "vcBig73ojpE",
  "bankdrucken": "vcBig73ojpE",
  "bench press": "vcBig73ojpE",
  "kurzhantel-bankdrücken": "QsYre__-aro",
  "kurzhantelbankdrücken": "QsYre__-aro",
  "dumbbell bench": "QsYre__-aro",
  "db bench": "QsYre__-aro",
  "schrägbankdrücken": "8iPEnn-ltC8",
  "incline bench": "8iPEnn-ltC8",
  "incline press": "8iPEnn-ltC8",
  "schrägbankdrücken kurzhantel": "5CECBjd7HLQ",
  "schrägbankdrücken langhantel": "8iPEnn-ltC8",
  "fliegende": "QENKPHhQVi4",
  "kurzhantel fliegende": "QENKPHhQVi4",
  "cable fly": "Iwe6AmxVf7o",
  "cable crossover": "Iwe6AmxVf7o",
  "kabel fliegende": "Iwe6AmxVf7o",
  "liegestütze": "IODxDxX7oi4",
  "liegestütz": "IODxDxX7oi4",
  "push up": "IODxDxX7oi4",
  "push-up": "IODxDxX7oi4",
  "dips": "wjUmnZH528Y",
  "dip": "wjUmnZH528Y",

  // === Back ===
  "klimmzüge": "eGo4IYlbE5g",
  "klimmzug": "eGo4IYlbE5g",
  "pull up": "eGo4IYlbE5g",
  "pull-up": "eGo4IYlbE5g",
  "latziehen": "CAwf7n6Luuc",
  "lat pulldown": "CAwf7n6Luuc",
  "langhantelrudern": "kBWAon7ItDw",
  "barbell row": "kBWAon7ItDw",
  "kurzhantelrudern": "roCP6wCXPqo",
  "kurzhantelrudern einarmig": "roCP6wCXPqo",
  "dumbbell row": "roCP6wCXPqo",
  "kabelrudern": "GZbfZ033f74",
  "kabelrudern sitzend": "GZbfZ033f74",
  "cable row": "GZbfZ033f74",
  "t-bar rudern": "yPis7nlbqdY",
  "kreuzheben": "ytGaGIn3SjE",
  "deadlift": "ytGaGIn3SjE",
  "rumänisches kreuzheben": "JCXUYuzwNrM",
  "romanian deadlift": "JCXUYuzwNrM",
  "rdl": "JCXUYuzwNrM",
  "hyperextensions": "ph3pddpKzzw",
  "face pull": "rep-qVOkqgk",
  "face pulls": "rep-qVOkqgk",

  // === Shoulders ===
  "schulterdrücken": "qEwKCR5JCog",
  "schulterdrücken langhantel": "qEwKCR5JCog",
  "schulterdrücken kurzhantel": "qEwKCR5JCog",
  "shoulder press": "qEwKCR5JCog",
  "overhead press": "2yjwXTZQDDI",
  "seitheben": "3VcKaXpzqRo",
  "lateral raise": "3VcKaXpzqRo",
  "frontheben": "sxA__DoLsgo",
  "front raise": "sxA__DoLsgo",
  "reverse flys": "ttvfGg9d76c",
  "rear delt": "ttvfGg9d76c",
  "arnold press": "3ml7BH7mNwQ",
  "upright row": "txdo_LWLg-Y",

  // === Legs ===
  "kniebeugen": "ultWZbUMPL8",
  "kniebeuge": "ultWZbUMPL8",
  "squat": "ultWZbUMPL8",
  "back squat": "ultWZbUMPL8",
  "frontkniebeuge": "uYumuL_G_V0",
  "front squat": "uYumuL_G_V0",
  "beinpresse": "IZxyjW7MPJQ",
  "leg press": "IZxyjW7MPJQ",
  "ausfallschritt": "QOVaHwm-Q6U",
  "ausfallschritte": "QOVaHwm-Q6U",
  "lunge": "QOVaHwm-Q6U",
  "bulgarian split squat": "2C-uNgKwPLE",
  "split squat": "2C-uNgKwPLE",
  "beinstrecker": "YyvSfVjQeL0",
  "leg extension": "YyvSfVjQeL0",
  "beinbeuger": "F488k67BTzc",
  "leg curl": "F488k67BTzc",
  "wadenheben": "gwLzBJYoWlI",
  "calf raise": "gwLzBJYoWlI",
  "calf raises": "gwLzBJYoWlI",
  "hip thrust": "LM8XHLYJoYs",
  "hip thrusts": "LM8XHLYJoYs",

  // === Arms — Biceps ===
  "langhantel curl": "kwG2ipFRgfo",
  "barbell curl": "kwG2ipFRgfo",
  "kurzhantel curl": "ykJmrZ5v0Oo",
  "dumbbell curl": "ykJmrZ5v0Oo",
  "hammer curl": "zC3nLlEvin4",
  "hammercurls": "zC3nLlEvin4",
  "konzentrations curl": "0AUGkch3tGc",
  "preacher curl": "fIWP-FRFNU0",

  // === Arms — Triceps ===
  "trizeps drücken kabel": "2-LAMcpzODU",
  "cable pushdown": "2-LAMcpzODU",
  "french press": "_gsUck-7M74",
  "skull crusher": "d_KZxkY_0cM",
  "enges bankdrücken": "nEF0bv2FW94",
  "close grip bench": "nEF0bv2FW94",
  "overhead trizeps extension": "_gsUck-7M74",
  "diamond push-ups": "j-mD5DJDjEs",

  // === Core ===
  "crunches": "Xyd_fa5zoEU",
  "crunch": "Xyd_fa5zoEU",
  "plank": "ASdvN_XEl_c",
  "beinheben hängend": "Pr1ieGZ5atk",
  "hängendes beinheben": "Pr1ieGZ5atk",
  "hanging leg raise": "Pr1ieGZ5atk",
  "russian twists": "wkD8rjkodUI",
  "russian twist": "wkD8rjkodUI",
  "cable crunches": "6cm9-mNUKxw",
  "ab wheel rollout": "rqiTPdK1c_I",
  "ab wheel": "rqiTPdK1c_I",
  "mountain climber": "kLh-uczlPLg",

  // === Cardio / Conditioning ===
  "burpee": "auBLPXO8Fww",
  "burpees": "auBLPXO8Fww",
  "jump rope": "FJmRQ5iTXKE",
  "seilspringen": "FJmRQ5iTXKE",
  "jumping jacks": "uLVtLurFcW0",
  "jumping jack": "uLVtLurFcW0",
  "box jumps": "hxldG9FX4j4",
  "laufband": "_kGESn8ArrU",
  "rudergerät": "S7HEm-fd534",
};

function normalize(name) {
  return (name || "")
    .toLowerCase()
    .trim()
    .replace(/[.,!?;:()/\\]/g, "")
    .replace(/\s+/g, " ");
}

/**
 * Get the YouTube video ID for an exercise.
 * Returns null if no curated mapping exists.
 */
export function getExerciseVideoId(name) {
  const n = normalize(name);
  if (!n) return null;
  if (VIDEO_MAP[n]) return VIDEO_MAP[n];
  // Try substring/contains matches for compound exercise names
  for (const key of Object.keys(VIDEO_MAP)) {
    if (n.includes(key) || key.includes(n)) {
      return VIDEO_MAP[key];
    }
  }
  return null;
}

/**
 * Get YouTube embed URL for an exercise (or null if not mapped).
 */
export function getExerciseVideoUrl(name) {
  const id = getExerciseVideoId(name);
  if (!id) return null;
  return `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1`;
}

/**
 * Fallback search URL when no curated video is available.
 */
export function getExerciseSearchUrl(name) {
  const q = encodeURIComponent(`${name} Form Tutorial`);
  return `https://www.youtube.com/results?search_query=${q}`;
}
