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

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# ===== Config =====
MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')
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

@api_router.post("/coach/generate-plan")
async def coach_generate(user: dict = Depends(get_current_user)):
    if not user.get("profile"):
        raise HTTPException(status_code=400, detail="Onboarding erst abschließen")
    plan = await generate_ai_plan(user["id"], user["profile"])
    return {"plan": plan}

@api_router.post("/coach/adjust-plan")
async def coach_adjust(user: dict = Depends(get_current_user)):
    """Synchronous adjust (kept for backward compat). Hard 60s timeout to avoid Cloudflare 524.
    Frontend should use /coach/adjust-plan/start + /coach/adjust-plan/status/{job_id}."""
    plan_id = user.get("current_plan_id")
    if not plan_id:
        raise HTTPException(status_code=400, detail="Kein aktiver Plan")
    plan = await db.training_plans.find_one({"id": plan_id}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan nicht gefunden")
    try:
        new_plan = await asyncio.wait_for(_perform_plan_adjust(user, plan), timeout=60)
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="KI antwortet zu langsam - bitte erneut versuchen")
    return {"plan": new_plan}


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


@api_router.post("/coach/adjust-plan/start")
async def coach_adjust_start(user: dict = Depends(get_current_user)):
    """Start an async plan-adjust job. Returns instantly with a job_id; poll /status/{job_id}."""
    plan_id = user.get("current_plan_id")
    if not plan_id:
        raise HTTPException(status_code=400, detail="Kein aktiver Plan")
    plan = await db.training_plans.find_one({"id": plan_id}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan nicht gefunden")

    # If a job is already running for this user, return it instead of starting another
    existing = await db.plan_adjust_jobs.find_one(
        {"user_id": user["id"], "status": "pending"}, {"_id": 0}
    )
    if existing:
        return {"job_id": existing["id"], "status": "pending"}

    job_id = str(uuid.uuid4())
    await db.plan_adjust_jobs.insert_one({
        "id": job_id,
        "user_id": user["id"],
        "status": "pending",
        "created_at": now_iso(),
        "plan_id": plan_id,
    })
    # Fire-and-forget background task
    asyncio.create_task(_run_adjust_job(job_id, user, plan))
    return {"job_id": job_id, "status": "pending"}


@api_router.get("/coach/adjust-plan/status/{job_id}")
async def coach_adjust_status(job_id: str, user: dict = Depends(get_current_user)):
    job = await db.plan_adjust_jobs.find_one({"id": job_id, "user_id": user["id"]}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job nicht gefunden")
    return job



@api_router.post("/coach/chat")
async def coach_chat(msg: ChatMessage, user: dict = Depends(get_current_user)):
    profile_ctx = json.dumps(user.get("profile") or {})
    sys = build_coach_system() + f"\n\nUser-Profil: {profile_ctx}"
    text = await call_llm(sys, msg.text, f"chat-{user['id']}")
    await db.chat_messages.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_text": msg.text,
        "ai_text": text,
        "created_at": now_iso(),
    })
    return {"reply": text}

@api_router.get("/coach/chat/history")
async def chat_history(user: dict = Depends(get_current_user)):
    msgs = await db.chat_messages.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", 1).to_list(200)
    return {"messages": msgs}

