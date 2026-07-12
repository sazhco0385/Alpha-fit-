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

## Implemented (2026-02-15) - Streak-Freeze (Premium Retention Lever)
- **New router** `routers/streak.py`: `GET /api/streak/status` returns `{is_premium, freezes_available, used_this_month, next_refresh_at, monthly_allowance}`. Lazy monthly grant on read (1 freeze per calendar month for Premium users only).
- **`consume_freeze_if_available(user_id, bridge_key)`**: atomic `$inc` + push to `streak_freezes_used_at` + `streak_freeze_bridges` log.
- **Streak calculation** in `routers/sessions.py` patched: when a 2-day gap is detected (today → workout was 2 days ago, or any 2-day intra-streak gap), check existing `streak_freeze_bridges` log first; if not bridged yet AND a freeze is available, consume + record bridge. Subsequent reads are idempotent (no double-consume).
- **Payment activation** (`payments.py` + `admin.py`): grants 1 freeze immediately on premium activation (both `/payments/status/{session_id}` and `/admin/members/premium` + webhook). User doesn't have to wait for next month.
- **Frontend widget** `StreakFreezeWidget.jsx`: Premium → cyan shield + "X verfügbar / Schützt deine Streak bei 1 Tag Pause" or "Verbraucht / Neuer Freeze am DD MMM"; Free → gold lock + "Verpass 1 Tag — Streak bleibt. Premium-Feature." linking to `/premium`.
- **Integration**: Widget placed in Dashboard between Coach-Insights and Daily-Summary.
- **Testing**: 2/2 pytest tests pass (`test_streak_freeze.py`) covering full flow (free=0 streak, premium auto-bridge, idempotent re-read) + 37/37 regression on iter9.

## Implemented (2026-02-15) - Trial-Reminder-Email-System (Conversion Lever)
- **New template** `render_trial_usage_reminder(name, hours_left, stats, unsub_token)` in `email_service.py`: royal-gold layout with 3 dynamic stat cards (auto-picks the top 3 non-zero stats from workouts/volume/coach_msgs/body_scans/PRs/badges), urgency pill (Trial endet bald | Letzter Tag), CTA → `/premium?from=trial_reminder`.
- **Dispatcher block** in `services/dispatchers.py` `run_email_dispatcher_once`: two milestones with idempotent send-once-per-milestone via `email_log` `{template:"trial_usage_reminder", milestone:"48h"|"24h"}`.
  - 48h window: `24h < trial_until - now ≤ 48h`
  - 24h window: `0 < trial_until - now ≤ 24h`
- **Stats computed** from trial-period only (trial_until − 7d as lower bound): workouts, volume_kg, coach_msgs (chat_messages assistant role), body_scans, PRs, badges.
- **Respects** `notification_prefs.email.trial_ending` toggle (reuses existing pref).
- **Stats persisted** in `email_log.stats` for admin audit + future winback personalization.
- **New return keys** in dispatcher result: `trial_usage_48h`, `trial_usage_24h`.
- **Preview endpoint** `/api/emails/test` accepts `trial_usage_reminder`, `trial_usage_48h`, `trial_usage_24h` templates.
- **Testing**: 4/4 pytest tests pass (`test_trial_usage_reminder.py`): template rendering with empty + full stats, dispatcher idempotent 48h→24h flow, pref opt-out suppression. 41/41 combined with streak + iter9 regression.

## Implemented (2026-02-15) - Trial-Reminder Conversion Funnel (Admin Analytics)
- **New router** `routers/funnel.py`: `POST /api/track/funnel` records click events to `db.funnel_events` and sets `user.last_funnel_source` for attribution. Auto-derives source from event name if not explicitly passed.
- **Checkout attribution**: `payments.py` `/payments/checkout` reads `user.last_funnel_source` and persists it as `attribution` on `payment_transactions`. Carries through to payment success → links email → click → checkout → purchase.
- **New admin endpoint** `GET /api/admin/funnel/trial-reminder`: aggregates 4-stage funnel (Emails → Clicks → Checkouts → Purchases) with conversion rates per stage and overall E2E rate. Returns revenue from paid attributed transactions.
- **Frontend hook** in `Premium.jsx`: useEffect on mount reads `?from=<source>` URL param and POSTs to `/track/funnel` (fire-and-forget). Used by `trial_usage_reminder` email CTAs (`?from=trial_reminder`) and easily extensible to winback / weekly_summary / ads.
- **Admin UI** `TrialReminderFunnel` card in `Admin.jsx`: 4 stage tiles (E-Mails / Klicks / Checkouts / Käufe) with per-stage conversion-rate badges, color-coded per stage, footer with full breakdown + revenue.
- **Testing**: 4/4 funnel tests pass (track click sets source, checkout inherits attribution, admin aggregation returns all metric keys, non-admin blocked). 45/45 combined regression.

