"""
AlphaFit Exercise Image Generator
Uses Gemini Nano Banana (gemini-3.1-flash-image-preview) to generate
a consistent set of exercise demonstration images in the AlphaFit aesthetic.

Usage:
  python generate_exercise_images.py            # generates all exercises
  python generate_exercise_images.py --test     # generates 3 test exercises only
  python generate_exercise_images.py --only chest  # only chest exercises

Output: /app/frontend/public/exercises/{slug}.png
Manifest: /app/frontend/public/exercises/manifest.json
"""
import asyncio
import argparse
import base64
import json
import os
import sys
import time
from pathlib import Path
from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / "backend" / ".env")

OUT_DIR = ROOT / "frontend" / "public" / "exercises"
OUT_DIR.mkdir(parents=True, exist_ok=True)

API_KEY = os.getenv("EMERGENT_LLM_KEY")
if not API_KEY:
    print("ERROR: EMERGENT_LLM_KEY missing")
    sys.exit(1)

# ============ STYLE ANCHOR (Consistent across all images) ============
STYLE = (
    "Cinematic, photorealistic fitness photography. "
    "Single fit male athlete (mid-20s, athletic build, dark grey tank top or shirtless) "
    "demonstrating the exercise in a dark gym setting. "
    "Dramatic side lighting from the LEFT with electric cyan accent rim light (#00BFFF). "
    "Pitch black background with subtle volumetric haze. "
    "High contrast, sharp focus on the athlete, muscle definition visible. "
    "Square 1:1 composition, full body or upper body framing as appropriate. "
    "NO text, NO logos, NO watermarks, NO captions. Pure photograph only."
)

