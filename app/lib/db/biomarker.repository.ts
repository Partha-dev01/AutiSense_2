import { db } from "./schema";
import { getCurrentUserId } from "../identity/identity";
import { normalizeScore, getAgeGroup, AGE_THRESHOLDS } from "../scoring/ageNormalization";
import type {
  Biomarker,
  BiomarkerAggregate,
  TaskId,
} from "../../types/biomarker";

/** Which domains each task actually measures. Used to exclude placeholder 0.5 values. */
const TASK_DOMAINS: Record<string, { gaze: boolean; motor: boolean; vocal: boolean }> = {
  communication_responsiveness: { gaze: false, motor: false, vocal: true },
  behavioral_observation:       { gaze: true,  motor: false, vocal: false },
  preparation_interactive:      { gaze: false, motor: true,  vocal: false },
  motor_assessment:             { gaze: false, motor: true,  vocal: false },
  behavioral_video:             { gaze: true,  motor: true,  vocal: false },
  social_visual_engagement:     { gaze: true,  motor: false, vocal: false },
  audio_assessment:             { gaze: false, motor: false, vocal: true },
  gaze_tracking:                { gaze: true,  motor: false, vocal: false },
  motor_tap:                    { gaze: false, motor: true,  vocal: false },
  sound_match:                  { gaze: false, motor: false, vocal: true },
  social_attention:             { gaze: true,  motor: false, vocal: false },
  response_latency:             { gaze: false, motor: true,  vocal: false },
};

//Create
export async function addBiomarker(
  sessionId: string,
  taskId: TaskId,
  reading: {
    gazeScore: number;
    motorScore: number;
    vocalizationScore: number;
    responseLatencyMs?: number | null;
    // Extended fields for behavioral_video task
    asdRiskScore?: number;
    bodyBehaviorClass?: string;
    faceBehaviorClass?: string;
    bodyProbabilities?: number[];
    faceProbabilities?: number[];
    emotionDistribution?: number[];
  },
): Promise<void> {
  const userId = getCurrentUserId();

  await db.biomarkers.add({
    sessionId,
    userId,
    taskId,
    gazeScore: clamp(reading.gazeScore),
    motorScore: clamp(reading.motorScore),
    vocalizationScore: clamp(reading.vocalizationScore),
    responseLatencyMs: reading.responseLatencyMs ?? null,
    // Extended fields (Stage 10 video analysis)
    asdRiskScore: reading.asdRiskScore != null ? clamp(reading.asdRiskScore) : undefined,
    bodyBehaviorClass: reading.bodyBehaviorClass,
    faceBehaviorClass: reading.faceBehaviorClass,
    bodyProbabilities: reading.bodyProbabilities,
    faceProbabilities: reading.faceProbabilities,
    emotionDistribution: reading.emotionDistribution,
    timestamp: Date.now(),
  });
}

//Read
export async function getBiomarkersBySession(
  sessionId: string,
): Promise<Biomarker[]> {
  return db.biomarkers.where("sessionId").equals(sessionId).sortBy("timestamp");
}

export async function getBiomarkersByTask(
  sessionId: string,
  taskId: TaskId,
): Promise<Biomarker[]> {
  return db.biomarkers
    .where("sessionId")
    .equals(sessionId)
    .filter((b) => b.taskId === taskId)
    .sortBy("timestamp");
}