## Implemented (2026-02-15) - Exercise Video Demos (YouTube Curated)
- **New library** `frontend/src/lib/exerciseVideos.js`: 60+ exercise → YouTube ID mappings (Jeff Nippard, Athlean-X, RP Strength). Substring-Matching für Variationen.
- **Helper functions**: `getExerciseVideoId(name)`, `getExerciseVideoUrl(name)` (embed URL), `getExerciseSearchUrl(name)` (fallback YouTube search)
- **New component** `ExerciseVideoModal.jsx`: Mobile-first modal mit YouTube iframe (16:9 responsive), close-on-Esc, body-scroll-lock, "In YouTube öffnen" Link, Fallback-UI für nicht-gemappte Übungen mit „Auf YouTube suchen" CTA
- **PlanView**: Übungs-Zeilen sind jetzt klickbar → Modal öffnet. Hover zeigt PlayCircle-Icon auf dem Übungs-Bild.
- **ActiveWorkout**: Neuer „VIDEO" Button rechts oben (über Form-Check) → öffnet Modal mit aktueller Übung
- Smoke test ✅: Bankdrücken-Klick lädt Jeff Nippard Tutorial sauber, X + Esc + Backdrop-Click schließen, Fallback funktioniert für unbekannte Übungen.

## Implemented (2026-02-15) - Friends Phase A (Social Foundation)
  - `GET /api/friends/search?q=...` (case-insensitive, min 2 chars, max 20 results, annotated with `is_friend`/`request_status`)
  - `POST /api/friends/request` (404 if user not found, 400 if duplicate or already friends)
  - `POST /api/friends/accept` (only by recipient)
  - `POST /api/friends/decline`, `POST /api/friends/cancel`, `DELETE /api/friends/{id}`
  - `GET /api/friends/profile/{user_id}` (gated: only friends or self; returns workouts_total, workouts_30d, streak, badges)
- **New collection**: `db.friendships` with `{id, from_user_id, to_user_id, status: pending|accepted, created_at, accepted_at}`
- **New page**: `/friends` (`pages/Friends.jsx`) — search bar with 300ms debounce + 4 tabs (Freunde/Anfragen/Gesendet/Suche), inline accept/decline/cancel/unfriend buttons, friend-row shows 30d workouts as mini-leaderboard preview
- **Bottom-Nav** now has 7 entries (+ Admin = 8): Start, Plan, Food, Coach, **Crew** (NEW), Stats, Pro, Admin
- E2E backend flow verified ✅: search → request → accept → unfriend → re-search (all 9 steps return correct state)

## Implemented (2026-02-15) - Friends Phase B (Challenges)
- **New router** `routers/challenges.py` (~330 lines): 7 endpoints
  - `POST /api/challenges` — creator auto-joins, invites must be existing friends, validates title≥2 / target>0 / days 1-60
  - `GET /api/challenges` — returns `{active, invited, completed, counts}` with live standings hydrated; lazy-resolves expired actives on each call
  - `GET /api/challenges/{id}` — full detail (403 for outsiders), participant or invitee only
  - `POST /api/challenges/accept` / `/decline` — invitee actions
  - `POST /api/challenges/leave` — participant (non-creator) only
  - `DELETE /api/challenges/{id}` — creator only, status→cancelled
- **Metric types**: `workouts` (count), `volume_kg` (sum reps×weight from logged_sets), `active_days` (distinct days)
- **Lazy-resolve pattern** `_resolve_if_ended()` — no background job needed; when `now > end_at` next list/detail GET auto-completes, computes winner from highest value, sets `target_reached`, sends push to all participants
- **Push notifications** (fire-and-forget): challenge_invite, challenge_accepted, challenge_ended, challenge_cancelled — all routed to /challenges deep-link
- **New collection** `db.challenges` with `{id, created_by, title, metric, target, start_at, end_at, status, participants[], invites[], winner_user_id, final_standings, target_reached, resolved_at}`
- **New page** `/challenges` (`pages/Challenges.jsx`): 3 tabs (Aktiv / Einladungen / Beendet), 2-step create modal (metric chips + target/days → friend toggles), detail modal with live ranked standings (gold/silver/bronze badges) + progress bars + creator-cancel / participant-leave / invitee-accept-decline actions
- **CTA card** on `/friends` page links to `/challenges`
- **Testing**: 18/18 backend pytest tests pass (iter 10), incl. friend-only invite guard, accept→standings update, lazy-resolve with poked end_at, 403-for-outsider; frontend Playwright E2E for create/tabs/detail/cancel all green
- **UX tweak**: `GET /challenges` "completed" tab now includes `cancelled` status too (last 14d) so users keep context after a creator cancels

