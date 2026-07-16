# alpha-fit – Product Requirements Document

## Original Problem Statement
Create the ultimate fitness app "alpha-fit". Key requirements: AI Coach for dynamic training plans, comprehensive onboarding, "badge glow" UI, Admin system, Stripe integration, Body Scan analysis (Vision AI), AI Nutrition Tracking, Exercise Image Generation, Web Push Notifications, Async Polling architecture for long LLM tasks, Social features (Friends/Challenges/Leaderboards), Custom Plan editing, Email integrations, Muscle Group heatmap, Plan History tracking. Preparing for Google Play Store release. Live at alpha-fit.fitness. User's language: German.

## Design System — v2 "Performance Pro" (Feb 2026)
Full app-wide overhaul. Dark-mode-only, no cyan.
- **Palette**: Electric Blaze `#FF4500` primary, Volt Green `#39FF14` success, Gold `#D4AF37`, Obsidian surfaces `#0A0A0B` / `#121214`
- **Typography**: Teko (headings, uppercase, tight) + Chakra Petch (body, technical)
- **Radii**: 4px tactical (--radius 0.25rem)
- **Layout**: Bento Grid Mode B for dense screens
- **Tokens**: `/app/frontend/src/index.css` (CSS vars + shims for legacy classes)
- **Guidelines**: `/app/design_guidelines.json`

## Architecture
- Frontend: React + TailwindCSS + shadcn/ui + Recharts + lucide-react
- Backend: FastAPI + Motor (MongoDB async) + emergentintegrations LLM
- LLM: GPT-5.5 via Emergent Universal Key (auto-upgrade path documented for gpt-5.6-sol)
- Payments: Stripe
- Email: Resend (delivery blocked by user's DKIM until DNS configured)
- Push: Web Push VAPID

## Recently Completed (Feb 2026)
- **Design v2 overhaul**: Electric Blaze palette, Bento Dashboard flagship, app-wide color swap across 50 files
- **Rest-Timer Kategorie-Badge**: neon badge under countdown explaining why rest is long/short (SCHWERE GRUNDÜBUNG / COMPOUND / ISOLATION / CORE)
- **Rest-Seconds Bug Fix**: DB was storing `rest_sec`, frontend read `rest_seconds`. Normalizer + startup migration normalized 33 legacy plans, differentiated by exercise type
- **GPT-5.6 Availability Check**: Confirmed not yet routable via Emergent (falls back to gpt-5.5)
- **Muscle-Group Heatmap** (`/progress`): interactive SVG with 4-week hit frequency
- **Plan History + Rollback** (`/plan-history`)
- **Progressive-Overload-Gating**: LLM waits until week 4 before swapping exercises
- **Week Schedule Drag & Drop** on Dashboard
- **Collapsible Sections** with localStorage
- **Email Verification** with grandfathering (currently disabled via `EMAIL_VERIFICATION_REQUIRED=false`)
- **Login "Stay Logged In" + Password Eye + Tour Guide + Help Modal**

## Backlog / Roadmap
- **P1 Daily Quests**: 3 daily + 1 weekly quest, XP bar, Duolingo-style hook
- **P1 Screen-by-screen design rollout**: Login, Onboarding, ActiveWorkout, Nutrition, BodyScan bespoke layouts per `/app/design_guidelines.json`
- **P2 Body-Measurements**: waist/chest/arms/thighs + photo history
- **P2 Rest-Sound Cue**: different gong per rest category
- **P3 Health Connect Export Parser** (Google Fit / Android)
- **P4 Mail-Quota-Widget** in Admin dashboard
- **P4 GPT-5.6 auto-detect**: startup ping to upgrade model string when available

## Blocked
- **Email verification** requires user's DKIM/DMARC/SPF DNS config. `EMAIL_VERIFICATION_REQUIRED=false` in `.env`.

## Deployment
- Preview: this pod
- Production: https://alpha-fit.fitness (deployed separately)

## Critical Files
- `/app/frontend/src/index.css` — Design v2 tokens
- `/app/frontend/src/pages/Dashboard.jsx` — flagship Bento Dashboard
- `/app/frontend/src/lib/restCategory.js` — rest-timer categorization
- `/app/backend/services/llm_coach.py` — LLM plan gen + `normalize_days_rest` + `_smart_rest_default`
- `/app/backend/routers/bodyscan.py` — body scan + plan adjust
- `/app/backend/server.py` — startup migrations (email grandfather + rest_seconds)
- `/app/design_guidelines.json` — full design system spec
- `/app/memory/test_credentials.md` — test accounts