@api_router.get("/coach/insights")
async def coach_insights(user: dict = Depends(get_current_user)):
    """Alpha Coach 2.0 - proaktive Wochen-Insights mit Stats & Empfehlungen."""
    now = datetime.now(timezone.utc)
    week_ago = (now - timedelta(days=7)).isoformat()
    two_weeks_ago = (now - timedelta(days=14)).isoformat()

    # This week's completed sessions
    this_week = await db.workout_sessions.find(
        {"user_id": user["id"], "status": "completed", "completed_at": {"$gte": week_ago}},
        {"_id": 0}
    ).to_list(50)
    # Last week
    last_week = await db.workout_sessions.find(
        {"user_id": user["id"], "status": "completed",
         "completed_at": {"$gte": two_weeks_ago, "$lt": week_ago}},
        {"_id": 0}
    ).to_list(50)

    def volume(sessions):
        return sum(
            log.get("reps", 0) * log.get("weight_kg", 0)
            for s in sessions for log in s.get("logged_sets", [])
        )

    this_vol = volume(this_week)
    last_vol = volume(last_week)
    vol_change_pct = None
    if last_vol > 0:
        vol_change_pct = round(((this_vol - last_vol) / last_vol) * 100, 1)

    # Streak + total
    streak = await calculate_streak(user["id"])
    total_completed = await db.workout_sessions.count_documents({"user_id": user["id"], "status": "completed"})

    # Top exercise progression recommendation
    plan_id = user.get("current_plan_id")
    plan = await db.training_plans.find_one({"id": plan_id}, {"_id": 0}) if plan_id else None

    exercise_recs = []
    if plan and this_week:
        # Aggregate performance per exercise across this week
        from collections import defaultdict
        ex_perf = defaultdict(list)
        for s in this_week:
            day = next((d for d in plan["days"] if d["day_index"] == s.get("day_index")), None)
            if not day:
                continue
            for log in s.get("logged_sets", []):
                idx = log.get("exercise_index")
                if 0 <= idx < len(day.get("exercises", [])):
                    ex = day["exercises"][idx]
                    ex_perf[ex["name"]].append({
                        "target_reps": ex.get("reps", 0),
                        "target_weight": ex.get("weight_kg", 0),
                        "actual_reps": log.get("reps", 0),
                        "actual_weight": log.get("weight_kg", 0),
                    })
        # For each, recommend progression
        for name, logs in list(ex_perf.items())[:3]:
            target_w = logs[0]["target_weight"]
            target_r = logs[0]["target_reps"]
            avg_reps = sum(l["actual_reps"] for l in logs) / len(logs)
            last_w = logs[-1]["actual_weight"]
            if avg_reps >= target_r and last_w >= target_w:
                inc = 2.5 if last_w < 50 else 5.0
                exercise_recs.append({
                    "exercise": name,
                    "current_weight": last_w,
                    "recommended_weight": last_w + inc,
                    "reason": f"Du hast {target_r} Whdh sauber geschafft.",
                })

    # Build insight messages
    insights = []

    # 1. Workout count
    count = len(this_week)
    if count > 0:
        insights.append({
            "type": "workouts",
            "icon": "flame",
            "title": f"{count} Workouts diese Woche",
            "text": (
                f"Du hast diese Woche {count} Training{'s' if count > 1 else ''} absolviert. "
                + (f"Letzte Woche: {len(last_week)}. " if last_week else "")
                + ("Solid Arbeit!" if count >= 3 else "Push mehr — Ziel sind 3+.")
            ),
        })
    else:
        insights.append({
            "type": "workouts",
            "icon": "alert",
            "title": "0 Workouts diese Woche",
            "text": "Du hast diese Woche noch nicht trainiert. Zeit für die nächste Einheit, Alpha.",
        })

    # 2. Volume change
    if vol_change_pct is not None and last_vol > 0:
        arrow = "⬆" if vol_change_pct > 0 else ("⬇" if vol_change_pct < 0 else "→")
        insights.append({
            "type": "volume",
            "icon": "trending",
            "title": f"Volumen {arrow} {abs(vol_change_pct)}%",
            "text": (
                f"Dein Trainings-Volumen ist um {abs(vol_change_pct)}% "
                + ("gestiegen — exzellent!" if vol_change_pct > 0 else
                   "gefallen. Push härter nächste Woche." if vol_change_pct < 0 else "stabil geblieben.")
                + f" ({int(this_vol):,} kg vs. {int(last_vol):,} kg)"
            ),
        })
    elif this_vol > 0:
        insights.append({
            "type": "volume",
            "icon": "trending",
            "title": f"{int(this_vol):,} kg Volumen",
            "text": f"Du hast diese Woche {int(this_vol):,} kg insgesamt bewegt. Starker Start!",
        })

    # 3. Streak
    if streak >= 3:
        insights.append({
            "type": "streak",
            "icon": "fire",
            "title": f"{streak}-Tage Streak 🔥",
            "text": f"Du trainierst seit {streak} Tagen in Folge. Brich den Streak nicht!",
        })

    # 4. Exercise progression recommendations
    for rec in exercise_recs:
        insights.append({
            "type": "progression",
            "icon": "sparkles",
            "title": f"Steigere {rec['exercise']}",
            "text": f"{rec['reason']} Nächste Woche: **{rec['recommended_weight']} kg** (aktuell {rec['current_weight']} kg).",
            "exercise": rec["exercise"],
            "current_weight": rec["current_weight"],
            "recommended_weight": rec["recommended_weight"],
        })

    # 5. STAGNATION detection - same weight on exercise for 3+ weeks
    three_weeks_ago = (now - timedelta(days=21)).isoformat()
    stagnation_sessions = await db.workout_sessions.find(
        {"user_id": user["id"], "status": "completed", "completed_at": {"$gte": three_weeks_ago}},
        {"_id": 0}
    ).to_list(50)
    if plan and len(stagnation_sessions) >= 4:
        from collections import defaultdict
        ex_weights = defaultdict(set)
        for s in stagnation_sessions:
            day = next((d for d in plan["days"] if d["day_index"] == s.get("day_index")), None)
            if not day:
                continue
            for log in s.get("logged_sets", []):
                idx = log.get("exercise_index")
                if 0 <= idx < len(day.get("exercises", [])):
                    ex_weights[day["exercises"][idx]["name"]].add(log.get("weight_kg", 0))
        for name, weights in ex_weights.items():
            # If user only used 1 weight across 3 weeks → stagnation
            if len(weights) == 1 and list(weights)[0] > 0:
                w = list(weights)[0]
                # don't double-report exercises already in exercise_recs
                if any(r["exercise"] == name for r in exercise_recs):
                    continue
                insights.append({
                    "type": "stagnation",
                    "icon": "alert",
                    "title": f"Stagnation: {name}",
                    "text": f"Du arbeitest seit 3+ Wochen mit {w} kg auf {name}. Zeit zu steigern oder Übung zu wechseln.",
                })
                break  # only show one stagnation alert

    # 6. PROTEIN intake check (this week)
    profile = user.get("profile") or {}
    goals = calculate_nutrition_goals(profile)
    target_protein = goals.get("protein_g", 0)
    if target_protein > 0:
        nutrition_pipeline = [
            {"$match": {"user_id": user["id"], "date": {"$gte": (now - timedelta(days=7)).strftime("%Y-%m-%d")}}},
            {"$group": {"_id": "$date", "protein": {"$sum": "$protein_g"}, "calories": {"$sum": "$calories"}}}
        ]
        nut_days = await db.nutrition_entries.aggregate(nutrition_pipeline).to_list(7)
        if nut_days:
            avg_protein = round(sum(d["protein"] for d in nut_days) / len(nut_days))
            avg_cal = round(sum(d["calories"] for d in nut_days) / len(nut_days))
            target_cal = goals.get("calories", 2000)
            if avg_protein < target_protein * 0.85:
                insights.append({
                    "type": "nutrition_protein",
                    "icon": "alert",
                    "title": f"Protein-Defizit: {avg_protein}g/Tag",
                    "text": f"Du erreichst diese Woche nur {avg_protein}g Protein pro Tag. Ziel sind {target_protein}g. Mehr Hähnchen, Quark, Whey.",
                })
            elif avg_protein >= target_protein:
                insights.append({
                    "type": "nutrition_protein",
                    "icon": "sparkles",
                    "title": f"Protein-Ziel erreicht: {avg_protein}g/Tag",
                    "text": f"Du hittest dein Protein-Ziel von {target_protein}g. So baust du Muskeln.",
                })
            # Calorie balance feedback
            goal_type = profile.get("goal", "")
            if goal_type == "fat_loss" and avg_cal > target_cal * 1.1:
                insights.append({
                    "type": "nutrition_cal",
                    "icon": "alert",
                    "title": f"Zu viele Kalorien: {avg_cal}/Tag",
                    "text": f"Dein Ziel ist Fettabbau, aber du isst {avg_cal} kcal/Tag (Ziel: {target_cal}). Reduziere um {avg_cal - target_cal} kcal.",
                })
            elif goal_type == "muscle_gain" and avg_cal < target_cal * 0.9:
                insights.append({
                    "type": "nutrition_cal",
                    "icon": "alert",
                    "title": f"Zu wenig Kalorien: {avg_cal}/Tag",
                    "text": f"Für Muskelaufbau brauchst du {target_cal} kcal/Tag. Du isst nur {avg_cal}. Iss {target_cal - avg_cal} kcal mehr.",
                })

    # 7. Total milestone
    if total_completed > 0 and total_completed % 10 == 0:
        insights.append({
            "type": "milestone",
            "icon": "trophy",
            "title": f"{total_completed} Workouts insgesamt",
            "text": f"Krass — du hast {total_completed} Trainings absolviert. Das ist Disziplin.",
        })

    return {
        "insights": insights,
        "stats": {
            "this_week_workouts": count,
            "last_week_workouts": len(last_week),
            "this_week_volume_kg": this_vol,
            "last_week_volume_kg": last_vol,
            "volume_change_pct": vol_change_pct,
            "current_streak": streak,
            "total_completed": total_completed,
        },
    }


# ===== Training Plans =====
@api_router.get("/plans/current")
async def get_current_plan(user: dict = Depends(get_current_user)):
    plan_id = user.get("current_plan_id")
    if not plan_id:
        return {"plan": None}
    plan = await db.training_plans.find_one({"id": plan_id}, {"_id": 0})
    return {"plan": plan}


