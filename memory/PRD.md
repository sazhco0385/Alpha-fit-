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
- LLM: GPT-5.5 via Emergent Universal Key (auto-upgrade path documented for gpt-5.6-sol)
- Payments: Stripe · Email: Resend · Push: Web Push VAPID

## Recently Completed
- **Design v3 "Neon Aurora"** (Feb 2026): mobile-first Dashboard redesign with aurora hero, daily-quote emotional anchor, warm streak flame, tile-3d hover animations
- **Rest-Timer Kategorie-Badge**: neon badge under countdown explaining rest duration
- **Rest-Seconds Bug Fix**: DB migration for 33 legacy plans + normalizer
- **GPT-5.6 Check**: not yet available via Emergent
- **Muscle-Group Heatmap** (`/progress`)
- **Plan History + Rollback** (`/plan-history`)
- **Progressive-Overload-Gating** in LLM prompts
- **Week Schedule Drag & Drop**
- **Collapsible Sections** with localStorage
- **Email Verification** with grandfathering (disabled via env until DKIM)

## Backlog / Roadmap
- **P1 Onboarding Redesign** — apply Aurora look to onboarding wizard
- **P1 Active Workout HUD** — apply Aurora look with tactical beam-border around active set
- **P1 Daily Quests** — 3 daily + 1 weekly quest, XP bar, Duolingo hook
- **P2 Body-Measurements** — waist/chest/arms/thighs + photo history
- **P2 Rest-Sound Cue** — different gong per rest category
- **P3 Health Connect Export Parser** (Google Fit / Android)
- **P4 Mail-Quota-Widget** in Admin dashboard
- **P4 GPT-5.6 auto-detect** — startup ping when available

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