# ============ EXERCISE LIST ============
# (slug, german_name, scene_description, group)
EXERCISES = [
    # CHEST
    ("bench-press",          "Bankdrücken",         "lying on a flat bench, gripping a loaded barbell mid-press, arms extended upward, chest engaged", "chest"),
    ("incline-bench-press",  "Schrägbankdrücken",   "lying on an incline bench at 30 degrees, pressing a loaded barbell upward, chest and shoulders engaged", "chest"),
    ("db-bench-press",       "Kurzhantel-Bankdrücken", "lying on a flat bench, two heavy dumbbells pressed above the chest, full extension", "chest"),
    ("push-up",              "Liegestütze",          "in plank position on floor, arms extended, lowering chest toward the ground, full body straight", "chest"),
    ("cable-fly",            "Kabel Fliegende",      "standing between two cable machines, arms extended outward, bringing handles together in front of chest", "chest"),
    ("dips",                 "Dips",                 "suspended on parallel bars, body lowered with elbows bent 90 degrees, triceps and chest engaged", "chest"),
    # BACK
    ("deadlift",             "Kreuzheben",           "standing, gripping a heavy loaded barbell at hip level, neutral spine, back muscles flexed, mid-lift", "back"),
    ("barbell-row",          "Langhantelrudern",     "bent over at the hips, holding a barbell, pulling it toward the lower abs, back contracted", "back"),
    ("pull-up",              "Klimmzug",             "hanging from a pull-up bar with wide grip, chin above the bar, lat muscles flexed", "back"),
    ("lat-pulldown",         "Latzug",               "seated at a lat pulldown machine, pulling the wide bar down to upper chest, lats engaged", "back"),
    ("seated-row",           "Kabelrudern sitzend",  "seated at a cable row machine, pulling the handle toward the abdomen, back contracted", "back"),
    ("tbar-row",             "T-Bar Rudern",         "bent over a T-bar row apparatus, pulling the handle toward the lower chest", "back"),
    ("face-pull",            "Face Pulls",           "standing at a cable machine with rope attachment at face height, pulling rope toward the face, rear delts engaged", "back"),
    # SHOULDERS
    ("ohp",                  "Schulterdrücken",      "standing, pressing a loaded barbell overhead, full extension, shoulders flexed", "shoulders"),
    ("lateral-raise",        "Seitheben",            "standing, holding two dumbbells, arms raised to the sides to shoulder height, slight bend in elbows", "shoulders"),
    ("front-raise",          "Frontheben",           "standing, holding a dumbbell, arm extended straight in front to shoulder height", "shoulders"),
    ("shrug",                "Schulterheben",        "standing, holding two heavy dumbbells at the sides, shoulders elevated toward the ears, traps engaged", "shoulders"),
    ("rear-delt-fly",        "Reverse Fly",          "bent over slightly, two dumbbells raised to the sides at shoulder height, rear delts engaged", "shoulders"),
    ("arnold-press",         "Arnold Press",         "seated, rotating two dumbbells from front of body to overhead with palm rotation", "shoulders"),
    # BICEPS
    ("barbell-curl",         "Langhantelcurls",      "standing, holding a barbell, curling it up toward the chest, biceps fully contracted", "biceps"),
    ("db-curl",              "Kurzhantelcurls",      "standing, alternating dumbbell curl, one arm curling up while the other extended", "biceps"),
    ("hammer-curl",          "Hammercurls",          "standing, holding two dumbbells with neutral grip, curling them up toward the shoulders", "biceps"),
    ("preacher-curl",        "Preacher Curls",       "seated at a preacher curl bench, arms extended over the pad, curling an EZ-bar up", "biceps"),
    # TRICEPS
    ("triceps-pushdown",     "Trizepsdrücken",       "standing at a cable machine, pushing a rope or bar attachment down, elbows pinned to sides, triceps engaged", "triceps"),
    ("skullcrusher",         "Skullcrusher",         "lying on a flat bench, lowering an EZ-curl bar toward the forehead, elbows pointing up", "triceps"),
    ("triceps-extension",    "Trizeps Extension",    "standing, holding a dumbbell behind the head with both hands, extending arms overhead", "triceps"),
    ("close-grip-bench",     "Enges Bankdrücken",    "lying on a flat bench, gripping the barbell with hands close together, pressing upward, triceps engaged", "triceps"),
    # LEGS
    ("squat",                "Kniebeuge",            "standing with a loaded barbell on the upper back, descending into a deep squat, knees tracking over toes", "legs"),
    ("front-squat",          "Frontkniebeuge",       "standing with a barbell across the front shoulders in a clean grip, descending into a deep squat", "legs"),
    ("rdl",                  "Rumänisches Kreuzheben", "standing, holding a barbell, hinging at the hips with slight knee bend, bar lowered along the legs", "legs"),
    ("leg-press",            "Beinpresse",           "seated in a 45-degree leg press machine, legs pressing a loaded sled away from the body", "legs"),
    ("lunge",                "Ausfallschritte",      "in a deep lunge position, holding two dumbbells, front knee bent 90 degrees, back knee near the floor", "legs"),
    ("leg-extension",        "Beinstrecker",         "seated at a leg extension machine, legs extending out fully, quads engaged", "legs"),
    ("leg-curl",             "Beinbeuger",           "lying face down on a leg curl machine, legs curling up bringing the heels toward the glutes", "legs"),
    ("calf-raise",           "Wadenheben",           "standing on a calf raise machine or platform, heels raised high, calves fully contracted", "legs"),
    ("hip-thrust",           "Hip Thrust",           "shoulders on a bench, hips raised with a loaded barbell across the hips, glutes contracted", "legs"),
    # CORE
    ("plank",                "Plank",                "in a forearm plank position, body in a perfectly straight line from head to heels, core engaged", "core"),
    ("crunch",               "Crunch",               "lying on the back with knees bent, hands behind the head, upper body curled toward the knees", "core"),
    ("hanging-leg-raise",    "Hängendes Beinheben",  "hanging from a pull-up bar, legs raised straight to 90 degrees, abs contracted", "core"),
    ("russian-twist",        "Russian Twist",        "seated on the floor, leaning back, feet off the floor, holding a weight plate, twisting torso side to side", "core"),
    # CARDIO
    ("treadmill",            "Laufband",             "sprinting on a treadmill, arms in motion, full intensity, focused expression", "cardio"),
    ("burpee",               "Burpees",              "mid-jump in a burpee, arms overhead, full body explosion", "cardio"),
    ("jumping-jack",         "Jumping Jacks",        "mid-jumping jack, arms overhead, legs spread wide, full body extension", "cardio"),
    ("rowing-machine",       "Rudergerät",           "seated on a rowing machine, pulling the handle to the chest, legs extended, full row position", "cardio"),
    ("jump-rope",            "Seilspringen",         "mid-jump with a jump rope, both feet off the ground, rope arcing over the body", "cardio"),
    # MUSCLE GROUP FALLBACKS (used when no specific exercise matches)
    ("group-chest",          "Brusttraining",        "athlete on a flat bench mid-press, generic chest workout vibe", "chest"),
    ("group-back",           "Rückentraining",       "athlete performing a heavy row, back muscles dramatically lit", "back"),
    ("group-shoulders",      "Schultertraining",     "athlete mid overhead press, shoulders flexed under cyan rim light", "shoulders"),
    ("group-biceps",         "Bizepstraining",       "athlete performing a tight biceps curl, peak contraction", "biceps"),
    ("group-triceps",        "Trizepstraining",      "athlete performing a triceps pushdown, arm fully extended", "triceps"),
    ("group-legs",           "Beintraining",         "athlete in a deep squat with a loaded barbell, quads engaged", "legs"),
    ("group-core",           "Bauchtraining",        "athlete in a perfect plank position, core flexed", "core"),
    ("group-cardio",         "Cardio Training",      "athlete sprinting on a treadmill, sweat and intensity", "cardio"),
    ("group-full",           "Ganzkörper",           "athlete in a powerful athletic stance in a dark gym, ready to train", "full"),
]


