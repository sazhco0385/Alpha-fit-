from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import json
import logging
import uuid
import asyncio
import bcrypt
import jwt
import stripe
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta

from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
from pywebpush import webpush, WebPushException

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# ===== Config =====
MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')
VAPID_PUBLIC_KEY = os.environ.get('VAPID_PUBLIC_KEY', '')
VAPID_PRIVATE_KEY = os.environ.get('VAPID_PRIVATE_KEY', '')
VAPID_SUBJECT = os.environ.get('VAPID_SUBJECT', 'mailto:support@alphafit.local')
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY')
JWT_SECRET = os.environ.get('JWT_SECRET', 'changeme')
ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD')

stripe.api_key = STRIPE_API_KEY
SUPPORT_EMAIL = "supportalphafit@gmail.com"

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="alpha-fit API")
api_router = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("alphafit")

# ===== Pricing Plans (server-side only) =====
PLANS = {
    "monthly": {"amount": 9.99, "currency": "eur", "label": "1 Monat", "interval": "month", "interval_count": 1, "days": 30},
    "quarterly": {"amount": 19.99, "currency": "eur", "label": "3 Monate", "interval": "month", "interval_count": 3, "days": 90},
    "yearly": {"amount": 69.99, "currency": "eur", "label": "1 Jahr", "interval": "year", "interval_count": 1, "days": 365},
}
TRIAL_DAYS = 7


# ===== Models =====
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class OnboardingData(BaseModel):
    goal: str  # muscle_gain | fat_loss | strength | endurance | general
    experience: str  # beginner | intermediate | advanced
    gender: str
    age: int
    height_cm: float
    weight_kg: float
    days_per_week: int
    equipment: str  # home | gym | minimal
    injuries: Optional[str] = ""

class ChatMessage(BaseModel):
    text: str

class LogSetRequest(BaseModel):
    session_id: str
    exercise_index: int
    set_index: int
    reps: int
    weight_kg: float

class CheckoutRequest(BaseModel):
    plan: str  # monthly | quarterly | yearly
    origin_url: str

class AdminPremiumRequest(BaseModel):
    user_id: str
    days: int

class SupportTicketRequest(BaseModel):
    subject: str
    message: str
    category: Optional[str] = "general"

class NutritionAnalyzeRequest(BaseModel):
    image_base64: str  # data URL or pure base64
    meal_type: Optional[str] = "snack"  # breakfast | lunch | dinner | snack

class BodyScanRequest(BaseModel):
    image_base64: str  # data URL or pure base64
    notes: Optional[str] = ""

class FormCheckRequest(BaseModel):
    image_base64: str
    exercise_name: str
    target_muscle: Optional[str] = ""
    notes: Optional[str] = ""

class PushSubscribeRequest(BaseModel):
    endpoint: str
    keys: dict
    triggers: Optional[dict] = None  # {workout_reminder: true, streak_protect: true, weekly_review: true}
    reminder_time: Optional[str] = "18:00"  # HH:MM local user time
    timezone_offset: Optional[int] = 0  # minutes from UTC

class PushTestRequest(BaseModel):
    title: Optional[str] = "Alpha Fit"
    body: Optional[str] = "Test-Benachrichtigung von deinem Alpha Coach 🛡️"

class NutritionLogRequest(BaseModel):
    food_name: str
    portion_grams: float
    calories: float
    protein_g: float = 0
    carbs_g: float = 0
    fat_g: float = 0
    fiber_g: float = 0
    sugar_g: float = 0
    sodium_mg: float = 0
    meal_type: str = "snack"
    notes: Optional[str] = ""


# ===== Helpers =====
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False

def create_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=30)}
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def decode_token(token: str) -> Optional[str]:
    try:
        data = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return data.get("sub")
    except Exception:
        return None

