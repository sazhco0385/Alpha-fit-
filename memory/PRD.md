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
- Badges: 6 tiers (first_workout → legend), glow shield design, auto-awarded on session complete
- Progress: volume chart (14 days), session history, badges earned
- Premium paywall: 3 plans with 7-day trial, Stripe Checkout subscription mode
- Payment return polling
- Admin dashboard: total/monthly/today revenue, daily bar chart, members table with grant/revoke premium, delete member, 403 for non-admins

## P0 Backlog (next)
- Stripe webhook secret (STRIPE_WEBHOOK_SECRET) for production-grade signature verification
- AI Coach plan-adjust fallback when LLM returns unparsable JSON
- Email notifications (trial ending, payment success)
- Push notifications for workout reminders

## P1 Backlog
- Body measurements tracking (weight log, photos)
- Nutrition / macro tracking with AI
- Exercise video demos
- Custom plan editor

## P2 Backlog
- Social: friends, challenges, leaderboards
- Apple Health / Google Fit sync
- Wearable integration
