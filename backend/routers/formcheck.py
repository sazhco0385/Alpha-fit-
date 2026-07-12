"""FormCheck router - extracted from server.py for modularity.
Imports shared state from the parent server module at import-time (after server.py
has finished loading its top-level definitions)."""
from fastapi import APIRouter, Depends, HTTPException
import uuid
import logging

from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

# Lazy re-export: imported from server at module load.
# server.py mounts this router AT THE END after defining these names.
from server import (
    db, EMERGENT_LLM_KEY, get_current_user, require_premium,
    strip_base64_prefix, parse_json_from_llm, now_iso, log_activity,
    FormCheckRequest,
)

logger = logging.getLogger("alphafit")
router = APIRouter()


@router.post("/formcheck/analyze")
async def formcheck_analyze(payload: FormCheckRequest, user: dict = Depends(get_current_user)):
    """Premium: analyze a photo of the user performing an exercise.
    Returns form score, issues, tips, safety score. Does NOT store the photo."""
    require_premium(user)
    image_b64 = strip_base64_prefix(payload.image_base64)

    sys = (
        "Du bist Alpha Form Coach - ein zertifizierter Personal Trainer und Bewegungs-Analyst. "
        "Du analysierst Übungsfotos OBJEKTIV und SACHLICH auf Ausführung & Sicherheit. "
        "Du gibst KEINE medizinische Diagnose, nur Fitness-Hinweise. "
        "Antworte AUSSCHLIESSLICH mit validem JSON, keine Markdown-Codeblöcke, keine Erklärungen."
    )

    prompt = f"""Analysiere dieses Foto. Übung: '{payload.exercise_name}' (Zielmuskel: {payload.target_muscle or "unbekannt"}).
Notiz vom User: {payload.notes or "-"}

Falls KEIN Mensch oder keine Trainings-Position erkennbar: gib {{"error": "no_pose_detected"}} zurück.

Sonst gib AUSSCHLIESSLICH dieses JSON zurück:
{{
  "exercise_recognized": "Bankdrücken",
  "form_score": 7,
  "safety_score": 8,
  "phase": "Endposition (Stange auf Brust)",
  "issues": [
    "Ellenbogen zu weit ausgestellt (~80°) — Schulterrisiko",
    "Stange landet etwas zu hoch (Schlüsselbein statt Brust)"
  ],
  "good_points": [
    "Schulterblätter sauber zusammengezogen",
    "Stabile Basis mit den Beinen"
  ],
  "tips": [
    "Ellenbogen näher zum Körper (45-60°)",
    "Stange tiefer auf die Brustmitte führen",
    "Atmen: einatmen beim Ablassen, ausatmen beim Drücken"
  ],
  "primary_correction": "Ellenbogen näher zum Körper",
  "confidence": 0.78
}}

Skalen:
- form_score: 1-10 (Technik-Sauberkeit)
- safety_score: 1-10 (Verletzungsrisiko, 10 = sicher)
- confidence: 0-1
- issues: max 3 wichtigste Fehler
- good_points: max 3 was bereits gut ist
- tips: max 4 konkrete Verbesserungen

Sei ehrlich aber konstruktiv. Wenn die Form bereits gut ist (score >= 8), feiere das auch."""

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"formcheck-{user['id']}-{uuid.uuid4()}",
        system_message=sys,
    # TODO(gpt-5.6): upgrade when Emergent playbook lists gpt-5.6 (currently 5.5 is newest)
    ).with_model("openai", "gpt-5.5")

    try:
        img = ImageContent(image_base64=image_b64)
        resp = await chat.send_message(UserMessage(text=prompt, file_contents=[img]))
        text = resp if isinstance(resp, str) else str(resp)
    except Exception as e:
        logger.error(f"Form check vision error: {e}")
        raise HTTPException(status_code=500, detail=f"KI-Analyse fehlgeschlagen: {str(e)}")

    data = parse_json_from_llm(text)
    if not data:
        raise HTTPException(status_code=500, detail="KI konnte die Analyse nicht generieren. Bitte erneut versuchen.")
    if data.get("error") == "no_pose_detected":
        raise HTTPException(status_code=400, detail="Keine Trainings-Pose erkennbar. Bitte ein klares Foto während der Übung aufnehmen.")

    def _int(v, default=0):
        try:
            return int(round(float(v)))
        except Exception:
            return default
    def _list(v, mx=4):
        return [str(x)[:200] for x in v][:mx] if isinstance(v, list) else []
    def _num(v, default=0.0):
        try:
            return float(v)
        except Exception:
            return default

    record = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "exercise_name": payload.exercise_name[:120],
        "exercise_recognized": str(data.get("exercise_recognized", payload.exercise_name))[:120],
        "form_score": max(1, min(10, _int(data.get("form_score", 5), 5))),
        "safety_score": max(1, min(10, _int(data.get("safety_score", 5), 5))),
        "phase": str(data.get("phase", ""))[:200],
        "issues": _list(data.get("issues"), 4),
        "good_points": _list(data.get("good_points"), 4),
        "tips": _list(data.get("tips"), 5),
        "primary_correction": str(data.get("primary_correction", ""))[:200],
        "confidence": round(max(0.0, min(1.0, _num(data.get("confidence", 0.5), 0.5))), 2),
        "notes": (payload.notes or "")[:300],
        "created_at": now_iso(),
    }
    await db.form_checks.insert_one(record)
    try:
        await log_activity(user["id"], user.get("name") or "User", "form_check",
                           {"exercise": record["exercise_name"], "score": record["form_score"]})
    except Exception:
        pass
    record.pop("_id", None)
    return record


@router.get("/formcheck/history")
async def formcheck_history(user: dict = Depends(get_current_user), limit: int = 20):
    require_premium(user)
    checks = await db.form_checks.find(
        {"user_id": user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(min(max(limit, 1), 50))
    return {"checks": checks}


@router.delete("/formcheck/{check_id}")
async def formcheck_delete(check_id: str, user: dict = Depends(get_current_user)):
    require_premium(user)
    res = await db.form_checks.delete_one({"id": check_id, "user_id": user["id"]})
    return {"ok": True, "deleted": res.deleted_count}

