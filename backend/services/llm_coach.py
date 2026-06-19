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
    ).with_model("openai", "gpt-5.5")
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

Erstelle exakt {profile.get('days_per_week')} Trainingstage. Jeder Tag 5-7 Übungen. Realistische Startgewichte basierend auf Erfahrung und Körpergewicht."""

    text = await call_llm(build_coach_system(), prompt, f"plan-{user_id}")
    # Try to extract JSON
    plan_data = parse_json_from_llm(text)
    if not plan_data:
        plan_data = fallback_plan(profile)

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
                    "rest_sec": ex.get("rest_sec", 90),
                }
                for ex in (d.get("exercises") or [])
            ],
        })

    prompt = f"""
Aktueller Trainingsplan (JSON): {json.dumps(slim_days)}

Performance der letzten Einheiten:
{perf_text}

User-Profil: {json.dumps(user.get('profile'))}

Passe den Plan progressiv an. Erhöhe Gewichte wo Athlet die Ziel-Wiederholungen geschafft hat (2.5-5kg). Verringere wo unterschritten (-2.5-5kg). Anzahl Tage und Übungen beibehalten falls möglich, aber du darfst Übungen variieren wenn sinnvoll.

Gib NUR JSON zurück im Format:
{{
  "name": "Plan-Name v2",
  "weeks": 4,
  "progression_notes": "Was wurde angepasst",
  "days": [...]
}}
"""
    text = await call_llm(build_coach_system(), prompt, f"adjust-{user['id']}-{uuid.uuid4()}")
    plan_data = parse_json_from_llm(text)
    if not plan_data:
        raise HTTPException(status_code=500, detail="Konnte Plan nicht aktualisieren")

    new_plan = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "name": plan_data.get("name", "Alpha Plan v2"),
        "weeks": plan_data.get("weeks", 4),
        "progression_notes": plan_data.get("progression_notes", ""),
        "days": plan_data.get("days", []),
        "created_at": now_iso(),
        "version": plan.get("version", 1) + 1,
        "previous_plan_id": plan["id"],
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
        logger.error(f"adjust job {job_id} failed: {e}")
        await db.plan_adjust_jobs.update_one(
            {"id": job_id},
            {"$set": {"status": "error", "error": "KI-Anpassung fehlgeschlagen", "finished_at": now_iso()}},
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