def public_user(u: dict) -> dict:
    if not u:
        return None
    return {
        "id": u.get("id"),
        "email": u.get("email"),
        "name": u.get("name"),
        "is_admin": u.get("is_admin", False),
        "is_premium": is_premium_active(u),
        "premium_until": u.get("premium_until"),
        "trial_until": u.get("trial_until"),
        "onboarding_completed": u.get("onboarding_completed", False),
        "profile": u.get("profile"),
        "current_plan_id": u.get("current_plan_id"),
        "badges": u.get("badges", []),
        "created_at": u.get("created_at"),
    }

def is_premium_active(u: dict) -> bool:
    now = datetime.now(timezone.utc)
    for key in ("premium_until", "trial_until"):
        v = u.get(key)
        if v:
            try:
                dt = datetime.fromisoformat(v)
                if dt > now:
                    return True
            except Exception:
                pass
    return False

async def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> dict:
    if not credentials:
        raise HTTPException(status_code=401, detail="Missing token")
    user_id = decode_token(credentials.credentials)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin only")
    return user


# ===== Startup: Seed admin =====
@app.on_event("startup")
async def seed_admin():
    if not ADMIN_EMAIL or not ADMIN_PASSWORD:
        return
    existing = await db.users.find_one({"email": ADMIN_EMAIL})
    if existing:
        # Make sure flag is set
        await db.users.update_one({"email": ADMIN_EMAIL}, {"$set": {"is_admin": True}})
        return
    user = {
        "id": str(uuid.uuid4()),
        "email": ADMIN_EMAIL,
        "password_hash": hash_password(ADMIN_PASSWORD),
        "name": "Alpha Admin",
        "is_admin": True,
        "is_premium": True,
        "premium_until": (datetime.now(timezone.utc) + timedelta(days=3650)).isoformat(),
        "trial_until": None,
        "onboarding_completed": False,
        "profile": None,
        "current_plan_id": None,
        "badges": [],
        "created_at": now_iso(),
    }
    await db.users.insert_one(user)
    logger.info(f"Seeded admin user: {ADMIN_EMAIL}")


# ===== Auth =====
@api_router.post("/auth/register")
async def register(payload: RegisterRequest):
    existing = await db.users.find_one({"email": payload.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="E-Mail bereits registriert")
    user = {
        "id": str(uuid.uuid4()),
        "email": payload.email.lower(),
        "password_hash": hash_password(payload.password),
        "name": payload.name,
        "is_admin": False,
        "is_premium": False,
        "premium_until": None,
        "trial_until": None,
        "onboarding_completed": False,
        "profile": None,
        "current_plan_id": None,
        "badges": [],
        "created_at": now_iso(),
    }
    await db.users.insert_one(user)
    await log_activity(user["id"], user["name"], "registered", {})
    token = create_token(user["id"])
    return {"token": token, "user": public_user(user)}

@api_router.post("/auth/login")
async def login(payload: LoginRequest):
    user = await db.users.find_one({"email": payload.email.lower()}, {"_id": 0})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Ungültige Anmeldedaten")
    token = create_token(user["id"])
    return {"token": token, "user": public_user(user)}

@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return public_user(user)

@api_router.post("/auth/heartbeat")
async def heartbeat(user: dict = Depends(get_current_user)):
    """User-Aktivität ping - jede Minute vom Frontend gesendet."""
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"last_active_at": now_iso()}}
    )
    return {"ok": True}


# ===== Onboarding =====
@api_router.post("/onboarding")
async def save_onboarding(data: OnboardingData, user: dict = Depends(get_current_user)):
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"profile": data.model_dump(), "onboarding_completed": True}}
    )
    await log_activity(user["id"], user.get("name", ""), "onboarding_completed", {"goal": data.goal})
    # Auto-generate first AI plan
    plan = await generate_ai_plan(user["id"], data.model_dump())
    return {"ok": True, "plan_id": plan["id"]}


# ===== AI Coach =====
# HTTP endpoints moved to routers/coach.py
# Helpers below (build_coach_system, call_llm, generate_ai_plan, parse_json_from_llm,
# fallback_plan, _perform_plan_adjust, _run_adjust_job) stay here because they are
# called from multiple routers (coach, sessions auto-adjust, bodyscan plan-adjust, onboarding).
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





