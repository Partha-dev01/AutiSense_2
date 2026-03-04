/**
 * ActionDetector — rule-based detection of specific physical actions
 * from YOLO COCO-17 keypoints. Used by Step 7 to verify the child
 * performed motor instructions (touch nose, wave, clap, etc.).
 *
 * All distances are normalised by shoulder-to-hip body scale so
 * thresholds are size-invariant.
 */

// ── COCO-17 keypoint indices (same as FeatureEncoder.ts) ────────────
const NOSE = 0;
const L_EAR = 3;
const R_EAR = 4;
const L_SHOULDER = 5;
const R_SHOULDER = 6;
const L_WRIST = 9;
const R_WRIST = 10;
const L_HIP = 11;
const R_HIP = 12;

// ── Types ───────────────────────────────────────────────────────────

export type ActionId =
  | "wave"
  | "touch_nose"
  | "clap"
  | "raise_arms"
  | "touch_head"
  | "touch_ears";

export interface ActionResult {
  detected: boolean;
  confidence: number; // 0-1, how close to detection threshold
  label: string;
  emoji: string;
}

export const ACTION_META: Record<ActionId, { label: string; emoji: string }> = {
  wave: { label: "Wave hello", emoji: "👋" },
  touch_nose: { label: "Touch your nose", emoji: "👃" },
  clap: { label: "Clap your hands", emoji: "👏" },
  raise_arms: { label: "Raise your arms", emoji: "🙌" },
  touch_head: { label: "Touch your head", emoji: "🤚" },
  touch_ears: { label: "Touch your ears", emoji: "👂" },
};

// ── Helpers ─────────────────────────────────────────────────────────

function kp(keypoints: Float32Array, idx: number): [number, number] {
  return [keypoints[idx * 2], keypoints[idx * 2 + 1]];
}

function dist(a: [number, number], b: [number, number]): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return Math.sqrt(dx * dx + dy * dy);
}

function bodyScale(keypoints: Float32Array): number {
  const midShoulder: [number, number] = [
    (keypoints[L_SHOULDER * 2] + keypoints[R_SHOULDER * 2]) / 2,
    (keypoints[L_SHOULDER * 2 + 1] + keypoints[R_SHOULDER * 2 + 1]) / 2,
  ];
  const midHip: [number, number] = [
    (keypoints[L_HIP * 2] + keypoints[R_HIP * 2]) / 2,
    (keypoints[L_HIP * 2 + 1] + keypoints[R_HIP * 2 + 1]) / 2,
  ];
  const s = dist(midShoulder, midHip);
  return s > 0 ? s : 1; // avoid division by zero
}

function confOk(confidence: Float32Array, ...indices: number[]): boolean {
  return indices.every((i) => confidence[i] > 0.3);
}

// ── Per-action detection rules ──────────────────────────────────────

function detectTouchNose(
  kps: Float32Array,
  conf: Float32Array,
  scale: number,
): { hit: boolean; proximity: number } {
  if (!confOk(conf, NOSE, L_WRIST) && !confOk(conf, NOSE, R_WRIST))
    return { hit: false, proximity: 0 };
  const nose = kp(kps, NOSE);
  const dL = confOk(conf, L_WRIST) ? dist(kp(kps, L_WRIST), nose) : Infinity;
  const dR = confOk(conf, R_WRIST) ? dist(kp(kps, R_WRIST), nose) : Infinity;
  const minD = Math.min(dL, dR);
  const threshold = 0.25 * scale;
  return { hit: minD < threshold, proximity: Math.max(0, 1 - minD / threshold) };
}

function detectWave(
  kps: Float32Array,
  conf: Float32Array,
  _scale: number,
  history: Float32Array[],
): { hit: boolean; proximity: number } {
  // Need at least one wrist above its shoulder
  const lAbove =
    confOk(conf, L_WRIST, L_SHOULDER) &&
    kps[L_WRIST * 2 + 1] < kps[L_SHOULDER * 2 + 1];
  const rAbove =
    confOk(conf, R_WRIST, R_SHOULDER) &&
    kps[R_WRIST * 2 + 1] < kps[R_SHOULDER * 2 + 1];
  if (!lAbove && !rAbove) return { hit: false, proximity: 0 };

  // Check horizontal oscillation over recent frames
  if (history.length < 6) return { hit: false, proximity: 0.3 };
  const wristIdx = lAbove ? L_WRIST : R_WRIST;
  const xValues = history.slice(-10).map((h) => h[wristIdx * 2]);
  xValues.push(kps[wristIdx * 2]);
  const mean = xValues.reduce((a, b) => a + b, 0) / xValues.length;
  const variance =
    xValues.reduce((a, x) => a + (x - mean) ** 2, 0) / xValues.length;
  const threshold = 0.015;
  return {
    hit: variance > threshold,
    proximity: Math.min(1, variance / threshold),
  };
}

