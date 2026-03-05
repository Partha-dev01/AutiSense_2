/**
 * POST /api/report/summary
 *
 * Generates a parent-friendly screening summary using Amazon Nova Lite
 * via Amazon Bedrock. Falls back to a mock summary when AWS credentials
 * are not configured.
 *
 * Request body:
 *   { sessionId: string, biomarkers: BiomarkerAggregate }
 *
 * Response:
 *   { summary: string }
 */

import { NextRequest, NextResponse } from "next/server";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import type { BiomarkerAggregate } from "../../../types/biomarker";
import { getAppCredentials } from "../../../lib/aws/credentials";

interface SummaryRequestBody {
  sessionId: string;
  biomarkers: BiomarkerAggregate;
}

const BEDROCK_REGION = process.env.BEDROCK_REGION || "us-east-1";

function getBedrockClient(): BedrockRuntimeClient {
  const credentials = getAppCredentials();
  return new BedrockRuntimeClient({ region: BEDROCK_REGION, ...(credentials && { credentials }) });
}

function buildMockSummary(biomarkers: BiomarkerAggregate): string {
  const risk = biomarkers.overallScore < 50 ? "elevated" : "low";
  return [
    `Based on the screening session (${biomarkers.sampleCount} data points collected), your child's overall developmental score is ${biomarkers.overallScore}/100. This places them in the ${risk}-risk category for further evaluation.`,
    `In the area of social communication, your child scored ${(biomarkers.avgGazeScore * 100).toFixed(0)}% on gaze tracking and ${(biomarkers.avgVocalizationScore * 100).toFixed(0)}% on vocalization quality. ${biomarkers.flags.socialCommunication ? "These scores suggest some differences in social communication patterns that align with DSM-5 Criterion A indicators. This does not mean a diagnosis, but it does suggest a conversation with your pediatrician would be beneficial." : "These scores are within the typical developmental range for social communication, which is encouraging."}`,
    `Motor coordination was measured at ${(biomarkers.avgMotorScore * 100).toFixed(0)}%. ${biomarkers.flags.restrictedBehavior ? "Some patterns in motor behavior were observed that may correspond to restricted or repetitive behaviors described in DSM-5 Criterion B. A specialist can help determine whether these patterns are developmentally significant." : "Motor patterns appear typical for this developmental stage."}${biomarkers.dominantBodyBehavior ? ` The most frequently observed body behavior was "${biomarkers.dominantBodyBehavior.replace(/_/g, " ")}".` : ""}`,
    `We recommend sharing this summary with your child's pediatrician or a developmental specialist. This screening is not a diagnosis -- it is a starting point for a conversation about your child's unique developmental profile. Early identification and support can make a meaningful difference in a child's developmental trajectory.`,
  ].join("\n\n");
}

export async function POST(req: NextRequest) {
  let body: SummaryRequestBody;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  if (!body?.sessionId || !body?.biomarkers) {
    return NextResponse.json(
      { error: "Missing required fields: sessionId and biomarkers" },
      { status: 400 },
    );
  }

  const { biomarkers } = body;

  const prompt = `Generate a parent-friendly screening summary for a child based on the following biomarker data. Map to DSM-5 criteria. Keep it to 3-4 paragraphs.

Biomarker Data:
${JSON.stringify(biomarkers, null, 2)}

Important guidelines:
- Use warm, supportive language appropriate for parents
- Explain what each score means in plain language
- Reference DSM-5 Criterion A (Social Communication & Interaction) and Criterion B (Restricted & Repetitive Behaviours) where relevant
- End with a clear recommendation for next steps
- Do NOT use the word "diagnosis" -- this is a screening tool, not a diagnostic instrument`;

  try {
    const client = getBedrockClient();
    const invokeBody = JSON.stringify({
      messages: [{ role: "user", content: [{ text: prompt }] }],
      inferenceConfig: { maxTokens: 1024, temperature: 0.7 },
    });

    const command = new InvokeModelCommand({
      modelId: "amazon.nova-lite-v1:0",
      contentType: "application/json",
      accept: "application/json",
      body: new TextEncoder().encode(invokeBody),
    });

    const response = await client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    // Nova Lite returns: { output: { message: { content: [{ text: "..." }] } } }
    const summary =
      responseBody?.output?.message?.content?.[0]?.text ??
      responseBody?.completion ??
      buildMockSummary(biomarkers);

    return NextResponse.json({ summary });
  } catch (err) {
    console.error("[Report/Summary] Bedrock invocation failed:", err);
    // Graceful degradation: return mock summary on error
    return NextResponse.json({ summary: buildMockSummary(biomarkers) });
  }
}