# ===== Training Plans + Sessions endpoints moved to routers/sessions.py =====


# ===== Stripe Payments =====
# Payments endpoints moved to routers/payments.py


# ===== Admin endpoints moved to routers/admin.py =====
# ===== Support endpoints moved to routers/support.py =====


# ===== Nutrition Tracking (AI Vision) =====
def strip_base64_prefix(b64: str) -> str:
    """Entfernt 'data:image/jpeg;base64,' Prefix falls vorhanden."""
    if "," in b64 and b64.startswith("data:"):
        return b64.split(",", 1)[1]
    return b64

# ===== Nutrition endpoints moved to routers/nutrition.py =====

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


# ===== Body Scan (AI Vision) =====
# HTTP endpoints moved to routers/bodyscan.py
def require_premium(user: dict) -> None:
    if not is_premium_active(user):
        raise HTTPException(status_code=403, detail="Premium erforderlich für AI Body Scan")




# ===== Form Check endpoints moved to routers/formcheck.py =====





# ===== Push Notifications (Web Push / VAPID) =====
# HTTP endpoints moved to routers/push.py
# Shared helpers (_send_web_push, push_dispatcher_loop) remain here because they are
# used by other in-process tasks (auto-adjust, bodyscan plan-adjust, dispatcher loop).
def _send_web_push(sub: dict, title: str, body: str, url: str = "/dashboard", tag: str = "alphafit") -> bool:
    """Send a single web push. Returns True on success."""
    if not VAPID_PRIVATE_KEY:
        logger.warning("VAPID_PRIVATE_KEY not configured")
        return False
    try:
        webpush(
            subscription_info={"endpoint": sub["endpoint"], "keys": sub["keys"]},
            data=json.dumps({"title": title, "body": body, "url": url, "tag": tag}),
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims={"sub": VAPID_SUBJECT},
            ttl=86400,
        )
        return True
    except WebPushException as e:
        logger.warning(f"Push failed for {sub.get('endpoint','')[:60]}: {e}")
        # 404/410 = subscription gone, remove it
        status = getattr(getattr(e, 'response', None), 'status_code', None)
        if status in (404, 410):
            asyncio.create_task(db.push_subscriptions.delete_one(
                {"user_id": sub["user_id"], "endpoint": sub["endpoint"]}
            ))
        return False
    except Exception as e:
        logger.error(f"Push exception: {e}")
        return False


# /notifications/test moved to routers/push.py



async def push_dispatcher_loop():
    """Background loop: every minute, checks all subscriptions and sends scheduled pushes.
    Triggers: workout_reminder (daily at reminder_time), streak_protect (no activity in 24h before streak break),
    weekly_review (sunday 18:00 local)."""
    await asyncio.sleep(5)
    last_minute = None
    while True:
        try:
            now_utc = datetime.now(timezone.utc)
            current_minute = now_utc.strftime("%Y%m%d%H%M")
            if current_minute == last_minute:
                await asyncio.sleep(20)
                continue
            last_minute = current_minute

            subs = await db.push_subscriptions.find({}, {"_id": 0}).to_list(2000)
            for sub in subs:
                triggers = sub.get("triggers") or {}
                tz_offset = int(sub.get("timezone_offset") or 0)
                local_now = now_utc + timedelta(minutes=tz_offset)
                local_hhmm = local_now.strftime("%H:%M")
                local_dow = local_now.weekday()  # 0=Mon, 6=Sun
                reminder_time = sub.get("reminder_time") or "18:00"

                # Daily workout reminder
                if triggers.get("workout_reminder") and local_hhmm == reminder_time:
                    user = await db.users.find_one({"id": sub["user_id"]})
                    if user:
                        name = (user.get("name") or "Alpha").split()[0]
                        _send_web_push(sub,
                                       title=f"🛡️ {name}, dein Workout wartet",
                                       body="Zeit für Training. Heute leiden, morgen herrschen.",
                                       url="/plan", tag="workout-reminder")

                # Weekly review (Sunday 18:00 local)
                if triggers.get("weekly_review") and local_dow == 6 and local_hhmm == "18:00":
                    _send_web_push(sub,
                                   title="📊 Deine Alpha-Woche",
                                   body="Schau dir dein Coach-Insights & Fortschritts-Update an.",
                                   url="/coach", tag="weekly-review")

                # Streak protect: once per day at 20:00 local, check if user has logged today
                if triggers.get("streak_protect") and local_hhmm == "20:00":
                    today_local = local_now.strftime("%Y-%m-%d")
                    has_session = await db.workout_sessions.find_one(
                        {"user_id": sub["user_id"], "status": "completed",
                         "completed_at": {"$regex": f"^{today_local}"}}
                    )
                    if not has_session:
                        # Check if user has a current streak worth protecting (>=2)
                        user = await db.users.find_one({"id": sub["user_id"]})
                        streak = (user or {}).get("streak_days", 0) or 0
                        if streak >= 2:
                            _send_web_push(sub,
                                           title=f"🔥 Streak gefährdet ({streak} Tage)",
                                           body="Noch keine Aktivität heute. Schütz deine Serie!",
                                           url="/plan", tag="streak-protect")
        except Exception as e:
            logger.error(f"push_dispatcher_loop error: {e}")
        await asyncio.sleep(30)


