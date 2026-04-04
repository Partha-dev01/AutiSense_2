/**
 * Receives an anonymised session + biomarker aggregate from the client
 * and writes it to DynamoDB via AWS Lambda (or directly via SDK).
 *
 * Request body (SyncRequestBody):
 *   {
 *     session: SessionSyncPayload,   // no childName
 *     biomarkers: BiomarkerAggregate | null
 *   }
 *
 * Environment variables:
 *   AWS_REGION                (auto-set on Lambda)
 *   DYNAMODB_SESSIONS_TABLE
 *   DYNAMODB_BIOMARKERS_TABLE
 */

import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import type { SessionSyncPayload } from "../../types/session";
import type { BiomarkerAggregate } from "../../types/biomarker";
import { getAppCredentials, getAppRegion } from "../../lib/aws/credentials";

function getDocClient() {
  const credentials = getAppCredentials();
  const client = new DynamoDBClient({
    region: getAppRegion("ap-south-1"),
    ...(credentials && { credentials }),
  });
  return DynamoDBDocumentClient.from(client);
}

interface SyncRequestBody {
  session: SessionSyncPayload;
  biomarkers: BiomarkerAggregate | null;
}

export async function POST(req: NextRequest) {
  // Auth gate
  const { requireApiAuth } = await import("../../lib/auth/requireApiAuth");
  const authResult = await requireApiAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  let body: SyncRequestBody;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Basic validation
  if (!body?.session?.id || !body?.session?.userId) {
    return NextResponse.json(
      { error: "Missing required fields: session.id and session.userId" },
      { status: 400 },
    );
  }

  const { session, biomarkers } = body;

  // IDOR check — user can only sync their own data
  if (session.userId !== authResult.id) {
    return NextResponse.json({ error: "userId mismatch" }, { status: 403 });
  }

  const sessionsTable = process.env.DYNAMODB_SESSIONS_TABLE;
  const biomarkersTable = process.env.DYNAMODB_BIOMARKERS_TABLE;
  if (!sessionsTable) {
    console.error("[Sync API] DYNAMODB_SESSIONS_TABLE not configured");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const docClient = getDocClient();

  // Allowlist session fields — prevent mass assignment
  const sessionItem = {
    id: session.id,
    userId: session.userId,
    ageMonths: session.ageMonths,
    language: session.language,
    gender: session.gender,
    createdAt: session.createdAt,
    completedAt: session.completedAt,
    status: session.status,
    synced: true,
    ttl: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60,
  };

  try {
    // Write session record
    await docClient.send(
      new PutCommand({
        TableName: sessionsTable,
        Item: sessionItem,
        // Idempotency: skip if already synced (same sessionId)
        ConditionExpression: "attribute_not_exists(id)",
      }),
    );
  } catch (err: unknown) {
    // ConditionalCheckFailedException = already exists → treat as success
    if (isAlreadyExistsError(err)) {
      return NextResponse.json({
        ok: true,
        sessionId: session.id,
        note: "already_exists",
      });
    }
    console.error("[Sync API] DynamoDB sessions write failed:", err);
    return NextResponse.json(
      { error: "Failed to write session" },
      { status: 500 },
    );
  }

  // Write biomarker aggregate record (optional — null if no tasks completed)
  if (biomarkers && biomarkersTable) {
    // Allowlist biomarker fields — prevent mass assignment
    const biomarkerItem = {
      sessionId: biomarkers.sessionId || session.id,
      avgGazeScore: biomarkers.avgGazeScore,
      avgMotorScore: biomarkers.avgMotorScore,
      avgVocalizationScore: biomarkers.avgVocalizationScore,
      avgResponseLatencyMs: biomarkers.avgResponseLatencyMs,
      sampleCount: biomarkers.sampleCount,
      overallScore: biomarkers.overallScore,
      flags: biomarkers.flags,
      ...(biomarkers.avgAsdRisk != null && { avgAsdRisk: biomarkers.avgAsdRisk }),
      ...(biomarkers.dominantBodyBehavior && { dominantBodyBehavior: biomarkers.dominantBodyBehavior }),
      ...(biomarkers.dominantFaceBehavior && { dominantFaceBehavior: biomarkers.dominantFaceBehavior }),
      ...(biomarkers.behaviorClassDistribution && { behaviorClassDistribution: biomarkers.behaviorClassDistribution }),
      createdAt: session.createdAt,
      ttl: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60,
    };
    try {
      await docClient.send(
        new PutCommand({
          TableName: biomarkersTable,
          Item: biomarkerItem,
        }),
      );
    } catch (err) {
      console.error("[Sync API] DynamoDB biomarkers write failed:", err);
    }
  }

  return NextResponse.json({ ok: true, sessionId: session.id });
}

function isAlreadyExistsError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "name" in err &&
    (err as { name: string }).name === "ConditionalCheckFailedException"
  );
}
