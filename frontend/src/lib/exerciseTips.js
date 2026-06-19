// Static German tips for each exercise. Used by /library page and any tip lookup.
// Tip format: array of 3-4 short actionable cues (form, breathing, common mistakes).

const TIPS = {
  // CHEST
  "bench-press": {
    name: "Bankdrücken",
    group: "chest",
    de: "Brust",
    tips: [
      "Schulterblätter zusammenziehen und in die Bank drücken — stabile Basis.",
      "Stange an der unteren Brust (Brustwarzen-Höhe) berühren lassen.",
      "Ellenbogen ca. 45° vom Körper, nicht ausflattern lassen.",
      "Beine fest am Boden, Spannung im ganzen Körper.",
    ],
  },
  "incline-bench-press": {
    name: "Schrägbankdrücken",
    group: "chest",
    de: "Obere Brust",
    tips: [
      "Bank auf 30° einstellen — höher trifft mehr Schulter als Brust.",
      "Stange Richtung Schlüsselbein führen, nicht zur Mitte.",
      "Ellenbogen leicht nach unten zeigen, nicht ausstellen.",
      "Volle Range — runter bis kurz vor Brustkontakt.",
    ],
  },
  "db-bench-press": {
    name: "Kurzhantel-Bankdrücken",
    group: "chest",
    de: "Brust",
    tips: [
      "Hanteln in einer leichten V-Bahn nach oben drücken.",
      "Auf Brusthöhe stoppen, ehe der Bizeps die Bank berührt.",
      "Handgelenke neutral, Daumen Richtung Schulter.",
      "Volle Spannung halten — Hanteln oben nicht aufeinanderklacken lassen.",
    ],
  },
  "push-up": {
    name: "Liegestütze",
    group: "chest",
    de: "Brust",
    tips: [
      "Körper bildet eine Linie von Kopf bis Ferse — kein Hohlkreuz.",
      "Hände schulterbreit, Finger zeigen leicht nach außen.",
      "Brust bis kurz über den Boden senken.",
      "Schulterblätter aktiv steuern — nicht in den Schultern hängen.",
    ],
  },
  "cable-fly": {
    name: "Kabel Fliegende",
    group: "chest",
    de: "Brust (Isolation)",
    tips: [
      "Leichte Beuge in den Ellenbogen — fix halten, nicht aus dem Arm drücken.",
      "Bewegung kommt nur aus der Schulter (Brustmuskel).",
      "Hände vor der Brust zusammenführen — kurz halten.",
      "Eher leichteres Gewicht für saubere Form & Spannung.",
    ],
  },
  "dips": {
    name: "Dips",
    group: "chest",
    de: "Brust & Trizeps",
    tips: [
      "Oberkörper leicht nach vorne lehnen → mehr Brust, aufrecht → mehr Trizeps.",
      "Ellenbogen 90° beugen, nicht weiter — Schultern schonen.",
      "Schultern weg von den Ohren, Brust raus.",
      "Mit Zusatzgewicht erst arbeiten, wenn 10+ saubere Wdh möglich.",
    ],
  },
  // BACK
  "deadlift": {
    name: "Kreuzheben",
    group: "back",
    de: "Ganzer Rücken & Beine",
    tips: [
      "Stange direkt über dem Mittelfuß — startet nah am Schienbein.",
      "Rücken neutral (gerade) — kein Rundrücken, kein Hohlkreuz.",
      "Erst Beine strecken, dann Hüfte — Stange streift den Körper.",
      "Bauch dauerhaft anspannen (Valsalva-Atmung beim Anheben).",
    ],
  },
  "barbell-row": {
    name: "Langhantelrudern",
    group: "back",
    de: "Rücken (Mittelteil)",
    tips: [
      "Hüfte ca. 30° vor — Oberkörper schräg, nicht aufrecht.",
      "Stange zum unteren Bauch ziehen, Ellenbogen nach hinten.",
      "Rücken neutral, Bauch fest — kein Wippen aus der Hüfte.",
      "Schulterblätter am Endpunkt zusammenziehen.",
    ],
  },
  "pull-up": {
    name: "Klimmzug",
    group: "back",
    de: "Latissimus & Bizeps",
    tips: [
      "Volle Range: gestreckte Arme unten, Brust an die Stange oben.",
      "Schultern aktiv nach unten ziehen — nicht zucken.",
      "Kein Schwung — saubere Wdh statt Quantität.",
      "Falls unmöglich: negative Wdh oder Band-Assisted starten.",
    ],
  },
  "lat-pulldown": {
    name: "Latzug",
    group: "back",
    de: "Latissimus",
    tips: [
      "Stange zum oberen Brustbein ziehen — nicht zum Nacken.",
      "Schulterblätter zuerst nach unten ziehen, dann Ellenbogen.",
      "Oberkörper leicht nach hinten lehnen (~15°), aber fixiert.",
      "Negative Phase kontrolliert (2-3s) — kein Loslassen.",
    ],
  },
  "seated-row": {
    name: "Kabelrudern sitzend",
    group: "back",
    de: "Mittlerer Rücken",
    tips: [
      "Brust raus, Schultern nach hinten — keine Rundrücken-Position.",
      "Griff zum Nabel ziehen, Ellenbogen eng am Körper.",
      "Am Endpunkt 1s halten, Schulterblätter zusammenziehen.",
      "Kein Wippen aus dem Rücken — Spannung kommt aus dem Lat.",
    ],
  },
  "tbar-row": {
    name: "T-Bar Rudern",
    group: "back",
    de: "Mittlerer Rücken (Dicke)",
    tips: [
      "Stange zum unteren Bauchbereich ziehen.",
      "Brust raus, Schulterblätter zusammen am Endpunkt.",
      "Rücken neutral, Knie leicht gebeugt.",
      "Volle Range — kein halbes Tempo zum Schein-Aufpumpen.",
    ],
  },
  "face-pull": {
    name: "Face Pulls",
    group: "back",
    de: "Hintere Schulter & Trapezius",
    tips: [
      "Seil auf Gesichtshöhe einstellen.",
      "Ellenbogen NACH OBEN ziehen, Hände Richtung Schläfen.",
      "Kein Zurücklehnen — Bewegung kommt aus Schulter & oberem Rücken.",
      "Top-Tier Übung für gesunde Schultern + bessere Haltung.",
    ],
  },
  // SHOULDERS
  "ohp": {
    name: "Schulterdrücken",
    group: "shoulders",
    de: "Schultern (Frontale)",
    tips: [
      "Stange auf Schlüsselbein-Höhe gestartet, Ellenbogen leicht vor der Stange.",
      "Kopf am Topp leicht durchschieben — Stange direkt überm Kopf.",
      "Bauch & Gesäß anspannen — keine Hohlkreuz-Brücke.",
      "Saubere vertikale Linie statt Schwung aus den Beinen.",
    ],
  },
  "lateral-raise": {
    name: "Seitheben",
    group: "shoulders",
    de: "Mittlere Schulter",
    tips: [
      "Leichte Ellenbogen-Beuge fixieren — Bewegung NUR aus der Schulter.",
      "Bis Schulterhöhe heben, kleiner Finger leicht oben.",
      "Kein Schwung — lieber 5kg sauber als 10kg mit Tempo.",
      "Negative Phase langsam (3s) zurück.",
    ],
  },
  "front-raise": {
    name: "Frontheben",
    group: "shoulders",
    de: "Vordere Schulter",
    tips: [
      "Arm fast gestreckt (leichte Ellenbogen-Beuge) — nicht völlig durchgedrückt.",
      "Bis maximal Schulterhöhe heben.",
      "Daumen leicht nach oben für Schulterschonung.",
      "Kein Zurücklehnen aus dem Rücken — Bauch hält stabil.",
    ],
  },
  "shrug": {
    name: "Schulterheben (Shrugs)",
    group: "shoulders",
    de: "Trapezius",
    tips: [
      "Schultern GERADE NACH OBEN — kein Kreisen.",
      "Am Topp 1-2s halten für maximale Kontraktion.",
      "Schwer aber kontrolliert — kein Wippen mit dem Körper.",
      "Kopf neutral, kein Vorbeugen oder Strecken.",
    ],
  },
  "rear-delt-fly": {
    name: "Reverse Fly",
    group: "shoulders",
    de: "Hintere Schulter",
    tips: [
      "Oberkörper ~45° nach vorne, Brust auf Bank wenn möglich.",
      "Arme bogenförmig zur Seite heben — Daumen leicht nach oben.",
      "Bewegung nur aus der hinteren Schulter, nicht aus dem oberen Rücken.",
      "Leicht starten — hintere Schulter braucht wenig Last.",
    ],
  },
  "arnold-press": {
    name: "Arnold Press",
    group: "shoulders",
    de: "Ganze Schulter",
    tips: [
      "Start: Hände vor der Schulter, Handflächen zum Körper.",
      "Beim Drücken rotieren — am Topp zeigen Handflächen nach vorne.",
      "Kontrolliert nach unten zurückrotieren.",
      "Mittlere Last reicht — die Rotation ist der eigentliche Reiz.",
    ],
  },
  // BICEPS
  "barbell-curl": {
    name: "Langhantelcurls",
    group: "biceps",
    de: "Bizeps",
    tips: [
      "Ellenbogen am Körper fixiert — bewegt sich NICHT nach vorne.",
      "Stange bis Brusthöhe, am Topp kurz halten.",
      "Negative Phase langsam (2-3s) — kein Fallen lassen.",
      "Schultern nach hinten — kein Vorrollen.",
    ],
  },
  "db-curl": {
    name: "Kurzhantelcurls",
    group: "biceps",
    de: "Bizeps",
    tips: [
      "Handflächen rotieren beim Heben nach außen (Supination).",
      "Ellenbogen fix am Körper.",
      "Alternierend oder gleichzeitig — beide ok.",
      "Spitze der Bewegung: kleine Pause, dann kontrolliert ablassen.",
    ],
  },
  "hammer-curl": {
    name: "Hammercurls",
    group: "biceps",
    de: "Bizeps & Brachialis",
    tips: [
      "Handflächen bleiben zum Körper (neutraler Griff).",
      "Trifft Brachialis (unter dem Bizeps) — gibt Armdicke.",
      "Bis fast zur Schulter heben.",
      "Saubere Form vor Schwung.",
    ],
  },
  "preacher-curl": {
    name: "Preacher Curls",
    group: "biceps",
    de: "Bizeps (untere Spitze)",
    tips: [
      "Achseln satt auf das Polster — kein Abheben.",
      "Volle Range: untere Position sehr langsam, kein Reißen.",
      "Am Topp 1s halten.",
      "Schmerz im Ellenbogen → Gewicht senken & Range prüfen.",
    ],
  },
  // TRICEPS
  "triceps-pushdown": {
    name: "Trizepsdrücken (Kabel)",
    group: "triceps",
    de: "Trizeps",
    tips: [
      "Ellenbogen am Körper fixiert — der Oberarm bewegt sich NICHT.",
      "Nur der Unterarm bewegt sich — Stange/Seil bis zur Streckung.",
      "Am Endpunkt 1s halten, Trizeps anspannen.",
      "Leicht vorgebeugt für besseren Trizeps-Hebel.",
    ],
  },
  "skullcrusher": {
    name: "Skullcrusher",
    group: "triceps",
    de: "Trizeps (langer Kopf)",
    tips: [
      "Ellenbogen zeigen IMMER nach oben — fixierter Punkt.",
      "Stange leicht hinter den Kopf führen (nicht vor die Stirn).",
      "Volle Range: bis 2cm vor der Stirn ablassen.",
      "EZ-Stange schont die Handgelenke.",
    ],
  },
  "triceps-extension": {
    name: "Trizeps Extension (Overhead)",
    group: "triceps",
    de: "Langer Trizepskopf",
    tips: [
      "Oberarme neben den Ohren — Ellenbogen zeigen nach oben.",
      "Hantel hinter den Kopf ablassen, volle Dehnung im Trizeps.",
      "Bauch fest, kein Hohlkreuz beim Strecken.",
      "Mittlere Last — Schulter freundlicher als zu schwer.",
    ],
  },
  "close-grip-bench": {
    name: "Enges Bankdrücken",
    group: "triceps",
    de: "Trizeps & Brust",
    tips: [
      "Hände schulterbreit (nicht enger! — Handgelenke schonen).",
      "Ellenbogen nahe am Körper — eng führen.",
      "Stange auf der unteren Brust.",
      "Hauptreiz Trizeps, Brust assistiert.",
    ],
  },
  // LEGS
  "squat": {
    name: "Kniebeuge",
    group: "legs",
    de: "Quadrizeps & Gesäß",
    tips: [
      "Stange auf dem oberen Trapezius (High Bar) oder hintere Schulter (Low Bar).",
      "Brust raus, Bauch fest, Blick geradeaus.",
      "Tiefe: Hüfte unter Knie — sauber & kontrolliert.",
      "Knie folgen den Zehenspitzen, kein Einknicken nach innen.",
    ],
  },
  "front-squat": {
    name: "Frontkniebeuge",
    group: "legs",
    de: "Quadrizeps",
    tips: [
      "Stange auf den vorderen Schultern, Ellenbogen hoch.",
      "Oberkörper möglichst aufrecht — sonst kippt die Stange.",
      "Tiefer als Back Squat möglich — volle Range nutzen.",
      "Trifft Quad stärker als Back Squat.",
    ],
  },
  "rdl": {
    name: "Rumänisches Kreuzheben (RDL)",
    group: "legs",
    de: "Hamstrings & Gesäß",
    tips: [
      "Knie LEICHT gebeugt, FIX — bewegt sich nicht weiter.",
      "Hüfte nach hinten schieben — Stange streift die Beine.",
      "Bis die Hamstrings deutlich ziehen (meist Schienbein-Höhe).",
      "Rücken neutral — kein Runden.",
    ],
  },
  "leg-press": {
    name: "Beinpresse",
    group: "legs",
    de: "Quadrizeps & Gesäß",
    tips: [
      "Füße schulterbreit, leicht angewinkelt.",
      "Knie nicht voll durchstrecken — Druck im Muskel halten.",
      "Bis Knie ca. 90° ablassen — kein Rundrücken auf der Liege.",
      "Höher = mehr Gesäß, Tiefer = mehr Quad.",
    ],
  },
  "lunge": {
    name: "Ausfallschritte",
    group: "legs",
    de: "Quadrizeps & Gesäß",
    tips: [
      "Schritt groß genug — Vorderes Knie über dem Fußgelenk, nicht überm Zeh.",
      "Hinteres Knie bis kurz über dem Boden.",
      "Oberkörper aufrecht — kein Vorlehnen.",
      "Alternierend oder Walking Lunges — beide top.",
    ],
  },
  "leg-extension": {
    name: "Beinstrecker",
    group: "legs",
    de: "Quadrizeps (Isolation)",
    tips: [
      "Polster knapp über dem Knöchel — nicht zu tief.",
      "Volle Streckung am Topp, 1s halten.",
      "Negative Phase langsam (2-3s).",
      "Beide Beine gleichzeitig — keine Schwung-Bewegung.",
    ],
  },
  "leg-curl": {
    name: "Beinbeuger",
    group: "legs",
    de: "Hamstrings",
    tips: [
      "Polster unten am Knöchel (nicht oberhalb der Wade).",
      "Komplett kontrahieren — bis Ferse fast den Po berührt.",
      "Negative Phase langsam ablassen.",
      "Sitzend oder liegend — sitzend trifft Hamstring stärker.",
    ],
  },
  "calf-raise": {
    name: "Wadenheben",
    group: "legs",
    de: "Wade",
    tips: [
      "Volle Range: tiefe Dehnung unten, maximale Streckung oben.",
      "Am Topp 1-2s halten — Pump entsteht durch Halten.",
      "Beine leicht gebeugt für gestreckten Wadenmuskel.",
      "Hohe Wdh (15-25) — Waden mögen Volumen.",
    ],
  },
  "hip-thrust": {
    name: "Hip Thrust",
    group: "legs",
    de: "Gesäß",
    tips: [
      "Schultern auf Bank, Füße schulterbreit & flach.",
      "Hüfte gerade nach oben drücken — Knie 90° am Topp.",
      "Gesäß HART zusammenkneifen — 1-2s halten.",
      "Kein Hohlkreuz beim Strecken — Bauch fest.",
    ],
  },
  // CORE
  "plank": {
    name: "Plank",
    group: "core",
    de: "Ganzer Core",
    tips: [
      "Körper in einer geraden Linie — Po nicht zu hoch oder zu tief.",
      "Bauch fest, Gesäß fest, alles anspannen.",
      "Schultern direkt über den Ellenbogen.",
      "Qualität > Dauer — 30s perfekt schlägt 2min wackelig.",
    ],
  },
  "crunch": {
    name: "Crunch",
    group: "core",
    de: "Oberer Bauch",
    tips: [
      "Nur Schulterblätter vom Boden lösen — kein voller Sit-Up.",
      "Kinn weg vom Körper, kein Nacken-Ziehen.",
      "Ausatmen beim Hochkommen.",
      "Spannung halten — keine Ruhepause am Boden.",
    ],
  },
  "hanging-leg-raise": {
    name: "Hängendes Beinheben",
    group: "core",
    de: "Unterer Bauch",
    tips: [
      "Beine kontrolliert anheben — kein Schwung.",
      "Bis mind. 90° (waagerecht) — mit Erfahrung höher.",
      "Schultern aktiv nach unten ziehen.",
      "Negative Phase langsam ablassen.",
    ],
  },
  "russian-twist": {
    name: "Russian Twist",
    group: "core",
    de: "Schräge Bauchmuskulatur",
    tips: [
      "Rücken neutral — leicht zurückgelehnt, nicht rundrücken.",
      "Beine angehoben für mehr Reiz.",
      "Hände/Gewicht von Seite zu Seite — kontrolliert.",
      "Atmung gleichmäßig, nicht hetzen.",
    ],
  },
  // CARDIO
  "treadmill": {
    name: "Laufband",
    group: "cardio",
    de: "Ausdauer",
    tips: [
      "Aufrechte Haltung, Blick nach vorne.",
      "Mittelfuß-Aufsatz statt Ferse — schont Gelenke.",
      "Arme schwingen mit — entspannte Schultern.",
      "Intervall (HIIT) > Konstanz für Fettabbau.",
    ],
  },
  "burpee": {
    name: "Burpees",
    group: "cardio",
    de: "Ganzkörper Cardio",
    tips: [
      "Saubere Form > Tempo.",
      "Liegestütz unten optional, aber für vollen Reiz machen.",
      "Sprung nach oben mit ausgestreckten Armen.",
      "Atmung kontrollieren — kurze Pausen ok.",
    ],
  },
  "jumping-jack": {
    name: "Jumping Jacks",
    group: "cardio",
    de: "Aufwärmen & Cardio",
    tips: [
      "Volle Range: Arme komplett hoch, Beine schulterbreit.",
      "Leicht in den Knien federn — kein hartes Aufsetzen.",
      "Tempo gleichmäßig — nicht hetzen.",
      "Perfekt als 5min Warm-Up.",
    ],
  },
  "rowing-machine": {
    name: "Rudergerät",
    group: "cardio",
    de: "Ganzkörper Cardio",
    tips: [
      "Sequenz: Beine — Hüfte — Arme. Zurück: Arme — Hüfte — Beine.",
      "Rücken neutral, keine Rundrücken-Position.",
      "Ziehen mit den Beinen, nicht mit den Armen.",
      "Konstante Schlagzahl — 22-28 Züge/Min für Ausdauer.",
    ],
  },
  "jump-rope": {
    name: "Seilspringen",
    group: "cardio",
    de: "Cardio & Koordination",
    tips: [
      "Handgelenke drehen — nicht aus den Armen.",
      "Kleine Sprünge — nur ein paar cm vom Boden.",
      "Mittelfuß-Aufsatz, weich landen.",
      "Top-Tier Cardio: 10min = ~30min Joggen.",
    ],
  },
};

export function getExerciseTips(slug) {
  return TIPS[slug] || null;
}

export function getAllExercises() {
  return Object.entries(TIPS).map(([slug, data]) => ({ slug, ...data }));
}

export const MUSCLE_GROUPS = [
  { key: "chest",     label: "Brust" },
  { key: "back",      label: "Rücken" },
  { key: "shoulders", label: "Schultern" },
  { key: "biceps",    label: "Bizeps" },
  { key: "triceps",   label: "Trizeps" },
  { key: "legs",      label: "Beine" },
  { key: "core",      label: "Core" },
  { key: "cardio",    label: "Cardio" },
];

export default TIPS;
