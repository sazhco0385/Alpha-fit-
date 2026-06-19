# alpha-fit — PRD

## Original Problem Statement
Erstelle mir eine ultimative Fitness App namens alpha-fit (Logo: metallisches Chrom + elektrisch-blauer Glow Shield). Features: KI Coach der Trainingsplan erstellt & progressiv anpasst, vollständiges Onboarding, Badges mit Glow Design, Stripe Live Payments (9.99€/Monat, 19.99€/3 Monate, 69.99€/Jahr, 7 Tage gratis), Admin System mit Monats/Tages Umsatz, Mitglieder Einsicht/Löschen/Premium freischalten, Auto-Advance nach jedem Satz, Workout-Resume wenn Fenster verlassen.

## User Choices
- LLM: GPT-5.2 via Emergent Universal LLM Key
- Stripe: LIVE keys provided
- Admin: sazhco0385@gmail.com / Bellakiki1
- Auth: Standard JWT E-Mail/Passwort
- Onboarding: alle Standardfelder (goal, experience, gender, age, height, weight, days/week, equipment, injuries)

## Architecture
- Backend: FastAPI + MongoDB (motor), JWT auth, bcrypt, Stripe SDK, emergentintegrations LLM
- Frontend: React 19 + Tailwind + Shadcn + Framer Motion + Recharts + Sonner
- Design: Pure black (#000), electric cyan-blue (#00BFFF/#00E5FF) glow, Teko + Chakra Petch fonts, hex shield motif, grid background, scanlines

## Implemented (2026-02-14)
- Auth: register, login, JWT bearer, admin auto-seed on startup
- Onboarding 9-step wizard → triggers AI plan generation (GPT-5.2 with deterministic fallback)
- KI Coach: chat (gpt-5.2), plan generation, plan adjustment based on workout history
- Training plans + days/exercises with sets/reps/weight/rest
- Active Workout: full-screen, auto-advance after each set, rest timer (pause/skip), exercise stepper for reps/weight, resume from where left off via active session
- Badges: 29+ tiers (first_workout → legend, streak 3-100, volume 10t-1m), glow shield design, auto-awarded on session complete
- Progress: volume chart (14 days), session history, badges earned
- Premium paywall: 3 plans with 7-day trial, Stripe Checkout subscription mode
- Payment return polling
- Admin dashboard: total/monthly/today revenue, daily bar chart, members table, live online users heartbeat, live activity feed, support ticket replies, 403 for non-admins
- Support ticket system with email forwarding to supportalphafit@gmail.com
- AI Nutrition Tracking via GPT-5.2 Vision (photo recognition + manual logging + macros + goals)
- Alpha Coach 2.0 proactive insights (weekly volume %, stagnation alerts)
- PWA manifest + Android/iOS Add-to-Home-Screen prompt
- Legal: /impressum, /agb, /datenschutz

## Implemented (2026-06-14) - Phase 2
- **AI Body Scan** (Premium-only): POST /api/bodyscan/analyze (GPT-5.2 Vision), GET /api/bodyscan/history, GET /api/bodyscan/{id}, DELETE /api/bodyscan/{id}
  - Analysis: overall_score (0-100), body_fat_estimate %, muscle_development (7 groups 1-10), symmetry, strengths, weak_points, posture, recommendations, next_focus
  - Privacy: photo NOT stored, only analysis text
  - Compare view: select 2 scans → side-by-side + delta on every muscle group
  - delta_vs_previous auto-computed on every new scan
  - Disclaimer „Keine medizinische Diagnose, nur Fitness-Einschätzung"
  - Premium gate (is_premium_active) with upgrade CTA to /premium
  - Frontend: /bodyscan page, Dashboard CTA card, mobile responsive
  - Testing: 13/13 backend + 5/5 frontend flows pass (iteration_3.json)

## P0 Backlog (next)
- Stripe webhook secret (STRIPE_WEBHOOK_SECRET) for production-grade signature verification
- Email notifications (trial ending, payment success)
- Push notifications for workout reminders

## Implemented (2026-02-15) - Resend Email Integration
- **5 transactional email templates** (Royal-Gold branded HTML, inline CSS, table-based for email client compat):
  - `welcome` — sent on POST /api/auth/register (fire-and-forget)
  - `payment_success` — sent from payment_status + stripe webhook (idempotent via email_log)
  - `trial_ending` — daily dispatcher, ≤48h before trial_until expires
  - `streak_reminder` — daily dispatcher, last workout 3-14 days ago, max 1/14d
  - `weekly_summary` — Sundays only, ISO-week deduplicated, 3 stat cards (workouts, volume kg, streak)
- **Email dispatcher loop** runs every 6h on startup; admin can manually trigger via POST /api/admin/emails/run-dispatcher
- **`/api/emails/test`** for previewing any template; **`/api/admin/emails/log`** for delivery audit
- New collection `db.email_log` (used both for audit + idempotency)
- New router `routers/emails.py`; helper module `email_service.py` (Resend SDK wrapped in asyncio.to_thread)
- Env vars added: `RESEND_API_KEY`, `RESEND_SENDER_EMAIL` (set to `noreply@alpha-fit.fitness` — domain verified ✅), `RESEND_SENDER_NAME`
- **Smoke test ✅**: all 5 templates sent successfully to verified address (Resend IDs returned). Domain verification confirmed by sending to a non-account email (sazhco0385@gmail.com).

## Implemented (2026-02-15) - Backend Modular Refactor (Phase 2)
- Extracted 6 additional APIRouters: `nutrition`, `bodyscan`, `sessions`, `coach`, `admin`, `support`.
- `server.py` shrunk further: 2201 → **855 lines** (down 61.2% from original 2502 monolith).
- Total: **9 modular routers** in `/app/backend/routers/` (~1900 LOC), `server.py` keeps shared helpers (`build_coach_system`, `call_llm`, `generate_ai_plan`, `_perform_plan_adjust`, `_run_adjust_job`, `calculate_nutrition_goals`, `_send_web_push`, `push_dispatcher_loop`, gate helpers, log_activity, etc.).
- Router load order: `sessions` must load before `coach` because `coach.py` imports `calculate_streak` from `routers.sessions`. Documented inline.
- Regression: **75/75 tests pass** (iteration_7.json — 42 phase2 + 19 refactor + 14 v5). Zero behavior change. No duplicate route registrations. Pre-existing budget exhaustion on Vision/LLM endpoints is environmental, not code-related.

## Implemented (2026-02-15) - Backend Modular Refactor (Phase 1)
- Extracted 3 APIRouters from server.py monolith:
  - `/app/backend/routers/formcheck.py` (FormCheck Vision endpoints)
  - `/app/backend/routers/payments.py` (Stripe checkout / status / webhook)
  - `/app/backend/routers/push.py` (Web Push HTTP endpoints; shared `_send_web_push` + `push_dispatcher_loop` remain in server.py)
- Deferred-import pattern: router modules `from server import …` and are imported at the BOTTOM of server.py to avoid circular imports. Documented inline.
- server.py: 2502 → 2201 lines.
- Regression: 33/33 backend tests pass (iteration_6.json). Zero behavior change. No duplicate route registrations.

## P1 Backlog
- Body measurements tracking (weight log over time, link to body scans)
- Exercise video demos
- Custom plan editor
- Rate-limit /api/bodyscan/analyze (expensive Vision call)
- DB index on body_scans (user_id, created_at)
- Refactor server.py monolith — Phase 1 DONE (formcheck/payments/push extracted, server.py 2201 lines). Phase 2 backlog: extract /coach/*, /nutrition/*, /sessions/*, /bodyscan/*, /admin/* into routers.

## P2 Backlog
- Social: friends, challenges, leaderboards
- Apple Health / Google Fit sync
- Wearable integration
- Body scan auto-adjust training plan based on weak_points