## Implemented (2026-02-15) - Friends Phase C (Leaderboards)
- **New router** `routers/leaderboard.py` (~180 lines): single flexible endpoint `GET /api/leaderboard`
  - Query params: `metric` (workouts|volume|streak), `period` (7d|30d|all, ignored for streak), `scope` (friends|global), `limit` (1-100, default 50)
  - Returns `{metric, metric_label, period, scope, rows:[{rank,user_id,name,is_premium,value,is_self}], you:{rank,value,...}, generated_at}`
  - `you` field **always** populated even when user not in top-N (rank=null in that case)
- **Mongo aggregations** for performance: `$match → $group ($sum 1)` for workouts, `$unwind logged_sets → $group ($multiply reps weight)` for volume
- **Streak global** pre-filters candidates to users with workout in last 7d (bounds to 200), then calls `calculate_streak` per candidate
- **New page** `/leaderboard` (`pages/Leaderboard.jsx`): scope toggle (Freunde/Global), 3 metric pills (Workouts/Volumen/Streak), 3 period chips (7T/30T/All - hidden for Streak), ranked list with Gold/Silver/Bronze medals for top-3, plain rank for 4+, current user row with cyan border + 'DU' badge, value progress-bar overlay, sticky 'Dein Rang' pill when not in top-N
- **Friends page** now shows TWO CTAs side-by-side: CHALLENGES (Swords, cyan) + RANGLISTE (Trophy, gold)
- **Testing**: 17/18 pytest passing (1 skipped due to unrelated helper endpoint absence), all frontend Playwright E2E green (iter 11)





## Implemented (2026-06-20) - Marketing / SEO Foundation
- **3 public Feature-Landing-Pages** für Google Ads Sitelinks (kein Auth-Wall, gecrawlt):
  - `/features/ki-coach` — AI Coach hero + Beispiel-Chat
  - `/features/body-scan` — Vision-AI hero + Beispiel-Analyse
  - `/features/ernaehrung` — Foto-Tracker hero + Step-by-Step
- Shared `<FeatureLanding>` Component mit:
  - SEO Meta-Tags pro Seite (title, description, OG-tags, canonical, twitter:card) via useEffect-injection (no react-helmet dep)
  - Sticky Header mit Logo + CTA
  - Hero-Section pro Page
  - Benefit-Cards Grid
  - Trust-Strip (SSL, 7T gratis, jederzeit kündbar)
  - Bottom-CTA + Legal-Footer
  - Mobile-optimiert (responsive Hero text, gratis-Start Button auf Mobile statt Login)
- `/sitemap.xml` mit allen public Routes + Prioritäten
- `/robots.txt` mit Allow für public, Disallow für /admin /dashboard /workout
- Conversion-Tracking: jeder CTA-Button linkt zu `/auth?mode=register` (Signup-Conversion feuert dort via `trackConversion("signup")`)

## Implemented (2026-06-20) - PR Cards (Personal Records)
- Backend: `/api/personal-records` (list) + `/api/personal-records/{id}` (detail) + `detect_prs_for_session()` Hook in /sessions/complete
- Epley e1RM Formel für faire PR-Vergleiche (weight*(1+reps/30))
- Rarity-Tiers: Bronze (≤5%) / Silber (5-12%) / Gold (12-25% oder ≥100kg) / Mythic (25%+ oder ≥200kg oder Triple-PR-Session)
- Frontend: `<PRCard>` Component mit Rarity-spezifischen Farben/Borders/Glows, animierten Sparkles, Chrome-Gradient auf Gewicht
- `html-to-image` PNG-Export + Web Share API für native iOS/Android Share-Sheet
- `/personal-records` Page (Trophy Room) mit Tabs "Beste pro Übung" und "Verlauf" + Rarity-Counts
- Auto-Showcase auf Workout-Complete-Screen wenn PRs erzielt



