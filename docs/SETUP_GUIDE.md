# AutiSense — Setup Guide

## Quick Start

```bash
git clone https://github.com/Partha-dev01/AutiSense.git
cd AutiSense
npm install
cp .env.local.example .env.local
# Fill in .env.local with your values
npm run dev
```

## Environment Variables

See [`.env.local.example`](../.env.local.example) for the full list of required variables.

The app works **without AWS credentials** — all API routes have template/fallback responses.

### Local Development

For local AWS access, configure the AWS CLI profile or set these in `.env.local`:
```
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=<your-key>
AWS_SECRET_ACCESS_KEY=<your-secret>
```

### Production (AWS Amplify)

Environment variables are configured in the Amplify Console:
- **App-level**: AWS credentials (`APP_*` prefix — Amplify blocks `AWS_*`)
- **Branch-level**: Google OAuth, DynamoDB table names, Bedrock/Polly regions

> **Warning**: `aws amplify update-app --environment-variables` REPLACES the entire map. Always pass ALL vars when using the CLI. Use the Amplify Console UI for safer edits.

## Testing

```bash
npm run test:unit      # Vitest unit tests (68 tests)
npx playwright test    # Playwright E2E tests (97 tests)
npm run lint           # ESLint
npm run type-check     # TypeScript
```

## Deployment

Pushes to `main` auto-deploy via GitHub webhook to AWS Amplify.

```bash
# Manual redeploy
aws amplify start-job --app-id <APP_ID> --branch-name main --job-type RELEASE --region ap-south-1
```

## Architecture

See [`DOCS.md`](DOCS.md) for the full architecture reference, and [`Amazon_usage.md`](Amazon_usage.md) for AWS service details.
