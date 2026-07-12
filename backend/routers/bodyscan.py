"""BodyScan router (AI Vision body analysis + plan adjustment) - extracted from server.py."""
from fastapi import APIRouter, Depends, HTTPException
import asyncio
import json
import uuid
import logging

from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

from server import (
    db, EMERGENT_LLM_KEY, get_current_user, require_premium,
    strip_base64_prefix, parse_json_from_llm, now_iso, log_activity,
    build_coach_system, call_llm,
    BodyScanRequest,
)

logger = logging.getLogger("alphafit")
router = APIRouter()


@router.post("/bodyscan/analyze")
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
    # TODO(gpt-5.6): upgrade when Emergent playbook lists gpt-5.6 (currently 5.5 is newest)
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


@router.get("/bodyscan/history")
async def bodyscan_history(user: dict = Depends(get_current_user), limit: int = 20):
    require_premium(user)
    scans = await db.body_scans.find(
        {"user_id": user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(min(max(limit, 1), 50))
    return {"scans": scans}


@router.get("/bodyscan/{scan_id}")
async def bodyscan_detail(scan_id: str, user: dict = Depends(get_current_user)):
    require_premium(user)
    scan = await db.body_scans.find_one({"id": scan_id, "user_id": user["id"]}, {"_id": 0})
    if not scan:
        raise HTTPException(status_code=404, detail="Scan nicht gefunden")
    return scan


@router.delete("/bodyscan/{scan_id}")
async def bodyscan_delete(scan_id: str, user: dict = Depends(get_current_user)):
    require_premium(user)
    res = await db.body_scans.delete_one({"id": scan_id, "user_id": user["id"]})
    return {"ok": True, "deleted": res.deleted_count}


@router.get("/profile/weight-trend")
async def profile_weight_trend(user: dict = Depends(get_current_user)):
    """Weight history merging body_weight_logs + body_scans, sorted ascending.
    current_kg = latest from EITHER source (whichever is newest). Free for all users."""
    # 1) Manual body-weight logs (primary source)
    logs = await db.body_weight_logs.find(
        {"user_id": user["id"]},
        {"_id": 0, "weight_kg": 1, "logged_at": 1},
    ).sort("logged_at", 1).to_list(500)
    # 2) Weight captured during body scans (secondary)
    scans = await db.body_scans.find(
        {"user_id": user["id"], "weight_kg_at_scan": {"$ne": None}},
        {"_id": 0, "weight_kg_at_scan": 1, "created_at": 1},
    ).sort("created_at", 1).to_list(500)
    merged = []
    for l in logs:
        if l.get("weight_kg") is not None and l.get("logged_at"):
            merged.append({"date": l["logged_at"], "weight_kg": float(l["weight_kg"])})
    for s in scans:
        if s.get("weight_kg_at_scan") is not None and s.get("created_at"):
            merged.append({"date": s["created_at"], "weight_kg": float(s["weight_kg_at_scan"])})
    merged.sort(key=lambda p: p["date"])
    # Fallback to profile.weight_kg as a synthetic starting point if NO data at all
    profile = user.get("profile") or {}
    profile_weight = profile.get("weight_kg")
    if not merged and profile_weight is not None:
        merged.append({"date": profile.get("weight_updated_at") or now_iso(), "weight_kg": float(profile_weight)})
    earliest = merged[0]["weight_kg"] if merged else None
    current = merged[-1]["weight_kg"] if merged else (float(profile_weight) if profile_weight is not None else None)
    delta = None
    if current is not None and earliest is not None:
        try:
            delta = round(float(current) - float(earliest), 1)
        except Exception:
            delta = None
    return {"current_kg": current, "earliest_kg": earliest, "delta_kg": delta, "points": merged}


@router.post("/bodyscan/{scan_id}/suggest-plan-adjustment")
async def bodyscan_suggest_plan_adjustment(scan_id: str, user: dict = Depends(get_current_user)):
    """Async job: AI suggests plan adjustments based on the scan's weak_points.
    Returns immediately with a job_id, frontend polls /coach/adjust-plan/status/{job_id}."""
    require_premium(user)
    scan = await db.body_scans.find_one({"id": scan_id, "user_id": user["id"]}, {"_id": 0})
    if not scan:
        raise HTTPException(status_code=404, detail="Scan nicht gefunden")

    plan_id = user.get("current_plan_id")
    if not plan_id:
        raise HTTPException(status_code=400, detail="Kein aktiver Plan")
    plan = await db.training_plans.find_one({"id": plan_id}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan nicht gefunden")

    existing = await db.plan_adjust_jobs.find_one({"user_id": user["id"], "status": "pending"}, {"_id": 0})
    if existing:
        return {"job_id": existing["id"], "status": "pending"}

    job_id = str(uuid.uuid4())
    await db.plan_adjust_jobs.insert_one({
        "id": job_id,
        "user_id": user["id"],
        "status": "pending",
        "created_at": now_iso(),
        "plan_id": plan_id,
        "source": "body_scan",
        "scan_id": scan_id,
    })
    asyncio.create_task(_run_bodyscan_plan_adjust(job_id, user, plan, scan))
    return {"job_id": job_id, "status": "pending"}


async def _run_bodyscan_plan_adjust(job_id: str, user: dict, plan: dict, scan: dict) -> None:
    """Background: takes a body scan + current plan, asks LLM to produce a refined plan focused on weak_points."""
    try:
        new_plan = await asyncio.wait_for(_perform_bodyscan_plan_adjust(user, plan, scan), timeout=180)
        await db.plan_adjust_jobs.update_one(
            {"id": job_id},
            {"$set": {"status": "done", "plan": new_plan, "finished_at": now_iso()}},
        )
    except asyncio.TimeoutError:
        await db.plan_adjust_jobs.update_one(
            {"id": job_id},
            {"$set": {"status": "error", "error": "KI hat zu lange gebraucht.", "finished_at": now_iso()}},
        )
    except HTTPException as he:
        await db.plan_adjust_jobs.update_one(
            {"id": job_id},
            {"$set": {"status": "error", "error": he.detail, "finished_at": now_iso()}},
        )
    except Exception as e:
        logger.error(f"bodyscan-plan-adjust job {job_id} failed: {e}")
        await db.plan_adjust_jobs.update_one(
            {"id": job_id},
            {"$set": {"status": "error", "error": "Plan-Anpassung fehlgeschlagen", "finished_at": now_iso()}},
        )


async def _perform_bodyscan_plan_adjust(user: dict, plan: dict, scan: dict) -> dict:
    slim_days = [{
        "day_index": d.get("day_index"),
        "name": d.get("name"),
        "exercises": [
            {"name": ex.get("name"), "target_muscle": ex.get("target_muscle"),
             "sets": ex.get("sets"), "reps": ex.get("reps"),
             "weight_kg": ex.get("weight_kg"), "rest_sec": ex.get("rest_sec", 90)}
            for ex in (d.get("exercises") or [])
        ],
    } for d in plan.get("days", [])]

    weak = scan.get("weak_points") or []
    muscle_dev = scan.get("muscle_development") or {}
    posture = scan.get("posture_notes") or ""
    next_focus = scan.get("next_focus") or ""

    prompt = f"""Aktueller Trainingsplan (JSON): {json.dumps(slim_days)}

Body-Scan Analyse:
- Schwachstellen: {json.dumps(weak, ensure_ascii=False)}
- Muskelentwicklung (1-10): {json.dumps(muscle_dev)}
- Haltung: {posture}
- Empfohlener Fokus: {next_focus}

User-Profil: {json.dumps(user.get('profile'))}

Passe den Plan an die Schwachstellen aus dem Body-Scan an. Erhöhe Volumen / füge gezielte Übungen hinzu für die schwachen Muskelgruppen. Reduziere ggf. Volumen bei sehr gut entwickelten Bereichen. Anzahl Tage und grobe Struktur beibehalten.

Gib AUSSCHLIESSLICH dieses JSON zurück:
{{
  "name": "Plan v3 - Schwachstellen-Fokus",
  "weeks": 4,
  "progression_notes": "Was wurde basierend auf dem Body-Scan angepasst (max 3 Sätze, konkret).",
  "days": [...]
}}
"""
    text = await call_llm(build_coach_system(), prompt, f"bodyscan-adjust-{user['id']}-{uuid.uuid4()}")
    plan_data = parse_json_from_llm(text)
    if not plan_data:
        raise HTTPException(status_code=500, detail="KI konnte Plan nicht generieren.")

    new_plan = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "name": plan_data.get("name", "Alpha Plan v3 - Body-Scan Anpassung"),
        "weeks": plan_data.get("weeks", 4),
        "progression_notes": plan_data.get("progression_notes", ""),
        "days": plan_data.get("days", []),
        "created_at": now_iso(),
        "version": plan.get("version", 1) + 1,
        "previous_plan_id": plan["id"],
        "source": "body_scan",
        "scan_id": scan.get("id"),
    }
    await db.training_plans.insert_one(new_plan)
    new_plan.pop("_id", None)
    await db.users.update_one({"id": user["id"]}, {"$set": {"current_plan_id": new_plan["id"]}})
    return new_plan