# ===== Workout Sessions =====
@api_router.post("/sessions/start")
async def start_session(payload: dict, user: dict = Depends(get_current_user)):
    day_index = int(payload.get("day_index", 1))
    # If active session for this day exists, return it (resume)
    active = await db.workout_sessions.find_one(
        {"user_id": user["id"], "day_index": day_index, "status": "active"},
        {"_id": 0}
    )
    if active:
        return {"session": active, "resumed": True}

    plan_id = user.get("current_plan_id")
    if not plan_id:
        raise HTTPException(status_code=400, detail="Kein aktiver Plan")

    session = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "plan_id": plan_id,
        "day_index": day_index,
        "status": "active",
        "current_exercise_index": 0,
        "current_set_index": 0,
        "logged_sets": [],
        "started_at": now_iso(),
        "completed_at": None,
    }
    await db.workout_sessions.insert_one(session)
    session.pop("_id", None)
    day_index_val = session.get("day_index")
    await log_activity(user["id"], user.get("name", ""), "workout_started", {"day_index": day_index_val})
    return {"session": session, "resumed": False}

@api_router.get("/sessions/active")
async def get_active_session(user: dict = Depends(get_current_user)):
    s = await db.workout_sessions.find_one(
        {"user_id": user["id"], "status": "active"}, {"_id": 0}
    )
    return {"session": s}

