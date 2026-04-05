# AutiSense

[![CI](https://github.com/Partha-dev01/AutiSense/actions/workflows/ci.yml/badge.svg)](https://github.com/Partha-dev01/AutiSense/actions/workflows/ci.yml)
[![Next.js](https://img.shields.io/badge/Next.js-16.2-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![ONNX Runtime](https://img.shields.io/badge/ONNX_Runtime-Web-blue)](https://onnxruntime.ai/)
[![AWS](https://img.shields.io/badge/AWS-Bedrock%20%7C%20Polly%20%7C%20DynamoDB-FF9900?logo=amazon-web-services&logoColor=white)](https://aws.amazon.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

> **Privacy-first, browser-based autism screening powered by on-device AI.**

AutiSense is a web application that captures behavioral biomarkers using real-time on-device AI inference. Four ONNX models run entirely in the browser -- no video, audio, or inference data ever leaves the device during screening. Cloud services enrich the experience with generative AI reports, text-to-speech, and cross-device data sync, all with graceful offline fallbacks.

**Live**: [https://autisense.imaginaerium.in](https://autisense.imaginaerium.in)

![AutiSense Landing Page](public/home.png)

---

## Key Features

- **10-step screening pipeline** -- Guided flow covering consent, speech, motor, reaction time, and full behavioral video analysis (~15 minutes)
- **On-device AI inference** -- YOLO pose detection, body/face behavior classification, and emotion analysis run client-side via Web Workers and ONNX Runtime Web
- **Multimodal fusion** -- Body pose (70%) and facial expression (30%) late fusion for ASD risk scoring
- **AI-generated clinical reports** -- Amazon Bedrock (Nova Pro) produces DSM-5-aligned reports with severity mapping; downloadable as PDF
- **Kids dashboard** -- 13 therapy games, AI chat with animated animal avatars, speech practice, progress tracking, weekly reports, and a nearby-institutes map
- **Offline-first** -- IndexedDB (Dexie v5) stores all data locally; DynamoDB sync when connectivity is available
- **Privacy-first** -- Zero data egress during screening; cloud sync is opt-in with explicit consent

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.2.2 (App Router, React 19.2.4) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 + CSS custom properties |
| State | Zustand (global) + React useState (local) |
| On-device AI | ONNX Runtime Web 1.24.2 (WebGPU/WASM) |
| Face Analysis | @mediapipe/tasks-vision (478 landmarks, 52 blendshapes) |
| Client Database | Dexie.js v4 (IndexedDB, 10 tables) |
| Server Database | Amazon DynamoDB (7 tables) |
| Generative AI | Amazon Bedrock (Nova Lite + Nova Pro) |
| Text-to-Speech | Amazon Polly (Neural, Joanna voice) |
| Auth | Custom Google OAuth 2.0 + DynamoDB sessions |
| Charts | Recharts (dashboard) + Chart.js (detector) |
| PDF | pdf-lib (server-side generation) |
| E2E Testing | Playwright 1.58.2 (97 tests) |
| Unit Testing | Vitest 3.2.4 (68 tests) |
| Hosting | AWS Amplify (WEB_COMPUTE SSR) |

---

## AI Models (On-Device)

All inference runs in a Web Worker. No data is transmitted to any server.

| Model | File | Size | Input | Output |
|-------|------|------|-------|--------|
| **YOLO26n-pose** | `yolo26n-pose-int8.onnx` | 13 MB | 320x240 RGB frame | 17 COCO keypoints + confidence |
| **BodyTCN** | `pose-tcn-int8.onnx` | 274 KB | 86-dim feature sequence | 6 behavior classes |
| **FER+** | `emotion-ferplus-8.onnx` | 34 MB | 48x48 grayscale face | 8 emotion probabilities |
| **FaceTCN** | `face-tcn-int8.onnx` | 81 KB | 64-dim feature sequence | 4 expression classes |

**Body behavior classes (6):** hand_flapping, body_rocking, head_banging, spinning, toe_walking, non_autistic

**Face behavior classes (4):** typical_expression, flat_affect, atypical_expression, gaze_avoidance

**Fusion:** `ASD Risk = 0.7 * bodyRisk + 0.3 * faceRisk`

---

## 10-Step Screening Pipeline

| Step | Page | Assessment | Biomarker Output |
|------|------|-----------|-----------------|
| 1 | `/intake/profile` | Parental consent | -- |
| 2 | `/intake/child-profile` | Child info (name, DOB, language) | Session created |
| 3 | `/intake/device-check` | Camera + microphone verification | -- |
| 4 | `/intake/communication` | Word Echo (LLM-generated words + Polly TTS + speech recognition) | vocalizationScore |
| 5 | `/intake/behavioral-observation` | Bubble Pop reaction time | motorScore, responseLatencyMs |
| 6 | `/intake/preparation` | Action Challenge (YOLO motor verification, 6 actions) | motorScore, responseLatencyMs |
| 7 | `/intake/motor` | Tap-the-target coordination | motorScore, responseLatencyMs |
| 8 | `/intake/video-capture` | ONNX behavioral video analysis (30s) | gazeScore, motorScore, asdRiskScore, behavior classes |
| 9 | `/intake/summary` | Aggregated domain scores | -- |
| 10 | `/intake/report` | AI clinical report (Bedrock Nova Pro) + PDF download | PDF report |

---

## Kids Dashboard and Therapy Games

The kids dashboard (`/kid-dashboard`) provides 13 therapy games across two hubs, daily streak tracking, AI chat, speech practice, weekly reports, and a nearby-institutes map.

**Clinician-facing games (7):**
Emotion Quiz, Category Sorting, Sequence Memory, Social Stories, Calm Breathing, Pattern Match, Color and Sound

**Kid-facing games (6):**
Bubble Pop, Alphabet Pattern, Tracing, Match Numbers, Memory, Social Stories V2

All games use an adaptive difficulty engine that adjusts based on recent score history. Game activity and daily streaks are tracked in IndexedDB.

Additional features: AI chat with animal avatars (dog/cat/rabbit/parrot), speech practice with Polly TTS, weekly progress reports (kid and parent views), nearby autism institutes map (Leaflet + Overpass API, 50+ institutes across 12 Indian cities).

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm

### Installation

```bash
git clone https://github.com/Partha-dev01/AutiSense.git
cd AutiSense
npm install
```

### Environment Variables

Copy the example file and fill in your values:

```bash
cp .env.local.example .env.local
```

Required variables:

| Variable | Purpose |
|----------|---------|
| `AWS_REGION` | Primary AWS region (default: ap-south-1) |
| `AWS_ACCESS_KEY_ID` | IAM access key for local development |
| `AWS_SECRET_ACCESS_KEY` | IAM secret key for local development |
| `BEDROCK_REGION` | Bedrock region (default: us-east-1) |
| `POLLY_REGION` | Polly region (default: ap-south-1) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `NEXT_PUBLIC_APP_URL` | App base URL (default: http://localhost:3000) |
| `DYNAMODB_*` (7 tables) | DynamoDB table names (defaults provided) |

See [`.env.local.example`](.env.local.example) for the full list.

> The app works without AWS credentials -- all API routes have mock/template fallbacks.

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Build and Test

```bash
npm run build
npm run test:unit      # 68 Vitest unit tests
npx playwright test    # 97 Playwright E2E tests
```

---

## Project Structure

```
AutiSense/
├── app/
│   ├── api/               14 API routes (auth, chat, feed, nearby, report, sync, tts)
│   ├── auth/              Login page
│   ├── components/        11 shared UI components
│   ├── contexts/          AuthContext (Google OAuth)
│   ├── dashboard/         Clinician dashboard + child profiles
│   ├── feed/              Community feed (posts, reactions)
│   ├── games/             7 therapy games (clinician-facing)
│   ├── hooks/             4 custom hooks (auth, camera, inference)
│   ├── intake/            10-step screening flow
│   ├── kid-dashboard/     Kids hub (6 games, AI chat, progress, reports, map)
│   ├── lib/               Business logic
│   │   ├── actions/       Rule-based action detection from YOLO keypoints
│   │   ├── audio/         Unified TTS helper (Polly -> browser fallback)
│   │   ├── auth/          Google OAuth + DynamoDB sessions
│   │   ├── aws/           Shared AWS credential helper
│   │   ├── camera/        Progressive getUserMedia with HTTPS check
│   │   ├── db/            Dexie repositories (8 modules)
│   │   ├── inference/     ONNX pipeline (YOLO, TCN, FER+, fusion, orchestrators)
│   │   └── scoring/       Age-normalized biomarker scoring (4 brackets)
│   └── types/             6 type modules
├── public/models/         4 ONNX models (~47 MB total)
├── server/                Lambda handler + DynamoDB setup script
├── __tests__/             7 Vitest unit test files (68 tests)
├── tests/                 4 Playwright E2E spec files (97 tests)
├── workers/               ONNX inference Web Worker
└── docs/                  DOCS.md, SETUP_GUIDE.md, Amazon_usage.md
```

---

## Data Architecture

### What's stored where

| Data | Storage | Syncs to Cloud? | Cross-Device? |
|------|---------|-----------------|---------------|
| **Screening sessions** | IndexedDB → DynamoDB | Yes (opt-in, anonymized) | Yes (after sync) |
| **Biomarker scores** | IndexedDB → DynamoDB | Yes (opt-in, anonymized) | Yes (after sync) |
| **User account** | DynamoDB | Always (Google OAuth) | Yes |
| **Game progress & scores** | IndexedDB only | No | No |
| **Daily streaks** | IndexedDB only | No | No |
| **Weekly reports** | IndexedDB only | No | No |
| **Chat history** | IndexedDB only | No | No |
| **Child profiles** | IndexedDB only | No | No |
| **Difficulty levels** | localStorage only | No | No |

> **Note**: Game progress, streaks, and weekly reports are stored locally in the browser only. Switching devices or clearing browser data will reset this data. This is by design -- game activity data never leaves the device.

### Privacy architecture

AutiSense follows a **zero-egress screening** model:

1. **On-device inference** -- All 4 AI models (YOLO, BodyTCN, FER+, FaceTCN) run in a Web Worker via ONNX Runtime Web. No video frames, keypoints, or inference results are transmitted to any server.
2. **Local-first storage** -- All game and screening data lives in IndexedDB (Dexie). The app works fully offline.
3. **Opt-in cloud sync** -- Only anonymized screening sessions and biomarker scores are synced to DynamoDB. Child names are stripped before upload. Game activity stays local.
4. **Cloud AI enrichment** -- Only aggregated biomarker scores (not raw data) are sent to Amazon Bedrock for report generation. This step is optional and has template-based fallbacks.
5. **Data expiry** -- DynamoDB records have a 365-day TTL and auto-expire.

---

## AWS Services

| Service | Purpose | Region |
|---------|---------|--------|
| **Amazon Bedrock** | Nova Lite (chat, word generation, summaries) + Nova Pro (DSM-5 clinical reports) | us-east-1 |
| **Amazon Polly** | Neural TTS voice prompts (Joanna) | ap-south-1 |
| **Amazon DynamoDB** | 7 tables -- users, auth sessions, screening sessions, biomarkers, feed posts, child profiles, session summaries | ap-south-1 |
| **AWS Amplify** | WEB_COMPUTE SSR hosting with auto-deploy from GitHub | ap-south-1 |
| **Amazon S3** | ONNX model storage (models currently served from `public/` via CDN) | ap-south-1 |
| **AWS IAM** | 1 user + 1 role + scoped Bedrock/Polly/DynamoDB policies | Global |
| **AWS Budgets** | $10/month alarm with email alerts at 80% | Global |

All AWS-dependent API routes have **graceful fallbacks** -- the app is fully functional without AWS credentials.

See [`docs/Amazon_usage.md`](docs/Amazon_usage.md) for the complete AWS architecture reference.

---

## API Routes

| Route | Method | AWS Service | Fallback |
|-------|--------|------------|----------|
| `/api/auth/google` | GET | -- | -- |
| `/api/auth/callback/google` | GET | DynamoDB | In-memory auth |
| `/api/auth/session` | GET | DynamoDB | In-memory auth |
| `/api/auth/logout` | POST | DynamoDB | In-memory auth |
| `/api/chat/conversation` | POST | Bedrock (Nova Lite) | Pre-defined conversation pool |
| `/api/chat/generate-words` | POST | Bedrock (Nova Lite) | Curated age-stratified word pools |
| `/api/report/summary` | POST | Bedrock (Nova Lite) | Template mock summary |
| `/api/report/clinical` | POST | Bedrock (Nova Pro) | Deterministic template report |
| `/api/report/pdf` | POST | -- | -- |
| `/api/report/weekly` | GET/POST | -- | -- |
| `/api/tts` | POST | Polly | Client falls back to browser speechSynthesis |
| `/api/feed` | GET/POST | DynamoDB | In-memory store |
| `/api/sync` | POST | DynamoDB | Error response |
| `/api/nearby` | POST | -- (Overpass API) | -- |

---

## Deployment

AutiSense is deployed on **AWS Amplify** (WEB_COMPUTE) with auto-deploy from the `main` branch.

```bash
# Manual trigger
aws amplify start-job --app-id d2n7pu2vtgi8yc --branch-name main --job-type RELEASE --region ap-south-1
```

### Amplify SSR Environment Variables

Amplify WEB_COMPUTE injects env vars into the build container but **not** into the Lambda runtime. All non-AWS env vars are listed in `next.config.ts` under the `env` property for build-time inlining. AWS credentials use `APP_*` prefix (Amplify reserves the `AWS_*` prefix).

See [`docs/SETUP_GUIDE.md`](docs/SETUP_GUIDE.md) for full deployment configuration, troubleshooting, and the list of all 16 required Amplify environment variables.

---

## Documentation

| Document | Contents |
|----------|----------|
| [`docs/DOCS.md`](docs/DOCS.md) | Full project documentation -- architecture, feature map, intake flow, AI/ML pipeline, data layer, games, API endpoints, testing, changelog |
| [`docs/SETUP_GUIDE.md`](docs/SETUP_GUIDE.md) | Deployment reference -- AWS resources, environment variables, credential handling, troubleshooting, critical warnings |
| [`docs/Amazon_usage.md`](docs/Amazon_usage.md) | Complete AWS architecture -- Bedrock, Polly, DynamoDB, Amplify, S3, IAM, credentials strategy, API route matrix, data flow diagrams, cost analysis |

---

## Disclaimer

AutiSense is a **screening tool**, not a diagnostic instrument. Results are intended to support -- not replace -- professional clinical evaluation. The AI models provide behavioral pattern indicators that should be interpreted by qualified healthcare professionals. Always consult a licensed clinician for autism spectrum disorder diagnosis.

---

## License

[MIT](LICENSE)