function detectClap(
  kps: Float32Array,
  conf: Float32Array,
  scale: number,
): { hit: boolean; proximity: number } {
  if (!confOk(conf, L_WRIST, R_WRIST))
    return { hit: false, proximity: 0 };
  const d = dist(kp(kps, L_WRIST), kp(kps, R_WRIST));
  const threshold = 0.2 * scale;
  return { hit: d < threshold, proximity: Math.max(0, 1 - d / threshold) };
}

function detectRaiseArms(
  kps: Float32Array,
  conf: Float32Array,
  scale: number,
): { hit: boolean; proximity: number } {
  if (!confOk(conf, L_WRIST, R_WRIST, L_SHOULDER, R_SHOULDER))
    return { hit: false, proximity: 0 };
  const margin = 0.05 * scale;
  const lUp = kps[L_WRIST * 2 + 1] < kps[L_SHOULDER * 2 + 1] - margin;
  const rUp = kps[R_WRIST * 2 + 1] < kps[R_SHOULDER * 2 + 1] - margin;
  return { hit: lUp && rUp, proximity: (lUp ? 0.5 : 0) + (rUp ? 0.5 : 0) };
}

function detectTouchHead(
  kps: Float32Array,
  conf: Float32Array,
  scale: number,
): { hit: boolean; proximity: number } {
  if (!confOk(conf, NOSE, L_WRIST) && !confOk(conf, NOSE, R_WRIST))
    return { hit: false, proximity: 0 };
  const nose = kp(kps, NOSE);
  const dL = confOk(conf, L_WRIST) ? dist(kp(kps, L_WRIST), nose) : Infinity;
  const dR = confOk(conf, R_WRIST) ? dist(kp(kps, R_WRIST), nose) : Infinity;
  const minD = Math.min(dL, dR);
  const threshold = 0.3 * scale;
  return { hit: minD < threshold, proximity: Math.max(0, 1 - minD / threshold) };
}

function detectTouchEars(
  kps: Float32Array,
  conf: Float32Array,
  scale: number,
): { hit: boolean; proximity: number } {
  const dL =
    confOk(conf, L_WRIST, L_EAR)
      ? dist(kp(kps, L_WRIST), kp(kps, L_EAR))
      : Infinity;
  const dR =
    confOk(conf, R_WRIST, R_EAR)
      ? dist(kp(kps, R_WRIST), kp(kps, R_EAR))
      : Infinity;
  if (dL === Infinity && dR === Infinity) return { hit: false, proximity: 0 };
  const minD = Math.min(dL, dR);
  const threshold = 0.25 * scale;
  return { hit: minD < threshold, proximity: Math.max(0, 1 - minD / threshold) };
}

// ── Main detection function ─────────────────────────────────────────

export function detectAction(
  keypoints: Float32Array,
  confidence: Float32Array,
  action: ActionId,
  history: Float32Array[] = [],
): ActionResult {
  if (!keypoints || keypoints.length < 34 || !confidence || confidence.length < 17) {
    const meta = ACTION_META[action];
    return { detected: false, confidence: 0, label: meta.label, emoji: meta.emoji };
  }

  const scale = bodyScale(keypoints);
  const meta = ACTION_META[action];

  let result: { hit: boolean; proximity: number };
  switch (action) {
    case "touch_nose":
      result = detectTouchNose(keypoints, confidence, scale);
      break;
    case "wave":
      result = detectWave(keypoints, confidence, scale, history);
      break;
    case "clap":
      result = detectClap(keypoints, confidence, scale);
      break;
    case "raise_arms":
      result = detectRaiseArms(keypoints, confidence, scale);
      break;
    case "touch_head":
      result = detectTouchHead(keypoints, confidence, scale);
      break;
    case "touch_ears":
      result = detectTouchEars(keypoints, confidence, scale);
      break;
    default:
      result = { hit: false, proximity: 0 };
  }

  return {
    detected: result.hit,
    confidence: result.proximity,
    label: meta.label,
    emoji: meta.emoji,
  };
}

// ── Sustained detection tracker ─────────────────────────────────────

const REQUIRED_CONSECUTIVE = 8;

export class ActionTracker {
  private consecutiveHits = 0;
  private confirmed = false;
  private history: Float32Array[] = [];

  reset(): void {
    this.consecutiveHits = 0;
    this.confirmed = false;
    this.history = [];
  }

  /** Feed a new frame and return whether the action is confirmed. */
  update(
    keypoints: Float32Array,
    confidence: Float32Array,
    action: ActionId,
  ): ActionResult & { confirmed: boolean; consecutiveHits: number; requiredHits: number } {
    this.history.push(new Float32Array(keypoints));
    if (this.history.length > 15) this.history.shift();

    const result = detectAction(keypoints, confidence, action, this.history);

    if (result.detected) {
      this.consecutiveHits++;
    } else {
      this.consecutiveHits = Math.max(0, this.consecutiveHits - 1);
    }

    if (this.consecutiveHits >= REQUIRED_CONSECUTIVE) {
      this.confirmed = true;
    }

    return {
      ...result,
      confirmed: this.confirmed,
      consecutiveHits: Math.min(this.consecutiveHits, REQUIRED_CONSECUTIVE),
      requiredHits: REQUIRED_CONSECUTIVE,
    };
  }
}