@api_router.post("/sessions/log-set")
async def log_set(payload: LogSetRequest, user: dict = Depends(get_current_user)):
    session = await db.workout_sessions.find_one({"id": payload.session_id, "user_id": user["id"]}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Session nicht gefunden")
    logged = session.get("logged_sets", [])
    logged.append({
        "exercise_index": payload.exercise_index,
        "set_index": payload.set_index,
        "reps": payload.reps,
        "weight_kg": payload.weight_kg,
        "completed_at": now_iso(),
    })
    await db.workout_sessions.update_one(
        {"id": payload.session_id},
        {"$set": {
            "logged_sets": logged,
            "current_exercise_index": payload.exercise_index,
            "current_set_index": payload.set_index + 1,
        }}
    )
    return {"ok": True, "logged_count": len(logged)}

@api_router.post("/sessions/update-progress")
async def update_progress(payload: dict, user: dict = Depends(get_current_user)):
    """Save current exercise/set pointer (when user moves between exercises)."""
    sid = payload.get("session_id")
    s = await db.workout_sessions.find_one({"id": sid, "user_id": user["id"]}, {"_id": 0})
    if not s:
        raise HTTPException(status_code=404, detail="Session nicht gefunden")
    await db.workout_sessions.update_one(
        {"id": sid},
        {"$set": {
            "current_exercise_index": int(payload.get("exercise_index", 0)),
            "current_set_index": int(payload.get("set_index", 0)),
        }}
    )
    return {"ok": True}

@api_router.post("/sessions/complete")
async def complete_session(payload: dict, user: dict = Depends(get_current_user)):
    sid = payload.get("session_id")
    s = await db.workout_sessions.find_one({"id": sid, "user_id": user["id"]}, {"_id": 0})
    if not s:
        raise HTTPException(status_code=404, detail="Session nicht gefunden")
    await db.workout_sessions.update_one(
        {"id": sid},
        {"$set": {"status": "completed", "completed_at": now_iso()}}
    )
    await log_activity(user["id"], user.get("name", ""), "workout_completed", {"day_index": s.get("day_index"), "sets": len(s.get("logged_sets", []))})
    # Reload user + sessions for badge calc
    user = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    badges = user.get("badges", [])
    existing_ids = {b["id"] for b in badges}
    new_badges = []

    # 1) WORKOUT COUNT BADGES
    completed_count = await db.workout_sessions.count_documents({"user_id": user["id"], "status": "completed"})
    workout_def = [
        (1, "first_workout", "Erstes Blut", "1 Training absolviert"),
        (3, "warm_up", "Aufgewärmt", "3 Trainings absolviert"),
        (5, "five_workouts", "5er Streak", "5 Trainings absolviert"),
        (10, "ten_workouts", "Eisenwille", "10 Trainings absolviert"),
        (15, "fifteen", "Stahlhart", "15 Trainings absolviert"),
        (25, "warrior", "Krieger", "25 Trainings absolviert"),
        (40, "granite", "Granit", "40 Trainings absolviert"),
        (50, "alpha", "Alpha", "50 Trainings - Du bist Alpha"),
        (75, "titan", "Titan", "75 Trainings absolviert"),
        (100, "centurion", "Zenturio", "100 Trainings - Legende"),
        (150, "spartan", "Spartaner", "150 Trainings absolviert"),
        (200, "olympian", "Olympier", "200 Trainings absolviert"),
        (300, "demigod", "Halbgott", "300 Trainings absolviert"),
        (365, "year_warrior", "Jahres-Krieger", "365 Trainings - Ein Jahr Eisen"),
        (500, "immortal", "Unsterblich", "500 Trainings absolviert"),
        (750, "myth", "Mythos", "750 Trainings absolviert"),
        (1000, "legend", "Legende", "1000 Trainings - Gott-Tier"),
    ]
    for threshold, bid, title, desc in workout_def:
        if completed_count >= threshold and bid not in existing_ids:
            new_badges.append({"id": bid, "title": title, "description": desc, "earned_at": now_iso()})

    # 2) STREAK BADGES (consecutive days with workouts)
    streak = await calculate_streak(user["id"])
    streak_def = [
        (3, "streak_3", "3-Tage Streak", "3 Tage in Folge trainiert"),
        (7, "streak_7", "Wochen-Krieger", "7 Tage in Folge trainiert"),
        (14, "streak_14", "Zwei-Wochen Fokus", "14 Tage in Folge trainiert"),
        (30, "streak_30", "Monats-Beast", "30 Tage in Folge trainiert"),
        (60, "streak_60", "Konsistenz-King", "60 Tage in Folge trainiert"),
        (100, "streak_100", "Eiserne Disziplin", "100 Tage in Folge trainiert"),
    ]
    for threshold, bid, title, desc in streak_def:
        if streak >= threshold and bid not in existing_ids:
            new_badges.append({"id": bid, "title": title, "description": desc, "earned_at": now_iso()})

    # 3) VOLUME BADGES (total kg lifted across all sessions)
    total_volume = await calculate_total_volume(user["id"])
    volume_def = [
        (10000, "vol_10t", "10 Tonnen Club", "10.000 kg insgesamt gehoben"),
        (50000, "vol_50t", "50 Tonnen Club", "50.000 kg insgesamt gehoben"),
        (100000, "vol_100t", "100 Tonnen Club", "100.000 kg insgesamt gehoben"),
        (250000, "vol_250t", "Quarter Million", "250.000 kg insgesamt gehoben"),
        (500000, "vol_500t", "Halbe Million", "500.000 kg insgesamt gehoben"),
        (1000000, "vol_1m", "Millionär", "1.000.000 kg insgesamt gehoben"),
    ]
    for threshold, bid, title, desc in volume_def:
        if total_volume >= threshold and bid not in existing_ids:
            new_badges.append({"id": bid, "title": title, "description": desc, "earned_at": now_iso()})

    if new_badges:
        await db.users.update_one({"id": user["id"]}, {"$push": {"badges": {"$each": new_badges}}})

    return {
        "ok": True,
        "new_badges": new_badges,
        "total_completed": completed_count,
        "current_streak": streak,
        "total_volume_kg": total_volume,
    }

async def calculate_streak(user_id: str) -> int:
    """Berechnet die aktuelle Streak (konsekutive Tage mit abgeschlossenem Training)."""
    sessions = await db.workout_sessions.find(
        {"user_id": user_id, "status": "completed"}, {"_id": 0, "completed_at": 1}
    ).sort("completed_at", -1).to_list(500)
    if not sessions:
        return 0
    # Convert to date strings (YYYY-MM-DD), unique sorted desc
    dates = sorted({(s.get("completed_at") or "")[:10] for s in sessions if s.get("completed_at")}, reverse=True)
    if not dates:
        return 0
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    yesterday_str = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
    # Streak only valid if last training is today or yesterday
    if dates[0] != today_str and dates[0] != yesterday_str:
        return 0
    streak = 1
    for i in range(1, len(dates)):
        prev_date = datetime.fromisoformat(dates[i-1])
        curr_date = datetime.fromisoformat(dates[i])
        if (prev_date - curr_date).days == 1:
            streak += 1
        else:
            break
    return streak

async def calculate_total_volume(user_id: str) -> float:
    """Summiert das Gesamtvolumen (reps * weight_kg) aller abgeschlossenen Sessions."""
    pipeline = [
        {"$match": {"user_id": user_id, "status": "completed"}},
        {"$unwind": "$logged_sets"},
        {"$group": {
            "_id": None,
            "total": {"$sum": {"$multiply": ["$logged_sets.reps", "$logged_sets.weight_kg"]}}
        }}
    ]
    result = await db.workout_sessions.aggregate(pipeline).to_list(1)
    return result[0]["total"] if result else 0

@api_router.get("/sessions/history")
async def session_history(user: dict = Depends(get_current_user)):
    sessions = await db.workout_sessions.find(
        {"user_id": user["id"]}, {"_id": 0}
    ).sort("started_at", -1).to_list(50)
    return {"sessions": sessions}

@api_router.get("/sessions/stats")
async def user_stats(user: dict = Depends(get_current_user)):
    """Streak + Volume + Workout-Count für Dashboard."""
    completed_count = await db.workout_sessions.count_documents({"user_id": user["id"], "status": "completed"})
    streak = await calculate_streak(user["id"])
    total_volume = await calculate_total_volume(user["id"])
    return {
        "total_completed": completed_count,
        "current_streak": streak,
        "total_volume_kg": total_volume,
    }

@api_router.get("/sessions/suggestion/{day_index}/{exercise_index}")
async def progression_suggestion(day_index: int, exercise_index: int, user: dict = Depends(get_current_user)):
    """KI-Progressions-Empfehlung für eine Übung basierend auf bisheriger Performance."""
    plan_id = user.get("current_plan_id")
    if not plan_id:
        return {"has_history": False, "message": "Kein Plan aktiv"}
    plan = await db.training_plans.find_one({"id": plan_id}, {"_id": 0})
    if not plan:
        return {"has_history": False, "message": "Plan nicht gefunden"}

    day = next((d for d in plan["days"] if d["day_index"] == day_index), None)
    if not day or exercise_index >= len(day.get("exercises", [])):
        return {"has_history": False, "message": "Übung nicht gefunden"}

    target_ex = day["exercises"][exercise_index]
    target_reps = target_ex.get("reps", 0)
    target_weight = target_ex.get("weight_kg", 0)

    # Get last 3 completed sessions for this day
    sessions = await db.workout_sessions.find(
        {"user_id": user["id"], "day_index": day_index, "status": "completed"}, {"_id": 0}
    ).sort("completed_at", -1).to_list(3)

    if not sessions:
        return {
            "has_history": False,
            "target_weight": target_weight,
            "target_reps": target_reps,
            "suggested_weight": target_weight,
            "suggested_reps": target_reps,
            "message": "Erstes Mal - Starte mit dem Zielgewicht.",
            "delta_weight": 0,
        }

    # Collect logged sets for this exercise across sessions
    history = []
    for s in sessions:
        for log in s.get("logged_sets", []):
            if log.get("exercise_index") == exercise_index:
                history.append({
                    "reps": log.get("reps", 0),
                    "weight_kg": log.get("weight_kg", 0),
                    "completed_at": log.get("completed_at"),
                })

    if not history:
        return {
            "has_history": False,
            "target_weight": target_weight,
            "target_reps": target_reps,
            "suggested_weight": target_weight,
            "suggested_reps": target_reps,
            "message": "Noch keine Daten für diese Übung.",
            "delta_weight": 0,
        }

    # Last session performance (sets of last session only)
    last_session = sessions[0]
    last_sets = [log for log in last_session.get("logged_sets", []) if log.get("exercise_index") == exercise_index]
    if not last_sets:
        last_sets = history[:1]

    avg_reps = sum(s["reps"] for s in last_sets) / len(last_sets)
    last_weight = last_sets[-1].get("weight_kg", target_weight)

    # Progression logic
    if avg_reps >= target_reps:
        # Hit all reps -> increase weight
        increment = 2.5 if last_weight < 50 else 5.0
        suggested_weight = last_weight + increment
        suggested_reps = target_reps
        msg = f"Letztes Mal: {int(avg_reps)} Whdh @ {last_weight}kg sauber. Steigere auf {suggested_weight}kg."
        delta = increment
    elif avg_reps >= target_reps - 2:
        # Close to target -> keep weight, push reps
        suggested_weight = last_weight
        suggested_reps = target_reps
        msg = f"Letztes Mal: {int(avg_reps)} Whdh @ {last_weight}kg. Heute auf {target_reps} pushen."
        delta = 0
    else:
        # Undershoot -> reduce weight
        decrement = 2.5
        suggested_weight = max(0, last_weight - decrement)
        suggested_reps = target_reps
        msg = f"Letztes Mal: nur {int(avg_reps)} Whdh @ {last_weight}kg. Reduziere auf {suggested_weight}kg."
        delta = -decrement

    return {
        "has_history": True,
        "target_weight": target_weight,
        "target_reps": target_reps,
        "suggested_weight": suggested_weight,
        "suggested_reps": suggested_reps,
        "last_weight": last_weight,
        "last_avg_reps": round(avg_reps, 1),
        "message": msg,
        "delta_weight": delta,
    }


# ===== Stripe Payments =====
@api_router.post("/payments/checkout")
async def create_checkout(payload: CheckoutRequest, user: dict = Depends(get_current_user)):
    if payload.plan not in PLANS:
        raise HTTPException(status_code=400, detail="Ungültiger Plan")
    p = PLANS[payload.plan]
    origin = payload.origin_url.rstrip("/")
    success_url = f"{origin}/payment-return?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/premium"

    try:
        session = stripe.checkout.Session.create(
            mode="subscription",
            payment_method_types=["card"],
            customer_email=user["email"],
            line_items=[{
                "price_data": {
                    "currency": p["currency"],
                    "product_data": {"name": f"alpha-fit Premium - {p['label']}"},
                    "recurring": {"interval": p["interval"], "interval_count": p["interval_count"]},
                    "unit_amount": int(p["amount"] * 100),
                },
                "quantity": 1,
            }],
            subscription_data={"trial_period_days": TRIAL_DAYS, "metadata": {"user_id": user["id"], "plan": payload.plan}},
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={"user_id": user["id"], "plan": payload.plan},
        )
    except Exception as e:
        logger.error(f"Stripe error: {e}")
        raise HTTPException(status_code=500, detail=f"Stripe Fehler: {str(e)}")

    await db.payment_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_email": user["email"],
        "session_id": session.id,
        "plan": payload.plan,
        "amount": p["amount"],
        "currency": p["currency"],
        "status": "initiated",
        "payment_status": "pending",
        "created_at": now_iso(),
    })
    await log_activity(user["id"], user.get("name", ""), "checkout_started", {"plan": payload.plan, "amount": p["amount"]})
    return {"url": session.url, "session_id": session.id}