export async function aggregateBiomarkers(
  sessionId: string,
  ageMonths?: number,
): Promise<BiomarkerAggregate | null> {
  const rows = await getBiomarkersBySession(sessionId);
  if (rows.length === 0) return null;

  const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;

  const latencies = rows
    .map((r) => r.responseLatencyMs)
    .filter((v): v is number => v !== null);

  // Domain-aware averaging: only use scores from tasks that actually measure each domain
  const gazeRows = rows.filter((r) => TASK_DOMAINS[r.taskId]?.gaze);
  const motorRows = rows.filter((r) => TASK_DOMAINS[r.taskId]?.motor);
  const vocalRows = rows.filter((r) => TASK_DOMAINS[r.taskId]?.vocal);

  const rawAvgGaze = gazeRows.length > 0 ? avg(gazeRows.map((r) => r.gazeScore)) : 0.75;
  const rawAvgMotor = motorRows.length > 0 ? avg(motorRows.map((r) => r.motorScore)) : 0.75;
  const rawAvgVocal = vocalRows.length > 0 ? avg(vocalRows.map((r) => r.vocalizationScore)) : 0.75;
  const avgLatency = latencies.length > 0 ? avg(latencies) : null;

  // Apply age normalization if ageMonths provided
  const avgGaze = ageMonths != null ? normalizeScore(rawAvgGaze, "gaze", ageMonths) : rawAvgGaze;
  const avgMotor = ageMonths != null ? normalizeScore(rawAvgMotor, "motor", ageMonths) : rawAvgMotor;
  const avgVocal = ageMonths != null ? normalizeScore(rawAvgVocal, "vocal", ageMonths) : rawAvgVocal;

  // Composite score: weighted average (gaze 40%, motor 30%, vocal 30%)
  const overallScore = Math.round(
    (avgGaze * 0.4 + avgMotor * 0.3 + avgVocal * 0.3) * 100,
  );

  // Age-based DSM-5 thresholds
  const thresholds = ageMonths != null
    ? AGE_THRESHOLDS[getAgeGroup(ageMonths)]
    : { gazeFlag: 0.4, vocalFlag: 0.35, motorFlag: 0.35, latencyFlag: 3000 };

  // Extended fields from Stage 10 detector data
  const videoRows = rows.filter((r) => r.taskId === "behavioral_video");
  let avgAsdRisk: number | undefined;
  let dominantBodyBehavior: string | undefined;
  let dominantFaceBehavior: string | undefined;
  let behaviorClassDistribution: Record<string, number> | undefined;

  if (videoRows.length > 0) {
    const riskScores = videoRows.filter((r) => r.asdRiskScore != null).map((r) => r.asdRiskScore!);
    if (riskScores.length > 0) avgAsdRisk = round(avg(riskScores));

    const bodyCounts: Record<string, number> = {};
    for (const r of videoRows) {
      if (r.bodyBehaviorClass) {
        bodyCounts[r.bodyBehaviorClass] = (bodyCounts[r.bodyBehaviorClass] || 0) + 1;
      }
    }
    if (Object.keys(bodyCounts).length > 0) {
      dominantBodyBehavior = Object.entries(bodyCounts).sort((a, b) => b[1] - a[1])[0][0];
      behaviorClassDistribution = bodyCounts;
    }

    const faceCounts: Record<string, number> = {};
    for (const r of videoRows) {
      if (r.faceBehaviorClass) {
        faceCounts[r.faceBehaviorClass] = (faceCounts[r.faceBehaviorClass] || 0) + 1;
      }
    }
    if (Object.keys(faceCounts).length > 0) {
      dominantFaceBehavior = Object.entries(faceCounts).sort((a, b) => b[1] - a[1])[0][0];
    }
  }

  return {
    sessionId,
    avgGazeScore: round(avgGaze),
    avgMotorScore: round(avgMotor),
    avgVocalizationScore: round(avgVocal),
    avgResponseLatencyMs: avgLatency !== null ? Math.round(avgLatency) : null,
    sampleCount: rows.length,
    overallScore,
    flags: {
      socialCommunication: avgGaze < thresholds.gazeFlag || avgVocal < thresholds.vocalFlag,
      restrictedBehavior:
        avgMotor < thresholds.motorFlag || (avgLatency !== null && avgLatency > thresholds.latencyFlag),
    },
    avgAsdRisk,
    dominantBodyBehavior,
    dominantFaceBehavior,
    behaviorClassDistribution,
  };
}

//Delete
export async function deleteBiomarkersForSession(
  sessionId: string,
): Promise<void> {
  await db.biomarkers.where("sessionId").equals(sessionId).delete();
}

//Helpers
function clamp(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function round(n: number): number {
  return Math.round(n * 10000) / 10000;
}
