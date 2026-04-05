/**
 * GET /api/health
 *
 * Returns application health status. Use for uptime monitoring.
 * Checks DynamoDB connectivity if credentials are available.
 */

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, string> = {};
  let healthy = true;

  // Check DynamoDB connectivity
  try {
    const { getAppCredentials, getAppRegion } = await import("../../lib/aws/credentials");
    const creds = getAppCredentials();
    if (creds || process.env.AWS_REGION) {
      const { DynamoDBClient } = await import("@aws-sdk/client-dynamodb");
      const { DynamoDBDocumentClient, GetCommand } = await import("@aws-sdk/lib-dynamodb");
      const table = process.env.DYNAMODB_USERS_TABLE || "autisense-users";
      const client = new DynamoDBClient({
        region: getAppRegion("ap-south-1"),
        ...(creds && { credentials: creds }),
      });
      const docClient = DynamoDBDocumentClient.from(client);
      // Use GetItem (allowed by IAM policy) instead of DescribeTable (not allowed)
      await docClient.send(new GetCommand({ TableName: table, Key: { id: "__health_check__" } }));
      checks.dynamodb = "ok";
    } else {
      checks.dynamodb = "no_credentials";
    }
  } catch {
    checks.dynamodb = "error";
    healthy = false;
  }

  // Check env vars
  checks.env = process.env.DYNAMODB_SESSIONS_TABLE ? "ok" : "missing";

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || "0.1.0",
      checks,
    },
    { status: healthy ? 200 : 503 },
  );
}