@api_router.get("/payments/status/{session_id}")
async def payment_status(session_id: str, user: dict = Depends(get_current_user)):
    tx = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not tx:
        raise HTTPException(status_code=404, detail="Transaktion nicht gefunden")

    try:
        session = stripe.checkout.Session.retrieve(session_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    payment_status_str = session.get("payment_status") or "unpaid"
    status_str = session.get("status") or "open"

    # idempotent update
    if tx.get("payment_status") != "paid" and (payment_status_str in ("paid", "no_payment_required") or status_str == "complete"):
        # activate premium
        plan = PLANS.get(tx["plan"])
        if plan:
            until = datetime.now(timezone.utc) + timedelta(days=TRIAL_DAYS + plan["days"])
            await db.users.update_one(
                {"id": tx["user_id"]},
                {"$set": {
                    "is_premium": True,
                    "premium_until": until.isoformat(),
                    "trial_until": (datetime.now(timezone.utc) + timedelta(days=TRIAL_DAYS)).isoformat(),
                    "stripe_customer_id": session.get("customer"),
                    "stripe_subscription_id": session.get("subscription"),
                }}
            )
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"status": status_str, "payment_status": "paid", "completed_at": now_iso()}}
        )
        await log_activity(tx["user_id"], "", "payment_succeeded", {"plan": tx["plan"], "amount": tx.get("amount")})

    return {
        "status": status_str,
        "payment_status": payment_status_str,
        "amount_total": session.get("amount_total"),
        "currency": session.get("currency"),
    }

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    sig = request.headers.get("Stripe-Signature", "")
    secret = os.environ.get("STRIPE_WEBHOOK_SECRET")
    try:
        if secret:
            event = stripe.Webhook.construct_event(body, sig, secret)
        else:
            event = json.loads(body.decode())
    except Exception as e:
        logger.error(f"Webhook parse error: {e}")
        raise HTTPException(status_code=400, detail="Invalid payload")

    etype = event.get("type") if isinstance(event, dict) else event["type"]
    data_obj = event["data"]["object"] if isinstance(event, dict) else event.data.object

    if etype == "checkout.session.completed":
        sid = data_obj.get("id")
        meta = data_obj.get("metadata") or {}
        user_id = meta.get("user_id")
        plan = meta.get("plan")
        p = PLANS.get(plan or "")
        if user_id and p:
            until = datetime.now(timezone.utc) + timedelta(days=TRIAL_DAYS + p["days"])
            await db.users.update_one(
                {"id": user_id},
                {"$set": {
                    "is_premium": True,
                    "premium_until": until.isoformat(),
                    "trial_until": (datetime.now(timezone.utc) + timedelta(days=TRIAL_DAYS)).isoformat(),
                    "stripe_customer_id": data_obj.get("customer"),
                    "stripe_subscription_id": data_obj.get("subscription"),
                }}
            )
        await db.payment_transactions.update_one(
            {"session_id": sid},
            {"$set": {"payment_status": "paid", "status": "complete", "completed_at": now_iso()}}
        )
    return {"received": True}


