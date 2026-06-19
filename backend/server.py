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

# ===== Onboarding endpoint moved to routers/onboarding.py =====

# ===== Support endpoints moved to routers/support.py =====

def strip_base64_prefix(b64: str) -> str:
    """Entfernt 'data:image/jpeg;base64,' Prefix falls vorhanden."""
    if "," in b64 and b64.startswith("data:"):
        return b64.split(",", 1)[1]
    return b64

def require_premium(user: dict) -> None:
    if not is_premium_active(user):
        raise HTTPException(status_code=403, detail="Premium erforderlich für AI Body Scan")

@app.on_event("startup")
async def start_push_dispatcher():
    if VAPID_PRIVATE_KEY:
        asyncio.create_task(push_dispatcher_loop())
        logger.info("Push dispatcher started")
    else:
        logger.warning("VAPID_PRIVATE_KEY missing - push dispatcher NOT started")

@app.on_event("startup")
async def start_email_dispatcher():
    if os.environ.get("RESEND_API_KEY"):
        asyncio.create_task(email_dispatcher_loop())
        logger.info("Email dispatcher started")
    else:
        logger.warning("RESEND_API_KEY missing - email dispatcher NOT started")

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

# Phase-3 services: import + re-export their names into server's namespace
# so existing `from server import X` calls in router files continue to work.
from services.llm_coach import (  # noqa: E402,F401
    build_coach_system, call_llm, generate_ai_plan,
    parse_json_from_llm, fallback_plan,
    _perform_plan_adjust, _run_adjust_job,
    calculate_nutrition_goals,
)
from services.dispatchers import (  # noqa: E402,F401
    _send_web_push, push_dispatcher_loop,
    run_email_dispatcher_once, email_dispatcher_loop,
)

from routers import formcheck as _formcheck_router  # noqa: E402
from routers import payments as _payments_router  # noqa: E402
from routers import push as _push_router  # noqa: E402
from routers import nutrition as _nutrition_router  # noqa: E402
from routers import bodyscan as _bodyscan_router  # noqa: E402
from routers import sessions as _sessions_router  # noqa: E402
from routers import coach as _coach_router  # noqa: E402  (must load AFTER sessions; imports calculate_streak from it)
from routers import admin as _admin_router  # noqa: E402
from routers import support as _support_router  # noqa: E402
from routers import emails as _emails_router  # noqa: E402
from routers import auth as _auth_router  # noqa: E402
from routers import onboarding as _onboarding_router  # noqa: E402

api_router.include_router(_formcheck_router.router)
api_router.include_router(_payments_router.router)
api_router.include_router(_push_router.router)
api_router.include_router(_nutrition_router.router)
api_router.include_router(_bodyscan_router.router)
api_router.include_router(_sessions_router.router)
api_router.include_router(_coach_router.router)
api_router.include_router(_admin_router.router)
api_router.include_router(_support_router.router)
api_router.include_router(_emails_router.router)
api_router.include_router(_auth_router.router)
api_router.include_router(_onboarding_router.router)

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
