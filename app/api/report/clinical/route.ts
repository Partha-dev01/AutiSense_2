/**
 * POST /api/report/clinical
 *
 * Generates a DSM-5 aligned clinical report using a hybrid approach:
 * 1. Deterministic template (buildTemplateReport) generates the full report
 * 2. Amazon Nova Pro provides structured clinical insights via short JSON prompt
 * 3. Insights are merged into the template for clinical depth
 * Falls back to the template-only report when Bedrock is unavailable.
 *
 * Request body:
 *   { sessionId: string, biomarkers: BiomarkerAggregate, childAge?: number }
 *
 * Response:
 *   {
 *     report: string,
 *     sections: {
 *       criterionA: string,
 *       criterionB: string,
 *       motor: string,
 *       recommendations: string,
 *     }
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import type { BiomarkerAggregate } from "../../../types/biomarker";
import { getAppCredentials } from "../../../lib/aws/credentials";
import { logger } from "../../../lib/logger";

const log = logger("report/clinical");

interface ClinicalRequestBody {
  sessionId: string;
  biomarkers: BiomarkerAggregate;
  childAge?: number;
}

interface ClinicalResponse {
  report: string;
  sections: {
    criterionA: string;
    criterionB: string;
    motor: string;
    recommendations: string;
  };
}

interface AiInsights {
  severityLevel: string;
  criterionA_interpretation: string;
  criterionB_interpretation: string;
  clinicalImpression: string;
  priorityRecommendations: string[];
  differentialConsiderations: string;
}

const BEDROCK_REGION = process.env.BEDROCK_REGION || "us-east-1";

function getBedrockClient(): BedrockRuntimeClient {
  const credentials = getAppCredentials();
  return new BedrockRuntimeClient({ region: BEDROCK_REGION, ...(credentials && { credentials }) });
}

function buildTemplateReport(
  biomarkers: BiomarkerAggregate,
  childAge?: number,
): ClinicalResponse {
  const ageStr = childAge
    ? `${Math.floor(childAge / 12)} years and ${childAge % 12} months`
    : "age not specified";

  const criterionA = `CRITERION A -- SOCIAL COMMUNICATION & INTERACTION

The child (${ageStr}) was assessed across multiple social communication domains during this screening session.

Gaze Tracking & Joint Attention:
The child demonstrated a gaze consistency score of ${(biomarkers.avgGazeScore * 100).toFixed(1)}%. ${biomarkers.avgGazeScore < 0.4 ? "This score falls below the typical developmental threshold (40%), suggesting potential differences in social visual engagement. Reduced gaze consistency may indicate difficulties with joint attention, a core feature of DSM-5 Criterion A.1 (deficits in social-emotional reciprocity) and A.3 (deficits in developing, maintaining, and understanding relationships)." : "This score is within the typical range, suggesting age-appropriate social visual engagement patterns."}

Vocalization & Communication:
Vocalization quality was measured at ${(biomarkers.avgVocalizationScore * 100).toFixed(1)}%. ${biomarkers.avgVocalizationScore < 0.35 ? "This is below the developmental threshold, which may reflect differences in verbal and nonverbal communicative behaviors as described in Criterion A.2." : "This falls within normal parameters for the assessed age range."}${biomarkers.dominantFaceBehavior ? `\n\nFacial Affect Analysis:\nThe dominant facial expression pattern observed was "${biomarkers.dominantFaceBehavior.replace(/_/g, " ")}". ${biomarkers.dominantFaceBehavior === "flat_affect" ? "A predominantly flat affect may be associated with reduced social-emotional reciprocity." : biomarkers.dominantFaceBehavior === "gaze_avoidance" ? "Gaze avoidance patterns were noted, which may be relevant to Criterion A.1 assessment." : "This pattern is noted for clinical context."}` : ""}

Social Communication Flag: ${biomarkers.flags.socialCommunication ? "FLAGGED -- scores indicate potential differences warranting specialist evaluation." : "Within typical range."}`;

  const criterionB = `CRITERION B -- RESTRICTED & REPETITIVE BEHAVIOURS

Motor Pattern Assessment:
Motor coordination scored ${(biomarkers.avgMotorScore * 100).toFixed(1)}%. ${biomarkers.avgMotorScore < 0.35 ? "This is below the typical threshold, which may indicate differences in motor planning or the presence of stereotyped motor movements as described in Criterion B.1." : "Motor coordination appears within the typical developmental range."}${biomarkers.avgResponseLatencyMs !== null ? `\n\nResponse Latency:\nAverage response latency was ${biomarkers.avgResponseLatencyMs}ms. ${biomarkers.avgResponseLatencyMs > 3000 ? "Extended response latency (>3000ms) may suggest insistence on sameness or inflexible adherence to routines (Criterion B.2), though this requires clinical interpretation." : "This is within the expected range."}` : ""}${biomarkers.dominantBodyBehavior ? `\n\nBehavior Classification (Computer-Assisted):\nThe predominant body behavior pattern detected during video analysis was "${biomarkers.dominantBodyBehavior.replace(/_/g, " ")}". ${["hand_flapping", "body_rocking", "spinning"].includes(biomarkers.dominantBodyBehavior) ? "This behavior pattern aligns with stereotyped or repetitive motor movements described in Criterion B.1." : biomarkers.dominantBodyBehavior === "toe_walking" ? "Toe walking may be associated with sensory processing differences described in Criterion B.4 (hyper- or hyporeactivity to sensory input)." : "This pattern is noted for clinical context."}` : ""}${biomarkers.behaviorClassDistribution ? `\n\nBehavior Distribution:\n${Object.entries(biomarkers.behaviorClassDistribution).map(([cls, count]) => `  - ${cls.replace(/_/g, " ")}: ${count} observations`).join("\n")}` : ""}

Restricted Behavior Flag: ${biomarkers.flags.restrictedBehavior ? "FLAGGED -- patterns suggest potential restricted or repetitive behaviors warranting further assessment." : "Within typical range."}`;

  const motor = `MOTOR DEVELOPMENT ASSESSMENT

Overall motor coordination score: ${(biomarkers.avgMotorScore * 100).toFixed(1)}%
${biomarkers.avgMotorScore < 0.5 ? "Below-average motor coordination was observed. Motor differences are commonly co-occurring with autism spectrum conditions and may benefit from occupational therapy assessment." : "Motor coordination appears age-appropriate based on the screening tasks administered."}

${biomarkers.dominantBodyBehavior && biomarkers.dominantBodyBehavior !== "non_autistic" ? `Notable motor pattern: "${biomarkers.dominantBodyBehavior.replace(/_/g, " ")}" was the most frequently observed body behavior during the video analysis component.` : "No atypical motor patterns were prominently detected during the video analysis component."}

Note: This motor assessment is based on computer-assisted behavioral observation and should be supplemented with a formal motor development evaluation (e.g., Movement ABC-2 or BOT-2) by a qualified occupational therapist.`;

  const recommendations = `RECOMMENDATIONS

Overall Screening Score: ${biomarkers.overallScore}/100
${biomarkers.avgAsdRisk !== undefined ? `AI-Estimated ASD Risk: ${(biomarkers.avgAsdRisk * 100).toFixed(1)}%` : ""}

Based on this screening:

${biomarkers.flags.socialCommunication || biomarkers.flags.restrictedBehavior ? `1. REFERRAL RECOMMENDED: This screening identified potential indicators in ${[biomarkers.flags.socialCommunication ? "social communication (Criterion A)" : "", biomarkers.flags.restrictedBehavior ? "restricted/repetitive behaviors (Criterion B)" : ""].filter(Boolean).join(" and ")}. We recommend a comprehensive developmental evaluation by:
   - A developmental pediatrician
   - A clinical psychologist specializing in autism assessment
   - A multidisciplinary team using standardized diagnostic instruments (ADOS-2, ADI-R)

2. EARLY INTERVENTION: Regardless of diagnostic outcome, early intervention services may support your child's development:
   - Speech-language therapy (if communication differences noted)
   - Occupational therapy (for motor and sensory processing support)
   - Applied behavior analysis (ABA) or naturalistic developmental behavioral interventions (NDBI)

3. MONITORING: Continue monitoring developmental milestones and repeat screening in 3-6 months to track progress.` : `1. CONTINUE MONITORING: Current screening scores are within the typical range. Continue monitoring developmental milestones at regular pediatric visits.

2. RESCREEN: Consider repeating this screening in 6-12 months or if new concerns arise.

3. WELL-CHILD VISITS: Maintain regular pediatric check-ups and discuss any emerging concerns with your child's doctor.`}

IMPORTANT DISCLAIMER: This report is generated by a computer-assisted screening tool and is NOT a clinical diagnosis. Autism spectrum disorder can only be diagnosed by qualified healthcare professionals through comprehensive evaluation. This screening is intended to support -- not replace -- clinical judgment.`;

  const report = [criterionA, criterionB, motor, recommendations].join(
    "\n\n---\n\n",
  );

  return { report, sections: { criterionA, criterionB, motor, recommendations } };
}

function buildInsightsPrompt(
  biomarkers: BiomarkerAggregate,
  childAge?: number,
): string {
  const age = childAge
    ? `${Math.floor(childAge / 12)}y${childAge % 12}m`
    : "unknown";
  return `Autism screening biomarkers for child (age: ${age}): ${JSON.stringify(biomarkers)}

Return ONLY valid JSON (no markdown, no explanation):
{"severityLevel":"mild|moderate|significant","criterionA_interpretation":"1-2 sentences mapping gaze/vocalization/face scores to DSM-5 A.1/A.2/A.3","criterionB_interpretation":"1-2 sentences mapping motor/behavior patterns to DSM-5 B.1/B.2/B.4","clinicalImpression":"2-3 sentence overall clinical impression","priorityRecommendations":["2-3 specific recommendations for this child"],"differentialConsiderations":"1 sentence on differential diagnosis considerations"}`;
}

function parseInsights(text: string): AiInsights | null {
  try {
    // Try to extract JSON from the response (handle possible markdown wrapping)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.severityLevel || !parsed.clinicalImpression) return null;
    return parsed as AiInsights;
  } catch {
    return null;
  }
}

function mergeAiInsights(
  base: ClinicalResponse,
  insights: AiInsights,
): ClinicalResponse {
  const { criterionA, criterionB, motor, recommendations } = base.sections;

  // Enrich Criterion A with AI interpretation
  const enrichedA = criterionA.replace(
    /Social Communication Flag:/,
    `\nClinical Interpretation:\n${insights.criterionA_interpretation}\n\nSocial Communication Flag:`,
  );

  // Enrich Criterion B with AI interpretation
  const enrichedB = criterionB.replace(
    /Restricted Behavior Flag:/,
    `\nClinical Interpretation:\n${insights.criterionB_interpretation}\n\nRestricted Behavior Flag:`,
  );

  // Enrich Recommendations with clinical impression and specific recommendations
  const severityLine = `Clinical Severity Assessment: ${insights.severityLevel.toUpperCase()}\n\n`;
  const impressionBlock = `Clinical Impression:\n${insights.clinicalImpression}\n\n`;
  const aiRecs = insights.priorityRecommendations
    .map((r, i) => `${i + 1}. ${r}`)
    .join("\n");
  const differential = `\nDifferential Considerations:\n${insights.differentialConsiderations}`;

  const enrichedRecs = recommendations.replace(
    /Based on this screening:/,
    `${severityLine}${impressionBlock}Based on this screening:`,
  ).replace(
    /IMPORTANT DISCLAIMER:/,
    `${aiRecs ? `\nPriority Recommendations:\n${aiRecs}\n\n` : ""}${differential}\n\nIMPORTANT DISCLAIMER:`,
  );

  const sections = {
    criterionA: enrichedA,
    criterionB: enrichedB,
    motor,
    recommendations: enrichedRecs,
  };

  const report = [
    sections.criterionA,
    sections.criterionB,
    sections.motor,
    sections.recommendations,
  ].join("\n\n---\n\n");

  return { report, sections };
}

export async function POST(req: NextRequest) {
  // Auth gate
  const { requireApiAuth } = await import("../../../lib/auth/requireApiAuth");
  const authResult = await requireApiAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  // Rate limit
  const { aiRateLimiter } = await import("../../../lib/rateLimit");
  const rl = aiRateLimiter.check(authResult.id);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  let body: ClinicalRequestBody;

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

  const { biomarkers, childAge } = body;

  // Always generate the deterministic template first
  const baseReport = buildTemplateReport(biomarkers, childAge);

  try {
    const client = getBedrockClient();
    const prompt = buildInsightsPrompt(biomarkers, childAge);
    const invokeBody = JSON.stringify({
      messages: [{ role: "user", content: [{ text: prompt }] }],
      inferenceConfig: { maxTokens: 512, temperature: 0.5 },
    });

    const command = new InvokeModelCommand({
      modelId: "amazon.nova-pro-v1:0",
      contentType: "application/json",
      accept: "application/json",
      body: new TextEncoder().encode(invokeBody),
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await client.send(command, { abortSignal: controller.signal });
    clearTimeout(timeout);

    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    const text: string =
      responseBody?.output?.message?.content?.[0]?.text ?? "";

    const insights = parseInsights(text);
    if (!insights) {
      log.warn("Could not parse AI insights, using template only");
      return NextResponse.json({ ...baseReport, aiEnriched: false });
    }

    return NextResponse.json({ ...mergeAiInsights(baseReport, insights), aiEnriched: true });
  } catch (err) {
    log.error("Bedrock invocation failed", { error: err });
    return NextResponse.json({ ...baseReport, aiEnriched: false });
  }
}
