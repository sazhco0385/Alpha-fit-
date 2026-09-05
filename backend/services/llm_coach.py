"""LLM coach helpers (system prompt, plan generation, parsing, adjust jobs).
Extracted from server.py."""
from datetime import datetime, timezone, timedelta
from typing import Optional
import asyncio
import json
import uuid
import logging

from fastapi import HTTPException
from emergentintegrations.llm.chat import LlmChat, UserMessage

from server import db, EMERGENT_LLM_KEY, now_iso

logger = logging.getLogger("alphafit")


def build_coach_system() -> str:
    return (
        "Du bist Alpha Coach, ein hochmoderner KI-Personaltrainer für die alpha-fit App. "
        "Du erstellst Trainingspläne und passt sie progressiv an. "
        "Antworte IMMER auf Deutsch. Sei direkt, motivierend, alpha-männlich, präzise."
    )

async def call_llm(system: str, user_text: str, session_id: str) -> str:
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=system,
    ).with_model("openai", "gpt-5.6-terra")
    resp = await chat.send_message(UserMessage(text=user_text))
    return resp if isinstance(resp, str) else str(resp)

async def generate_ai_plan(user_id: str, profile: dict) -> dict:
    """Use LLM to generate a structured workout plan as JSON."""
    prompt = f"""
Erstelle einen Trainingsplan für folgenden Athleten:
- Ziel: {profile.get('goal')}
- Erfahrung: {profile.get('experience')}
- Geschlecht: {profile.get('gender')}
- Alter: {profile.get('age')}
- Größe: {profile.get('height_cm')} cm
- Gewicht: {profile.get('weight_kg')} kg
- Tage pro Woche: {profile.get('days_per_week')}
- Equipment: {profile.get('equipment')}
- Verletzungen: {profile.get('injuries') or 'keine'}

Gib AUSSCHLIESSLICH valides JSON zurück (kein Markdown, keine Erklärungen), genau in diesem Format:
{{
  "name": "Plan-Name",
  "weeks": 4,
  "progression_notes": "Kurzer Hinweis zur Progression",
  "days": [
    {{
      "day_index": 1,
      "name": "Push - Brust/Schulter/Trizeps",
      "focus": "Push",
      "exercises": [
        {{
          "name": "Bankdrücken",
          "target_muscle": "Brust",
          "sets": 4,
          "reps": 8,
          "weight_kg": 60,
          "rest_seconds": 90,
          "notes": "Sauber, kontrolliert"
        }}
      ]
    }}
  ]
}}

Erstelle exakt {profile.get('days_per_week')} Trainingstage. Jeder Tag 5-7 Übungen. Realistische Startgewichte basierend auf Erfahrung und Körpergewicht.

WICHTIG - Pausenzeiten (rest_seconds) MÜSSEN pro Übung individuell und realistisch sein:
- Schwere Grundübungen (Kniebeugen, Kreuzheben, Bankdrücken, Schulterdrücken, Langhantelrudern) bei 1-6 Wdh: 150-180s
- Grundübungen bei 7-10 Wdh: 90-120s
- Mittlere Compound-Übungen (Klimmzüge, Rudern, Beinpresse, Latzug, Dips) 8-12 Wdh: 75-90s
- Isolationsübungen (Curls, Trizeps, Seitheben, Face Pulls, Wadenheben) 10-15 Wdh: 45-60s
- Core/Ausdauer (Plank, Crunches, Farmer's Walk): 30-45s
NIEMALS alle Übungen mit demselben rest_seconds Wert! Die Pause MUSS zur Intensität und zum Wdh-Bereich passen."""

    text = await call_llm(build_coach_system(), prompt, f"plan-{user_id}")
    # Try to extract JSON
    plan_data = parse_json_from_llm(text)
    if not plan_data:
        plan_data = fallback_plan(profile)

    # Normalize rest times (fix uniform-60s slop + legacy rest_sec key)
    plan_data["days"] = normalize_days_rest(plan_data.get("days", []))

    plan = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "name": plan_data.get("name", "Alpha Plan"),
        "weeks": plan_data.get("weeks", 4),
        "progression_notes": plan_data.get("progression_notes", ""),
        "days": plan_data.get("days", []),
        "created_at": now_iso(),
        "version": 1,
    }
    await db.training_plans.insert_one(plan)
    plan.pop("_id", None)
    await db.users.update_one({"id": user_id}, {"$set": {"current_plan_id": plan["id"]}})
    return plan