## Implemented (2026-02-15) - Email Unsubscribe Landing
- **Signed JWT unsubscribe tokens** (1-year expiry, scope=`unsub`) via `create_unsub_token()` / `decode_unsub_token()` in server.py
- **3 public endpoints** (no auth) in `routers/unsubscribe.py`: GET /api/unsubscribe/verify, POST /update, POST /all
- **Unsub link in every email footer** — all 6 templates updated; auth/payments/dispatcher callers pass `create_unsub_token(user_id)`
- **Public `/unsubscribe` page** in React (`pages/Unsubscribe.jsx`): 4 trigger toggles auto-save + „ALLE MARKETING-EMAILS ABBESTELLEN" button. Welcome/Payment-Success bleiben immer aktiv (DSGVO).
- Smoke tests ✅: verify/update/all alle korrekt, bad token → 400, JWT roundtrip funktioniert.

## Implemented (2026-02-15) - Backend Modular Refactor (Phase 3 Final)
- Extracted last 2 routers: `routers/auth.py` (register/login/me/heartbeat) + `routers/onboarding.py`
- Extracted shared services into a new `services/` package:
  - `services/llm_coach.py`: build_coach_system, call_llm, generate_ai_plan, parse_json_from_llm, fallback_plan, _perform_plan_adjust, _run_adjust_job, calculate_nutrition_goals
  - `services/dispatchers.py`: _send_web_push, push_dispatcher_loop, run_email_dispatcher_once, email_dispatcher_loop
- **server.py: 1021 → 361 lines** (down 85.6% from original 2502 monolith). Now contains only: config, models, security helpers, seed_admin, startup events, root endpoint, router/service wiring, CORS, shutdown.
- Re-export pattern preserved (`from services.X import * as part of server's namespace`) so existing `from server import …` in router files keeps working — zero router-side changes.
- 11 modular routers + 2 services + 1 server.py = **clean production layout**.
- Regression: **163 backend tests pass, 1 skipped** (full pytest run). Zero behavior change.

## Implemented (2026-02-15) - Custom Plan Editor + Notification Settings + Win-Back Email
- **Custom Plan Editor**: `PUT /api/plans/current` with full validation (≤7 days, 1-15 exercises each, value clamps for sets/reps/weight/rest). Creates new plan version with `source='user_edited'`. `GET /api/plans/exercise-suggestions` returns 8 muscle groups. Frontend `/plan` page has BEARBEITEN mode with editable name/notes/day-names + expandable exercise rows + delete + add-from-picker + custom-exercise prompt.
- **Notification Preferences**: `GET/PUT /api/notifications/preferences` returns/updates unified `{email: {trial_ending, streak_reminder, weekly_summary, winback}, push: {workout_reminder, streak_protect, weekly_review}}`. Email dispatcher checks pref before sending each trigger. Frontend `/settings` adds EMAIL-BENACHRICHTIGUNGEN card with 4 toggles + auto-save. TriggerToggle uses `role=switch` + `aria-checked` for a11y.
- **Win-Back Email**: New `render_winback` template (royal-gold, 30% discount CTA, total workouts + volume kg stats). Dispatcher block finds users with `premium_until` expired 7-14 days ago + `is_premium=false` + ≥1 completed workout. Idempotent via `email_log` (1× per user lifetime). Skip if `email.winback=false`.
- **Regression: 26/26 tests pass** (iteration_8.json) + 75 prior tests still green = **101 total backend tests**.

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
- Social: friends, challenges, leaderboards ✅ DONE
- Apple Health Import + iOS Shortcut Auto-Sync ✅ DONE (Feb 2026)
- **Health Connect (Android) Export-Upload** — WAITING auf Google ZIP-Export-Feature (Android 15+). Generischer Token-Endpoint `/integrations/apple-health/weight` ist ready und funktioniert via Tasker/MacroDroid für Power-User.
- Apple-Workouts importieren (Phase 2 nach BodyMass)
- Wearable integration (Apple Watch / Wear OS)
- Body scan auto-adjust training plan based on weak_points


## Play Store Pre-Release Regression (2026-02-16) ✅
- **Full pytest suite executed against live preview backend**: 278 passed, 1 skipped, 0 failed
- Fixed `test_bodyscan.py::test_image_not_persisted_in_db`: replaced deprecated `asyncio.get_event_loop().run_until_complete()` with `asyncio.run()` (Python 3.10+ compatibility)
- The previously reported `test_challenges.py` failures (`test_lazy_resolve_when_end_at_past`, `test_progress_workouts_metric_counts_completed_sessions`) were **collection-time failures due to missing REACT_APP_BACKEND_URL env** in the pytest shell — with env correctly set, all 18 challenge tests pass.
- **App status**: green for Google Play Store testing. Backend routers + all critical flows verified.


