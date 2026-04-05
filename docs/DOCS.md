# AutiSense — Project Documentation

> AI-Powered Autism Screening Platform
> Privacy-first, offline-capable, browser-based behavioral analysis

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Feature Map](#feature-map)
- [Intake Flow (10 Steps)](#intake-flow-10-steps)
- [AI / ML Pipeline](#ai--ml-pipeline)
- [AWS Services](#aws-services)
- [Authentication](#authentication)
- [Data Layer](#data-layer)
- [Therapy Games](#therapy-games)
- [API Endpoints](#api-endpoints)
- [Testing](#testing)
- [Development Progress](#development-progress)
- [Known Issues](#known-issues)
- [Changelog](#changelog)

---

## Overview

AutiSense is a Next.js 16 web application that provides AI-powered autism screening for children. It combines:

- **Edge AI** — Real-time ONNX inference (YOLO pose detection + TCN behavior classification + FER+ emotion analysis) running entirely in the browser via Web Workers
- **Generative AI** — Amazon Bedrock (Nova Lite + Nova Pro) for generating DSM-5 aligned clinical reports from biomarker data
- **Offline-first data** — IndexedDB (Dexie.js) for local storage with DynamoDB sync when online
- **Adaptive therapy** — 7 post-diagnosis games with dynamic difficulty adjustment

The app runs a full 10-step screening flow in ~15 minutes, producing domain scores for gaze, motor, vocalization, and behavioral patterns. No video or audio ever leaves the device.

---

## Architecture

```
Browser (Client)
├── Main Thread (Next.js App Router)
│   ├── 10-step intake flow
│   ├── Dashboard + child profiles
│   ├── 7 therapy games
│   ├── Community feed
│   ├── IndexedDB (Dexie v5, 10 tables)
│   └── DynamoDB sync bridge
│
└── Web Worker (InferenceWorker.ts)
    ├── ONNX Runtime Web (WebGPU/WASM)
    ├── Body: YOLO26n-pose → FeatureEncoder → BodyTCN (6 classes)
    ├── Face: FaceDetector → FER+ (8 emotions) → FaceFeatureEncoder → FaceTCN (4 classes)
    └── Fusion: 70% body + 30% face → ASD risk score

Server (Amplify SSR / Lambda)
├── POST /api/chat/conversation → Amazon Bedrock Nova Lite (voice agent)
├── POST /api/report/summary    → Amazon Bedrock Nova Lite
├── POST /api/report/clinical   → Amazon Bedrock Nova Pro (hybrid template + AI insights)
├── POST /api/report/pdf        → pdf-lib PDF generation
├── POST /api/tts               → Amazon Polly
├── GET/POST /api/auth/*        → Google OAuth + DynamoDB sessions
├── GET/POST /api/feed          → Community feed CRUD
├── POST /api/sync              → DynamoDB session sync
├── POST /api/chat/generate-words → Dynamic word/sentence generation
├── GET  /api/nearby            → Overpass API for nearby institutes
└── GET  /api/report/weekly     → Weekly progress report generation
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.1.6 (App Router, React 19) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 + custom CSS variables (globals.css) |
| Fonts | Fredoka (headings) + Nunito (body) |
| State | Zustand (global) + React useState (local) |
| Database (client) | Dexie.js v4 (IndexedDB wrapper) |
| Database (server) | Amazon DynamoDB (7 tables) |
| ML Inference | ONNX Runtime Web 1.24.2 |
| Face Detection | @mediapipe/tasks-vision |
| Charts | Recharts (dashboard) + Chart.js (detector) |
| PDF | pdf-lib (server-side generation) |
| Auth | Custom Google OAuth 2.0 flow |
| Testing | Playwright 1.58.2 |
| Hosting | AWS Amplify (WEB_COMPUTE) |

---

## Project Structure

```
AutiSense/
├── .env.local                          — Local environment variables (not committed)
├── .env.local.example                  — Template for required env vars
├── .nvmrc                              — Node.js version pin
├── DOCS.md                             — Full project documentation (this file)
├── LICENSE                             — MIT license
├── README.md                           — Quick-start readme
├── SETUP_GUIDE.md                      — Deployment reference & AWS setup
├── amplify.yml                         — AWS Amplify build config
├── eslint.config.mjs                   — ESLint flat config (React 19 rules)
├── next-env.d.ts                       — Next.js TypeScript declarations
├── next.config.ts                      — Next.js config (env vars, headers, webpack)
├── package.json                        — Dependencies & scripts
├── playwright.config.ts                — Playwright test config
├── postcss.config.mjs                  — PostCSS config (Tailwind v4)
├── tsconfig.json                       — TypeScript config
│
├── app/
│   ├── page.tsx                        — Landing page (feature cards, auth-aware CTA)
│   ├── layout.tsx                      — Root layout (fonts, viewport, theme, providers)
│   ├── globals.css                     — Design system (sage palette, CSS vars, Tailwind)
│   ├── favicon.ico                     — App favicon
│   │
│   ├── api/
│   │   ├── auth/
│   │   │   ├── google/route.ts         — Initiate Google OAuth with CSRF state
│   │   │   ├── callback/google/route.ts — OAuth callback, upsert user, create session
│   │   │   ├── session/route.ts        — Get current authenticated user
│   │   │   └── logout/route.ts         — Delete session cookie + DynamoDB record
│   │   ├── chat/
│   │   │   ├── conversation/route.ts   — AI chat via Bedrock Nova Lite
│   │   │   └── generate-words/route.ts — Dynamic word/sentence generation
│   │   ├── feed/route.ts               — Community feed CRUD (placeholder, uses IndexedDB)
│   │   ├── nearby/route.ts             — Overpass API proxy for nearby institutes
│   │   ├── report/
│   │   │   ├── summary/route.ts        — Bedrock Nova Lite session summary
│   │   │   ├── clinical/route.ts       — Bedrock Nova Pro clinical report
│   │   │   ├── pdf/route.ts            — PDF generation via pdf-lib
│   │   │   └── weekly/route.ts         — Weekly progress report generation
│   │   ├── sync/route.ts               — Upload session + biomarkers to DynamoDB
│   │   └── tts/route.ts                — Text-to-speech via Amazon Polly
│   │
│   ├── auth/login/page.tsx             — Login page (Google button + privacy card)
│   │
│   ├── components/
│   │   ├── AnimalAvatar.tsx            — SVG animal avatars with CSS animations (4 animals)
│   │   ├── BottomNav.tsx               — Mobile bottom tab navigation (Lucide icons)
│   │   ├── DetectorResultsPanel.tsx    — Inference results display (body/face/fusion)
│   │   ├── DetectorVideoCanvas.tsx     — Video canvas with skeleton overlay
│   │   ├── LeafletMap.tsx              — Interactive map (dynamic import, no SSR)
│   │   ├── NavLogo.tsx                 — Logo/branding component
│   │   ├── Providers.tsx               — Root context provider wrapper
│   │   ├── SkipStageDialog.tsx         — Confirmation modal for skipping intake stages
│   │   ├── StreakBadge.tsx             — Daily streak counter display
│   │   ├── ThemeToggle.tsx             — Light/dark theme switch (Sun/Moon icons)
│   │   └── UserMenu.tsx               — Top-right user menu with backdrop overlay
│   │
│   ├── contexts/AuthContext.tsx         — React context for Google OAuth auth state
│   │
│   ├── dashboard/
│   │   ├── page.tsx                    — Clinician dashboard (session history, charts)
│   │   └── child/[id]/page.tsx         — Individual child profile with bar charts
│   │
│   ├── feed/page.tsx                   — Community feed (posts, reactions, FAB compose)
│   │
│   ├── games/
│   │   ├── page.tsx                    — Games hub (7 therapy games)
│   │   ├── breathing/page.tsx          — Calm Breathing (guided breathing exercise)
│   │   ├── color-sound/page.tsx        — Color & Sound (multisensory association)
│   │   ├── emotion-match/page.tsx      — Emotion Quiz (scenario-based, 20 scenarios)
│   │   ├── pattern-match/page.tsx      — Pattern Match (visual discrimination)
│   │   ├── sequence/page.tsx           — Sequence Memory (Simon Says)
│   │   ├── social-stories/page.tsx     — Social Stories (social interaction scenarios)
│   │   └── sorting/page.tsx            — Category Sorting (classification)
│   │
│   ├── hooks/
│   │   ├── useAuth.ts                  — Read auth context hook
│   │   ├── useAuthGuard.ts             — Redirect if not authenticated
│   │   ├── useActionCamera.ts          — Camera + YOLO + action detection hook
│   │   └── useDetectorInference.ts     — Real-time detector inference with FPS tracking
│   │
│   ├── intake/
│   │   ├── profile/page.tsx            — Step 1: Welcome & privacy consent
│   │   ├── child-profile/page.tsx      — Step 2: Child info (name, age, language)
│   │   ├── device-check/page.tsx       — Step 3: Camera + microphone verification
│   │   ├── communication/page.tsx      — Step 4: Word Echo (speech recognition)
│   │   ├── behavioral-observation/page.tsx — Step 5: Bubble Pop (reaction time)
│   │   ├── preparation/page.tsx        — Step 6: Action Challenge (YOLO motor verify)
│   │   ├── motor/page.tsx              — Step 7: Tap-the-target coordination
│   │   ├── video-capture/page.tsx      — Step 8: ONNX behavioral video analysis
│   │   ├── summary/page.tsx            — Step 9: Aggregated domain scores
│   │   ├── report/page.tsx             — Step 10: AI-generated clinical report + PDF
│   │   ├── visual-engagement/page.tsx  — (Archived) Visual engagement task
│   │   └── audio/page.tsx              — (Archived) Audio assessment
│   │
│   ├── kid-dashboard/
│   │   ├── layout.tsx                  — Layout wrapper (BottomNav, ThemeToggle, UserMenu)
│   │   ├── page.tsx                    — Hub page (quick links, game cards, streak)
│   │   ├── chat/page.tsx               — AI chat with animal avatars (4 animals, TTS)
│   │   ├── detection/page.tsx          — Real-time behavior detector (elapsed timer)
│   │   ├── nearby-help/page.tsx        — Nearby institutes map (Leaflet + Overpass API)
│   │   ├── progress/page.tsx           — Activity stats (today/week/all-time)
│   │   ├── reports/page.tsx            — Weekly progress reports (kid/parent views)
│   │   ├── speech/page.tsx             — Speech practice (Polly TTS + recognition)
│   │   └── games/
│   │       ├── page.tsx                — Games hub (all games listed)
│   │       ├── alphabet-pattern/page.tsx — Alphabet sequence recognition
│   │       ├── bubble-pop/page.tsx     — Pop target bubbles (letter matching)
│   │       ├── match-numbers/page.tsx  — Number-to-quantity matching
│   │       ├── memory/page.tsx         — Card pair matching (3x3 grid, 4 pairs max)
│   │       ├── social-stories-v2/page.tsx — Kid-friendly social scenarios
│   │       └── tracing/page.tsx        — Motor skill tracing on HTML Canvas
│   │
│   ├── lib/
│   │   ├── actions/actionDetector.ts   — Rule-based action detection from YOLO keypoints
│   │   ├── audio/ttsHelper.ts          — Unified TTS (Polly → browser fallback)
│   │   ├── auth/
│   │   │   ├── config.ts              — Auth configuration (Google OAuth)
│   │   │   ├── dynamodb.ts            — DynamoDB auth adapter (30s cooldown on errors)
│   │   │   └── session.ts             — Session management (cookie, validate, destroy)
│   │   ├── aws/credentials.ts          — Shared AWS credential helper (APP_* env vars)
│   │   ├── camera/cameraUtils.ts       — 3-tier progressive getUserMedia + HTTPS check
│   │   ├── data/
│   │   │   ├── doctors.ts             — Doctor directory (specialty, contact, location)
│   │   │   └── institutes.ts          — 50+ autism institutes across 12 Indian cities
│   │   ├── db/
│   │   │   ├── schema.ts             — Dexie v5 schema (10 tables, 5 migrations)
│   │   │   ├── session.repository.ts  — Session CRUD
│   │   │   ├── biomarker.repository.ts — Biomarker storage + age-normalized aggregation
│   │   │   ├── childProfile.repository.ts — Child profile management
│   │   │   ├── feed.repository.ts     — Feed posts + per-user reaction toggling
│   │   │   ├── gameActivity.repository.ts — Game activity tracking
│   │   │   ├── streak.repository.ts   — Daily streak management
│   │   │   └── sync.repository.ts     — Sync queue management
│   │   ├── games/difficultyEngine.ts   — Adaptive difficulty per child/game
│   │   ├── identity/identity.ts        — Anonymous user ID generation (localStorage)
│   │   ├── inference/
│   │   │   ├── YoloEngine.ts          — YOLO26n-pose estimation (17 keypoints)
│   │   │   ├── FeatureEncoder.ts      — Body feature extraction (86-dim)
│   │   │   ├── TcnEngine.ts           — Body TCN classifier (6 behavior classes)
│   │   │   ├── FaceDetector.ts        — Face ROI extraction
│   │   │   ├── FerEngine.ts           — FER+ emotion classifier (8 emotions)
│   │   │   ├── MediaPipeFaceLandmarker.ts — MediaPipe 478-landmark face mesh
│   │   │   ├── FaceFeatureEncoder.ts  — Face feature extraction (64-dim)
│   │   │   ├── FaceTcnEngine.ts       — Face TCN classifier (4 behavior classes)
│   │   │   ├── FusionEngine.ts        — 70/30 body-face late fusion
│   │   │   ├── MultimodalOrchestrator.ts — Full pipeline (body + face + fusion)
│   │   │   ├── PipelineOrchestrator.ts — Body-only pipeline
│   │   │   ├── backendDetector.ts     — Server-side detection fallback
│   │   │   └── modelCache.ts          — ONNX model caching layer
│   │   ├── reports/weeklyReport.ts     — Weekly summary HTML generation (kid + parent)
│   │   ├── scoring/ageNormalization.ts — Age-adjusted biomarker scoring (4 brackets)
│   │   ├── session/currentSession.ts   — Current screening session state
│   │   └── sync/sync.ts               — IndexedDB ↔ DynamoDB sync logic
│   │
│   └── types/
│       ├── biomarker.ts                — TaskId (12 types), Biomarker, BiomarkerAggregate
│       ├── childProfile.ts             — ChildProfile (name, age, language, gender)
│       ├── feedPost.ts                 — FeedPost (4 categories), FeedReaction
│       ├── gameActivity.ts             — GameActivity, Streak, WeeklyReport, ChatSession
│       ├── inference.ts                — Behavior classes, FaceResult, PipelineResult
│       └── session.ts                  — Session, SessionStatus, SessionSyncPayload
│
├── public/
│   ├── models/
│   │   ├── yolo26n-pose-int8.onnx     — YOLO pose model (13MB, INT8)
│   │   ├── pose-tcn-int8.onnx         — Body TCN model (274KB, INT8)
│   │   ├── emotion-ferplus-8.onnx     — FER+ emotion model (34MB, FP32)
│   │   └── face-tcn-int8.onnx         — Face TCN model (81KB, INT8)
│   └── *.svg                           — Next.js default icons
│
├── server/
│   ├── lambda/sync-handler.ts          — Lambda handler for DynamoDB sync
│   └── scripts/setup-dynamodb.sh       — Shell script to create DynamoDB tables
│
├── tests/
│   ├── app-pages.spec.ts              — Auth, dashboard, games, feed, API endpoint tests
│   └── intake-flow.spec.ts            — Full 10-step intake navigation tests
│
└── workers/
    └── inference.worker.ts             — ONNX inference Web Worker entry point
```

---

## Feature Map

### Core Features (Complete)

| Feature | Status | Files |
|---------|--------|-------|
| Landing page | Done | `app/page.tsx` |
| 10-step intake flow | Done | `app/intake/*/page.tsx` (10 pages) |
| ONNX video behavioral analysis | Done | `app/intake/video-capture/page.tsx`, `app/lib/inference/*` |
| Session biomarker tracking | Done | `app/lib/db/biomarker.repository.ts` |
| Summary with domain scores | Done | `app/intake/summary/page.tsx` |
| Bedrock AI reports (summary + clinical) | Done | `app/api/report/summary/route.ts`, `app/api/report/clinical/route.ts` |
| PDF report download | Done | `app/api/report/pdf/route.ts` |
| Amazon Polly TTS | Done | `app/api/tts/route.ts` |
| Google OAuth login | Done | `app/api/auth/*/route.ts`, `app/auth/login/page.tsx` |
| Dashboard with charts | Done | `app/dashboard/page.tsx` |
| Child profiles | Done | `app/dashboard/child/[id]/page.tsx` |
| 7 adaptive therapy games | Done | `app/games/*/page.tsx` |
| Community feed | Done | `app/feed/page.tsx` |
| Light/dark theme | Done | `app/globals.css` (`[data-theme]`) |
| Offline-first IndexedDB | Done | `app/lib/db/schema.ts` (Dexie v5, 10 tables) |
| COOP/COEP headers for WASM | Done | `next.config.ts` |

### AWS Infrastructure (Complete)

| Resource | Status | Details |
|----------|--------|---------|
| DynamoDB (7 tables) | Deployed | PAY_PER_REQUEST, ap-south-1 |
| S3 bucket + ONNX models | Deployed | 4 models, ~47MB total |
| IAM policies (3) | Created | Bedrock, Polly, DynamoDB+S3 |
| IAM user + Amplify role | Created | For local dev + production |
| Bedrock model access | Auto-enabled | Nova Lite + Nova Pro |
| Budget alarm ($10/mo) | Active | Email alerts at 80% and 100% |
| Amplify hosting | Live | Auto-deploy from GitHub main |

---

## Intake Flow (10 Steps)

| Step | Page | What It Tests | Biomarker Output |
|------|------|--------------|-----------------|
| 1 | `/intake/profile` | Parental consent | — |
| 2 | `/intake/child-profile` | Child info (name, DOB, language) | Creates session in IndexedDB |
| 3 | `/intake/device-check` | Camera + microphone permissions | — |
| 4 | `/intake/communication` | Word Echo — speech recognition | `vocalizationScore` |
| 5 | `/intake/behavioral-observation` | Free-play bubble pop reaction time | `motorScore`, `responseLatencyMs` |
| 6 | `/intake/preparation` | Action Challenge — YOLO motor verification | `motorScore`, `responseLatencyMs` |
| 7 | `/intake/motor` | Tap-the-target motor coordination | `motorScore`, `responseLatencyMs` |
| 8 | `/intake/video-capture` | ONNX behavioral video analysis | `gazeScore`, `motorScore`, `asdRiskScore`, behavior classes |
| 9 | `/intake/summary` | Aggregated domain scores from all stages | — |
| 10 | `/intake/report` | AI-generated clinical report (Bedrock) | PDF download |

> **Archived stages** (files kept, removed from navigation): Visual Engagement (`/intake/visual-engagement`), Audio Assessment (`/intake/audio`)

---

## AI / ML Pipeline

### Body Pipeline (6 behavior classes)
```
Webcam frame → YOLO26n-pose (17 keypoints) → FeatureEncoder (86-dim)
  → BodyTCN → [hand_flapping, body_rocking, head_banging, spinning, toe_walking, non_autistic]
```

### Face Pipeline (4 behavior classes)
```
Face ROI → FER+ (8 emotions) → FaceFeatureEncoder (64-dim)
  → FaceTCN → [typical_expression, flat_affect, atypical_expression, gaze_avoidance]
```

### Fusion
```
ASD Risk = 0.7 × bodyRisk + 0.3 × faceRisk
```

### ONNX Models

| Model | File | Size | Quantization |
|-------|------|------|-------------|
| YOLO26n-pose | `yolo26n-pose-int8.onnx` | 13MB | INT8 |
| Body TCN | `pose-tcn-int8.onnx` | 274KB | INT8 |
| FER+ Emotions | `emotion-ferplus-8.onnx` | 34MB | FP32 |
| Face TCN | `face-tcn-int8.onnx` | 81KB | INT8 |

All inference runs client-side in a Web Worker via ONNX Runtime Web (WebGPU or WASM backend).

---

## AWS Services

| Service | Usage | API Endpoint |
|---------|-------|-------------|
| **Bedrock** (Nova Lite) | Parent-friendly session summaries | `POST /api/report/summary` |
| **Bedrock** (Nova Pro) | DSM-5 aligned clinical reports | `POST /api/report/clinical` |
| **Polly** | Neural TTS voice prompts (Joanna) | `POST /api/tts` |
| **DynamoDB** | User accounts, auth sessions, biomarkers, child profiles, feed posts | Via AWS SDK v3 |
| **S3** | ONNX model file hosting (presigned URLs) | Via `@aws-sdk/s3-request-presigner` |
| **Amplify** | Next.js SSR hosting with auto-deploy | GitHub webhook |

All API routes have **mock fallbacks** — the app works without AWS credentials using template-based responses and in-memory storage.

---

## Authentication

- **Provider**: Google OAuth 2.0 (custom implementation, no third-party auth library)
- **Flow**: `/api/auth/google` → Google consent → `/api/auth/callback/google` → DynamoDB session → cookie
- **Session**: `autisense-session` cookie (7-day expiry), stored in DynamoDB `autisense-auth-sessions` table
- **Fallback**: In-memory auth adapter when AWS credentials are unavailable (development mode)
- **Anonymous use**: Users can complete the full screening without signing in

### Key Files
- `app/api/auth/google/route.ts` — Initiates OAuth with CSRF state
- `app/api/auth/callback/google/route.ts` — Handles callback, upserts user, creates session
- `app/api/auth/session/route.ts` — Returns current user
- `app/api/auth/logout/route.ts` — Deletes session
- `app/lib/auth/dynamodb.ts` — DynamoDB adapter with in-memory fallback
- `app/hooks/useAuth.ts` — Client-side auth hook

---

## Data Layer

### IndexedDB Schema (Dexie v5)

| Table | Primary Key | Indexes | Purpose |
|-------|-------------|---------|---------|
| `sessions` | `id` | `userId`, `createdAt`, `synced`, `status` | Screening sessions |
| `biomarkers` | `++id` (auto) | `sessionId`, `userId`, `timestamp`, `taskId` | Per-task biomarker data |
| `syncQueue` | `++id` (auto) | `sessionId`, `queuedAt`, `retryCount` | Offline sync queue |
| `childProfiles` | `id` | `userId`, `createdAt` | Child profiles |
| `feedPosts` | `++id` (auto) | `userId`, `createdAt` | Community feed posts |
| `feedReactions` | `++id` (auto) | `[postId+userId+type]`, `postId`, `userId` | Per-user reaction tracking |
| `gameActivity` | `++id` (auto) | `childId`, `date`, `gameId` | Game session records |
| `streaks` | `childId` | — | Daily play streak tracking |
| `weeklyReports` | `++id` (auto) | `childId`, `weekStart` | Weekly progress summaries |
| `chatHistory` | `++id` (auto) | `childId`, `createdAt` | AI chat conversations |

### Biomarker Fields

| Field | Type | Range | Source |
|-------|------|-------|--------|
| `gazeScore` | number | 0-1 | Visual engagement, video capture |
| `motorScore` | number | 0-1 | Motor test, behavioral observation |
| `vocalizationScore` | number | 0-1 | Communication, audio, preparation |
| `responseLatencyMs` | number | ms | Motor test, behavioral observation |
| `asdRiskScore` | number | 0-1 | Video capture (fusion engine) |
| `bodyBehaviorClass` | string | 6 classes | Video capture (body TCN) |
| `faceBehaviorClass` | string | 4 classes | Video capture (face TCN) |

### Session Propagation

Session ID is stored in `localStorage` (`autisense-current-session-id`) at child profile creation and read by each subsequent intake page for biomarker writes.

---

## Therapy Games

| Game | Route | Cognitive Target | Difficulty Levels |
|------|-------|-----------------|-------------------|
| Emotion Quiz | `/games/emotion-match` | Scenario-based emotion recognition | 3 (adaptive, 5 emotions) |
| Category Sorting | `/games/sorting` | Classification, reasoning | 5 (items scale) |
| Sequence Memory | `/games/sequence` | Working memory | 5 (sequence length) |
| Social Stories | `/games/social-stories` | Social interaction | 5 (scenario complexity) |
| Calm Breathing | `/games/breathing` | Self-regulation | 5 (duration) |
| Pattern Match | `/games/pattern-match` | Visual discrimination | 5 (grid size) |
| Color & Sound | `/games/color-sound` | Multisensory processing | 5 (speed) |

Difficulty engine (`app/lib/games/difficultyEngine.ts`) auto-adjusts based on recent score history stored in localStorage.

---

## API Endpoints

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/auth/google` | Public | Redirect to Google OAuth |
| GET | `/api/auth/callback/google` | Public | OAuth callback handler |
| GET | `/api/auth/session` | Public | Get current user |
| POST | `/api/auth/logout` | Public | Delete session |
| POST | `/api/chat/conversation` | Public | Dynamic voice agent conversation via Bedrock Nova Lite |
| POST | `/api/report/summary` | Public | Generate summary via Bedrock Nova Lite |
| POST | `/api/report/clinical` | Public | Generate clinical report via Bedrock Nova Pro |
| POST | `/api/report/pdf` | Public | Generate downloadable PDF |
| POST | `/api/tts` | Public | Text-to-speech via Amazon Polly |
| POST | `/api/chat/generate-words` | Public | Generate age-appropriate words/sentences via Bedrock |
| GET | `/api/feed` | Public | List feed posts |
| POST | `/api/feed` | Public | Create feed post |
| GET | `/api/nearby` | Public | Find nearby doctors/institutes via Overpass API |
| POST | `/api/sync` | Public | Sync session + biomarkers to DynamoDB |
| GET | `/api/report/weekly` | Public | Generate/list weekly progress reports |

---

## Testing

### Test Suites

| File | Tests | Coverage |
|------|-------|----------|
| `tests/intake-flow.spec.ts` | 16 | Full 10-step intake flow navigation, form validation, back buttons, skip stage |
| `tests/app-pages.spec.ts` | 16 | Auth, dashboard, all 7 games, feed, 5 API endpoints |
| **Total** | **32** | **All passing** |

### Run Tests

```bash
npm run build          # Build first (required for Playwright)
npx playwright test    # Run all 30 tests
```

### API Tests Included

- `POST /api/report/summary` — Returns mock summary without AWS
- `POST /api/report/clinical` — Returns mock clinical report without AWS
- `POST /api/report/pdf` — Generates valid PDF (checks content-type header)
- `POST /api/tts` — Returns 503 without AWS credentials (expected)

---

## Development Progress

### Phase 0 — Foundation (Complete)
- [x] Next.js 16 project setup with TypeScript, Tailwind v4
- [x] Design system (globals.css — sage green palette, Fredoka/Nunito fonts)
- [x] Landing page with feature cards
- [x] Data layer (Dexie schema v1, session/biomarker repositories)
- [x] Sync bridge (POST /api/sync)

### Phase 1A — Infrastructure + Detector Engine (Complete)
- [x] COOP/COEP headers in next.config.ts
- [x] 4 ONNX models copied to public/models/
- [x] 13 inference engine files ported from detector codebase
- [x] Web Worker replaced with full inference pipeline
- [x] Inference types defined (app/types/inference.ts)
- [x] Dexie schema bumped to v2

### Phase 1B — Detector UI (Complete)
- [x] Video capture page (Stage 10) with camera + skeleton overlay
- [x] DetectorVideoCanvas component (sage green themed)
- [x] DetectorResultsPanel component
- [x] useDetectorInference hook with biomarker conversion

### Phase 1C — Intake Stages 4-9 (Complete)
- [x] Communication (Stage 4) — SpeechRecognition
- [x] Visual Engagement (Stage 5) — canvas tap tracking
- [x] Behavioral Observation (Stage 6) — bubble pop
- [x] Preparation (Stage 7) — AI voice conversation (Bedrock + Polly + Web Speech API)
- [x] Motor Assessment (Stage 8) — target tap
- [x] Audio Assessment (Stage 9) — audio echo

### Phase 1D — Summary + Session Wiring (Complete)
- [x] Session creation at child-profile with localStorage propagation
- [x] All task pages write biomarkers to IndexedDB on completion
- [x] Summary page loads real aggregated data
- [x] Extended aggregation for detector-specific fields (asdRisk, behavior classes)

### Phase 2 — Authentication (Complete)
- [x] Google OAuth 2.0 flow (4 API routes)
- [x] DynamoDB auth adapter with in-memory fallback
- [x] Login page with Google button + privacy card
- [x] useAuth client hook
- [x] Session cookie management

### Phase 3 — Bedrock Reports (Complete)
- [x] Summary API (Nova Lite) with mock fallback
- [x] Clinical API (Nova Pro) with DSM-5 section extraction
- [x] PDF generation with pdf-lib
- [x] Amazon Polly TTS API
- [x] Report page with dual report types + PDF download

### Phase 4 — Dashboard + Child Profiles (Complete)
- [x] Dashboard with Recharts line chart
- [x] Child profile detail page with bar charts
- [x] Dexie schema bumped to v3

### Phase 5 — Therapy Games (Complete)
- [x] 7 adaptive therapy games
- [x] Difficulty engine with 5 levels
- [x] Games hub page

### Phase 6 — Community Feed (Complete)
- [x] Feed page with post creation and reactions
- [x] Category filtering
- [x] Feed API route

### AWS Deployment (Complete)
- [x] 7 DynamoDB tables + 2 GSIs created
- [x] S3 bucket created + 4 ONNX models uploaded
- [x] 3 IAM policies created
- [x] IAM user + Amplify service role created
- [x] $10/month budget alarm configured
- [x] Google OAuth configured
- [x] Amplify app deployed from GitHub
- [x] COOP/COEP custom headers set
- [x] Auto-deploy on push to main enabled

---

## Known Issues

| # | Issue | Severity | Status | Notes |
|---|-------|----------|--------|-------|
| 1 | No server-side route protection (middleware.ts deleted) | Medium | Open | Next.js 16 deprecated middleware. Dashboard/games/feed pages accessible without login. Client-side auth guards needed. |
| 2 | Login page shows "Loading..." briefly before rendering | Low | Open | Suspense boundary for useSearchParams — normal Next.js behavior |
| 3 | Video capture requires camera permission — no graceful fallback UI | Low | Open | Page shows "Start Video Analysis" but camera denial has no user-friendly error |
| 4 | SpeechRecognition not available in all browsers | Low | Open | Communication + Audio stages fall back to "missed" after timeout on unsupported browsers |
| 5 | ONNX models loaded from public/ not S3 in production | Low | Open | Models bundled with the app (~47MB). S3 presigned URL loading is implemented but not wired to video-capture page |
| 6 | ~~Feed posts are local-only (IndexedDB)~~ | Low | **Resolved** | v2.5.1: Feed now uses DynamoDB (`autisense-feed-posts` table) via `/api/feed` API route. Posts, reactions, and deletes are shared across all users. In-memory fallback for local dev. |
| 7 | Dashboard charts show empty state for new users | Low | Open | No sample/demo data — charts appear blank until user completes at least one screening |

### Resolved Issues

| # | Issue | Resolution |
|---|-------|-----------|
| R1 | **Amplify SSR env vars undefined at runtime** | Amplify WEB_COMPUTE injects env vars into the build container but NOT the Lambda runtime. Fixed by listing all non-AWS vars in `next.config.ts` `env` block so they're inlined at build time. See SETUP_GUIDE.md for details. |
| R2 | **Google OAuth "not configured" on deployed site** | Caused by R1 — `GOOGLE_CLIENT_ID` was undefined in Lambda. Fixed by build-time env inlining. |
| R3 | **AWS SDK auth failures on Amplify Lambda** | API routes passed explicit `credentials: { accessKeyId, secretAccessKey }` without `sessionToken`. Lambda IAM roles provide temporary STS credentials. Fixed by removing explicit credentials — SDK auto-detects. |
| R4 | **ONNX worker fails on mobile browsers** | WebGPU unavailable on mobile; WASM sub-worker couldn't load from Next.js static media. Fixed: CDN WASM paths in `backendDetector.ts`, mobile WebGPU skip, single-thread when SharedArrayBuffer unavailable. |
| R5 | **ESLint CI failures with React 19 strict rules** | `eslint-config-next` introduced strict `react-hooks/*` rules. Fixed: moved hooks before conditional returns, added ref patterns for recursive callbacks, configured rule overrides in `eslint.config.mjs`. |
| R6 | **Mobile layout overflow** | 12 step-dots (38px each) + fixed grid layout overflowed phone screens. Fixed: responsive breakpoints at 768px/480px, `.video-capture-grid` CSS class, safe-area padding. |
| R7 | **Camera "play() interrupted" error** | Browser autoPlay attribute conflicted with explicit `video.play()` call. Fixed by catching `AbortError` in `startCamera()` — autoPlay handles playback. |
| R8 | **PDF "=======" separator lines** | Clinical report mock joined sections with `"=".repeat(60)`. Fixed: changed to `---` separator. PDF renderer now detects separator lines (`===`, `---`) and renders graphical dividers instead of text. |
| R9 | **Video analysis saved only basic metrics** | Stage 10 only saved gazeScore/motorScore at the end. Fixed: extended `addBiomarker` to accept asdRiskScore, body/face behavior classes, probabilities, and emotion distribution. Biomarkers now saved every 5 seconds during the 2-minute assessment. |
| R10 | **No consent before cloud sync** | Results auto-synced to cloud without user consent. Fixed: consent checkbox added at Stage 10 completion. Summary page (Stage 11) respects the preference — skips sync if user opts out. |
| R11 | **Step 7 static instructions — no adaptive assessment** | Step 7 used 5 hardcoded instructions with parent-reported "Did it!" buttons. Replaced with a dynamic AI voice agent: Amazon Nova Lite (Bedrock) generates age-appropriate conversation, Amazon Polly speaks to the child, Web Speech API listens for responses. Collects richer biomarkers (response latency, engagement rate, comprehension). Falls back to pre-defined conversation when Bedrock unavailable. |
| R12 | **CI Playwright failures — AWS SDK "Region is missing"** | `next.config.ts` inlines env vars at build time with `?? ""` defaults. On CI (no `.env.local`), `BEDROCK_REGION`/`POLLY_REGION` resolved to `""` (empty string). Nullish coalescing (`??`) doesn't catch empty strings, so `process.env.BEDROCK_REGION ?? "us-east-1"` → `""`. AWS SDK threw `Error: Region is missing` outside try/catch → uncaught 500. Fix: changed `??` to `||` in all 4 API routes (summary, clinical, tts, conversation) and moved client creation inside try/catch blocks. TTS error status changed from 500 → 503. |
| R13 | **Step 7 auto-advances without verifying motor actions** | Voice agent spoke motor instructions ("touch your nose", "wave") but immediately moved on without checking if the child performed the action. Also, agent text wasn't displayed prominently. Fix: added camera-based motor action verification using existing YOLO pose detection pipeline. Motor turns activate camera → YOLO extracts 17 keypoints → rule-based ActionDetector checks keypoint geometry → ActionTracker requires 5 consecutive positive frames → confirmed. Agent text now displayed in large centered speech bubble with domain emoji headers. |
| R14 | **Stage 10 worker URL parse error** | `Failed to execute 'fetch' on 'WorkerGlobalScope': Failed to parse URL from /models/yolo26n-pose-int8.onnx`. ONNX model paths were relative URLs (`/models/...`) which fail inside Web Workers because relative paths resolve against the worker script URL (blob: or /_next/static/), not the page origin. Fix: prefixed all 4 model paths with `${self.location.origin}` in PipelineOrchestrator.ts and MultimodalOrchestrator.ts. |
| R15 | **Stages 4, 7, 9 overlap and lack differentiation** | Stage 4 (Communication) and Stage 9 (Audio) were both simple speech echo tests with hardcoded word lists. Stage 7 (Preparation) mixed motor actions with LLM conversation. Fix: Stage 4 → pure Word Echo with LLM-generated age-appropriate words + Polly TTS. Stage 7 → pure Motor Action Challenge with fixed 6-action sequence + live YOLO detection feedback (confidence bar, 5-dot frame counter, color-coded borders). Stage 9 → Sentence Echo + Comprehension (Part A: sentence repetition with word-overlap scoring, Part B: audio instruction following). |
| R16 | **Stage 10 camera fails on mobile** | `getUserMedia()` with fixed resolution constraints fails on many mobile browsers. Also: no HTTPS check (required for camera on mobile), generic error messages, no retry mechanism. Fix: 3-tier progressive constraint negotiation (ideal 320×240 → facingMode only → any video). HTTPS early check. Specific error messages per DOMException type (NotAllowedError, NotFoundError, NotReadableError, SecurityError). Retry Camera + Skip buttons on failure. Shared `cameraUtils.ts` reused by Stage 7 and Stage 10. |
| R17 | **Stages auto-advance without criteria verification** | Some stages allowed proceeding even when insufficient data was collected. Fix: minimum criteria gates on Stages 4 (2/6 words), 7 (3/6 actions), 9 (2/7 items), 10 (5 samples + 30s). Stages show "Let's try again!" card with Try Again/Skip buttons when criteria not met. |
| R18 | **UserMenu dropdown overlaps content on mobile** | Added semi-transparent backdrop overlay (z-199) behind dropdown (z-200). Backdrop click closes menu. `app/components/UserMenu.tsx` |
| R19 | **Emotion Match identical to Memory game** | Replaced card-flip game with scenario-based Emotion Quiz — 20 scenarios, 5 emotions, adaptive difficulty, sound feedback. Now saves game activity + updates streak. `app/games/emotion-match/page.tsx` |
| R20 | **Streak not updating despite playing games** | childId mismatch: dashboard used `""` fallback but games used `"default"`. Changed dashboard fallback to `"default"`. `app/kid-dashboard/page.tsx` |
| R21 | **Chat mic stops working after first voice input** | SpeechRecognition cleanup: stop+nullify old instance before creating new, 120ms delay for mic release, cleanup on unmount. Reordered input bar: mic first (64px, primary), text secondary. `app/kid-dashboard/chat/page.tsx` |
| R22 | **Mobile browser zoom on input focus** | Added `viewport` export with `maximumScale: 1`, `userScalable: false` in `app/layout.tsx`. |
| R23 | **Community feed infinite reactions / UI issues** | Per-user reaction tracking via `feedReactions` table (Dexie v5). Reactions toggle on/off per user. Posts displayed first, compose form behind FAB. Delete own posts with reaction cleanup. `app/feed/page.tsx`, `app/lib/db/feed.repository.ts`, `app/lib/db/schema.ts` |
| R24 | **UserMenu dropdown unclickable on mobile (Nothing Phone 3a Pro, Samsung)** | CSS stacking context issue: `.page > * { z-index: 1 }` in globals.css created separate stacking contexts for all page children, preventing `.nav`'s dropdown (z-index: 200) from rendering above `.main`. Fix: added `position: relative; z-index: 10` to `.nav` rule. `app/globals.css` |
| R25 | **Dashboard game cards cut off behind BottomNav** | Dashboard `.main` had only 24px bottom padding — Featured Games section disappeared behind the 64px fixed BottomNav. Fix: increased inline padding to `24px 20px 80px`. `app/kid-dashboard/page.tsx` |
| R26 | **Chat Home button oversized on mobile** | Home button in chat nav used `minHeight: 40, padding: 8px 14px, fontSize: 0.85rem` — too large for mobile viewports. Fix: reduced to `minHeight: 36, padding: 6px 12px, fontSize: 0.82rem`. `app/kid-dashboard/chat/page.tsx` |
| R27 | **BottomNav icons touching bottom edge on gesture-bar phones** | `height: 64` with `paddingBottom: env(safe-area-inset-bottom, 0px)` didn't grow for gesture navigation bars. Fix: changed to `minHeight: 64` + `paddingBottom: max(8px, env(safe-area-inset-bottom, 8px))` so nav grows for gesture bars and always has baseline padding. `app/components/BottomNav.tsx` |
| R28 | **Top navbar cramped on mobile with safe-area override** | The `@supports (padding-top: env(safe-area-inset-top))` rule set `padding-top: max(12px, ...)` which overrode the 480px breakpoint's padding. Also missing `min-height`. Fix: changed safe-area padding to `max(20px, env(...))`, added `min-height: 64px` to `.nav`. `app/globals.css` |
| R29 | **PDF reports identical across different screening sessions** | When no IndexedDB biomarker data exists for a session, the report page uses hardcoded fallback values `{avgGazeScore: 0.5, avgMotorScore: 0.5, avgVocalizationScore: 0.5, overallScore: 50}` — every report built from these looks the same. Root cause was NOT a Nova Pro failure (Playwright tests confirmed both Nova Pro and Nova Lite are active). Fix: added `aiEnriched: boolean` to clinical API response, `fallback: boolean` to summary API response, and UI badges showing AI enrichment status + fallback biomarker warning. `app/api/report/clinical/route.ts`, `app/api/report/summary/route.ts`, `app/intake/report/page.tsx` |
| R30 | **Desktop mic not working (SpeechRecognition race condition)** | `checkMicSupport()` in `ttsHelper.ts` created a temp `getUserMedia` stream, stopped it, then `SpeechRecognition.start()` was called — race condition on Windows/Chrome where mic hardware wasn't released fast enough. Fix: replaced `getUserMedia` with `navigator.permissions.query({name: 'microphone'})`. Added 200ms delay before `recognition.start()` in speech and communication pages. Added `interimResults: true` and `settled` flag to prevent double-handling. `app/lib/audio/ttsHelper.ts`, `app/kid-dashboard/speech/page.tsx`, `app/intake/communication/page.tsx` |
| R31 | **Live Detection modality buttons confusing on desktop** | Users had to manually select face/body/both toggle on detection page. Fix: removed toggle buttons, auto-detect modality based on viewport width (`< 768px → face`, `≥ 768px → both`). Added resize listener for dynamic updates. Changed `useDetectorInference` default from `"body"` to `"both"`. `app/kid-dashboard/detection/page.tsx`, `app/hooks/useDetectorInference.ts` |
| R32 | **Action detection canvas doesn't fit screen during screening** | Stage 7 camera container used fixed `width: 320, height: 240` — overflowed or was tiny on various viewports. Fix: changed to responsive `width: "100%", maxWidth: 400, aspectRatio: "4/3"` with `object-fit: cover`. `app/intake/preparation/page.tsx` |
| R33 | **CLAP and RAISE ARMS detection too strict** | Desktop webcam distance made action detection thresholds too tight. Fix: relaxed clap wrist-distance threshold from `0.3 * scale` to `0.45 * scale`, relaxed raise_arms margin from `0.05 * scale` to `0.02 * scale`, lowered `REQUIRED_CONSECUTIVE` from 12 to 10 frames. `app/lib/actions/actionDetector.ts` |
| R34 | **Sequence Memory no "Try Again" on wrong answer** | Wrong answer went straight to result screen after 1s timeout. Fix: added intermediate "feedback" phase showing correct sequence with color blocks, "Try Again" (replays same round) and "End Game" buttons. `app/games/sequence/page.tsx` |
| R35 | **Bubble Pop bubbles too fast / small target** | Bubbles floated off-screen before users could tap on some viewports. Fix: increased float duration from `5+3s` to `7+4s`, enlarged target letter display from `2.2rem` to `2.8rem`, increased play area height from `380px` to `440px`. `app/kid-dashboard/games/bubble-pop/page.tsx` |
| R36 | **Social Stories dark mode broken** | Feedback text used hardcoded `var(--peach-300)` which was invisible in dark mode. Fix: changed wrong-answer feedback color to `var(--text-secondary)`. `app/games/social-stories/page.tsx` |
| R37 | **Progress shows multiple entries per game per day** | Previous 2-second dedup window was too narrow — rapid replays still created duplicate entries. Fix: changed to per-game-per-day dedup keeping best score per game per calendar day. `app/kid-dashboard/progress/page.tsx` |
| R38 | **Report accuracy inflated when skipping stages** | Unmeasured biomarker domains defaulted to `0.5` but domain-aware averaging fallback was `0.75` when no tasks measured a domain. Fix: changed fallback from `0.75` to `0.5` so skipped screenings show honest ~50% scores. `app/lib/db/biomarker.repository.ts` |
| R39 | **PDF clinical text cut off at right margin** | `wrapText` margin was `CONTENT_WIDTH - 10` and font was `9.5pt` — text truncated on right edge. Fix: increased margin to `CONTENT_WIDTH - 20` and reduced clinical font from `9.5pt` to `9pt`. `app/api/report/pdf/route.ts` |
| R40 | **Community feed links point to non-functional /feed page** | Feed is IndexedDB-only (Known Issue #6) so community links were misleading. Fix: redirected all community/feed links to `/kid-dashboard/chat` (AI Chat). Updated landing page CTA, dashboard quick links, and footer. `app/page.tsx`, `app/kid-dashboard/page.tsx` |
| R41 | **Landing page logo not clickable** | Logo was a `<span>` with no click handler. Fix: wrapped in `<Link href="/">`. `app/page.tsx` |
| R42 | **Intake pages use emojis instead of icons** | Device-check, profile, and summary intake pages used emoji strings for visual indicators. Fix: replaced with Lucide React icons (Camera, Lock, BarChart3, Trash2, Mic, Globe, Eye, Hand, AlertCircle). `app/intake/profile/page.tsx`, `app/intake/device-check/page.tsx`, `app/intake/summary/page.tsx` |
| R43 | **Daily progress/streak not updating for 4 games** | Sorting, Color & Sound, Breathing, and Pattern Match games called `saveDifficulty` but never called `addGameActivity` or `updateStreak`. Fix: added result-saving `useEffect` with `addGameActivity` + `updateStreak` to all four games. `app/games/sorting/page.tsx`, `app/games/color-sound/page.tsx`, `app/games/breathing/page.tsx`, `app/games/pattern-match/page.tsx` |
| R44 | **Community feed local-only — posts not shared across users** | Feed used IndexedDB (Dexie) for posts and reactions — each user only saw their own posts. Fix: implemented DynamoDB-backed `/api/feed` API route with full CRUD (create, list, react, delete). Feed page now calls server API instead of IndexedDB. Reaction tracking stored per-post in `reactedBy` map. In-memory fallback for local dev. DynamoDB table: `autisense-feed-posts` (PK: `id`). `app/api/feed/route.ts`, `app/feed/page.tsx` |
| R45 | **Dashboard shows duplicate "AI Chat" quick link** | Community quick link was changed to AI Chat in v2.5.0, but AI Chat already existed — creating two identical entries. Fix: restored Community link pointing to `/feed`, kept single AI Chat entry. `app/kid-dashboard/page.tsx` |
| R46 | **Landing page community links pointed to chat** | v2.5.0 redirected community links to `/kid-dashboard/chat`. Now that feed works cross-user, restored links to `/feed`. Updated CTA card and footer. `app/page.tsx` |
| R47 | **Progress page showed duplicate game entries** | Multiple sessions of the same game appeared as separate rows. Fix: redesigned progress page to group sessions by game — one expandable card per game showing avg score, best score, and session count. Click chevron to expand dropdown with individual session details (time, duration, score). Groups sorted by most recently played. Applied to both Today and This Week tabs. `app/kid-dashboard/progress/page.tsx` |
| R48 | **Feed API used wrong DynamoDB key schema** | API route used `{ id }` as key but the existing `autisense-feed-posts` table uses composite key `{ postId (S), createdAt (N) }`. Fix: updated all DynamoDB operations (Put, Get, Update, Delete) to use correct composite key. Feed page sends both `postId` and `createdAt` for reactions and deletes. `app/api/feed/route.ts`, `app/feed/page.tsx` |
| R49 | **Feed page missing BottomNav** | `/feed` is outside `/kid-dashboard` layout which auto-includes BottomNav. Fix: added `<BottomNav />` directly to feed page. `app/feed/page.tsx` |
| R50 | **Scrollbar jitter on every page load** | Every page briefly showed a second scrollbar during hydration, causing visual jitter/layout shift. Fix: hidden native scrollbar on `html`, `body`, and `.page` via `scrollbar-width: none`, `-ms-overflow-style: none`, and `::-webkit-scrollbar { display: none }`. Added `overflow: hidden` on `.page` and `overflow-x: hidden` on `body` to prevent any container-level scrollbar flash. Scroll still works via `html { overflow-y: auto }`. `app/globals.css` |
| R51 | **Desktop mic not working in Word Echo and Speech Practice** | SpeechRecognition.start() was called only 200ms after TTS audio ended — not enough on Windows/Chrome for hardware release. Fix: mic stream is acquired ONCE via `getUserMedia` when test begins (warms up hardware), kept alive throughout all words, and shared with the visualizer. SpeechRecognition coexists with the open stream. Audio element explicitly released (`audio.src = ""`) after TTS. Speech practice page delay also increased to 500ms. `app/intake/communication/page.tsx`, `app/kid-dashboard/speech/page.tsx` |
| R52 | **Word not shown during playback/listening states** | The word text and emoji were only shown contextually per state. Fix: word emoji and text are now always prominently displayed at top of card regardless of state (playing, listening, matched, missed). `app/intake/communication/page.tsx` |
| R53 | **No audio visualizer during listening** | Listening state only showed a pulsing dot. Fix: added real-time mic visualizer using shared `getUserMedia` stream + `AudioContext` + `AnalyserNode` — renders 5 reactive bars on a canvas that respond to actual microphone input (voice frequency range). Uses retina-ready 2x canvas with manual rounded rect for browser compat. CSS animated bars during TTS playback, red pulsing recording indicator. Speech practice page gets animated bar visualizer in button. `app/intake/communication/page.tsx`, `app/kid-dashboard/speech/page.tsx` |
| R54 | **Speech recognition fires "no match" too quickly on desktop** | Chrome fires `onend` even with `continuous: true` after brief silence periods. Fix: `onend` handler now auto-restarts recognition (`recognition.start()`) instead of marking missed. This is valid because the instance IS restartable once `onend` has fully fired. Only the hard timeout (8-10s via `setTimeout`) calls `stopRecognition()` + marks missed. `onerror` ignores "no-speech"/"aborted" (expected in continuous mode). Result: mic stays open for the full 8 seconds, giving the user proper time to speak. Applied to all 3 audio pages: Word Echo, Speech Practice, Audio Intake. |
| R55 | **Action detection challenge: flickery UI, negative timer, detection too difficult** | Three issues: (1) Timer displayed negative values (e.g. "-154s") because tick interval decremented past 0 before clearing. Fix: clamp `t` to 0 and clear interval before calling `setTimeoutSeconds`. (2) Status text ("Looking for...", "Getting closer!", "Almost there!") flickered rapidly every frame as detection confidence oscillated. Fix: debounced status with 500ms hold — status category must be stable for 500ms before text updates. Progress dots also debounced (only update on ≥2 hit change). (3) Detection nearly impossible: `REQUIRED_CONSECUTIVE` was 10, miss penalty was -2 (vs +1 on hit), and confidence gate was 0.4. Fix: lowered to 8 required hits, -1 miss penalty (1:1 ratio), 0.3 confidence gate (matches individual detector thresholds). Timeout increased from 15s to 20s per action. `app/intake/preparation/page.tsx`, `app/lib/actions/actionDetector.ts` |
| R56 | **Speech recognition instant "no match" on other devices/Chrome tabs** | Two issues: (1) `onerror` treated transient errors as fatal. Fix: only `"not-allowed"` is fatal now. (2) `onend` had a retry limit of 5 (×200ms = 1s) which expired before the 8s hard timeout, causing premature "missed". Fix: `onend` now restarts indefinitely with no retry limit — ONLY the hard `setTimeout` (8s) can mark "missed". Applied to all 3 audio pages. `app/intake/communication/page.tsx`, `app/kid-dashboard/speech/page.tsx`, `app/intake/audio/page.tsx` |
| R57 | **Word Echo mic visualizer blocks SpeechRecognition on some devices** | `getUserMedia` stream + `AudioContext` + `AnalyserNode` monopolized the mic hardware on some Chrome builds, causing SpeechRecognition to receive zero audio (visualizer bars moved but "Heard:" transcript never appeared). Fix: removed `getUserMedia` stream entirely — mic stream is released before `recognition.start()`. Replaced real-time MicVisualizer with CSS-animated bars during listening state. SpeechRecognition now has exclusive mic access. `app/intake/communication/page.tsx` |
| R58 | **Speech recognition debug + sensitivity patch** | SpeechRecognition `onresult` never fires on some devices despite mic activity. Fix: (1) Restored original `getUserMedia`-based MicVisualizer (real audio bars, not CSS) for visual feedback. (2) Added temporary debug panel showing all SpeechRecognition events in real-time: `onstart`, `onaudiostart`, `onsoundstart`, `onspeechstart`, `onresult`, `onerror`, `onend` — with timestamps. (3) Made word matching much more sensitive: checks interim results (not just `isFinal`), checks all alternatives across all results, fuzzy matching with edit distance ≤1 and prefix matching. (4) Increased hard timeout from 8s to 10s. `app/intake/communication/page.tsx` |

---

## Changelog

### v1.0.0 — 2026-03-03 (Initial Release)

**Added:**
- Complete 12-step autism screening intake flow
- Real-time ONNX behavioral video analysis (YOLO + TCN + FER+)
- Amazon Bedrock AI report generation (Nova Lite summaries + Nova Pro clinical reports)
- PDF report download with scores and clinical text
- Amazon Polly text-to-speech for child-facing prompts
- Google OAuth 2.0 authentication with DynamoDB sessions
- Dashboard with session history, Recharts charts, and child profiles
- 7 adaptive therapy games with difficulty engine
- Anonymous community feed with category filters and reactions
- Offline-first IndexedDB storage (Dexie v3)
- Light/dark theme toggle
- AWS infrastructure: DynamoDB (7 tables), S3, Bedrock, Polly, Amplify
- $10/month budget alarm with email notifications
- 30 Playwright tests (all passing)
- COOP/COEP headers for SharedArrayBuffer (ONNX WASM threading)

**Deployment:**
- Live at https://main.d2n7pu2vtgi8yc.amplifyapp.com
- Auto-deploy from GitHub `main` branch
- Amplify service role for production AWS access

### v1.1.0 — 2026-03-03 (Bug Fixes & Production Hardening)

**Fixed:**
- ONNX Runtime worker loading on mobile/some browsers (CDN WASM paths, mobile WebGPU skip)
- Mobile layout overflow (responsive breakpoints at 768px/480px, safe-area padding)
- Mic retry buttons on communication/audio/device-check pages
- PDF report quality (visual score bars, risk indicators, page numbers, professional layout)
- Removed "AI-generated" references from reports and UI (now "computer-assisted")
- ESLint CI failures with React 19 strict rules (hooks ordering, ref patterns, config overrides)
- **Amplify SSR env vars** — inlined via `next.config.ts` `env` (Amplify doesn't inject into Lambda runtime)
- **Google OAuth on deployed site** — caused by missing env vars in Lambda
- **AWS SDK credential handling** — removed explicit credentials, using IAM role auto-detection

**Added:**
- Auth-aware homepage navigation (sign in button, dashboard links, user chip)
- Game improvements (animations, sound effects, progressive difficulty, explanations)
- Comprehensive deployment documentation (SETUP_GUIDE.md)

**Infrastructure:**
- Environment variables set at both app-level and branch-level in Amplify
- Build-time env var inlining prevents future runtime env var issues

### v1.2.0 — 2026-03-03 (Metrics, Consent, PDF & Camera Fixes)

**Fixed:**
- Camera "play() interrupted by a new load request" error — `AbortError` caught gracefully when autoPlay conflicts with explicit `play()`
- PDF "=======" separator lines — clinical report now uses `---`, PDF renderer converts separator lines to graphical dividers
- Video heading changed from "AI behavioral screening" to "Behavioral screening" (matches test and removes AI language)

**Improved:**
- **Extended biomarker collection**: Video analysis (Stage 10) now saves full inference data every 5 seconds during the 2-minute assessment — asdRiskScore, body behavior class, face behavior class, body/face probabilities (6+4 arrays), FER+ emotion distribution (8 values), in addition to core gaze/motor/vocal scores
- **PDF report redesign**: Letter grading system (A+ to F), score distribution pie chart, AutiSense leaf logo in header, grading scale legend, grade circles per score, confidential watermark in footer, improved risk level badge with colored background box
- **Data consent**: Checkbox at Stage 10 completion — "Save anonymised results to cloud" — user can opt out to keep results local-only. Summary page (Stage 11) respects preference

**Added:**
- `addBiomarker` now accepts extended fields: `asdRiskScore`, `bodyBehaviorClass`, `faceBehaviorClass`, `bodyProbabilities`, `faceProbabilities`, `emotionDistribution`
- Periodic biomarker snapshots during video assessment (every 5s)
- Sample counter during video analysis ("X samples collected")
- `localStorage` consent flag (`autisense-sync-consent`) to persist consent across pages

### v1.3.0 — 2026-03-04 (AI Voice Agent for Step 7)

**Major Change:**
- **Step 7 replaced with dynamic AI voice conversation**: The static 5-instruction "Follow Instructions" page has been replaced with a fully adaptive voice agent that talks directly to the child using Amazon Nova Lite (Bedrock) for conversation generation, Amazon Polly for text-to-speech, and Web Speech API for listening to the child's responses. The agent asks age-appropriate questions across social, cognitive, language, and motor domains, adapting difficulty based on the child's responses.

**New:**
- `POST /api/chat/conversation` endpoint — sends conversation history to Bedrock Nova Lite, returns structured JSON with the agent's next response, turn metadata (domain, turn type, response relevance), and conversation flow control
- Pre-defined 7-turn fallback conversation used when Bedrock is unavailable — ensures the feature works offline
- Per-turn biomarker collection: response latency (TTS end → first speech), response engagement (did child respond?), response relevance (LLM-estimated 0-1 score), developmental domain per turn
- Richer biomarker mapping: `gazeScore` → avg comprehension/relevance, `motorScore` → motor instruction compliance, `vocalizationScore` → verbal response rate, `responseLatencyMs` → avg across turns
- Session-aware personalization: agent greets child by name and adjusts language complexity based on age (loaded from IndexedDB session data)

**Architecture:**
- Polly TTS with browser SpeechSynthesis fallback chain (Polly → browser → text display)
- Web Speech API with manual parent button fallback (for browsers without speech recognition)
- Conversation state machine: `pre_start → loading → speaking → listening → processing → complete`
- Hard cap at 8 turns; "End Early" button available throughout
- Error recovery: "Try Again" or "Skip Step" on failure

**Files:**
- Created: `app/api/chat/conversation/route.ts`
- Rewritten: `app/intake/preparation/page.tsx`
- Updated: `tests/intake-flow.spec.ts` (Step 7 test assertions)
- Updated: `DOCS.md` (R11 resolved issue, architecture, API table, changelog)

### v1.3.1 — 2026-03-04 (CI Fix — AWS Region Handling)

**Fixed:**
- **CI Playwright test failures**: 3 API route tests (summary, clinical, TTS) failed on GitHub Actions because `next.config.ts` inlines env vars as empty strings on CI (no `.env.local`). Nullish coalescing (`??`) doesn't catch empty strings — changed to logical OR (`||`) in all 4 AWS API routes so empty string defaults to the correct region.
- **Uncaught AWS SDK errors**: `getBedrockClient()`/`getPollyClient()` was called outside try/catch in POST handlers. Moved client creation inside try/catch so region/credential errors trigger graceful fallback instead of 500 crashes.
- **TTS error status**: Changed error response from 500 → 503 (Service Unavailable) when Polly synthesis fails, matching test expectations and HTTP semantics.

**Files:**
- Fixed: `app/api/report/summary/route.ts` (`??` → `||`, client inside try/catch)
- Fixed: `app/api/report/clinical/route.ts` (`??` → `||`, client inside try/catch)
- Fixed: `app/api/tts/route.ts` (`??` → `||`, client inside try/catch, 500 → 503)
- Fixed: `app/api/chat/conversation/route.ts` (`??` → `||`, client inside try/catch)

### v1.4.0 — 2026-03-04 (Camera Action Verification + Worker URL Fix)

**Major Change:**
- **Step 7 motor action verification via YOLO camera**: Motor instruction turns now activate the camera and use the existing YOLO26n-pose model to detect whether the child actually performed the requested action (wave, touch nose, clap, raise arms, touch head, touch ears). Rule-based ActionDetector analyzes 17 COCO keypoints with body-scale-normalized distance thresholds. ActionTracker requires 5 consecutive positive frames to confirm detection, preventing false positives.

**New:**
- `app/lib/actions/actionDetector.ts` — Pure rule-based action detection from YOLO keypoints: 6 actions with geometry rules, `ActionTracker` class for sustained detection, `ACTION_META` map for UI labels/emoji
- `app/hooks/useActionCamera.ts` — Camera + YOLO inference + action detection hook: manages getUserMedia, inference worker (body-only mode), requestAnimationFrame loop, skeleton overlay drawing, ActionTracker integration
- New `"verifying"` phase in Step 7 state machine: camera feed shown with COCO-17 skeleton overlay, detection progress bar, 15-second timeout with skip option
- Domain emoji headers in agent text display (social, cognitive, language, motor, general)
- `action` field added to conversation API TurnMetadata — LLM includes action ID for motor turns

**Fixed:**
- **Stage 10 ONNX worker URL parse error**: Model paths in `PipelineOrchestrator.ts` and `MultimodalOrchestrator.ts` changed from relative (`/models/...`) to absolute (`${self.location.origin}/models/...`) — resolves correctly in Web Worker scope

**Files:**
- Created: `app/lib/actions/actionDetector.ts`
- Created: `app/hooks/useActionCamera.ts`
- Rewritten: `app/intake/preparation/page.tsx` (camera verification integration)
- Updated: `app/api/chat/conversation/route.ts` (action field in metadata)
- Fixed: `app/lib/inference/PipelineOrchestrator.ts` (absolute model URLs)
- Fixed: `app/lib/inference/MultimodalOrchestrator.ts` (absolute model URLs)

### v1.5.0 — 2026-03-04 (Stage Differentiation, Dynamic Content, Mobile Camera, Criteria Gates)

**Major Changes:**
- **Stage 4 → Word Echo**: Dynamic LLM-generated (Bedrock Nova Lite) age-appropriate words spoken via Polly TTS. Child echoes back, matched via Web Speech API. 6 words per session from age-stratified pools (18-36mo, 36-60mo, 60+mo). Falls back to curated word pools when Bedrock unavailable.
- **Stage 7 → Action Challenge**: Pure motor action test — fixed sequence of 6 actions (wave, touch nose, clap, raise arms, touch head, touch ears). Camera + YOLO pose detection with **live feedback**: confidence bar, color-coded camera border (red/blue/green), 5-dot frame counter showing consecutive detection progress, contextual status text ("Step into view", "Getting closer!", "Almost there!"). No LLM/TTS/STT — purely visual.
- **Stage 9 → Speech & Comprehension**: Two-part test. Part A: 4 LLM-generated sentences with word-overlap matching (threshold 0.4). Part B: 3 audio instructions testing comprehension (any verbal response = engaged). Both spoken via Polly TTS.

**New:**
- `POST /api/chat/generate-words` — Shared endpoint for dynamic content generation. Modes: `words`, `sentences`, `instructions`. Falls back to curated age-stratified pools (20 words, 6 sentences, 5 instructions per bracket).
- `app/lib/camera/cameraUtils.ts` — Shared camera utility: 3-tier progressive `getUserMedia` constraint negotiation (ideal 320×240 → facingMode only → any camera). HTTPS early check. Specific error messages per DOMException type.
- `consecutiveHits` exposed from ActionTracker and useActionCamera hook for real-time frame progress display.

**Fixed:**
- **Mobile camera failures**: Progressive constraint fallback handles devices that can't satisfy resolution constraints. HTTPS check prevents silent failures on mobile HTTP. Specific error messages for NotFoundError, NotReadableError, OverconstrainedError, SecurityError. Retry Camera + Skip buttons added to Stage 10.
- **Stages auto-advance without verification**: Minimum criteria gates added — Stage 4 (2/6 words), Stage 7 (3/6 actions), Stage 9 (2/7 items), Stage 10 (5 samples + 30s). Shows retry/skip menu when criteria not met.

**Files:**
- Created: `app/api/chat/generate-words/route.ts`
- Created: `app/lib/camera/cameraUtils.ts`
- Rewritten: `app/intake/communication/page.tsx` (Word Echo)
- Rewritten: `app/intake/preparation/page.tsx` (Action Challenge)
- Rewritten: `app/intake/audio/page.tsx` (Speech & Comprehension)
- Updated: `app/intake/video-capture/page.tsx` (mobile camera + criteria gate)
- Updated: `app/hooks/useActionCamera.ts` (consecutiveHits + cameraUtils)
- Updated: `app/lib/actions/actionDetector.ts` (consecutiveHits in tracker return)
- Updated: `tests/intake-flow.spec.ts` (Step 4, 7, 9 test assertions)
- Updated: `tests/app-pages.spec.ts` (generate-words API test)

### v1.6.0 — 2026-03-05 (10-Step Flow, Age Scoring, Skip Buttons, Camera Fixes)

**Major Changes:**
- **Streamlined to 10-step flow**: Archived Visual Engagement (emoji tap) and Audio Assessment (sentence echo) stages. Navigation rewired to skip them — files preserved for potential future use.
- **Age-grouped scoring**: New `ageNormalization.ts` with 4 age brackets (12-24mo, 24-48mo, 48-72mo, 72+mo). Younger children get relaxed multipliers (e.g., 12-24mo: gaze×1.4, motor×1.5, vocal×1.6) and lower DSM-5 flag thresholds. A neurotypical child now scores ~93-100% instead of ~72%.
- **Domain-aware aggregation**: Each task only contributes to domains it actually measures (e.g., communication → vocal only, motor → motor only). Hardcoded 0.5 placeholders no longer drag down unrelated domain scores. Default 0.75 for unmeasured domains.
- **Skip Stage on all assessments**: New `SkipStageDialog` component added to all 5 assessment stages (communication, behavioral-observation, preparation, motor, video-capture). Shows confirmation modal before skipping. Saves default 0.5 biomarkers on skip.

**Fixed:**
- **Stage 7 camera not showing on desktop or mobile**: Video element was only rendered during `actionPhase === "detecting"` but camera stream was assigned during countdown when element didn't exist. Now renders camera during all active phases (countdown + detecting + detected) with countdown overlay on top.
- **Stage 10 mobile camera hanging**: Added 10-second timeout wrapper (`withTimeout()`) to all `getUserMedia()` calls in `cameraUtils.ts`. Prevents indefinite hanging when mobile browsers stall on camera permission.
- **Stream re-attach on DOM mount**: Defensive `useEffect` in `useActionCamera.ts` re-attaches stream when video element appears in DOM (catches ref timing issues).

**Improved:**
- **All timed assessments reduced to 30 seconds**: Behavioral observation (was 60s), motor assessment (was 45s), and video capture (was 120s) all now run for 30 seconds. Video capture criteria gate lowered to 3 samples / 15s (was 5 samples / 30s).
- **Live transcript in communication stage**: Transcript display moved outside `listening` state — now visible during listening/matched/missed. Larger font (1.4rem Fredoka) with "Heard:" label and pulse animation during active listening.

**Files:**
- Created: `app/lib/scoring/ageNormalization.ts` (age groups, multipliers, thresholds)
- Created: `app/components/SkipStageDialog.tsx` (shared skip confirmation)
- Modified: `app/lib/camera/cameraUtils.ts` (10s timeout wrapper)
- Modified: `app/hooks/useActionCamera.ts` (stream re-attach effect)
- Modified: `app/lib/db/biomarker.repository.ts` (domain-aware + age-normalized aggregation)
- Modified: All 10 active intake pages (STEPS array, step counts, navigation links, skip buttons)
- Updated: `tests/intake-flow.spec.ts` (10-step flow, skip button tests)
- Updated: `DOCS.md` (v1.6.0 changelog, 10-step flow docs)

### v1.6.1 — 2026-03-05 (Video Capture Camera Fix)

**Fixed:**
- **Stage 8 (Video Capture) camera stuck on "Requesting camera..."**: Root cause was a race condition — `startCamera()` obtained the MediaStream but `videoRef.current` was `null` because `DetectorVideoCanvas` (containing the `<video>` element) only renders after `setStarted(true)`, which runs after `startCamera()` returns. `setCamReady(true)` was inside `if (video)` block and never called. Fixed by:
  1. Moving `setCamReady(true)` outside the `if (video)` block — camera is marked ready once the stream is obtained, regardless of whether the video DOM element exists yet.
  2. Added 200ms interval re-attach effect (same pattern as `useActionCamera.ts`) that connects the stream to the video element when it appears in the DOM after React render.
- **Description text still said "2 minutes"**: Updated to "30 seconds" to match the actual `ASSESSMENT_SECONDS = 30` setting.

**Issues Log:**
- Camera race condition was specific to `video-capture/page.tsx` because it uses `useDetectorInference` directly (not `useActionCamera` which already had the re-attach pattern).
- The preparation page (Stage 6) never had this issue because `useActionCamera.ts` already polls every 300ms to re-attach lost streams.
- Desktop and mobile both affected — the `<video>` element mounting timing is the same regardless of platform.

**Files:**
- Modified: `app/intake/video-capture/page.tsx` (setCamReady moved, stream re-attach effect, description text fix)

### v1.6.2 — 2026-03-05 (Action Detection Tuning, Behavior Label Fix)

**Fixed:**
- **Stage 6 (Action Challenge) hypersensitive detection**: Actions were confirming too quickly (~0.5s) due to low `REQUIRED_CONSECUTIVE` (8) and slow decay (-1 per miss). False positives from YOLO keypoint noise accumulated faster than they decayed.
  - `REQUIRED_CONSECUTIVE`: 8 → 12 (~0.8s sustained detection at 15fps)
  - Decay on miss: -1 → -2 (noise drops out faster)
  - Added confidence gate: only count hits with confidence > 0.4
  - Tightened clap threshold: 0.4×scale → 0.3×scale
  - Tightened touch_head threshold: 0.3×scale → 0.25×scale (less overlap with touch_nose)
- **Stage 8 (Video Capture) "Hand Flapping" always shown as behavior label**: The body TCN model is biased toward hand_flapping (F1: 0.68) due to training data class imbalance (non_autistic F1 only 0.33). The video overlay now recomputes the display label from actual probabilities:
  - When P(non_autistic) > 50%: shows "Normal Activity" with a green badge
  - Otherwise: shows the highest ASD-related behavior class (indices 0-4)
  - Eliminates frame-mismatch display inconsistencies

**Training Model Notes (from `Autism_code/` analysis):**
- Body TCN best F1: 0.384 (macro-averaged, 6 classes)
- Classes 2 (head_banging) and 4 (toe_walking): 0.0 F1 — zero validation samples
- Class 0 (hand_flapping): 0.68 F1 — strongest, causes bias
- Class 5 (non_autistic): 0.33 F1 — weak recognition
- Long-term fix: retrain with balanced data. Current UI-side fix handles the display bias.

**CI Playwright Warnings (NOT a bug):**
- `CredentialsProviderError` messages in CI logs are expected — CI lacks AWS credentials. Bedrock/Polly APIs fail gracefully and tests verify fallback/mock responses. All 31 tests pass.

**Files:**
- Modified: `app/lib/actions/actionDetector.ts` (REQUIRED_CONSECUTIVE 12, decay -2, confidence gate, tighter thresholds)
- Modified: `app/intake/preparation/page.tsx` (12-dot counter, status text thresholds)
- Modified: `app/components/DetectorVideoCanvas.tsx` (behavior label recomputed from probs, "Normal Activity" display)

### v2.0.0 — 2026-03-05 (Kids Dashboard + Major Feature Expansion)

**New Features — Kids Dashboard (`/kid-dashboard`):**

A complete kids-facing dashboard with bottom tab navigation, daily games, AI chat, progress tracking, weekly reports, and a nearby institutes map. The existing 10-step screening flow is completely untouched.

**Phase 1: Foundation**
- 4 new IndexedDB tables: `gameActivity`, `streaks`, `weeklyReports`, `chatHistory` (Dexie v4)
- Repository layer: `gameActivity.repository.ts`, `streak.repository.ts`
- Type definitions: `app/types/gameActivity.ts`
- Kid dashboard shell: `/kid-dashboard` with bottom tab nav (Home, Games, Chat, Progress, Map)
- Components: `BottomNav.tsx`, `StreakBadge.tsx`
- Landing page + parent dashboard updated with Kids Dashboard links

**Phase 2: New Games (6)**
- Bubble Pop (`/kid-dashboard/games/bubble-pop`) — Tap floating bubbles matching prompts
- Alphabet Pattern (`/kid-dashboard/games/alphabet-pattern`) — Fill missing letters in sequences
- Basic Tracing (`/kid-dashboard/games/tracing`) — Trace shapes/letters on HTML Canvas
- Match Numbers (`/kid-dashboard/games/match-numbers`) — Match numerals to dot quantities
- Memory Game (`/kid-dashboard/games/memory`) — Classic flip-card pair matching
- Social Stories V2 (`/kid-dashboard/games/social-stories-v2`) — Kid-friendly social scenarios
- All games use adaptive difficulty engine, save to `gameActivity` table, update streaks
- Games hub (`/kid-dashboard/games`) showing all 13 games (6 new + 7 existing)

**Phase 3: Speech, Talking, Doctor Connect**
- Speech Practice (`/kid-dashboard/speech`) — Word prompts via Polly TTS + Web Speech API recognition
- One-to-One Talking (`/kid-dashboard/talking`) — Guided AI conversation with audio mode
- Doctor Connect (`/kid-dashboard/doctor-connect`) — Hardcoded specialist directory with call links
- Static doctor data: `app/lib/data/doctors.ts`

**Phase 4: AI Chat with Animated Animals**
- Chat page (`/kid-dashboard/chat`) — Select animal avatar (dog/cat/rabbit/parrot) + gender
- SVG animal avatars with CSS animations: idle, talking, happy, thinking states
- Text + audio chat modes via `/api/chat/conversation` + `/api/tts`
- Animal personality system: each animal has unique speech patterns
- Modified `/api/chat/conversation/route.ts` to accept `animalPersonality` parameter
- Conversations saved to `chatHistory` table
- Component: `AnimalAvatar.tsx`

**Phase 5: Streak + Progress Tracking**
- Streak system: consecutive daily play tracking with motivational messages
- Progress page (`/kid-dashboard/progress`) — Three tabs: Today, This Week, All Time
- Daily: games played, avg score, time spent with activity list
- Weekly: 7-day heatmap, per-game breakdown bars
- All Time: total games, best/current streak, favorite game, 4-week trend

**Phase 6: Weekly Reports**
- Report generator: `app/lib/reports/weeklyReport.ts` — kid + parent HTML versions
- API: `POST /api/report/weekly` (generate + save), `GET /api/report/weekly?childId=` (list)
- Reports page (`/kid-dashboard/reports`) — Generate, view (kid/parent toggle), list history
- Kid version: colorful, emoji-heavy, encouraging
- Parent version: detailed tables, trends, recommendations

**Phase 7: Nearby Institutes Map**
- Map page (`/kid-dashboard/map`) — Leaflet.js + OpenStreetMap (graceful fallback to list view)
- 50+ autism institutes across 12 Indian cities (Delhi, Mumbai, Bangalore, Chennai, etc.)
- 4 categories: Hospital, Therapy Center, Special School, Support Group (color-coded)
- Search by name/city, category filters, "Near Me" geolocation with distance sorting
- Static data: `app/lib/data/institutes.ts`

**New Files (27):**
- Types: `app/types/gameActivity.ts`
- DB: `app/lib/db/gameActivity.repository.ts`, `app/lib/db/streak.repository.ts`
- Layout: `app/kid-dashboard/layout.tsx`
- Pages: `app/kid-dashboard/page.tsx`, `app/kid-dashboard/games/page.tsx`, 6 game pages, `speech/page.tsx`, `talking/page.tsx`, `doctor-connect/page.tsx`, `chat/page.tsx`, `progress/page.tsx`, `reports/page.tsx`, `map/page.tsx`
- Components: `app/components/BottomNav.tsx`, `app/components/StreakBadge.tsx`, `app/components/AnimalAvatar.tsx`
- Data: `app/lib/data/doctors.ts`, `app/lib/data/institutes.ts`
- Reports: `app/lib/reports/weeklyReport.ts`
- API: `app/api/report/weekly/route.ts`

**Modified Files (4):**
- `app/lib/db/schema.ts` — v4 migration with 4 new tables
- `app/api/chat/conversation/route.ts` — animalPersonality support
- `app/page.tsx` — Kids Dashboard CTA card
- `app/dashboard/page.tsx` — Kids Dashboard quick link

**Unchanged:** All 10 intake pages, all inference code, all 7 existing games, auth system, existing components.

**Testing:** 31/31 Playwright tests pass. TypeScript clean. Build clean.

### v2.1.0 — 2026-03-05 (Bug Fix & Polish)

**New Components:**
- `UserMenu.tsx` — top-right user menu with logout (replaces inline logout buttons)
- `ThemeToggle.tsx` — light/dark toggle with Sun/Moon Lucide icons
- `LeafletMap.tsx` — dynamic-import interactive map component (no SSR)
- `app/lib/audio/ttsHelper.ts` — unified TTS helper (Polly → browser speechSynthesis fallback)

**UI/UX Improvements:**
- Increased base font to 17px across all pages
- BottomNav: Lucide icons, rounded top corners, max-width 600px
- Dashboard: quick links with Lucide icons, 4 recent/default game cards instead of 12-game grid
- UserMenu added to kid-dashboard layout, landing page, and parent dashboard

**Nearby Help Overhaul:**
- Replaced static doctor directory with live Overpass API integration
- New API route: `GET /api/nearby` (proxies Overpass queries)
- Leaflet map with category-colored markers (Hospital, Therapy Center, Special School, Support Group)
- "Near Me" geolocation with distance sorting
- Renamed route: `/kid-dashboard/doctor-connect` → `/kid-dashboard/nearby-help` (redirect added)

**Chat Fixes:**
- Gender toggle removed (simplified to animal avatars only)
- Added fallback mode indicator when Bedrock unavailable
- Integrated `speakText` TTS helper for audio responses
- Mic permission check with user-friendly error UI

**Game Fixes:**
- Speech: Fixed word fetch bug (`data.items` not `data.words`), auto-play audio, minimum 3 words
- Color & Sound: Persistent AudioContext (no re-creation), TTS voice cue after tone
- Bubble Pop: Guaranteed target letter in spawns, no blank screen, larger target display
- Memory: Capped at 3×3 grid (4 pairs max)

**Detection:**
- Elapsed timer mode (removed 60-minute countdown hack)

**Total API Routes:** 15 (added `/api/nearby`)

**Files:** 20+ files modified across components, pages, lib, and API routes.

### v2.1.1 — 2026-03-06 (Mobile UI Fixes, Emotion Quiz, Feed Redesign)

**8 issues fixed from mobile testing:**

1. **UserMenu dropdown overlap** — Added semi-transparent backdrop overlay behind dropdown for visual separation on mobile. Clicking backdrop closes menu.
   - `app/components/UserMenu.tsx`

2. **Emotion Match → Emotion Quiz** — Replaced card-flip matching game (identical to Memory game) with scenario-based Emotion Quiz. 20 scenarios, 5 emotion choices (Happy, Sad, Angry, Scared, Surprised), adaptive difficulty, sound feedback. Now correctly saves game activity + updates streak.
   - `app/games/emotion-match/page.tsx` (full rewrite)
   - `app/kid-dashboard/games/page.tsx` (updated description)
   - `app/kid-dashboard/page.tsx` (updated card emoji/title)

3. **Streak not updating** — Fixed childId mismatch: dashboard used `""` fallback but games used `"default"`. Changed dashboard fallback to `"default"`.
   - `app/kid-dashboard/page.tsx`

4. **Chat mic + viewport + input reorder**:
   - Added `viewport` export in layout.tsx to prevent mobile zoom on input focus
   - Fixed SpeechRecognition: cleanup old instance before new one, 120ms delay for mic release, nullify ref on callbacks, cleanup on unmount
   - Reordered input bar: mic button first (64px, primary green), text input secondary
   - `app/kid-dashboard/chat/page.tsx`, `app/layout.tsx`

5. **Progress page** — Verified childId already uses `"default"` fallback; no change needed.

6. **BottomNav/navbar overlap** — Resolved by Fix 1 (backdrop overlay).

7. **Community Feed redesign**:
   - Posts displayed first, compose form behind "New Post" button + floating action button (FAB)
   - Per-user reaction tracking via new `feedReactions` IndexedDB table (schema v5)
   - Reactions toggle on/off per user (filled/unfilled state)
   - Delete own posts with reaction cleanup
   - Cleaner card layout, category pills, empty state
   - `app/feed/page.tsx` (full rewrite), `app/lib/db/feed.repository.ts`, `app/lib/db/schema.ts`, `app/types/feedPost.ts`

**Files modified:** 11 files across components, games, pages, DB layer, and types.
**Testing:** TypeScript clean. ESLint clean. Build clean.

### v2.4.0 — 2026-03-06 (Bedrock Optimization — Hybrid Clinical Reports)

**Clinical Report Optimization:**
- Replaced full-prose LLM prompt with hybrid template + AI insights approach
- Deterministic template (`buildTemplateReport`) generates the complete report with scores, thresholds, flags, and disclaimers
- Nova Pro now returns only a small structured JSON with clinical interpretations (severity level, DSM-5 criterion mappings, clinical impression, priority recommendations, differential considerations)
- `mergeAiInsights()` enriches the template sections with AI clinical depth
- ~85% token reduction per clinical report (~400 tokens vs ~2700 previously)
- `maxTokens` reduced from 2048 to 512
- Fallback preserved: if Bedrock fails or JSON unparseable, returns template-only report

**Bedrock Model Updates:**
- Replaced Cohere Command R+ with Amazon Nova Pro for clinical reports (v2.3.0)
- Fixed `maxNewTokens` → `maxTokens` in generate-words route (v2.3.0)
- Updated all documentation references from Cohere to Nova Pro

**Files modified:** `app/api/report/clinical/route.ts`, `docs/DOCS.md`, `docs/SETUP_GUIDE.md`, `docs/Amazon_usage.md`

### v2.4.1 — 2026-03-06 (Mobile UI Fixes + Report Generation Indicators)

**Mobile UI Fixes (tested on Nothing Phone 3a Pro + Samsung):**
- **UserMenu dropdown unclickable**: CSS stacking context from `.page > *` rule isolated nav's z-index. Added `position: relative; z-index: 10` to `.nav`.
- **Dashboard cards behind BottomNav**: Increased `.main` bottom padding from 24px to 80px for BottomNav clearance.
- **Chat Home button too large**: Reduced button dimensions for mobile viewports.
- **BottomNav icons touching edge**: Changed `height: 64` to `minHeight: 64` with `paddingBottom: max(8px, env(safe-area-inset-bottom, 8px))` for gesture bar clearance.
- **Top navbar cramped**: Added `min-height: 64px`, fixed safe-area override from `max(12px, ...)` to `max(20px, ...)`.

**Report Generation Indicators:**
- Added `aiEnriched: boolean` field to `/api/report/clinical` response (3 paths: AI success -> true, parse failure -> false, Bedrock error -> false)
- Added `fallback: boolean` field to `/api/report/summary` response (Bedrock success -> false, error -> true)
- Report page now shows status badges:
  - Green: "AI-Enriched (Nova Pro)" when Bedrock succeeds
  - Amber: "Template Only -- AI unavailable" when Bedrock fails
  - Amber: "No screening data -- using placeholder values" when no real biomarker data exists
- Playwright tests confirmed Nova Pro and Nova Lite are both active on production

**Files modified:**
- `app/globals.css` (nav z-index, min-height, safe-area padding)
- `app/kid-dashboard/page.tsx` (bottom padding 80px)
- `app/kid-dashboard/chat/page.tsx` (Home button sizing)
- `app/components/BottomNav.tsx` (minHeight + gesture bar padding)
- `app/api/report/clinical/route.ts` (aiEnriched boolean)
- `app/api/report/summary/route.ts` (fallback boolean)
- `app/intake/report/page.tsx` (AI status badges + fallback warning)

**Commits:** `6c36e99`, `78bc739`, `6e1500f`, `9787c2f`, `1788d1f`, `d22c272`

### v2.7.1 — 2026-03-07 (Navbar Logo on All Pages)

**Navbar — logo image on all pages:**
- Added circular `logo.svg` image (user's custom logo) to the left of "AutiSense" text in every navbar
- Updated `NavLogo.tsx` shared component (used by ~24 pages) and 14 inline navbar instances
- Logo displays as 44px circle with `border-radius: 50%` and subtle border
- Dark mode compatible: border color switches via `[data-theme="dark"]`
- `text-decoration: none` on `.logo` removes underline on desktop
- Mobile navbar responsive: `overflow: hidden`, smaller padding, smaller font on `<768px`
- Footer logo in `page.tsx` uses smaller 28px variant

**Files changed:**
- `app/components/NavLogo.tsx` — added `<img src="/logo.svg" className="logo-icon" />`
- 8 intake pages (audio, behavioral-observation, communication, motor, preparation, report, video-capture, visual-engagement) — single-line logo update
- 4 intake pages (child-profile, device-check, profile, summary) — multiline logo update
- `app/auth/login/page.tsx` — 2 navbar instances (Link + span)
- `app/page.tsx` — footer span logo
- `app/globals.css` — `.logo` flex layout, `.logo-icon` circle styling, responsive rules (already done in v2.7.0)

### v2.7.0 — 2026-03-07 (Detection UI, Face Pipeline Fix, Body Noise Gate)

**UI — Detection page layout overhaul:**
- Wrapped camera feed, elapsed timer, stop button, and backend info in a white card container
- Moved "Backend: webgpu · Latency: XXms" from results panel to below stop button inside camera card
- Removed `isModelLoaded`/`backend` props from `DetectorResultsPanel`
- Camera column: fixed 480px on desktop (previously 420px, briefly 1fr 1fr)
- Overall layout max-width increased from 1200px to 1400px for wider body/face cards
- Body Behavior + Face Analysis cards stack vertically on mobile (`<768px`), side-by-side on desktop (new `.detector-behavior-grid` CSS class)
- Face Analysis shows "Warming up face model..." text during the ~6s Face-TCN ring buffer warmup (64 frames × 3 skip rate)

**Face Pipeline — Critical crash fix + sensitivity rebalancing:**
- **Bug 1 — Face never goes live**: In "both" mode, `bodyResult!.bbox!` crashed silently in the Web Worker when YOLO didn't detect a person (bbox undefined). The entire face pipeline would fail and never recover. **Fix**: Guard `bodyResult?.bbox` with fallback to center-of-frame extraction when no person bbox is available.
- **Bug 2 — Face ROI null at frame edges**: `FaceDetector.extractFaceROI()` returned `null` when the computed face region had negative coordinates (person partially off-screen). **Fix**: Clamp coordinates to frame bounds instead of rejecting.
- **Bug 3 — 88% flat_affect regardless of expression**: Face-TCN expects 64-dim features from FER+ emotions (8) + MediaPipe blendshapes (52) + landmarks (956). But **MediaPipe is not integrated at inference** — blendshapes and landmarks are passed as all-zeros (`new Float32Array(52)`, `new Float32Array(956)` in `MultimodalOrchestrator.processFaceROI()`). This means 56/64 features are zero/garbage, causing the model to always output ~88% flat_affect.
- **Fix**: Added `rebalanceFaceProbs()` post-processor that uses FER+ emotions (the only valid input) to correct Face-TCN outputs:
  - Temperature scaling (T=0.5) sharpens the softmax distribution
  - If FER+ detects non-neutral emotion > 15%, transfers probability from flat_affect → typical_expression
  - Caps flat_affect at 60% to prevent display domination
  - Re-normalizes to sum to 1.0
- Always uses "both" modality (body + face) on all devices — previously mobile used face-only mode with no COCO keypoints visible

**Body Analysis — Camera shake noise gate:**
- Added 5% noise floor: body behavior classes below 5% probability are zeroed and redistributed to non_autistic
- Eliminates false ~12% hand_flapping from minor camera shake when sitting still

**Preparation page:**
- Removed "Show Debug" button and all associated debug state/imports from `/intake/preparation`

**Files changed:**
- `app/components/DetectorResultsPanel.tsx` — removed backend info, cleaned props, responsive grid, face warmup text
- `app/kid-dashboard/detection/page.tsx` — camera card wrapper, backend info, always "both" modality
- `app/intake/video-capture/page.tsx` — updated DetectorResultsPanel props
- `app/intake/preparation/page.tsx` — removed debug panel, state, and imports
- `app/lib/inference/MultimodalOrchestrator.ts` — null bbox guard, center-of-frame fallback, `rebalanceFaceProbs()`, body noise gate
- `app/lib/inference/FaceDetector.ts` — clamp face ROI bounds instead of null return
- `app/globals.css` — camera 480px, max-width 1400px, `.detector-behavior-grid` responsive class

**Commits:** `b69610d`, `1d02b02`, `453f898`

### v2.6.1–v2.6.4 — 2026-03-07 (Action Detection — Complete Overhaul)

Action detection for the Preparation step (Step 7 — Motor) was rebuilt across 4 commits to fix all 4 actions: wave, touch nose, clap hands, raise arms.

**Problem summary**: Three independent bugs made all actions undetectable:
1. **Stale closure** — `startCountdown()` captured old `currentIdx` via closure, so all actions detected as "wave" regardless of which action was active
2. **Coordinate mismatch** — YOLO outputs keypoints in 320x240 pixel space, but detection thresholds were written for normalized 0-1 coordinates
3. **COCO anatomy offset** — COCO-17 wrist keypoints are at the wrist joint, not fingertips; thresholds didn't account for the hand/forearm length gap

**Fix 1 — Stale closure (v2.6.1):**
- Added `currentIdxRef` (React ref) updated synchronously before state `setCurrentIdx()`
- `startCountdown()` reads from `currentIdxRef.current` instead of `currentIdx` state
- Ensures each action countdown targets the correct action

**Fix 2 — Coordinate normalization (v2.6.3):**
- Added `normalizeKeypoints()` function: divides x by 320, y by 240 → 0-1 range
- `detectAction()` normalizes keypoints and history BEFORE dispatching to per-action detectors
- All detection functions now operate in 0-1 space where `bodyScale` ~0.2-0.4
- Eliminates coordinate system ambiguity — thresholds are resolution-independent

**Fix 3 — COCO wrist-joint compensation (v2.6.4):**
- Touch nose/head: `dy > -0.15` allows wrist to be 15% of frame below shoulder line (accounts for wrist-to-fingertip length when touching face)
- Clap: `hitThreshold = 0.28` accounts for forearm width between wrist joints when palms touch

**Final calibrated thresholds (0-1 normalized space):**

| Action | Method | Hit condition | Key threshold |
|--------|--------|---------------|---------------|
| **Wave** | X-variance of wrist over 10 frames | `variance > 0.0008` | Wrist must be above shoulder, lateral motion detected |
| **Touch nose** | Head-region: wrist within shoulder width, near face | `dx < 0.8 && dy > -0.15` | `dx` normalized by shoulder width, `dy` in absolute frame units |
| **Touch head** | Same head-region, slightly more generous | `dx < 1.0 && dy > -0.15` | Wider horizontal tolerance |
| **Clap** | Wrist-to-wrist distance OR single-wrist-at-center | `d < 0.28` (static), `approach > 0.008` (dynamic) | Dynamic approach over 2 frames also triggers |
| **Raise arms** | Wrist above shoulder (either side) + elbow fallback | `diff > 0.02` (2% of frame) | Elbow fallback if wrists not visible |
| **Touch ears** | Wrist-to-ear distance | `d < 0.10` | Normalized distance in 0-1 space |

**General detection parameters:**
- `CONF_GATE = 0.05` — if skeleton is drawn, keypoint passes the gate
- `REQUIRED_CONSECUTIVE = 3` — 3 consecutive hit frames confirms the action (exported for UI use)
- Decay: -1 per missed frame (gentle, doesn't reset to 0)
- Debug: `[ActionDiag]` console logs every 30th frame with all keypoint positions, confidence values, and bodyScale

**UI flicker fix:**
- Replaced `setTimeout`-based status debounce with **frame-count throttle**
- Upgrades ("looking" → "closer" → "almost") apply instantly
- Downgrades apply only every 10th frame (~300ms at 30fps) — no timers, no race conditions
- Dot counter uses imported `REQUIRED_CONSECUTIVE` (3 dots, not hardcoded 5)

**Files modified:**
- `app/lib/actions/actionDetector.ts` — full rewrite: normalization, head-region detection, recalibrated thresholds, diagnostic logging, exported `REQUIRED_CONSECUTIVE`
- `app/intake/preparation/page.tsx` — `currentIdxRef` stale closure fix, frame-count debounce, `REQUIRED_CONSECUTIVE` import for dot display
- `app/hooks/useActionCamera.ts` — unchanged (passes raw pixel keypoints; normalization happens inside `detectAction()`)

**Commits:** `bbf449e`, `d790cda`, `2714a09`, `8bc0458`, `44cbbf3`

### v2.6.0 — 2026-03-07 (Mic Logic, Detection Layout, Bubble Pop, Action Detection)

**Speech Recognition — Cross-Page Consistency (3 pages):**
- Applied working patterns from `communication/page.tsx` (reference, untouched) to 3 other pages
- **Chat page** (`kid-dashboard/chat`): Added `continuous: true`, `interimResults: true`, `maxAlternatives: 3`, 10s hard timeout, restart logic in `onend`, accumulates full transcript across interim results
- **Speech game** (`kid-dashboard/speech`): Added `maxAlternatives: 3`, replaced simple `includes()` with fuzzy matching (edit distance ≤1, prefix, substring), checks all alternatives
- **Audio intake** (`intake/audio`): Added `maxAlternatives: 3`, checks all alternatives for best sentence match

**Detection Page Layout — Complete Restructure:**
- Removed redundant "Elapsed" timer card (already shown below camera)
- Camera column 420px (medium, left), results panel 1fr (right)
- ASD Risk gauge full-width at top of right panel (100px ring)
- Body Behavior + Face Analysis side-by-side below gauge
- Added animated loading skeleton (pulsing placeholder bars) for Face Analysis while model loads
- `main-wide` widened to 1200px

**Social Stories V2 — Dark Mode Fix:**
- Removed hardcoded light color fallbacks: `var(--peach-50, #fff5f0)` → `var(--peach-50)`, `var(--peach-200, #ffcdb2)` → `var(--peach-200)`
- All cards now properly use CSS variables in both light and dark themes

**Bubble Pop Game — Complete Rewrite:**
- Game is now 30-second timed: pop as many rounds as possible
- Each correct pop shows "Nice!/Great!/Awesome!" feedback, then spawns a completely fresh layout with new target
- Bubbles scattered at random (x,y) positions across the play area with 18% minimum spacing overlap prevention
- Glossy bubble styling: inset shadows, translucent border, gentle idle wobble animation
- Scoring: total pops, accuracy %, rounds cleared, average speed per pop
- Timer bar with urgent red flash animation at ≤5s remaining

**Action Detection — Clap & Raise Arms Fix (3 iterations):**
- **Root cause identified**: `detectClap` and `detectRaiseArms` returned `proximity: 0` when conditions weren't fully met — unlike `detectTouchNose` which always returns distance-based proximity. The UI showed "Getting closer!" only when `confidence > 0.1`, but these functions were binary (0 or hit).
- **Iteration 1**: Relaxed confidence gates, OR logic, single-wrist fallback → caused false positives (clap fired on any standing pose, raise fired on slight arm movement)
- **Iteration 2**: Tightened back — both wrists required for clap (0.35×scale), raise margin 0.15×scale, REQUIRED_CONSECUTIVE 6→8 → no false positives but no proximity feedback either
- **Iteration 3 (final)**: Rewrote both functions with **gradual proximity feedback**:
  - `detectClap`: Always returns distance-based proximity (how close hands are, range 1.2×scale). Both-wrists path: static hit at 0.4×scale, dynamic convergence over 3 frames. Single-wrist fallback: center proximity with 0.15×scale threshold for hit.
  - `detectRaiseArms`: Proximity = how high wrist is relative to shoulder (diff/maxRaise), not binary. Hit when wrist ≥0.1×scale above shoulder. Always shows gradual progress as arms rise.
  - Wave: variance threshold lowered 0.015→0.01 (easier to detect)
- `REQUIRED_CONSECUTIVE`: 8 (prevents false positives while allowing genuine actions)
- Preparation page: "Getting closer!" threshold lowered to `confidence > 0.1`

**Files modified:**
- `app/kid-dashboard/chat/page.tsx` — speech recognition overhaul
- `app/kid-dashboard/speech/page.tsx` — fuzzy matching + maxAlternatives
- `app/intake/audio/page.tsx` — maxAlternatives + all alternatives
- `app/kid-dashboard/detection/page.tsx` — grid layout restructure
- `app/components/DetectorResultsPanel.tsx` — removed timer, ASD gauge top, loading skeleton
- `app/globals.css` — video-capture-grid 420px/1fr, main-wide 1200px
- `app/kid-dashboard/games/social-stories-v2/page.tsx` — dark mode color fixes
- `app/kid-dashboard/games/bubble-pop/page.tsx` — complete rewrite (30s timed rounds)
- `app/lib/actions/actionDetector.ts` — gradual proximity for clap/raise, easier wave
- `app/intake/preparation/page.tsx` — 8 dots, lower "closer" threshold

### v2.5.3 — 2026-03-07 (Speech Recognition Fix)

**Word Echo — Detection & Matching:**
- Restored original `getUserMedia`-based MicVisualizer (real audio-reactive bars)
- Made word matching much more sensitive: checks interim results (not just isFinal), all alternatives, fuzzy matching (edit distance ≤1, prefix match)
- Added multi-word support: repeated words like "dog dog" now match correctly (each part matched sequentially)
- Increased hard timeout from 8s to 10s
- Removed temporary debug panel (diagnosis complete — issue was mic coexistence)

**Documentation:**
- Rewrote `docs/Amazon_usage.md` — comprehensive AWS architecture reference with 4 Mermaid diagrams (high-level architecture, Bedrock data flow, auth sequence, screening data flow), full service inventory, all 7 DynamoDB tables with schema, 14 API routes matrix, credentials strategy, environment variables reference, cost estimates

**Files modified:** 3 files (`app/intake/communication/page.tsx`, `docs/Amazon_usage.md`, `docs/DOCS.md`)
**Resolved issues:** R58

### v2.5.2 — 2026-03-07 (Action Detection Fix)

**Action Detection Challenge — Stability & Usability:**
- Fixed negative timer display: tick interval now clamps to 0 and clears before updating state
- Fixed rapid UI flicker: status text ("Looking for...", "Getting closer!", "Almost there!") is debounced with 500ms hold — must be stable before text changes
- Progress dots debounced: only update on significant hit change (≥2 difference or boundary values)
- Reduced detection difficulty: `REQUIRED_CONSECUTIVE` 10→8, miss penalty -2→-1, confidence gate 0.4→0.3
- Increased per-action timeout from 15s to 20s
- Updated dot indicator from 10 to 8 dots to match new threshold

**Speech Recognition — Cross-Device Resilience:**
- `onerror` now only treats `"not-allowed"` as fatal; all other errors (audio-capture, network, service-not-available) are transient
- `onend` retries up to 5 times with 200ms delay, creates fresh SpeechRecognition instance if restart fails
- Initial `recognition.start()` retries once after 500ms on failure
- Applied to Word Echo, Speech Practice, and Audio Intake pages

**Files modified:** 6 files (`app/intake/preparation/page.tsx`, `app/lib/actions/actionDetector.ts`, `app/intake/communication/page.tsx`, `app/kid-dashboard/speech/page.tsx`, `app/intake/audio/page.tsx`, `docs/DOCS.md`)
**Resolved issues:** R55, R56

### v2.5.1 — 2026-03-07 (Community Feed Cross-User, Dashboard Fix)

**Community Feed — Now Shared Across Users:**
- Replaced IndexedDB-only feed with DynamoDB-backed `/api/feed` API route
- Posts, reactions, and deletes now shared across all authenticated users
- Reaction tracking per-post via `reactedBy` map (no separate reactions table needed)
- In-memory fallback for local development without AWS credentials
- DynamoDB table: `autisense-feed-posts` (PK: `id`, PAY_PER_REQUEST)

**Dashboard & Navigation Fixes:**
- Fixed duplicate "AI Chat" in dashboard quick links — restored Community link to `/feed`
- Restored landing page CTA and footer links to `/feed` (was redirected to chat in v2.5.0)

**Progress Page Redesign:**
- Replaced flat list with per-game grouped cards — one card per game with avg score, best score, session count
- Expandable dropdown (chevron) shows individual session details: time, duration, score bar
- Groups sorted by most recently played game
- Applied to both Today and This Week tabs

**Feed API Fix:**
- Fixed DynamoDB key schema mismatch: table uses `{ postId, createdAt }` composite key, not `{ id }`
- Updated all CRUD operations and client calls to use correct composite key

**Scrollbar Jitter Fix:**
- Hidden native scrollbar globally on `html`, `body`, `.page` — eliminates layout shift from scrollbar appearing/disappearing during hydration
- Uses `scrollbar-width: none` (Firefox), `-ms-overflow-style: none` (IE/Edge), `::-webkit-scrollbar { display: none }` (Chrome/Safari)
- Scroll still works via `html { overflow-y: auto }`

**Files modified:** 7 files (`app/api/feed/route.ts`, `app/feed/page.tsx`, `app/kid-dashboard/page.tsx`, `app/kid-dashboard/progress/page.tsx`, `app/page.tsx`, `app/globals.css`, `docs/DOCS.md`)
**Resolved issues:** R44–R50

### v2.5.0 — 2026-03-06 (Desktop Fixes, Game Fixes, Detection, Report Accuracy, UI Polish)

**Phase 1 — Desktop Mic Fix:**
- Replaced `getUserMedia` temp stream in `checkMicSupport()` with `navigator.permissions.query({name: 'microphone'})` — eliminates hardware race condition on Windows/Chrome
- Added 200ms delay before `SpeechRecognition.start()` in speech and communication pages
- Added `interimResults: true` and `settled` flag to prevent double-handling of results

**Phase 2 — Detection Fixes:**
- Removed face/body/both toggle buttons from live detection page — auto-detects modality based on viewport width (`< 768px → face`, `≥ 768px → both`) with resize listener
- Changed `useDetectorInference` default modality from `"body"` to `"both"`
- Made Stage 7 (preparation) camera container responsive: `width: "100%", maxWidth: 400, aspectRatio: "4/3"`
- Relaxed action detection thresholds: clap wrist-distance `0.3→0.45 * scale`, raise_arms margin `0.05→0.02 * scale`, `REQUIRED_CONSECUTIVE` `12→10`

**Phase 3 — Game Fixes:**
- **Sequence Memory**: added "Try Again" option on wrong answer — shows correct sequence with color blocks, retry replays same round
- **Bubble Pop**: increased float duration (`5+3s→7+4s`), enlarged target display (`2.2→2.8rem`), taller play area (`380→440px`)
- **Social Stories**: fixed dark mode feedback color (`var(--peach-300)→var(--text-secondary)`)

**Phase 4 — Progress & Reports:**
- Progress page dedup changed from 2-second window to per-game-per-day (keeps best score)
- Biomarker unmeasured domain defaults changed from `0.75` to `0.5` — skipped screenings now show honest ~50% scores
- PDF clinical text: increased wrap margin (`CONTENT_WIDTH - 10→20`), reduced font (`9.5→9pt`)

**Phase 5 — UI Polish:**
- Community/feed links redirected to `/kid-dashboard/chat` (AI Chat) on landing page + dashboard
- Landing page logo wrapped in `<Link href="/">`
- Intake pages (profile, device-check, summary): replaced emojis with Lucide React icons
- Added `addGameActivity` + `updateStreak` to 4 games missing daily progress tracking: sorting, color-sound, breathing, pattern-match

**Files modified:** ~20 files across lib, games, intake, dashboard, hooks, and API routes.
**Resolved issues:** R30–R43 (14 issues).

### v2.2.0 — 2026-03-06 (Game Staging, Nav Fix, Dark Mode, Feed Toggle)

**Navigation & Layout (Phase 1):**
- Landing page navbar: replaced inline auth nav with `<ThemeToggle>` + `<Link>Dashboard</Link>` + `<UserMenu />` — no more horizontal overflow when signed in
- Chat input bar: reduced mic button (64px→48px) and send button (56px→44px), added `min-width: 0` on text input for small screens

**Dark Mode Consistency (Phase 2):**
- StreakBadge: replaced hardcoded light gradient with theme-aware CSS vars (`var(--feature-peach)`, `var(--bg-secondary)`)
- Feed page: replaced text "Light"/"Dark" toggle with `<ThemeToggle>` component

**Game Fixes — Critical Gameplay (Phase 3):**
- **Bubble Pop**: converted `nextId` state to `useRef` to fix stale closure in spawn interval, removed redundant `fastCheck` 500ms interval, steady 1500ms spawn rate
- **Tracing**: added 65% accuracy threshold — scribbles below threshold show "Try Again" instead of advancing; only passing attempts recorded in scores
- **Color & Sound**: added 2-attempt system — wrong answer shows "Try Again" button (attempt 1), second wrong shows correct answer and auto-advances (attempt 2)

**Game Fixes — Staged Difficulty (Phase 4):**
- **Alphabet Pattern**: 3-stage progression — Stage 1 (rounds 1-2): 1 blank, Stage 2 (rounds 3-4): 2 blanks, Stage 3 (round 5): CVC word completion from 20-word pool
- **Sequence Memory**: enhanced show-sequence animation — `scale(1.15)` with glow `boxShadow`, `opacity: 0.3` on inactive buttons, 300ms gap between items, "Watch! (X of Y)" indicator
- **Speech Practice**: 3-stage progression — Stage 1 (items 1-3): single word, Stage 2 (items 4-6): 3-word phrase with current word highlighted, Stage 3 (items 7-9): full sentence

**Intake & Progress Fixes (Phase 5):**
- **Video Capture (Step 8)**: fixed `startingRef` not resetting on camera failure (blocked subsequent start attempts forever), added debug status bar showing Camera/Models/Inference status
- **Progress page**: added de-duplication filter — entries with same `gameId` within 2-second window collapsed into single entry

**Features & Polish (Phase 6):**
- **Feed anonymous toggle**: new checkbox in compose form — "Post Anonymously" (default: checked). Unchecked posts show "Community Member" instead of "Anonymous"
- **ThemeToggle consistency**: replaced text "Dark"/"Light" toggles with `<ThemeToggle>` component on all 18 game/feature pages (bubble-pop, alphabet-pattern, tracing, match-numbers, memory, social-stories-v2, emotion-match, color-sound, sequence, speech, talking, chat, progress, reports, nearby-help, child detail, plus landing and feed)

**Files modified:** 22+ files across games, components, intake, feed, and dashboard pages.
**Testing:** 42 Playwright tests (36 unauthenticated + 6 authenticated) all passing. TypeScript clean. Build clean.