@app.on_event("startup")
async def start_push_dispatcher():
    if VAPID_PRIVATE_KEY:
        asyncio.create_task(push_dispatcher_loop())
        logger.info("Push dispatcher started")
    else:
        logger.warning("VAPID_PRIVATE_KEY missing - push dispatcher NOT started")





def is_recently_active(last_active: Optional[str]) -> bool:
    if not last_active:
        return False
    try:
        dt = datetime.fromisoformat(last_active)
        return (datetime.now(timezone.utc) - dt).total_seconds() < 300  # 5 min
    except Exception:
        return False

def minutes_since(last_active: Optional[str]) -> int:
    if not last_active:
        return 9999
    try:
        dt = datetime.fromisoformat(last_active)
        return int((datetime.now(timezone.utc) - dt).total_seconds() / 60)
    except Exception:
        return 9999

async def log_activity(user_id: str, user_name: str, action: str, metadata: dict = None):
    """Logge ein Live-Aktivitäts-Event für das Admin-Dashboard."""
    await db.activity_events.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "user_name": user_name,
        "action": action,
        "metadata": metadata or {},
        "created_at": now_iso(),
    })



# ===== Root =====
@api_router.get("/")
async def root():
    return {"service": "alpha-fit", "status": "running"}


# ===== Include modular routers (extracted from server.py) =====
# IMPORTANT: These imports MUST stay at the bottom of server.py, AFTER all top-level
# definitions (db, models, helpers, get_current_user, _send_web_push, etc.).
# Router files do `from server import ...` — placing the imports here makes the
# server module fully populated by the time the router files load, avoiding
# circular-import errors. Do not move these to the top of the file.
from routers import formcheck as _formcheck_router  # noqa: E402
from routers import payments as _payments_router  # noqa: E402
from routers import push as _push_router  # noqa: E402
from routers import nutrition as _nutrition_router  # noqa: E402
from routers import bodyscan as _bodyscan_router  # noqa: E402
from routers import sessions as _sessions_router  # noqa: E402
from routers import coach as _coach_router  # noqa: E402  (must load AFTER sessions; imports calculate_streak from it)
from routers import admin as _admin_router  # noqa: E402
from routers import support as _support_router  # noqa: E402

api_router.include_router(_formcheck_router.router)
api_router.include_router(_payments_router.router)
api_router.include_router(_push_router.router)
api_router.include_router(_nutrition_router.router)
api_router.include_router(_bodyscan_router.router)
api_router.include_router(_sessions_router.router)
api_router.include_router(_coach_router.router)
api_router.include_router(_admin_router.router)
api_router.include_router(_support_router.router)


# Include router & CORS
app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
