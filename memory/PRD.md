# alpha-fit – Product Requirements Document

## Original Problem Statement
Create the ultimate fitness app "alpha-fit". Key requirements: AI Coach for dynamic training plans, comprehensive onboarding, "badge glow" UI, Admin system, Stripe integration, Body Scan analysis (Vision AI), AI Nutrition Tracking, Exercise Image Generation, Web Push Notifications, Async Polling architecture, Social features, Custom Plan editing, Email integrations, Muscle Group heatmap, Plan History tracking. Preparing for Google Play Store release. Live at alpha-fit.fitness. User's language: German.

## Design System — v3 "Neon Aurora" (Feb 2026, current)
Reverted the failed "Performance Pro" orange overhaul. Kept the original electric-cyan (#00BFFF) core but leveled it up to a cinematic, mobile-first, aurora-driven look.

- **Palette**: Electric Cyan `#00BFFF` primary, Aurora Purple `#9333EA` + Neon Pink `#FF1493` + Mint `#00FFB3` as aurora tints, Warm Flame `#FF6B35` for streaks, Royal Gold `#C9A04E` for Premium
- **Typography**: Teko (headings, uppercase, tight) + Chakra Petch (body, technical)
- **Motion**: aurora-drift (22s ease-in-out), flame-breath (1.8s), tile-3d hover translate-y-1
- **Hero**: `DashboardHero.jsx` — time-aware greeting + streak badge + daily quote (Spruch des Tages back as emotional anchor) + resume-training CTA
- **Mobile-first**: 390px baseline, single-column stacks, 3-col compact stats row, 2-col quick actions

## Architecture
- Frontend: React + TailwindCSS + shadcn/ui + Recharts + lucide-react
- Backend: FastAPI + Motor (MongoDB async) + emergentintegrations LLM
- LLM: GPT-5.6 (sol / terra) via Emergent Universal Key — Coach, Body-Scan, Nutrition all upgraded
- Payments: Stripe · Email: Resend · Push: Web Push VAPID

## Recently Completed
- **"Mega Krass" Dashboard Redesign** (Sep 2026): cinematic aurora hero with animated beam border + scanline + staggered entrance animations, breathing streak pill, chrome stat tiles with radial glow + hover pop, glassmorphism quick-action tiles (4: Body Scan, Bibliothek, Fortschritt, Ernährung) with neon icon glow boxes, tracing-beam border on active plan day card, mega quote box, pulsing resume CTA
- **Branding Update**: "Sky-Networks UG" → "S.L solutions UG" everywhere (Landing footer, Legal, Layout footer)
- **GPT-5.6 Labels**: all user-facing GPT-5.5 mentions updated to GPT-5.6 (Landing, Legal, Premium, Coach header, email templates)
- **GPT-5.6 Upgrade** (Feb 2026): swapped models in `llm_coach.py`, `bodyscan.py`, `nutrition.py`. 61/61 backend tests pass. Ruff F811 duplicate imports in `llm_coach.py` cleaned up.
- **AI Coach Mesocycle & Plateau Logic**: prompt now understands Accumulation / Intensification / Peaking / Deload; UI shows current phase on Dashboard
- **Anatomical Muscle Heatmap**: anatomically correct model, relative calc, auto-extending window when data sparse, pulsing animation for hottest muscle + `WeakMuscleRecommendations.jsx`
- **Landing Page Overhaul**: mobile-first Aurora + `FeatureShowcase.jsx` with CSS-only live loops (PR cinematic, rest ring, heatmap)
- **PR Cinematic Overlay**: volt-green Aurora flashes + confetti when PR is broken, wired into `detect_prs_for_session`
- **Rest Timer Ring**: circular animated SVG gradient countdown on `ActiveWorkout.jsx`
- **Rest Timer Categories**: neon badge under countdown explaining rest duration
- **Android TWA**: `assetlinks.json` configured with user's Play Console SHA-256 fingerprint
- **Design v3 "Neon Aurora"**: mobile-first Dashboard redesign, aurora hero, daily quote, warm streak flame
- **Rest-Seconds Bug Fix**: DB migration for 33 legacy plans + normalizer
- **Muscle-Group Heatmap** (`/progress`)
- **Plan History + Rollback** (`/plan-history`)
- **Progressive-Overload-Gating** in LLM prompts
- **Week Schedule Drag & Drop**
- **Collapsible Sections** with localStorage
- **Email Verification** with grandfathering (disabled via env until DKIM)

## Backlog / Roadmap
- **P1 Daily Quests** — 3 daily + 1 weekly quest, XP bar, Duolingo hook
- **P1 Onboarding Redesign** — apply Aurora look to onboarding wizard
- **P1 Active Workout HUD** — apply Aurora look with tactical beam-border around active set
- **P2 Body-Measurements** — waist/chest/arms/thighs + photo history
- **P2 Rest-Sound Cue** — different gong per rest category
- **P3 Health Connect Export Parser** (Google Fit / Android)
- **P4 Mail-Quota-Widget** in Admin dashboard

## Blocked
- **Email verification** requires user's DKIM/DMARC/SPF DNS. `EMAIL_VERIFICATION_REQUIRED=false`.

## Deployment
- Preview: this pod
- Production: https://alpha-fit.fitness (deployed separately)

## Critical Files
- `/app/frontend/src/pages/Dashboard.jsx` — Aurora flagship
- `/app/frontend/src/components/DashboardHero.jsx` — hero with greeting + quote + streak (NEW)
- `/app/frontend/src/index.css` — aurora keyframes, tile-3d, stat-tile, dash-quote
- `/app/frontend/src/lib/restCategory.js` — rest-timer categorization
- `/app/frontend/src/lib/quotes.js` — 30 Spartan daily quotes
- `/app/backend/services/llm_coach.py` — LLM plan gen + rest normalizer
- `/app/backend/server.py` — startup migrations
- `/app/memory/test_credentials.md` — test accounts
