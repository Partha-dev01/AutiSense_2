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
- **Generative AI** — Amazon Bedrock (Nova Lite + Cohere Command R+) for generating DSM-5 aligned clinical reports from biomarker data
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
│   ├── IndexedDB (Dexie v3)
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
├── POST /api/report/clinical   → Amazon Bedrock Cohere Command R+
├── POST /api/report/pdf        → pdf-lib PDF generation
├── POST /api/tts               → Amazon Polly
├── GET/POST /api/auth/*        → Google OAuth + DynamoDB sessions
└── GET/POST /api/feed          → Community feed CRUD
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
| Offline-first IndexedDB | Done | `app/lib/db/schema.ts` (Dexie v3) |
| COOP/COEP headers for WASM | Done | `next.config.ts` |

### AWS Infrastructure (Complete)

| Resource | Status | Details |
|----------|--------|---------|
| DynamoDB (7 tables) | Deployed | PAY_PER_REQUEST, ap-south-1 |
| S3 bucket + ONNX models | Deployed | 4 models, ~47MB total |
| IAM policies (3) | Created | Bedrock, Polly, DynamoDB+S3 |
| IAM user + Amplify role | Created | For local dev + production |
| Bedrock model access | Auto-enabled | Nova Lite + Command R+ |
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
| **Bedrock** (Command R+) | DSM-5 aligned clinical reports | `POST /api/report/clinical` |
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

### IndexedDB Schema (Dexie v3)

| Table | Primary Key | Indexes | Purpose |
|-------|-------------|---------|---------|
| `sessions` | `id` | `userId`, `createdAt`, `synced`, `status` | Screening sessions |
| `biomarkers` | `++id` (auto) | `sessionId`, `userId`, `timestamp`, `taskId` | Per-task biomarker data |
| `syncQueue` | `++id` (auto) | `sessionId`, `queuedAt`, `retryCount` | Offline sync queue |
| `childProfiles` | `id` | `userId`, `createdAt` | Child profiles |
| `feedPosts` | `id` | `category`, `createdAt` | Community feed posts |

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
| Emotion Match | `/games/emotion-match` | Emotional recognition | 5 (pairs scale) |
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
| POST | `/api/report/clinical` | Public | Generate clinical report via Bedrock Command R+ |
| POST | `/api/report/pdf` | Public | Generate downloadable PDF |
| POST | `/api/tts` | Public | Text-to-speech via Amazon Polly |
| GET | `/api/feed` | Public | List feed posts |
| POST | `/api/feed` | Public | Create feed post |

---

## Testing

### Test Suites

| File | Tests | Coverage |
|------|-------|----------|
| `tests/intake-flow.spec.ts` | 15 | Full 10-step intake flow navigation, form validation, back buttons, skip stage |
| `tests/app-pages.spec.ts` | 15 | Auth, dashboard, all 7 games, feed, 4 API endpoints |
| **Total** | **30** | **All passing** |

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
- [x] Clinical API (Command R+) with DSM-5 section extraction
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
| 6 | Feed posts are local-only (IndexedDB) | Low | Open | DynamoDB sync for feed posts not yet implemented |
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

---

## Changelog

### v1.0.0 — 2026-03-03 (Initial Release)

**Added:**
- Complete 12-step autism screening intake flow
- Real-time ONNX behavioral video analysis (YOLO + TCN + FER+)
- Amazon Bedrock AI report generation (Nova Lite summaries + Command R+ clinical reports)
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