# ----- Rest-time helpers -----
_COMPOUND_HEAVY_KEYWORDS = (
    "kniebeug", "squat", "kreuzheb", "deadlift", "bankdr", "bench",
    "schulterdr", "overhead", "military", "front squat", "hip thrust",
    "langhantelrud", "barbell row",
)
_COMPOUND_MED_KEYWORDS = (
    "klimm", "pull-up", "pull up", "dip", "beinpres", "leg press",
    "rumän", "romanian", "ausfallschritt", "lunge", "rudern", "row",
    "latzieh", "lat pull",
)
_ISOLATION_KEYWORDS = (
    "curl", "trizep", "tricep", "seitheb", "lateral", "face pull",
    "wadenheb", "calf", "reverse fly", "fly", "kickback", "extension",
    "leg curl", "beincurl", "shrug",
)
_CORE_KEYWORDS = ("plank", "crunch", "sit-up", "situp", "russian twist", "hollow", "l-sit", "hanging")


def _smart_rest_default(ex: dict) -> int:
    """Return a science-based rest time (seconds) for an exercise when the LLM omits it."""
    name = str(ex.get("name") or "").lower()
    reps_raw = ex.get("reps")
    # Parse reps range like "5-8" -> take upper bound
    try:
        if isinstance(reps_raw, str) and "-" in reps_raw:
            reps = int(reps_raw.split("-")[-1].strip())
        else:
            reps = int(reps_raw)
    except Exception:
        reps = 10
    # Core / endurance
    if any(k in name for k in _CORE_KEYWORDS) or reps >= 20:
        return 45
    # Heavy compound
    if any(k in name for k in _COMPOUND_HEAVY_KEYWORDS):
        return 150 if reps <= 6 else 120
    # Medium compound
    if any(k in name for k in _COMPOUND_MED_KEYWORDS):
        return 90
    # Isolation
    if any(k in name for k in _ISOLATION_KEYWORDS):
        return 60 if reps <= 12 else 45
    # Fallback by rep range
    if reps <= 6:
        return 150
    if reps <= 10:
        return 90
    if reps <= 15:
        return 60
    return 45


def normalize_days_rest(days: list) -> list:
    """Ensure every exercise has a sane `rest_seconds` (int).
    Accepts legacy `rest_sec`, drops it, clamps 0..600. Uses `_smart_rest_default` when missing/uniform.
    Also breaks up unrealistic uniform rest patterns (e.g., LLM returning all 60s) by re-deriving values."""
    if not isinstance(days, list):
        return days
    # Detect suspiciously uniform rests across the whole plan (LLM slop)
    all_rests = []
    for d in days:
        for ex in (d.get("exercises") or []):
            r = ex.get("rest_seconds")
            if r is None:
                r = ex.get("rest_sec")
            all_rests.append(r)
    is_uniform = (
        len(all_rests) >= 4
        and all(r is not None for r in all_rests)
        and len(set(all_rests)) == 1
    )
    for d in days:
        for ex in (d.get("exercises") or []):
            raw = ex.get("rest_seconds")
            if raw is None:
                raw = ex.pop("rest_sec", None)
            else:
                # legacy key removal
                ex.pop("rest_sec", None)
            if raw is None or is_uniform:
                val = _smart_rest_default(ex)
            else:
                try:
                    val = int(round(float(raw)))
                except Exception:
                    val = _smart_rest_default(ex)
            ex["rest_seconds"] = max(0, min(600, val))
    return days


def parse_json_from_llm(text: str) -> Optional[dict]:
    if not text:
        return None
    t = text.strip()
    # strip code fences
    if t.startswith("```"):
        t = t.strip("`")
        if t.startswith("json"):
            t = t[4:]
    # find first { and last }
    start = t.find("{")
    end = t.rfind("}")
    if start == -1 or end == -1:
        return None
    try:
        return json.loads(t[start:end+1])
    except Exception:
        return None