## Bug Fix (2026-02-16) — "KI anpassen" Button + Orphaned Adjust Jobs ✅
- **User Report**: Button zeigt Fehler, Plan wurde 2 Wochen nicht auto-angepasst (stuck auf v2).
- **Root Cause**: Ein "pending" plan-adjust job vom 2026-06-19 war orphan geworden (`asyncio.create_task` starb beim Backend-Restart). Der `/coach/adjust-plan/start` Dedup-Guard hat den toten job_id zurückgegeben → Frontend polled bis Timeout → 'Fehler'.
- **Fixes**:
  1. `/coach/adjust-plan/start` (`routers/coach.py`): Pending-Jobs > 5 Min → auf 'error' sweepen, dann frischen Job starten.
  2. Neuer Startup-Hook `sweep_orphaned_adjust_jobs` (`server.py`): Beim Backend-Boot alle pending > 10 Min auf 'error' setzen (defense-in-depth).
  3. Manual `/start` schreibt jetzt auch `users.last_auto_adjust_at` → Auto-Trigger respektiert manuellen Cooldown.
  4. Test-Cleanup: 11 TEST_ prefix workout_sessions aus Admin-DB entfernt (Regression-Test-Leakage).
  5. `test_challenges.py` DB_NAME-Default `test_database` → `alphafit_db` (verhinderte spurious Test-Fails).
- **Verified**: 68/68 Tests grün (6 neue + 62 regression). E2E manueller Adjust läuft in ~20s durch, Plan von v2 → v4 hochgezogen.


## Bug Fix (2026-02-16, Iter 13) — Plan-Name "v2 for ever" + Opaque LLM Errors ✅
- **User Report**: "Immer noch V2 und wie du siehst fehlgeschlagen das darf absolut nicht sein" — Plan-Name zeigte immer "v2", Adjust-Button warf leere "KI-Anpassung fehlgeschlagen".
- **Root Causes**:
  1. LLM-Prompt-Beispiel enthielt wörtlich `"name": "Plan-Name v2"` → GPT-5.5 hat "v2" bei jedem Adjust in den Namen kopiert. Interne `version` wurde hochgezählt (v4, v5, v6…), aber Dashboard zeigt nur `plan.name` → User sah "v2" für immer.
  2. Alle LLM-Fehler (Rate-Limit, Budget, malformed JSON) wurden zu generischem "KI-Anpassung fehlgeschlagen" → weder User noch Support konnten diagnostizieren.
- **Fixes** (`services/llm_coach.py`):
  1. Prompt weist LLM explizit an, KEIN Versions-Suffix zu setzen.
  2. Regex `\s+v\s*\d+\s*$` strippt jeglichen `vN`-Tail aus dem LLM-Namen; Server hängt deterministisch `v{new_version}` an.
  3. `call_llm` in try/except → Quota/Budget/429/exceeded-Keywords werden zu HTTP 402 "KI-Budget aufgebraucht" gemappt.
  4. Nicht-parsebare LLM-Response → HTTP 502 "KI hat unlesbare Antwort gesendet".
  5. Generic Exception schreibt jetzt `type(e).__name__: str(e)[:150]` in `job.error`.
- **Verified**: 21/21 Tests grün. E2E: Plan v11 → v12 mit Name "Alpha Hypertrophie 4-Tage Split v12" (clean, korrektes Suffix).
- **Prod-Redeploy erforderlich** damit User in Play-Store-App die Fixes sieht.


## Feature (2026-02-16, Iter 15) — Wochen-Schedule mit Restday ✅
- **User Wunsch**: "Restday anzeigen bei nicht Trainingstage".
- **Backend** (`routers/training_days.py`, neu): `GET/PUT /api/profile/training-days`. Default aus `days_per_week` (4 → Mo/Di/Do/Fr). Validierung: dedup, range 0-6, min. 1 Tag.
- **Frontend** (`components/WeekSchedule.jsx`, neu, im Dashboard nach `DailySummary`): 7 Slots Mo-So. Training: Dumbbell+T{N}. Rest: Moon+REST. Heute mit Blue-Ring. Completed-heute: grüner Check + "GESCHAFFT". Inline-Editor via `ANPASSEN`.
- **Verified**: 45 Tests grün (8 neu + 37 regression). Frontend E2E ok.


