// Categorizes an exercise for the Rest-Screen so users understand *why* the pause is long/short.
// Kept in sync with the backend `_smart_rest_default` heuristic in services/llm_coach.py.

const COMPOUND_HEAVY = [
  "kniebeug", "squat", "kreuzheb", "deadlift", "bankdr", "bench",
  "schulterdr", "overhead", "military", "front squat", "hip thrust",
  "langhantelrud", "barbell row",
];
const COMPOUND_MED = [
  "klimm", "pull-up", "pull up", "dip", "beinpres", "leg press",
  "rumän", "romanian", "ausfallschritt", "lunge", "rudern", "row",
  "latzieh", "lat pull",
];
const ISOLATION = [
  "curl", "trizep", "tricep", "seitheb", "lateral", "face pull",
  "wadenheb", "calf", "reverse fly", "fly", "kickback", "extension",
  "leg curl", "beincurl", "shrug",
];
const CORE = ["plank", "crunch", "sit-up", "situp", "russian twist", "hollow", "l-sit", "hanging"];

function matches(name, keywords) {
  const n = (name || "").toLowerCase();
  return keywords.some((k) => n.includes(k));
}

function parseReps(reps) {
  if (typeof reps === "number") return reps;
  if (typeof reps === "string" && reps.includes("-")) {
    const parts = reps.split("-");
    return parseInt(parts[parts.length - 1], 10) || 10;
  }
  return parseInt(reps, 10) || 10;
}

/**
 * Returns { label, hint } describing why the rest is that long.
 * label: short badge (e.g. "SCHWERE GRUNDÜBUNG")
 * hint: one-line explanation for the user
 */
export function getRestCategory(exercise) {
  if (!exercise) return null;
  const reps = parseReps(exercise.reps);
  const name = exercise.name || "";
  const rest = exercise.rest_seconds || 60;

  if (matches(name, CORE) || reps >= 20) {
    return {
      label: "CORE / AUSDAUER",
      hint: "Kurze Pause – der Muskel erholt sich schnell bei hoher Wiederholungszahl.",
      color: "#FF5A1F",
    };
  }
  if (matches(name, COMPOUND_HEAVY)) {
    if (reps <= 6) {
      return {
        label: "SCHWERE GRUNDÜBUNG",
        hint: "Maximale Kraft: dein Nervensystem braucht bis zu 3 Minuten für volle Regeneration.",
        color: "#FF3B3B",
      };
    }
    return {
      label: "GRUNDÜBUNG",
      hint: "Große Muskelgruppen – ausreichend Pause für saubere Ausführung im nächsten Satz.",
      color: "#FF8A00",
    };
  }
  if (matches(name, COMPOUND_MED)) {
    return {
      label: "COMPOUND-ÜBUNG",
      hint: "Mehrgelenkige Übung – solide Pause damit du das Volumen halten kannst.",
      color: "#FFB800",
    };
  }
  if (matches(name, ISOLATION)) {
    return {
      label: "ISOLATIONSÜBUNG",
      hint: "Nur ein Muskel arbeitet – kürzere Pause hält den Pump hoch.",
      color: "#FF4500",
    };
  }
  // Fallback based purely on rest length
  if (rest >= 120) {
    return { label: "SCHWERER SATZ", hint: "Volle Regeneration für maximale Leistung.", color: "#FF8A00" };
  }
  if (rest >= 75) {
    return { label: "KRAFT & MASSE", hint: "Ausgewogene Pause für Hypertrophie.", color: "#FFB800" };
  }
  return { label: "PUMP-SATZ", hint: "Kurze Pause hält die Spannung im Muskel.", color: "#FF4500" };
}