def fallback_plan(profile: dict) -> dict:
    """Fallback plan if AI fails."""
    days_count = profile.get("days_per_week", 3)
    base_w = max(20, int(profile.get("weight_kg", 70) * 0.5))
    template_days = [
        {"name": "Push - Brust/Schulter/Trizeps", "focus": "Push",
         "exercises": [
             {"name": "Bankdrücken", "target_muscle": "Brust", "sets": 4, "reps": 8, "weight_kg": base_w, "rest_seconds": 90, "notes": ""},
             {"name": "Schulterdrücken", "target_muscle": "Schulter", "sets": 4, "reps": 10, "weight_kg": int(base_w*0.6), "rest_seconds": 75, "notes": ""},
             {"name": "Schrägbankdrücken Kurzhantel", "target_muscle": "Brust oben", "sets": 3, "reps": 10, "weight_kg": int(base_w*0.4), "rest_seconds": 75, "notes": ""},
             {"name": "Trizepsdrücken", "target_muscle": "Trizeps", "sets": 3, "reps": 12, "weight_kg": int(base_w*0.4), "rest_seconds": 60, "notes": ""},
             {"name": "Seitheben", "target_muscle": "Schulter", "sets": 3, "reps": 15, "weight_kg": 8, "rest_seconds": 45, "notes": ""},
         ]},
        {"name": "Pull - Rücken/Bizeps", "focus": "Pull",
         "exercises": [
             {"name": "Klimmzüge", "target_muscle": "Rücken", "sets": 4, "reps": 8, "weight_kg": 0, "rest_seconds": 90, "notes": ""},
             {"name": "Langhantelrudern", "target_muscle": "Rücken", "sets": 4, "reps": 10, "weight_kg": int(base_w*0.8), "rest_seconds": 90, "notes": ""},
             {"name": "Latziehen", "target_muscle": "Latissimus", "sets": 3, "reps": 12, "weight_kg": int(base_w*0.7), "rest_seconds": 75, "notes": ""},
             {"name": "Bizeps Curl", "target_muscle": "Bizeps", "sets": 3, "reps": 12, "weight_kg": int(base_w*0.3), "rest_seconds": 60, "notes": ""},
             {"name": "Face Pulls", "target_muscle": "Schulter hinten", "sets": 3, "reps": 15, "weight_kg": 15, "rest_seconds": 45, "notes": ""},
         ]},
        {"name": "Legs - Beine/Po", "focus": "Legs",
         "exercises": [
             {"name": "Kniebeugen", "target_muscle": "Quadrizeps", "sets": 4, "reps": 8, "weight_kg": base_w, "rest_seconds": 120, "notes": ""},
             {"name": "Rumänisches Kreuzheben", "target_muscle": "Hamstrings", "sets": 4, "reps": 10, "weight_kg": int(base_w*0.9), "rest_seconds": 90, "notes": ""},
             {"name": "Beinpresse", "target_muscle": "Beine", "sets": 3, "reps": 12, "weight_kg": int(base_w*1.5), "rest_seconds": 90, "notes": ""},
             {"name": "Wadenheben", "target_muscle": "Waden", "sets": 4, "reps": 15, "weight_kg": int(base_w*0.5), "rest_seconds": 45, "notes": ""},
             {"name": "Ausfallschritte", "target_muscle": "Beine", "sets": 3, "reps": 12, "weight_kg": int(base_w*0.3), "rest_seconds": 60, "notes": ""},
         ]},
        {"name": "Upper Body", "focus": "Upper",
         "exercises": [
             {"name": "Bankdrücken", "target_muscle": "Brust", "sets": 4, "reps": 8, "weight_kg": base_w, "rest_seconds": 90, "notes": ""},
             {"name": "Langhantelrudern", "target_muscle": "Rücken", "sets": 4, "reps": 8, "weight_kg": int(base_w*0.8), "rest_seconds": 90, "notes": ""},
             {"name": "Schulterdrücken", "target_muscle": "Schulter", "sets": 3, "reps": 10, "weight_kg": int(base_w*0.6), "rest_seconds": 75, "notes": ""},
             {"name": "Latziehen", "target_muscle": "Latissimus", "sets": 3, "reps": 12, "weight_kg": int(base_w*0.7), "rest_seconds": 75, "notes": ""},
         ]},
        {"name": "Lower Body", "focus": "Lower",
         "exercises": [
             {"name": "Kniebeugen", "target_muscle": "Quadrizeps", "sets": 4, "reps": 8, "weight_kg": base_w, "rest_seconds": 120, "notes": ""},
             {"name": "Kreuzheben", "target_muscle": "Rücken/Beine", "sets": 4, "reps": 6, "weight_kg": int(base_w*1.2), "rest_seconds": 120, "notes": ""},
             {"name": "Beinpresse", "target_muscle": "Beine", "sets": 3, "reps": 12, "weight_kg": int(base_w*1.5), "rest_seconds": 90, "notes": ""},
             {"name": "Wadenheben", "target_muscle": "Waden", "sets": 4, "reps": 15, "weight_kg": int(base_w*0.5), "rest_seconds": 45, "notes": ""},
         ]},
        {"name": "Full Body", "focus": "Full",
         "exercises": [
             {"name": "Kniebeugen", "target_muscle": "Beine", "sets": 3, "reps": 10, "weight_kg": int(base_w*0.8), "rest_seconds": 90, "notes": ""},
             {"name": "Bankdrücken", "target_muscle": "Brust", "sets": 3, "reps": 10, "weight_kg": int(base_w*0.8), "rest_seconds": 90, "notes": ""},
             {"name": "Klimmzüge", "target_muscle": "Rücken", "sets": 3, "reps": 8, "weight_kg": 0, "rest_seconds": 90, "notes": ""},
             {"name": "Plank", "target_muscle": "Core", "sets": 3, "reps": 60, "weight_kg": 0, "rest_seconds": 45, "notes": "Sekunden"},
         ]},
    ]
    selected = template_days[:days_count] if days_count <= len(template_days) else template_days + template_days[:days_count-len(template_days)]
    for i, d in enumerate(selected):
        d["day_index"] = i + 1
    return {
        "name": f"Alpha {profile.get('goal','Custom').title()} Plan",
        "weeks": 4,
        "progression_notes": "Steigere alle 2 Wochen das Gewicht um 2.5-5kg wenn die Wiederholungen sauber sind.",
        "days": selected,
    }



