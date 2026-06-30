"""Apple Health integration — export.zip upload + Shortcut auto-sync via per-user API token.

Two ingest paths:
  1) POST /api/integrations/apple-health/upload  → user uploads export.zip from Health.app
     Parses BodyMass records → inserts into body_weight_logs (deduped by date+weight).
  2) POST /api/integrations/apple-health/weight  → iOS Shortcut posts current weight
     Uses per-user token (header X-AlphaFit-Token) so user doesn't need their full JWT.

Plus: GET /api/integrations/apple-health/token → generates or returns the user's sync token.
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone
import io
import secrets
import uuid
import zipfile
import logging
import xml.etree.ElementTree as ET

from server import db, get_current_user, now_iso

logger = logging.getLogger("alphafit")
router = APIRouter()


# -------- Token management --------

class TokenResponse(BaseModel):
    token: str
    created_at: str


def _gen_token() -> str:
    return "af_ah_" + secrets.token_urlsafe(28)


@router.get("/integrations/apple-health/token")
async def get_or_create_token(user: dict = Depends(get_current_user)) -> TokenResponse:
    """Returns the current Apple-Health sync token, or generates one if missing."""
    doc = await db.users.find_one({"id": user["id"]}, {"_id": 0, "apple_health_token": 1, "apple_health_token_created_at": 1})
    tok = (doc or {}).get("apple_health_token")
    created = (doc or {}).get("apple_health_token_created_at")
    if not tok:
        tok = _gen_token()
        created = now_iso()
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"apple_health_token": tok, "apple_health_token_created_at": created}},
        )
    return TokenResponse(token=tok, created_at=created)


@router.post("/integrations/apple-health/token/rotate")
async def rotate_token(user: dict = Depends(get_current_user)) -> TokenResponse:
    tok = _gen_token()
    created = now_iso()
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"apple_health_token": tok, "apple_health_token_created_at": created}},
    )
    return TokenResponse(token=tok, created_at=created)


# -------- Shortcut: live weight POST --------

class WeightPing(BaseModel):
    weight_kg: float = Field(..., gt=20, lt=400)
    logged_at: Optional[str] = None  # optional ISO timestamp from Shortcut
    note: Optional[str] = "Apple Health Auto-Sync"


async def _resolve_user_by_token(request: Request) -> dict:
    tok = request.headers.get("x-alphafit-token") or request.query_params.get("token")
    if not tok:
        raise HTTPException(status_code=401, detail="Missing X-AlphaFit-Token header.")
    u = await db.users.find_one({"apple_health_token": tok}, {"_id": 0})
    if not u:
        raise HTTPException(status_code=401, detail="Invalid token.")
    return u


@router.post("/integrations/apple-health/weight")
async def shortcut_weight(payload: WeightPing, request: Request) -> dict:
    """Auth via X-AlphaFit-Token header (NOT JWT). Used by the iOS Shortcut."""
    user = await _resolve_user_by_token(request)
    logged_at = payload.logged_at or now_iso()
    weight = round(float(payload.weight_kg), 2)

    # Dedupe: skip if SAME weight on SAME day already logged
    day_prefix = logged_at[:10]
    existing = await db.body_weight_logs.find_one({
        "user_id": user["id"],
        "logged_at": {"$gte": day_prefix, "$lt": day_prefix + "T99"},
        "weight_kg": weight,
    })
    if existing:
        return {"ok": True, "skipped": True, "reason": "duplicate"}

    entry_id = str(uuid.uuid4())
    await db.body_weight_logs.insert_one({
        "id": entry_id, "user_id": user["id"], "weight_kg": weight,
        "note": payload.note or "Apple Health Auto-Sync",
        "logged_at": logged_at, "created_at": now_iso(),
        "source": "apple_health_shortcut",
    })
    # Sync profile.weight_kg too (same logic as /body-weight/log)
    current_profile = dict(user.get("profile") or {})
    current_profile["weight_kg"] = weight
    current_profile["weight_updated_at"] = logged_at
    await db.users.update_one({"id": user["id"]}, {"$set": {"profile": current_profile}})
    return {"ok": True, "id": entry_id, "weight_kg": weight}


# -------- Bulk upload: export.zip --------

@router.post("/integrations/apple-health/upload")
async def upload_health_export(
    user: dict = Depends(get_current_user),
    file: UploadFile = File(...),
) -> dict:
    """Accepts an Apple Health export.zip (containing export.xml) and imports BodyMass records."""
    if not file.filename.lower().endswith((".zip", ".xml")):
        raise HTTPException(status_code=400, detail="Bitte die export.zip aus Apple Health hochladen (oder export.xml direkt).")
    raw = await file.read()
    if len(raw) > 200 * 1024 * 1024:  # 200 MB safety cap
        raise HTTPException(status_code=413, detail="Datei zu groß (max 200 MB).")
    try:
        if file.filename.lower().endswith(".zip"):
            with zipfile.ZipFile(io.BytesIO(raw)) as zf:
                # Find export.xml (Apple stores it in apple_health_export/export.xml)
                xml_member = next((n for n in zf.namelist() if n.lower().endswith("export.xml")), None)
                if not xml_member:
                    raise HTTPException(status_code=400, detail="export.xml nicht im ZIP gefunden.")
                with zf.open(xml_member) as fp:
                    xml_bytes = fp.read()
        else:
            xml_bytes = raw
    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="ZIP-Datei beschädigt oder ungültig.")

    # Stream-parse to avoid huge memory for big exports
    inserted = 0
    skipped = 0
    seen_keys = set()  # local dedupe within this upload
    weight_records = []
    try:
        for _, elem in ET.iterparse(io.BytesIO(xml_bytes), events=("end",)):
            if elem.tag != "Record":
                continue
            t = elem.attrib.get("type", "")
            if t == "HKQuantityTypeIdentifierBodyMass":
                unit = elem.attrib.get("unit", "kg")
                val = elem.attrib.get("value")
                start = elem.attrib.get("startDate") or elem.attrib.get("creationDate")
                if val and start:
                    try:
                        v = float(val)
                        if unit.lower() in ("lb", "lbs"):
                            v = round(v * 0.453592, 2)
                        v = round(v, 2)
                        # Normalize date: keep first 10 chars + add T-suffix
                        iso = start.replace(" ", "T").replace(" +0000", "+00:00")
                        key = (iso[:10], v)
                        if key in seen_keys:
                            elem.clear()
                            continue
                        seen_keys.add(key)
                        weight_records.append({"weight_kg": v, "logged_at": iso})
                    except Exception:
                        pass
            elem.clear()
    except ET.ParseError as e:
        raise HTTPException(status_code=400, detail=f"XML-Parser-Fehler: {e}")

    # Dedupe against existing DB entries (same day + same weight)
    if weight_records:
        existing = await db.body_weight_logs.find(
            {"user_id": user["id"]},
            {"_id": 0, "logged_at": 1, "weight_kg": 1},
        ).to_list(5000)
        existing_keys = {(r["logged_at"][:10], round(float(r["weight_kg"]), 2)) for r in existing if r.get("logged_at")}

        to_insert = []
        for rec in weight_records:
            key = (rec["logged_at"][:10], rec["weight_kg"])
            if key in existing_keys:
                skipped += 1
                continue
            to_insert.append({
                "id": str(uuid.uuid4()),
                "user_id": user["id"],
                "weight_kg": rec["weight_kg"],
                "note": "Apple Health Import",
                "logged_at": rec["logged_at"],
                "created_at": now_iso(),
                "source": "apple_health_export",
            })
            existing_keys.add(key)
        if to_insert:
            await db.body_weight_logs.insert_many(to_insert)
            inserted = len(to_insert)
            # Set profile.weight_kg to the LATEST imported value if it's newer
            latest = max(to_insert, key=lambda r: r["logged_at"])
            current_profile = dict(user.get("profile") or {})
            cur_updated = (current_profile.get("weight_updated_at") or "")
            if latest["logged_at"] > cur_updated:
                current_profile["weight_kg"] = latest["weight_kg"]
                current_profile["weight_updated_at"] = latest["logged_at"]
                await db.users.update_one({"id": user["id"]}, {"$set": {"profile": current_profile}})

    return {
        "ok": True,
        "found": len(weight_records),
        "imported": inserted,
        "skipped_duplicates": skipped,
    }