# ===== Admin =====
@api_router.get("/admin/stats")
async def admin_stats(admin: dict = Depends(require_admin)):
    total_users = await db.users.count_documents({})
    premium_users = await db.users.count_documents({"is_premium": True})

    # revenue
    now = datetime.now(timezone.utc)
    today_start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc).isoformat()
    month_start = datetime(now.year, now.month, 1, tzinfo=timezone.utc).isoformat()

    paid_filter = {"payment_status": "paid"}
    today_pipeline = [
        {"$match": {**paid_filter, "completed_at": {"$gte": today_start}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
    ]
    month_pipeline = [
        {"$match": {**paid_filter, "completed_at": {"$gte": month_start}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
    ]
    all_pipeline = [
        {"$match": paid_filter},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
    ]

    today_agg = await db.payment_transactions.aggregate(today_pipeline).to_list(1)
    month_agg = await db.payment_transactions.aggregate(month_pipeline).to_list(1)
    all_agg = await db.payment_transactions.aggregate(all_pipeline).to_list(1)

    # daily breakdown last 30 days
    daily_pipeline = [
        {"$match": paid_filter},
        {"$group": {
            "_id": {"$substr": ["$completed_at", 0, 10]},
            "total": {"$sum": "$amount"},
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id": -1}},
        {"$limit": 30}
    ]
    daily = await db.payment_transactions.aggregate(daily_pipeline).to_list(30)

    return {
        "total_users": total_users,
        "premium_users": premium_users,
        "online_users": await db.users.count_documents({"last_active_at": {"$gte": (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()}}),
        "revenue_today": today_agg[0]["total"] if today_agg else 0,
        "revenue_today_count": today_agg[0]["count"] if today_agg else 0,
        "revenue_month": month_agg[0]["total"] if month_agg else 0,
        "revenue_month_count": month_agg[0]["count"] if month_agg else 0,
        "revenue_total": all_agg[0]["total"] if all_agg else 0,
        "revenue_total_count": all_agg[0]["count"] if all_agg else 0,
        "daily_revenue": [{"date": d["_id"], "total": d["total"], "count": d["count"]} for d in daily],
    }

@api_router.get("/admin/members")
async def admin_members(admin: dict = Depends(require_admin)):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(500)
    # Add last_active_at to each
    out = []
    for u in users:
        pub = public_user(u)
        pub["last_active_at"] = u.get("last_active_at")
        pub["is_online"] = is_recently_active(u.get("last_active_at"))
        out.append(pub)
    return {"members": out}

@api_router.get("/admin/online")
async def admin_online(admin: dict = Depends(require_admin)):
    """Liste der User die in den letzten 5 Minuten aktiv waren."""
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
    users = await db.users.find(
        {"last_active_at": {"$gte": cutoff}},
        {"_id": 0, "password_hash": 0}
    ).sort("last_active_at", -1).to_list(200)
    return {
        "online": [
            {
                "id": u.get("id"),
                "name": u.get("name"),
                "email": u.get("email"),
                "is_premium": is_premium_active(u),
                "last_active_at": u.get("last_active_at"),
                "minutes_ago": minutes_since(u.get("last_active_at")),
            }
            for u in users
        ],
        "count": len(users),
    }

@api_router.get("/admin/activity")
async def admin_activity(admin: dict = Depends(require_admin), limit: int = 50):
    """Live-Aktivitäts-Feed - die letzten Events."""
    events = await db.activity_events.find({}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return {"events": events}


# ===== Support Tickets =====
@api_router.post("/support/ticket")
async def create_support_ticket(payload: SupportTicketRequest, user: dict = Depends(get_current_user)):
    ticket = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_name": user.get("name"),
        "user_email": user.get("email"),
        "subject": payload.subject.strip()[:200],
        "message": payload.message.strip()[:5000],
        "category": payload.category or "general",
        "status": "open",  # open | in_progress | resolved
        "admin_reply": None,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.support_tickets.insert_one(ticket)
    await log_activity(user["id"], user.get("name", ""), "support_ticket_created", {"subject": ticket["subject"], "category": ticket["category"]})
    return {"ok": True, "ticket_id": ticket["id"], "support_email": SUPPORT_EMAIL}

@api_router.get("/support/my-tickets")
async def my_tickets(user: dict = Depends(get_current_user)):
    tickets = await db.support_tickets.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"tickets": tickets, "support_email": SUPPORT_EMAIL}

@api_router.get("/support/info")
async def support_info():
    return {"support_email": SUPPORT_EMAIL}

@api_router.get("/admin/tickets")
async def admin_tickets(admin: dict = Depends(require_admin), status: Optional[str] = None):
    q = {}
    if status:
        q["status"] = status
    tickets = await db.support_tickets.find(q, {"_id": 0}).sort("created_at", -1).to_list(200)
    open_count = await db.support_tickets.count_documents({"status": "open"})
    return {"tickets": tickets, "open_count": open_count}

@api_router.post("/admin/tickets/{ticket_id}/respond")
async def admin_respond_ticket(ticket_id: str, payload: dict, admin: dict = Depends(require_admin)):
    reply = payload.get("reply", "").strip()
    new_status = payload.get("status", "resolved")
    await db.support_tickets.update_one(
        {"id": ticket_id},
        {"$set": {"admin_reply": reply, "status": new_status, "updated_at": now_iso(), "responded_by": admin.get("name")}}
    )
    return {"ok": True}

@api_router.delete("/admin/tickets/{ticket_id}")
async def admin_delete_ticket(ticket_id: str, admin: dict = Depends(require_admin)):
    await db.support_tickets.delete_one({"id": ticket_id})
    return {"ok": True}


# ===== Nutrition Tracking (AI Vision) =====
def strip_base64_prefix(b64: str) -> str:
    """Entfernt 'data:image/jpeg;base64,' Prefix falls vorhanden."""
    if "," in b64 and b64.startswith("data:"):
        return b64.split(",", 1)[1]
    return b64

@api_router.post("/nutrition/analyze")
async def analyze_food_photo(payload: NutritionAnalyzeRequest, user: dict = Depends(get_current_user)):
    """AI Vision Analyse: Foto → erkennt Lebensmittel + alle Nährstoffe."""
    image_b64 = strip_base64_prefix(payload.image_base64)

    sys = (
        "Du bist Alpha Nutrition AI - ein präziser Ernährungsexperte. "
        "Du erkennst Lebensmittel auf Fotos und schätzt akkurate Nährwerte. "
        "Antworte AUSSCHLIESSLICH mit validem JSON, keine Erklärungen."
    )

    prompt = """Analysiere das Lebensmittel auf diesem Foto präzise. Schätze die Portionsgröße in Gramm basierend auf visuellen Anhaltspunkten.

Gib AUSSCHLIESSLICH dieses JSON zurück (keine Markdown-Codeblöcke, kein Text drumherum):
{
  "food_name": "Name des Gerichts/Lebensmittels (auf Deutsch)",
  "portion_grams": 250,
  "calories": 420,
  "protein_g": 22.5,
  "carbs_g": 45.0,
  "fat_g": 15.5,
  "fiber_g": 4.2,
  "sugar_g": 6.0,
  "sodium_mg": 380,
  "confidence": 0.85,
  "components": ["Hähnchenbrust", "Reis", "Brokkoli"]
}

Wenn du das Essen nicht erkennen kannst, setze confidence auf 0.3 und gib trotzdem deine beste Schätzung. Alle Werte für die GESAMTE Portion (nicht pro 100g)."""

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"nutrition-{user['id']}-{uuid.uuid4()}",
        system_message=sys,
    ).with_model("openai", "gpt-5.5")

    try:
        img = ImageContent(image_base64=image_b64)
        resp = await chat.send_message(UserMessage(text=prompt, file_contents=[img]))
        text = resp if isinstance(resp, str) else str(resp)
    except Exception as e:
        logger.error(f"Vision LLM error: {e}")
        raise HTTPException(status_code=500, detail=f"KI-Analyse fehlgeschlagen: {str(e)}")

    data = parse_json_from_llm(text)
    if not data:
        raise HTTPException(status_code=500, detail="KI konnte das Foto nicht analysieren. Bitte erneut versuchen.")

    # Sanitize / ensure all fields
    result = {
        "food_name": str(data.get("food_name", "Unbekanntes Gericht"))[:200],
        "portion_grams": float(data.get("portion_grams", 100) or 100),
        "calories": float(data.get("calories", 0) or 0),
        "protein_g": float(data.get("protein_g", 0) or 0),
        "carbs_g": float(data.get("carbs_g", 0) or 0),
        "fat_g": float(data.get("fat_g", 0) or 0),
        "fiber_g": float(data.get("fiber_g", 0) or 0),
        "sugar_g": float(data.get("sugar_g", 0) or 0),
        "sodium_mg": float(data.get("sodium_mg", 0) or 0),
        "confidence": float(data.get("confidence", 0.5) or 0.5),
        "components": data.get("components", []) if isinstance(data.get("components"), list) else [],
    }
    return result

@api_router.post("/nutrition/log")
async def log_nutrition(payload: NutritionLogRequest, user: dict = Depends(get_current_user)):
    entry = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "food_name": payload.food_name,
        "portion_grams": payload.portion_grams,
        "calories": payload.calories,
        "protein_g": payload.protein_g,
        "carbs_g": payload.carbs_g,
        "fat_g": payload.fat_g,
        "fiber_g": payload.fiber_g,
        "sugar_g": payload.sugar_g,
        "sodium_mg": payload.sodium_mg,
        "meal_type": payload.meal_type,
        "notes": payload.notes or "",
        "logged_at": now_iso(),
        "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
    }
    await db.nutrition_entries.insert_one(entry)
    entry.pop("_id", None)
    return {"ok": True, "entry": entry}

@api_router.get("/nutrition/today")
async def nutrition_today(user: dict = Depends(get_current_user)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    entries = await db.nutrition_entries.find(
        {"user_id": user["id"], "date": today}, {"_id": 0}
    ).sort("logged_at", -1).to_list(100)

    totals = {
        "calories": sum(e.get("calories", 0) for e in entries),
        "protein_g": sum(e.get("protein_g", 0) for e in entries),
        "carbs_g": sum(e.get("carbs_g", 0) for e in entries),
        "fat_g": sum(e.get("fat_g", 0) for e in entries),
        "fiber_g": sum(e.get("fiber_g", 0) for e in entries),
        "sugar_g": sum(e.get("sugar_g", 0) for e in entries),
        "sodium_mg": sum(e.get("sodium_mg", 0) for e in entries),
    }

    # Calculate goals based on profile
    profile = user.get("profile") or {}
    goals = calculate_nutrition_goals(profile)

    return {
        "entries": entries,
        "totals": totals,
        "goals": goals,
        "date": today,
    }

@api_router.get("/nutrition/history")
async def nutrition_history(user: dict = Depends(get_current_user), days: int = 14):
    pipeline = [
        {"$match": {"user_id": user["id"]}},
        {"$group": {
            "_id": "$date",
            "calories": {"$sum": "$calories"},
            "protein_g": {"$sum": "$protein_g"},
            "carbs_g": {"$sum": "$carbs_g"},
            "fat_g": {"$sum": "$fat_g"},
        }},
        {"$sort": {"_id": -1}},
        {"$limit": days}
    ]
    daily = await db.nutrition_entries.aggregate(pipeline).to_list(days)
    return {"daily": [{"date": d["_id"], **{k: d[k] for k in ("calories","protein_g","carbs_g","fat_g")}} for d in daily]}

@api_router.delete("/nutrition/log/{entry_id}")
async def delete_nutrition_entry(entry_id: str, user: dict = Depends(get_current_user)):
    res = await db.nutrition_entries.delete_one({"id": entry_id, "user_id": user["id"]})
    return {"ok": True, "deleted": res.deleted_count}

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
def require_premium(user: dict) -> None:
    if not is_premium_active(user):
        raise HTTPException(status_code=403, detail="Premium erforderlich für AI Body Scan")

@api_router.post("/bodyscan/analyze")
async def analyze_body_scan(payload: BodyScanRequest, user: dict = Depends(get_current_user)):
    """AI Vision Body Scan: Foto -> Muskelgruppen, Symmetrie, Körperfett, Schwachstellen, Empfehlungen.
    Speichert NUR die Analyse, nicht das Foto (Datenschutz)."""
    require_premium(user)
    image_b64 = strip_base64_prefix(payload.image_base64)

    profile = user.get("profile") or {}
    goal = profile.get("goal", "general")
    weight = profile.get("weight_kg", "?")
    height = profile.get("height_cm", "?")
    gender = profile.get("gender", "?")
    age = profile.get("age", "?")

    sys = (
        "Du bist Alpha Body AI - ein Sportwissenschaftler und Physique-Coach. "
        "Du analysierst Körperfotos OBJEKTIV und SACHLICH für Trainingszwecke. "
        "Wichtig: Du gibst KEINE medizinische Diagnose, sondern eine Fitness-Einschätzung. "
        "Du bist motivierend, ehrlich und konstruktiv. "
        "Antworte AUSSCHLIESSLICH mit validem JSON, keine Erklärungen davor/danach, keine Markdown-Codeblöcke."
    )

    prompt = f"""Analysiere dieses Körperfoto für eine Fitness-Einschätzung.

Nutzerkontext:
- Geschlecht: {gender}
- Alter: {age}
- Größe: {height} cm
- Gewicht: {weight} kg
- Ziel: {goal}
- Eigene Notiz: {payload.notes or "-"}

Falls KEIN Körper auf dem Foto erkennbar ist (zu dunkel, kein Mensch, vollständig bekleidet ohne sichtbare Muskulatur), gib zurück: {{"error": "no_body_detected"}}.

Sonst gib AUSSCHLIESSLICH dieses JSON zurück:
{{
  "overall_score": 72,
  "body_fat_estimate": 16.5,
  "body_fat_range": "15-18%",
  "muscle_development": {{
    "chest": 7,
    "shoulders": 6,
    "back": 5,
    "arms": 7,
    "core": 6,
    "legs": 4,
    "glutes": 5
  }},
  "symmetry_score": 8,
  "symmetry_notes": "Leichte Asymmetrie zwischen linker und rechter Schulter, ansonsten gute Balance.",
  "strengths": ["Gute Armentwicklung", "Definierte Brust", "Schlanke Taille"],
  "weak_points": ["Beine unterentwickelt im Verhältnis zum Oberkörper", "Rückenbreite ausbaufähig"],
  "posture_notes": "Schultern leicht nach vorne gerollt - mehr Rudern und Face Pulls einbauen.",
  "recommendations": [
    "Fokus auf Beintraining: 2x pro Woche Squats & RDLs",
    "Mehr Volumen für Rücken (Klimmzüge, Rudern)",
    "Posture-Übungen: Face Pulls, Band Pull-Aparts"
  ],
  "next_focus": "Beine & Rücken priorisieren",
  "confidence": 0.75
}}

Skalen:
- overall_score: 0-100 (Gesamteindruck Physique)
- muscle_development: 1-10 pro Muskelgruppe
- symmetry_score: 1-10
- body_fat_estimate: Prozent als Zahl (z.B. 15.5)
- confidence: 0-1 wie sicher die Einschätzung ist

Sei ehrlich. Schmeichele nicht, aber demotiviere nicht. Werte sollen Trends zeigen, nicht absolute Wahrheit."""

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"bodyscan-{user['id']}-{uuid.uuid4()}",
        system_message=sys,
    ).with_model("openai", "gpt-5.5")

    try:
        img = ImageContent(image_base64=image_b64)
        resp = await chat.send_message(UserMessage(text=prompt, file_contents=[img]))
        text = resp if isinstance(resp, str) else str(resp)
    except Exception as e:
        logger.error(f"Body scan vision error: {e}")
        raise HTTPException(status_code=500, detail=f"KI-Analyse fehlgeschlagen: {str(e)}")

    data = parse_json_from_llm(text)
    if not data:
        raise HTTPException(status_code=500, detail="KI konnte die Analyse nicht generieren. Bitte erneut versuchen.")

    if data.get("error") == "no_body_detected":
        raise HTTPException(status_code=400, detail="Kein Körper auf dem Foto erkennbar. Bitte ein klares Foto in Sportkleidung hochladen.")

    def _num(v, default=0.0):
        try:
            return float(v)
        except Exception:
            return default

    def _int(v, default=0):
        try:
            return int(round(float(v)))
        except Exception:
            return default

    def _list(v):
        return [str(x)[:200] for x in v][:8] if isinstance(v, list) else []

    md = data.get("muscle_development") or {}
    if not isinstance(md, dict):
        md = {}

    muscle_groups = ["chest", "shoulders", "back", "arms", "core", "legs", "glutes"]
    muscle_dev = {g: max(1, min(10, _int(md.get(g, 5), 5))) for g in muscle_groups}

    scan_id = str(uuid.uuid4())
    record = {
        "id": scan_id,
        "user_id": user["id"],
        "overall_score": max(0, min(100, _int(data.get("overall_score", 50), 50))),
        "body_fat_estimate": round(_num(data.get("body_fat_estimate", 0)), 1),
        "body_fat_range": str(data.get("body_fat_range", ""))[:50],
        "muscle_development": muscle_dev,
        "symmetry_score": max(1, min(10, _int(data.get("symmetry_score", 5), 5))),
        "symmetry_notes": str(data.get("symmetry_notes", ""))[:500],
        "strengths": _list(data.get("strengths")),
        "weak_points": _list(data.get("weak_points")),
        "posture_notes": str(data.get("posture_notes", ""))[:500],
        "recommendations": _list(data.get("recommendations")),
        "next_focus": str(data.get("next_focus", ""))[:200],
        "confidence": round(max(0.0, min(1.0, _num(data.get("confidence", 0.5), 0.5))), 2),
        "notes": (payload.notes or "")[:500],
        "created_at": now_iso(),
        "weight_kg_at_scan": profile.get("weight_kg"),
    }

    # Vergleich zum vorherigen Scan
    prev = await db.body_scans.find_one(
        {"user_id": user["id"]}, {"_id": 0}, sort=[("created_at", -1)]
    )
    if prev:
        record["delta_vs_previous"] = {
            "overall_score": record["overall_score"] - int(prev.get("overall_score", 0) or 0),
            "body_fat_estimate": round(record["body_fat_estimate"] - float(prev.get("body_fat_estimate", 0) or 0), 1),
            "symmetry_score": record["symmetry_score"] - int(prev.get("symmetry_score", 0) or 0),
            "muscle_development": {
                g: record["muscle_development"][g] - int((prev.get("muscle_development") or {}).get(g, 0) or 0)
                for g in muscle_groups
            },
            "previous_scan_id": prev.get("id"),
            "previous_scan_date": prev.get("created_at"),
        }
    else:
        record["delta_vs_previous"] = None

    await db.body_scans.insert_one(record)
    try:
        await log_activity(user["id"], user.get("name") or "User", "body_scan", {"overall_score": record["overall_score"]})
    except Exception:
        pass

    record.pop("_id", None)
    return record

@api_router.get("/bodyscan/history")
async def bodyscan_history(user: dict = Depends(get_current_user), limit: int = 20):
    require_premium(user)
    scans = await db.body_scans.find(
        {"user_id": user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(min(max(limit, 1), 50))
    return {"scans": scans}

@api_router.get("/bodyscan/{scan_id}")
async def bodyscan_detail(scan_id: str, user: dict = Depends(get_current_user)):
    require_premium(user)
    scan = await db.body_scans.find_one({"id": scan_id, "user_id": user["id"]}, {"_id": 0})
    if not scan:
        raise HTTPException(status_code=404, detail="Scan nicht gefunden")
    return scan

@api_router.delete("/bodyscan/{scan_id}")
async def bodyscan_delete(scan_id: str, user: dict = Depends(get_current_user)):
    require_premium(user)
    res = await db.body_scans.delete_one({"id": scan_id, "user_id": user["id"]})
    return {"ok": True, "deleted": res.deleted_count}

@api_router.get("/profile/weight-trend")
async def profile_weight_trend(user: dict = Depends(get_current_user)):
    """Weight history from body scans + delta vs earliest. Free for all users."""
    profile = user.get("profile") or {}
    current = profile.get("weight_kg")
    scans = await db.body_scans.find(
        {"user_id": user["id"], "weight_kg_at_scan": {"$ne": None}},
        {"_id": 0, "weight_kg_at_scan": 1, "created_at": 1},
    ).sort("created_at", 1).to_list(50)
    points = [
        {"date": s["created_at"], "weight_kg": s["weight_kg_at_scan"]}
        for s in scans if s.get("weight_kg_at_scan")
    ]
    earliest = points[0]["weight_kg"] if points else None
    delta = None
    if current is not None and earliest is not None:
        try:
            delta = round(float(current) - float(earliest), 1)
        except Exception:
            delta = None
    return {"current_kg": current, "earliest_kg": earliest, "delta_kg": delta, "points": points}




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

@api_router.delete("/admin/members/{user_id}")
async def admin_delete_member(user_id: str, admin: dict = Depends(require_admin)):
    if user_id == admin["id"]:
        raise HTTPException(status_code=400, detail="Eigenes Konto kann nicht gelöscht werden")
    await db.users.delete_one({"id": user_id})
    await db.workout_sessions.delete_many({"user_id": user_id})
    await db.training_plans.delete_many({"user_id": user_id})
    await db.chat_messages.delete_many({"user_id": user_id})
    return {"ok": True}

@api_router.post("/admin/members/premium")
async def admin_set_premium(payload: AdminPremiumRequest, admin: dict = Depends(require_admin)):
    until = datetime.now(timezone.utc) + timedelta(days=payload.days)
    await db.users.update_one(
        {"id": payload.user_id},
        {"$set": {"is_premium": True, "premium_until": until.isoformat()}}
    )
    return {"ok": True, "premium_until": until.isoformat()}

@api_router.post("/admin/members/revoke-premium")
async def admin_revoke_premium(payload: dict, admin: dict = Depends(require_admin)):
    await db.users.update_one(
        {"id": payload.get("user_id")},
        {"$set": {"is_premium": False, "premium_until": None, "trial_until": None}}
    )
    return {"ok": True}


# ===== Root =====
@api_router.get("/")
async def root():
    return {"service": "alpha-fit", "status": "running"}


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