## Feature (2026-02-16, Iter 16) — Drag & Drop Plan-Zuordnung ✅
- **User Wunsch**: Bestimmte Plan-Tage (z.B. Tag 3 - Beine) gezielt auf bestimmte Wochentage legen.
- **Backend**: Neuer Endpoint `PUT /api/profile/plan-day-assignments` mit Validierung (Restday-Guard, Duplicate-Guard). GET liefert `plan_day_assignments`; PUT training-days filtert stale Entries.
- **Frontend**: WeekSchedule mit HTML5-DnD. Swap-on-Drop. Grüner Drop-Hover-Ring. `RESET`-Button für Sequential-Reset. Optimistic-Toast-Bug gefixt.
- **Verified**: 38 Backend-Tests grün (6 neue), Frontend-E2E via dispatchEvent-DnD (Swap + Persist + Reset).

## UI Cleanup (2026-02-16, Iter 17) — Dashboard entrümpelt ✅
- **User Feedback**: "sieht so geklatscht aus … die Badges können ruhig bei Statistik bleiben".
- **Änderungen** (`pages/Dashboard.jsx`):
  - Komplette BADGES-Sektion (30+ Chips) entfernt — bleibt auf `/progress` verfügbar.
  - StreakFreezeWidget aus Dashboard entfernt (dupliziert Streak-Banner).
  - Body-Scan + Bibliothek CTAs von großen Cards auf schlanke 2-col Icon-Zeile geschrumpft.
  - Ungenutzte Imports (BadgeGlow, StreakFreezeWidget, Dumbbell, TrendingUp, Award, Sparkles, ChevronRight) + `nextBadges`-Array aufgeräumt.
- **Verified**: Frontend-Testing-Agent 100 % — Badges weg, StreakFreeze weg, alle CTAs & WeekSchedule & KI-Adjust funktionieren, 0 Console-Errors, `/progress` zeigt Badges weiterhin.



## UI Enhancement (2026-02-16, Iter 18) — Dashboard Collapsibles ✅
- **User Wunsch**: "Ja" — Sektionen collapsible machen, damit Alex fokussierter scrollt.
- **Neue Komponente** `components/CollapsibleSection.jsx`: Header + Chevron + Hint bei collapsed + smoother max-height Transition + `aria-expanded` a11y.
- **Wrapper auf Dashboard**: `Alpha Coach`, `Heute` (DailySummary), `Statistik` (Stats-Bento) — alle Default CLOSED.
- **Immer sichtbar**: WeekSchedule, Training Plan, Resume-Banner, Streak-Banner, Quick-Actions-Row.
- **Verified**: Frontend-Testing-Agent 100 % — Initial-Zustand closed, Expand/Collapse-Cycle korrekt, aria-expanded toggelt, 0 Console-Errors.


## Quick-Win (2026-02-16, Iter 19) — Collapsible-State per localStorage persistiert ✅
- `CollapsibleSection` unterstützt optional `storageKey` → `af_cs_{key}` in localStorage.
- Dashboard-Sektionen mit Keys: `coach`, `daily`, `stats`.
- **Verified** via Playwright: Coach+Stats öffnen → localStorage `1,1,None` → Reload → Zustand bleibt.

## Logo-Refresh (2026-02-16, Iter 20) — Neues finales Logo ✅
- **User Asset**: Neues Logo mit metallischem A + Bizeps-Armen + Blitz-Motiv (2 MB PNG, `job_fitness-ai-premium/…yx3zdgx8_file_…088c7246b7bec2caf3b0d779.png`).
- **Prozess** (`/tmp/logo_work/process_logo.py`):
  1. Corner-Flood-Fill (tol=55) entfernt den rounded-square Card-Rahmen → Emblem sitzt auf Transparenz.
  2. Alpha-Threshold-Cleanup (α >= 180 oder neon-blue mask) entfernt Stray-Pixel.
  3. Zwei Varianten generiert: `logo` (mit ALPHAFIT-Text) + `helmet` (Emblem only).
- **Dateien in `/app/frontend/public/`** aktualisiert:
  - `alphafit-logo.png` (512, mit Text) + `-192.png` + `-512.png`
  - `alphafit-helmet.png` (Emblem-only) + `-256.png` + `-192.png`
  - `manifest.json`: PWA-Icons zeigen jetzt auf korrekt-gesizte Files.
