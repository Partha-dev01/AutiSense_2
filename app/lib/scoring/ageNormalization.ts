/**
 * Age-group normalization for biomarker scores.
 * Younger children naturally score lower on raw metrics — these multipliers
 * adjust for developmental expectations so a neurotypical child of any age
 * can score near 100%.
 */

export type AgeGroup = "12-24" | "24-48" | "48-72" | "72+";

export function getAgeGroup(ageMonths: number): AgeGroup {
  if (ageMonths < 24) return "12-24";
  if (ageMonths < 48) return "24-48";
  if (ageMonths < 72) return "48-72";
  return "72+";
}

/** Per-domain score multipliers by age group (capped at 1.0 after application). */
export const AGE_MULTIPLIERS: Record<AgeGroup, { gaze: number; motor: number; vocal: number }> = {
  "12-24": { gaze: 1.4, motor: 1.5, vocal: 1.6 },
  "24-48": { gaze: 1.15, motor: 1.2, vocal: 1.3 },
  "48-72": { gaze: 1.0, motor: 1.0, vocal: 1.0 },
  "72+":   { gaze: 1.0, motor: 1.0, vocal: 1.0 },
};

/** Apply age-based normalization to a raw domain score. */
export function normalizeScore(
  rawScore: number,
  domain: "gaze" | "motor" | "vocal",
  ageMonths: number,
): number {
  const group = getAgeGroup(ageMonths);
  return Math.min(1.0, rawScore * AGE_MULTIPLIERS[group][domain]);
}

/** Age-based DSM-5 flag thresholds. Younger children have lower thresholds. */
export const AGE_THRESHOLDS: Record<AgeGroup, {
  gazeFlag: number;
  vocalFlag: number;
  motorFlag: number;
  latencyFlag: number;
}> = {
  "12-24": { gazeFlag: 0.25, vocalFlag: 0.20, motorFlag: 0.20, latencyFlag: 5000 },
  "24-48": { gazeFlag: 0.35, vocalFlag: 0.30, motorFlag: 0.30, latencyFlag: 4000 },
  "48-72": { gazeFlag: 0.40, vocalFlag: 0.35, motorFlag: 0.35, latencyFlag: 3000 },
  "72+":   { gazeFlag: 0.40, vocalFlag: 0.35, motorFlag: 0.35, latencyFlag: 3000 },
};
