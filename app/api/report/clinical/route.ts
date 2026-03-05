/**
 * POST /api/report/clinical
 *
 * Generates a full DSM-5 aligned clinical report using Cohere Command R+
 * via Amazon Bedrock. Falls back to a detailed mock report when AWS
 * credentials are not configured.
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

const BEDROCK_REGION = process.env.BEDROCK_REGION || "us-east-1";

function getBedrockClient(): BedrockRuntimeClient {
  const credentials = getAppCredentials();
  return new BedrockRuntimeClient({ region: BEDROCK_REGION, ...(credentials && { credentials }) });
}

function buildMockReport(
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

function parseSections(text: string): ClinicalResponse["sections"] {
  const sectionPatterns = {
    criterionA: /(?:CRITERION\s*A|Social\s*Communication)[^\n]*\n([\s\S]*?)(?=(?:CRITERION\s*B|Restricted|MOTOR|={3,})|$)/i,
    criterionB: /(?:CRITERION\s*B|Restricted\s*&?\s*Repetitive)[^\n]*\n([\s\S]*?)(?=(?:MOTOR|RECOMMENDATION|={3,})|$)/i,
    motor: /(?:MOTOR)[^\n]*\n([\s\S]*?)(?=(?:RECOMMENDATION|={3,})|$)/i,
    recommendations: /(?:RECOMMENDATION)[^\n]*\n([\s\S]*?)$/i,
  };

  const sections: ClinicalResponse["sections"] = {
    criterionA: "",
    criterionB: "",
    motor: "",
    recommendations: "",
  };

  for (const [key, pattern] of Object.entries(sectionPatterns)) {
    const match = text.match(pattern);
    if (match) {
      sections[key as keyof typeof sections] = match[1].trim();
    }
  }

  // If parsing failed, put everything in criterionA
  if (!sections.criterionA && !sections.criterionB) {
    sections.criterionA = text;
  }

  return sections;
}

export async function POST(req: NextRequest) {
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

  const ageContext = childAge
    ? `The child is ${Math.floor(childAge / 12)} years and ${childAge % 12} months old.`
    : "The child's age was not specified.";

  const prompt = `You are a clinical report generator for an autism screening platform. Generate a comprehensive DSM-5 aligned clinical screening report based on the following biomarker data.

${ageContext}

Biomarker Data:
${JSON.stringify(biomarkers, null, 2)}

Structure the report with these EXACT section headers:

CRITERION A -- SOCIAL COMMUNICATION & INTERACTION
Analyze social gaze patterns (avgGazeScore), vocalization quality (avgVocalizationScore), facial affect (dominantFaceBehavior if available), and their mapping to DSM-5 Criterion A sub-criteria (A.1 social-emotional reciprocity, A.2 nonverbal communication, A.3 relationships).

CRITERION B -- RESTRICTED & REPETITIVE BEHAVIOURS
Analyze motor patterns (avgMotorScore), response latency, body behavior classification (dominantBodyBehavior, behaviorClassDistribution if available), and mapping to DSM-5 Criterion B sub-criteria (B.1 stereotyped movements, B.2 insistence on sameness, B.3 restricted interests, B.4 sensory reactivity).

MOTOR DEVELOPMENT ASSESSMENT
Provide a focused motor development analysis based on the motor score and any detected body behavior patterns. Note co-occurring motor differences common in ASD.

RECOMMENDATIONS
Provide actionable next steps based on the screening results: referral recommendations, suggested interventions, monitoring frequency. Include a disclaimer that this is a screening tool, not a diagnostic instrument.

Guidelines:
- Use clinical but accessible language
- Reference specific DSM-5 criteria codes where appropriate
- Include specific scores and thresholds in your analysis
- Be factual and evidence-based, avoid speculation
- End with a clear disclaimer about the screening nature of this tool`;

  try {
    const client = getBedrockClient();
    const invokeBody = JSON.stringify({
      message: prompt,
      max_tokens: 2048,
      temperature: 0.5,
    });

    const command = new InvokeModelCommand({
      modelId: "cohere.command-r-plus-v1:0",
      contentType: "application/json",
      accept: "application/json",
      body: new TextEncoder().encode(invokeBody),
    });

    const response = await client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    // Cohere Command R+ returns: { text: "..." }
    const reportText: string =
      responseBody?.text ??
      responseBody?.generations?.[0]?.text ??
      "";

    if (!reportText) {
      console.warn("[Report/Clinical] Empty response from Bedrock, using mock");
      return NextResponse.json(buildMockReport(biomarkers, childAge));
    }

    const sections = parseSections(reportText);

    return NextResponse.json({
      report: reportText,
      sections,
    });
  } catch (err) {
    console.error("[Report/Clinical] Bedrock invocation failed:", err);
    // Graceful degradation: return mock report on error
    return NextResponse.json(buildMockReport(biomarkers, childAge));
  }
}