- **Frontend**: `?v=4` Cache-Bust überall. Header-Logo-Größe 32 → 40 px. Stärkerer `drop-shadow` Glow (12px `#00BFFF`).
- **Verified via Screenshot**: Dashboard-Header + Landing-Hero + Auth-Page zeigen neues Logo mit blauem Neon-Glow.



## Enhancement (2026-02-16, Iter 21) — Alpha-Logo Breathing Pulse ✅
- **Neue CSS Keyframe** `alpha-logo-breath` in `index.css`: 3.2s ease-in-out infinite. Kombiniert `drop-shadow` (Glow-Intensität) + `transform: scale(1 → 1.04)`. `prefers-reduced-motion` respektiert.
- **Logo-Component** neuer optionaler Prop `pulse` → aktiviert Klasse `alpha-logo-pulse` auf Image.
- **Layout-Header**: `<Logo size={40} pulse />` — Header-Logo pulst jetzt kontinuierlich.
- **Splash-Screen**: Pulse-Amplitude verstärkt (0.86 → 1.14 statt 0.92 → 1.08) + separate `splash-helmet-breath`-Keyframe (drop-shadow + scale) beginnt nach dem Entry-Animation (900ms delay). Splash sieht deutlich filmischer.
- **Verified** via Screenshot: Splash-Emblem hat sichtbaren Neon-Halo mit weichem Puls, Header-Logo pulst subtil im Dashboard-Header.


## Bug Fix (2026-02-16, Iter 19) — GESCHAFFT-Badge Woche für Woche ✅
- **User Report**: Completed-Badge verschwand nach 1 Tag statt Woche zu bleiben.
- **Fix** (`WeekSchedule.jsx`): Prop `completedTodayDayIndex` → `sessions` Array. Neue Logik `startOfWeek` = Montag 00:00 Local + `completedThisWeek` Set (day_index Filter). Auto-Reset am Montag 00:00.
- **Testing**: 100 % Frontend-Test grün (2 seed sessions: aktuelle Woche persistiert, vergangene Woche nicht).


## Security Feature (2026-02-16, Iter 20) — E-Mail-Verifizierung nach Registrierung ✅
- **User Wunsch**: Fake-Account-Schutz durch verpflichtende E-Mail-Bestätigung.
- **Backend**:
  - Neuer Router `routers/email_verify.py`: `GET /auth/verify-email?token=`, `POST /auth/resend-verification` (60s Cooldown, Email-Enumeration-Schutz).
  - `/auth/register` gibt jetzt KEINEN JWT-Token zurück, sondern `{email_verification_required:true}` + schickt Verify-Mail (Resend Tag `verify_email`, 24h TTL Token).
  - `/auth/login` returned HTTP 403 mit `{code:"email_not_verified", email, message}` falls unverified.
  - **Grandfather-Migration** als Startup-Hook: 312 bestehende User automatisch als `email_verified=true` markiert (idempotent).
  - Welcome-Mail wird jetzt lazy beim ersten verified-Login getriggert.
- **Frontend**:
  - `AuthPage.jsx`: Neue `verify-pending-card` mit Resend-Button + 60s Countdown, Email-Enumeration nachverfolgt.
  - Neue Page `pages/VerifyEmail.jsx` unter `/verify-email?token=` mit Loading/Success/Already/Error States.
  - `lib/auth.jsx` `register()` returned `{pendingVerification:true}` statt Auto-Login.
- **Verified**: Testing-Agent **15/15 Tests grün** (10 Backend + 5 Frontend). Regression-Test unter `/app/backend/tests/test_email_verification.py`.


## Feature (2026-02-16, Iter 21) — Login-Polish + Onboarding-Tour + Hilfe ✅
- **AuthPage**: Eye-Toggle (`toggle-password-visibility`) + "Angemeldet bleiben"-Checkbox (Default checked) → Token in `localStorage` bzw `sessionStorage`.
- **`lib/api.js`**: `getStoredToken`/`clearStoredToken` liest aus beiden Storages.
- **`lib/auth.jsx`**: `login(email, password, stayLoggedIn=true)` schreibt entsprechend.
- **`TourGuide.jsx`** (neu): 5 Steps auf Dashboard (Alpha Coach, Deine Woche, KI-Anpassung, Body Scan, Hilfe). Auto-Start wenn `af_tour_seen !== "1"`. Skip / Backdrop / Fertig. Progress-Dots. position:fixed + Viewport-Clamping. Globaler Hook `window.__alphafit_start_tour`.
- **`HelpModal.jsx`** (neu): `?`-Button im Layout-Header. Tour-Launcher + Support-Mail-Link + 6 FAQ-Items.