def _plan_age_weeks(plan: dict) -> float:
    """Rough age of the CURRENT plan chain in weeks. Uses `first_created_at` if
    tracked, otherwise the plan's own `created_at`."""
    try:
        ca = plan.get("first_created_at") or plan.get("created_at")
        d = datetime.fromisoformat(str(ca).replace("Z", "+00:00"))
        return max(0.0, (datetime.now(timezone.utc) - d).total_seconds() / (7 * 24 * 3600))
    except Exception:
        return 0.0


def _mesocycle_phase(plan: dict) -> dict:
    """Return the current periodization phase based on plan age + version history.
    A mesocycle = 4-week block: accumulation → intensification → peak → deload → new cycle.
    """
    weeks = _plan_age_weeks(plan)
    version = int(plan.get("version") or 1)
    # Week within the current 4-week block (1..4)
    week_in_block = int(weeks) % 4 + 1
    if week_in_block == 1:
        return {"week": 1, "block": (int(weeks) // 4) + 1, "name": "AKKUMULATION", "focus": "Volumen aufbauen"}
    if week_in_block == 2:
        return {"week": 2, "block": (int(weeks) // 4) + 1, "name": "PROGRESSION", "focus": "Gewichte steigern"}
    if week_in_block == 3:
        return {"week": 3, "block": (int(weeks) // 4) + 1, "name": "INTENSIFIKATION", "focus": "Peak-Kraft"}
    # Week 4 → deload
    return {"week": 4, "block": (int(weeks) // 4) + 1, "name": "DELOAD", "focus": "Regeneration + neue Reize vorbereiten"}


def _detect_plateaus(sessions: list, plan: dict) -> list:
    """Identify exercises where the user has hit ≥3 sessions without progress
    (same or lower weight AND same or lower top-set reps). Returns a list of
    exercise names that need a stimulus change."""
    from collections import defaultdict
    # exercise_name → list of (weight, top_reps) from newest → oldest
    ex_hist = defaultdict(list)
    days_by_idx = {d.get("day_index"): d for d in (plan.get("days") or [])}
    for s in sessions[:8]:  # last 8 sessions
        day = days_by_idx.get(s.get("day_index"))
        if not day:
            continue
        # take top set per exercise from this session
        best_per_ex = {}
        for ls in (s.get("logged_sets") or []):
            i = ls.get("exercise_index")
            if not isinstance(i, int) or i < 0 or i >= len(day.get("exercises") or []):
                continue
            ex_name = (day["exercises"][i].get("name") or "").strip()
            if not ex_name:
                continue
            w = float(ls.get("weight_kg") or 0)
            r = int(ls.get("reps") or 0)
            prev = best_per_ex.get(ex_name)
            if not prev or (w, r) > prev:
                best_per_ex[ex_name] = (w, r)
        for name, (w, r) in best_per_ex.items():
            ex_hist[name].append((w, r))
    plateaus = []
    for name, hist in ex_hist.items():
        if len(hist) < 3:
            continue
        recent = hist[:3]
        # Sorted newest first; a plateau = weight not strictly increasing over 3 sessions
        weights = [h[0] for h in recent]
        # No progress if max(older) >= newest
        if max(weights[1:]) >= weights[0]:
            plateaus.append(name)
    return plateaus


def _variation_instruction(plan: dict, plateaus: list = None) -> str:
    """Mesocycle-aware progression instructions inspired by MyFitCoach / MCI style periodization."""
    phase = _mesocycle_phase(plan)
    weeks = _plan_age_weeks(plan)
    plateaus = plateaus or []

    plateau_note = ""
    if plateaus:
        joined = ", ".join(plateaus[:5])
        plateau_note = (
            f"\n\n⚠️ PLATEAU-ALARM: Diese Übungen zeigen seit 3+ Sessions KEINE Progression: {joined}. "
            "Für DIESE Übungen: entweder Deload (-10-15% Gewicht, saubere Form) ODER durch eine "
            "biomechanisch ähnliche Alternative ersetzen (z.B. Bankdrücken → Schrägbankdrücken, "
            "Kniebeugen → Front-Squat, Latzug → enges Latziehen)."
        )

    if phase["week"] == 1:
        return (
            f"MESOZYKLUS {phase['block']} · WOCHE 1 – AKKUMULATION (Plan-Alter: {weeks:.1f} Wochen).\n"
            "Ziel: VOLUMEN. Behalte alle Übungen. Falls User obere Rep-Range geschafft hat (z.B. 8/6-8), "
            "füge 1 Wdh hinzu ODER +2.5kg. Falls untere Rep-Range verpasst: Gewicht -2.5kg."
            + plateau_note
        )
    if phase["week"] == 2:
        return (
            f"MESOZYKLUS {phase['block']} · WOCHE 2 – PROGRESSION (Plan-Alter: {weeks:.1f} Wochen).\n"
            "Ziel: GEWICHT rauf. Bei allen Compound-Übungen die letzten Woche Ziel-Reps erreicht wurden: "
            "+2.5-5kg (5kg bei Beinen/Rücken, 2.5kg bei Oberkörper). Volumen (Sätze) identisch. "
            "Bei Wdh unter Ziel: Gewicht halten, sauber ausführen."
            + plateau_note
        )
    if phase["week"] == 3:
        return (
            f"MESOZYKLUS {phase['block']} · WOCHE 3 – INTENSIFIKATION (Plan-Alter: {weeks:.1f} Wochen).\n"
            "Ziel: PEAK-KRAFT. Bei Grundübungen (Kniebeugen, Kreuzheben, Bankdrücken, Schulterdrücken, "
            "Rudern): Reps -2 (z.B. 8 → 6), Gewicht +5-10%. Bei Isolationsübungen: unverändert weiter. "
            "1-2 alte Accessory-Übungen darfst du gegen frische ersetzen für neuen Reiz."
            + plateau_note
        )
    # Week 4 – DELOAD
    return (
        f"MESOZYKLUS {phase['block']} · WOCHE 4 – DELOAD (Plan-Alter: {weeks:.1f} Wochen).\n"
        "PFLICHT-DELOAD zur Regeneration: Sätze -30-40% (z.B. 4→3 oder 4→2), Gewicht -25-30% "
        "auf ALLEN Übungen. Reps identisch, Fokus auf perfekte Technik.\n"
        "Zusätzlich für den NÄCHSTEN Mesozyklus vorbereiten: 2-3 Accessory-Übungen gegen neue "
        "Variationen austauschen (z.B. Bizeps Curl → Hammer Curl, Seitheben → Cable Lateral, "
        "Bankdrücken bleibt aber wechsel Schrägbank-Winkel). Grundübungen bleiben immer erhalten."
        + plateau_note
    )


async def _perform_plan_adjust(user: dict, plan: dict) -> dict:
    """Core LLM-driven plan adjustment. Returns the saved new plan dict."""
    # gather last 10 completed sessions
    sessions = await db.workout_sessions.find(
        {"user_id": user["id"], "status": "completed"}, {"_id": 0}
    ).sort("completed_at", -1).to_list(10)

    perf_summary = []
    for s in sessions:
        day = next((d for d in plan["days"] if d["day_index"] == s.get("day_index")), None)
        if not day:
            continue
        for log in s.get("logged_sets", []):
            ex_idx = log["exercise_index"]
            if ex_idx < len(day["exercises"]):
                ex = day["exercises"][ex_idx]
                perf_summary.append(
                    f"{ex['name']}: Soll {ex['sets']}x{ex['reps']}@{ex['weight_kg']}kg, Ist {log['reps']} Whdh @ {log['weight_kg']}kg"
                )

    perf_text = "\n".join(perf_summary[-20:]) or "Noch keine Daten."

    # ─── Detect plateaus & phase for smart prompting ─────────────────────
    plateaus = _detect_plateaus(sessions, plan)
    phase = _mesocycle_phase(plan)

    # Shrink plan payload (only essential fields per exercise)
    slim_days = []
    for d in plan.get("days", []):
        slim_days.append({
            "day_index": d.get("day_index"),
            "name": d.get("name"),
            "exercises": [
                {
                    "name": ex.get("name"),
                    "target_muscle": ex.get("target_muscle"),
                    "sets": ex.get("sets"),
                    "reps": ex.get("reps"),
                    "weight_kg": ex.get("weight_kg"),
                    "rest_seconds": ex.get("rest_seconds") or ex.get("rest_sec") or _smart_rest_default(ex),
                }
                for ex in (d.get("exercises") or [])
            ],
        })

    prompt = f"""
Aktueller Trainingsplan (JSON): {json.dumps(slim_days)}

Performance der letzten Einheiten:
{perf_text}

User-Profil: {json.dumps(user.get('profile'))}

{_variation_instruction(plan, plateaus)}

WICHTIG - Pausenzeiten (rest_seconds) individuell pro Übung:
- Schwere Grundübungen 1-6 Wdh: 150-180s | 7-10 Wdh: 90-120s
- Mittlere Compounds 8-12 Wdh: 75-90s
- Isolation 10-15 Wdh: 45-60s
- Core/Ausdauer: 30-45s
NIEMALS alle Übungen mit identischer Pause. Nutze das Feld 'rest_seconds' (nicht 'rest_sec').

Gib NUR JSON zurück im Format (WICHTIG: 'name' OHNE Versions-Suffix wie 'v2' – die Version wird vom System vergeben):
{{
  "name": "Plan-Name",
  "weeks": 4,
  "progression_notes": "Was wurde angepasst",
  "days": [...]
}}
"""
    try:
        text = await call_llm(build_coach_system(), prompt, f"adjust-{user['id']}-{uuid.uuid4()}")
    except Exception as e:
        err_str = str(e)
        logger.error(f"plan-adjust LLM call failed: {err_str}")
        if "quota" in err_str.lower() or "budget" in err_str.lower() or "429" in err_str or "exceeded" in err_str.lower():
            raise HTTPException(status_code=402, detail="KI-Budget aufgebraucht - Support kontaktieren")
        raise HTTPException(status_code=502, detail=f"KI nicht erreichbar: {err_str[:120]}")
    plan_data = parse_json_from_llm(text)
    if not plan_data:
        logger.error(f"plan-adjust: LLM returned unparseable JSON (first 300 chars): {str(text)[:300]}")
        raise HTTPException(status_code=502, detail="KI hat unlesbare Antwort gesendet - bitte erneut versuchen")

    new_version = plan.get("version", 1) + 1
    # Strip any 'vN' / 'V N' suffix the LLM might still add, then append the real version
    raw_name = plan_data.get("name", "Alpha Plan")
    import re
    clean_name = re.sub(r"\s+v\s*\d+\s*$", "", str(raw_name), flags=re.IGNORECASE).strip() or "Alpha Plan"
    final_name = f"{clean_name} v{new_version}"

    new_plan = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "name": final_name,
        "weeks": plan_data.get("weeks", 4),
        "progression_notes": plan_data.get("progression_notes", ""),
        "days": normalize_days_rest(plan_data.get("days", [])),
        "created_at": now_iso(),
        "version": new_version,
        "previous_plan_id": plan["id"],
        # Track the original creation date of this plan chain so the LLM can gate variation by age
        "first_created_at": plan.get("first_created_at") or plan.get("created_at"),
        # Mesocycle metadata for UI + plateau tracking
        "mesocycle_phase": phase,
        "plateaus_detected": plateaus,
    }
    await db.training_plans.insert_one(new_plan)
    new_plan.pop("_id", None)
    await db.users.update_one({"id": user["id"]}, {"$set": {"current_plan_id": new_plan["id"]}})
    return new_plan


async def _run_adjust_job(job_id: str, user: dict, plan: dict) -> None:
    """Background worker: performs adjust then writes result back to the job document."""
    try:
        new_plan = await asyncio.wait_for(_perform_plan_adjust(user, plan), timeout=180)
        await db.plan_adjust_jobs.update_one(
            {"id": job_id},
            {"$set": {
                "status": "done",
                "plan": new_plan,
                "finished_at": now_iso(),
            }},
        )
    except asyncio.TimeoutError:
        await db.plan_adjust_jobs.update_one(
            {"id": job_id},
            {"$set": {"status": "error", "error": "KI hat zu lange gebraucht. Bitte erneut versuchen.", "finished_at": now_iso()}},
        )
    except HTTPException as he:
        await db.plan_adjust_jobs.update_one(
            {"id": job_id},
            {"$set": {"status": "error", "error": he.detail, "finished_at": now_iso()}},
        )
    except Exception as e:
        logger.error(f"adjust job {job_id} failed: {type(e).__name__}: {e}")
        err_msg = f"KI-Anpassung fehlgeschlagen: {type(e).__name__}"
        try:
            err_msg = f"KI-Anpassung fehlgeschlagen: {str(e)[:150]}"
        except Exception:
            pass
        await db.plan_adjust_jobs.update_one(
            {"id": job_id},
            {"$set": {"status": "error", "error": err_msg, "finished_at": now_iso()}},
        )






# ===== Nutrition goals (used by coach insights + nutrition router) =====
def calculate_nutrition_goals(profile: dict) -> dict:
    """Berechnet tägliche Nährstoff-Ziele basierend auf Mifflin-St Jeor + Ziel."""
    if not profile:
        return {"calories": 2200, "protein_g": 150, "carbs_g": 250, "fat_g": 70, "fiber_g": 30, "sugar_g": 50, "sodium_mg": 2300}

    weight = float(profile.get("weight_kg", 75))
    height = float(profile.get("height_cm", 175))
    age = int(profile.get("age", 30))
    gender = profile.get("gender", "male")
    goal = profile.get("goal", "general")
    days_per_week = int(profile.get("days_per_week", 3))

    # Mifflin-St Jeor BMR
    if gender == "female":
        bmr = 10 * weight + 6.25 * height - 5 * age - 161
    else:
        bmr = 10 * weight + 6.25 * height - 5 * age + 5

    # Activity factor based on training days
    activity = 1.375 + (days_per_week - 2) * 0.075  # 2d=1.375, 6d=1.675
    tdee = bmr * activity

    # Adjust for goal
    if goal == "muscle_gain":
        tdee += 300  # surplus
        protein_per_kg = 2.0
    elif goal == "fat_loss":
        tdee -= 400  # deficit
        protein_per_kg = 2.2
    elif goal == "strength":
        tdee += 150
        protein_per_kg = 2.0
    else:
        protein_per_kg = 1.6

    calories = round(tdee)
    protein_g = round(weight * protein_per_kg)
    fat_g = round(calories * 0.25 / 9)  # 25% from fat
    carbs_g = round((calories - protein_g * 4 - fat_g * 9) / 4)

    return {
        "calories": calories,
        "protein_g": protein_g,
        "carbs_g": max(carbs_g, 0),
        "fat_g": fat_g,
        "fiber_g": 30,
        "sugar_g": round(calories * 0.10 / 4),  # max 10% from sugar
        "sodium_mg": 2300,
    }