def prompt_for(scene: str) -> str:
    return f"{STYLE} Subject: {scene}. Aesthetic anchor: AlphaFit Spartan-cyber fitness brand."


async def gen_one(slug: str, scene: str) -> bool:
    out_path = OUT_DIR / f"{slug}.png"
    if out_path.exists() and out_path.stat().st_size > 10_000:
        print(f"  SKIP (exists): {slug}")
        return True

    chat = (
        LlmChat(
            api_key=API_KEY,
            session_id=f"alphafit-gen-{slug}-{int(time.time())}",
            system_message="You are an expert fitness photo generator for the AlphaFit brand. Generate only photorealistic fitness images. Never include any text, captions, or watermarks.",
        )
        .with_model("gemini", "gemini-3.1-flash-image-preview")
        .with_params(modalities=["image", "text"])
    )

    try:
        msg = UserMessage(text=prompt_for(scene))
        text, images = await chat.send_message_multimodal_response(msg)
        if not images:
            print(f"  FAIL (no image): {slug} - text: {(text or '')[:80]}")
            return False
        img = images[0]
        data = base64.b64decode(img["data"])
        out_path.write_bytes(data)
        print(f"  OK  ({len(data)/1024:.0f} KB): {slug}")
        return True
    except Exception as e:
        print(f"  ERR: {slug} - {str(e)[:120]}")
        return False


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--test", action="store_true", help="Generate 3 test images only")
    parser.add_argument("--only", default=None, help="Only generate exercises with this group")
    parser.add_argument("--delay", type=float, default=1.5, help="Delay between calls in seconds")
    args = parser.parse_args()

    items = EXERCISES
    if args.test:
        items = [EXERCISES[0], EXERCISES[6], EXERCISES[27]]  # bench, deadlift, squat
    if args.only:
        items = [x for x in EXERCISES if x[3] == args.only]

    print(f"Generating {len(items)} images to {OUT_DIR} ...")
    started = time.time()
    success = 0
    fail = 0
    for i, (slug, name, scene, group) in enumerate(items, 1):
        print(f"[{i}/{len(items)}] {name} ({group}) -> {slug}.png")
        ok = await gen_one(slug, scene)
        if ok:
            success += 1
        else:
            fail += 1
        if i < len(items):
            await asyncio.sleep(args.delay)

    # Write manifest
    manifest = {
        "generated_at": int(time.time()),
        "items": [
            {"slug": s, "name": n, "group": g}
            for s, n, _scene, g in EXERCISES
            if (OUT_DIR / f"{s}.png").exists()
        ],
    }
    (OUT_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2))
    elapsed = time.time() - started
    print(f"\nDone in {elapsed:.1f}s: {success} OK, {fail} fail")


if __name__ == "__main__":
    asyncio.run(main())