## Diagnostic (2026-02-16, Iter 22) — Email-Delivery-Diagnostik ✅
- **User Report**: Verifizierungs-Mails kommen nicht an (nicht mal im Spam) auf Production.
- **Setup-Info**: Resend-Domain `alpha-fit.fitness` verifiziert ✅, API-Key vorhanden, Preview-Test-Send an `bellakiki283@gmail.com` erfolgreich mit ID (Resend akzeptiert). Root Cause daher wahrscheinlich außerhalb der App (DNS SPF/DKIM/DMARC oder Resend Domain-Delivery-Config).
- **Neu**:
  - `email_service.send_email` schreibt jetzt jeden Send-Versuch mit voller Diagnostik in `db.email_log_raw` (sender, error, raw response, timestamp).
  - Neuer Endpoint `GET /api/admin/email-diagnostics` (admin-only): liefert letzte N raw sends + template log + config summary.
  - Neuer Endpoint `POST /api/admin/email-test` sendet Test-Verifizierungsmail mit voller Response.
- **Verified**: Testing-Agent **18 Backend-Tests grün** (8 neue Diagnostics + 10 Email-Verification-Regression).

- **Verified**: Testing-Agent **13/13 grün** + 3 optionale Verbesserungen umgesetzt.


## Emergency Bypass (2026-02-16, Iter 23) — Email-Verify Feature-Flag ✅
- **User Report**: "Kein Plan kommen keine Mails an" — Beta-User steckten auf Production fest, konnten nicht mehr registrieren/einloggen.
- **Root Cause (Preview verifiziert)**: Resend akzeptiert alle Sends mit valider ID + 200 Status + kein Error. Empfänger-Gmail dropped die Mail silent (DKIM/DMARC/SPF-Alignment-Problem).
- **Fix (Emergency Bypass)**:
  - Neue Env-Var `EMAIL_VERIFICATION_REQUIRED` (default `true`). Bei `false`: Register issued sofort JWT + markiert `email_verified=true`, Login skippt 403-Check.
  - Neuer Admin-Endpoint `POST /admin/verify-user` mit `{email}` → manueller Bypass falls User in strict-Phase gestrandet.
  - Neuer Admin-Endpoint `GET /admin/auth-config` → zeigt aktuellen Flag-Status + Resend-Config.
  - `.env` auf `EMAIL_VERIFICATION_REQUIRED=false` gesetzt damit Beta sofort läuft.
  - Old `test_email_verification.py` bekommt Skip-Marker wenn Flag off (strict-mode Tests laufen nur wenn Flag on).
- **Verified**: Testing-Agent **24 grün + 10 skipped** (16 neue Flag-Tests + 8 Diagnostik-Tests + 10 alte strict-Tests korrekt skipped).


## Follow-up (2026-02-16, Iter 24) — Default auf `false` geflippt ✅
- User hat deployed BEVOR er die Env-Var setzen konnte → Prod war strict + Mails funktionieren nicht.
- **Fix**: Default in `_email_verification_required()` und `/admin/auth-config` auf `false` geflippt → Production funktioniert out-of-the-box ohne Env-Var.
- Um strict wieder zu aktivieren: `EMAIL_VERIFICATION_REQUIRED=true` in Emergent-Env-Vars setzen + Redeploy.
- **Verified**: Testing-Agent 16/16 Flag-Tests grün + 10/10 legacy Strict-Tests korrekt geskippt.


## Feature (2026-02-16, Iter 25) — Muskelgruppen im Detail (Progress) ✅
- **Backend** (`routers/muscle_groups.py`): `GET /api/muscle-groups/stats?weeks=4` — analysiert completed sessions letzter N Wochen, matched `target_muscle` gegen 7 canonical Gruppen, berechnet `percent` (Baseline 2 Sessions/Woche/Gruppe = 100 %).
- **Frontend** (`MuscleGroupsSection.jsx`): Stylized SVG-Body mit Vorne/Hinten Toggle. Muskelregionen Fill an %-Value gekoppelt. Bidirektionaler Hover-Sync (Card ↔ Region). Progress-Balken Farbverlauf (Gold→Blau→Grün). Mounted auf `/progress`.
- **Verified**: Testing-Agent 5/5 Backend + 100 % Frontend grün. Kleines SVG-Hitbox-Overlap-Item durch Z-Order-Sort gefixt.
