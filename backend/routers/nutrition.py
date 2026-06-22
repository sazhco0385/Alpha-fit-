"""Nutrition router (AI Vision food recognition + logging) - extracted from server.py."""
from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone
from pydantic import BaseModel
import uuid
import logging

from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

from server import (
    db, EMERGENT_LLM_KEY, get_current_user,
    strip_base64_prefix, parse_json_from_llm, calculate_nutrition_goals, now_iso,
    NutritionAnalyzeRequest, NutritionLogRequest,
)

logger = logging.getLogger("alphafit")
router = APIRouter()


@router.post("/nutrition/analyze")
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


class NutritionNameRequest(BaseModel):
    food_name: str
    portion_grams: float = 100.0


@router.post("/nutrition/analyze-name")
async def analyze_food_name(payload: NutritionNameRequest, user: dict = Depends(get_current_user)):
    """Schätzt Nährwerte für ein bekanntes Lebensmittel ohne Foto (Text-only GPT-5.5)."""
    name = (payload.food_name or "").strip()
    if not name or len(name) < 2:
        raise HTTPException(status_code=400, detail="Bitte einen Namen eingeben (min. 2 Zeichen).")
    try:
        portion = max(1.0, min(5000.0, float(payload.portion_grams or 100)))
    except Exception:
        portion = 100.0

    sys = (
        "Du bist Alpha Nutrition AI - ein präziser Ernährungsexperte. "
        "Du schätzt Nährwerte für eingegebene Lebensmittel nach deutschen/europäischen Nährwert-Datenbanken (BLS, USDA). "
        "Antworte AUSSCHLIESSLICH mit validem JSON, keine Erklärungen, kein Markdown."
    )

    prompt = f"""Schätze die Nährwerte für: "{name}" bei einer Portion von {portion:.0f} g.

Falls der Name eine Mahlzeit beschreibt (z.B. "Pizza Margherita", "Caesar Salad"), nutze typische Rezeptwerte für die angegebene Portion.
Falls der Name ein einzelnes Lebensmittel ist (z.B. "Banane", "Hähnchenbrust gegrillt"), skaliere die Werte exakt auf {portion:.0f} g.
Falls das Lebensmittel mit Marke genannt wird (z.B. "Snickers"), nutze die offiziellen Hersteller-Nährwerte und skaliere auf {portion:.0f} g.

Gib AUSSCHLIESSLICH dieses JSON zurück:
{{
  "food_name": "Standardisierter Name (auf Deutsch, ggf. mit Zubereitung)",
  "portion_grams": {portion:.0f},
  "calories": 0,
  "protein_g": 0.0,
  "carbs_g": 0.0,
  "fat_g": 0.0,
  "fiber_g": 0.0,
  "sugar_g": 0.0,
  "sodium_mg": 0,
  "confidence": 0.85
}}

confidence: 0.9+ = sehr sicher (gängiges Lebensmittel), 0.6-0.8 = geschätzt, <0.5 = unsicher.
Alle Werte als Zahlen, NICHT als Strings. Für die GESAMTE Portion ({portion:.0f} g), nicht pro 100g."""

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"nutrition-name-{user['id']}-{uuid.uuid4()}",
        system_message=sys,
    ).with_model("openai", "gpt-5.5")

    try:
        resp = await chat.send_message(UserMessage(text=prompt))
        text = resp if isinstance(resp, str) else str(resp)
    except Exception as e:
        logger.error(f"Nutrition-name LLM error: {e}")
        raise HTTPException(status_code=500, detail=f"KI-Schätzung fehlgeschlagen: {str(e)}")

    data = parse_json_from_llm(text)
    if not data:
        raise HTTPException(status_code=500, detail="Konnte das Lebensmittel nicht erkennen. Bitte präziser eingeben.")

    result = {
        "food_name": str(data.get("food_name") or name)[:200],
        "portion_grams": float(data.get("portion_grams", portion) or portion),
        "calories": float(data.get("calories", 0) or 0),
        "protein_g": float(data.get("protein_g", 0) or 0),
        "carbs_g": float(data.get("carbs_g", 0) or 0),
        "fat_g": float(data.get("fat_g", 0) or 0),
        "fiber_g": float(data.get("fiber_g", 0) or 0),
        "sugar_g": float(data.get("sugar_g", 0) or 0),
        "sodium_mg": float(data.get("sodium_mg", 0) or 0),
        "confidence": float(data.get("confidence", 0.7) or 0.7),
    }
    return result




@router.post("/nutrition/log")
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


@router.get("/nutrition/today")
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

    profile = user.get("profile") or {}
    goals = calculate_nutrition_goals(profile)

    return {
        "entries": entries,
        "totals": totals,
        "goals": goals,
        "date": today,
    }


@router.get("/nutrition/history")
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


@router.delete("/nutrition/log/{entry_id}")
async def delete_nutrition_entry(entry_id: str, user: dict = Depends(get_current_user)):
    res = await db.nutrition_entries.delete_one({"id": entry_id, "user_id": user["id"]})
    return {"ok": True, "deleted": res.deleted_count}
