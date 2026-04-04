/**
 * ActionDetector — rule-based detection of specific physical actions
 * from YOLO COCO-17 keypoints. Used by Step 7 to verify the child
 * performed motor instructions (touch nose, wave, clap, etc.).
 *
 * Keypoints arrive in 320×240 pixel space from YOLO. We normalize
 * to 0-1 range inside detectAction() so all thresholds are
 * resolution-independent and intuitive to tune.
 */

// ── COCO-17 keypoint indices ─────────────────────────────────────────
const NOSE = 0;
const L_EAR = 3;
const R_EAR = 4;
const L_SHOULDER = 5;
const R_SHOULDER = 6;
const L_ELBOW = 7;
const R_ELBOW = 8;
const L_WRIST = 9;
const R_WRIST = 10;
const L_HIP = 11;
const R_HIP = 12;

// ── Frame dimensions (YOLO capture size) ─────────────────────────────
const FRAME_W = 320;
const FRAME_H = 240;

// ── Types ────────────────────────────────────────────────────────────

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
  wave: { label: "Wave hello", emoji: "\uD83D\uDC4B" },
  touch_nose: { label: "Touch your nose", emoji: "\uD83D\uDC43" },
  clap: { label: "Clap your hands", emoji: "\uD83D\uDC4F" },
  raise_arms: { label: "Raise your arms", emoji: "\uD83D\uDE4C" },
  touch_head: { label: "Touch your head", emoji: "\uD83E\uDD1A" },
  touch_ears: { label: "Touch your ears", emoji: "\uD83D\uDC42" },
};

// ── Debug logging ────────────────────────────────────────────────────

interface DebugEntry {
  ts: number;
  action: string;
  hit: boolean;
  proximity: number;
  consec: number;
  scale: number;
  detail: string;
}

const DEBUG_LOG: DebugEntry[] = [];
const MAX_DEBUG = 200;

function debugLog(entry: Omit<DebugEntry, "ts">) {
  DEBUG_LOG.push({ ...entry, ts: Date.now() });
  if (DEBUG_LOG.length > MAX_DEBUG) DEBUG_LOG.shift();
  if (typeof window !== "undefined") {
     
    (window as any).__actionDebug = DEBUG_LOG;
  }
}

export function getDebugLog(): DebugEntry[] {
  return DEBUG_LOG;
}

// ── Helpers ──────────────────────────────────────────────────────────

function kp(keypoints: Float32Array, idx: number): [number, number] {
  return [keypoints[idx * 2], keypoints[idx * 2 + 1]];
}

function dist(a: [number, number], b: [number, number]): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return Math.sqrt(dx * dx + dy * dy);
}

/** Normalize pixel-space keypoints to 0-1 range */
function normalizeKeypoints(raw: Float32Array): Float32Array {
  const norm = new Float32Array(raw.length);
  for (let i = 0; i < raw.length; i += 2) {
    norm[i] = raw[i] / FRAME_W;
    norm[i + 1] = raw[i + 1] / FRAME_H;
  }
  return norm;
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
  return s > 0.01 ? s : 0.01;
}

// ── Confidence gate ──────────────────────────────────────────────────
const CONF_GATE = 0.05;

// ── Per-action detection rules (ALL operate in 0-1 normalized space) ─

function detectTouchNose(
  kps: Float32Array,
  conf: Float32Array,
  _scale: number,
): { hit: boolean; proximity: number; detail: string } {
  // HEAD-REGION approach: check if wrist is in the face zone
  // (above shoulders, horizontally between them)
  const lOk = conf[L_WRIST] > CONF_GATE;
  const rOk = conf[R_WRIST] > CONF_GATE;
  const shouldersOk = conf[L_SHOULDER] > CONF_GATE && conf[R_SHOULDER] > CONF_GATE;
  if ((!lOk && !rOk) || !shouldersOk)
    return { hit: false, proximity: 0, detail: `lW=${conf[L_WRIST]?.toFixed(3)} rW=${conf[R_WRIST]?.toFixed(3)} sOk=${shouldersOk}` };

  const faceCenterX = (kps[L_SHOULDER * 2] + kps[R_SHOULDER * 2]) / 2;
  const shoulderY = (kps[L_SHOULDER * 2 + 1] + kps[R_SHOULDER * 2 + 1]) / 2;
  const shoulderWidth = Math.abs(kps[L_SHOULDER * 2] - kps[R_SHOULDER * 2]);

  let bestProx = 0;
  let bestHit = false;
  let detail = "";

  for (const [ok, idx, label] of [[lOk, L_WRIST, "L"], [rOk, R_WRIST, "R"]] as const) {
    if (!ok) continue;
    const wx = kps[idx * 2];
    const wy = kps[idx * 2 + 1];
    // Horizontal: how far from face center (normalized by shoulder width)
    const dx = Math.abs(wx - faceCenterX) / Math.max(shoulderWidth, 0.01);
    // Vertical: how far above shoulders (positive = above). COCO wrist keypoint
    // is at the wrist joint, not fingertips — when touching face, wrist is still
    // well below chin. Allow wrist up to 15% of frame BELOW shoulder line.
    const dy = shoulderY - wy;
    const hProx = Math.max(0, 1 - dx);
    const vProx = Math.max(0, Math.min(1, (dy + 0.15) / 0.20));
    const prox = Math.min(hProx, vProx);
    // Hit: within shoulder width horizontally, wrist anywhere from chin to forehead
    const isHit = dx < 0.8 && dy > -0.15;
    detail += `${label}:dx=${dx.toFixed(2)} dy=${dy.toFixed(3)} hp=${hProx.toFixed(2)} vp=${vProx.toFixed(2)} `;
    if (prox > bestProx) bestProx = prox;
    if (isHit) bestHit = true;
  }

  detail += `shW=${shoulderWidth.toFixed(3)}`;
  return { hit: bestHit, proximity: bestProx, detail };
}

function detectWave(
  kps: Float32Array,
  conf: Float32Array,
  _scale: number,
  history: Float32Array[],
): { hit: boolean; proximity: number; detail: string } {
  const lAbove =
    conf[L_WRIST] > CONF_GATE && conf[L_SHOULDER] > CONF_GATE &&
    kps[L_WRIST * 2 + 1] < kps[L_SHOULDER * 2 + 1];
  const rAbove =
    conf[R_WRIST] > CONF_GATE && conf[R_SHOULDER] > CONF_GATE &&
    kps[R_WRIST * 2 + 1] < kps[R_SHOULDER * 2 + 1];
  if (!lAbove && !rAbove) return { hit: false, proximity: 0, detail: "no wrist above shoulder" };

  if (history.length < 5) return { hit: false, proximity: 0.3, detail: `hist=${history.length}/5` };
  const wristIdx = lAbove ? L_WRIST : R_WRIST;
  const xValues = history.slice(-10).map((h) => h[wristIdx * 2]);
  xValues.push(kps[wristIdx * 2]);
  const mean = xValues.reduce((a, b) => a + b, 0) / xValues.length;
  const variance = xValues.reduce((a, x) => a + (x - mean) ** 2, 0) / xValues.length;
  // In 0-1 space: wave of 30px in 320-wide = 0.094 normalized.
  // Variance of [0.45, 0.55, 0.45, 0.55] = 0.0025. Threshold well below that.
  const threshold = 0.0008;
  return {
    hit: variance > threshold,
    proximity: Math.min(1, variance / threshold),
    detail: `var=${variance.toFixed(6)} thr=${threshold}`,
  };
}

function detectClap(
  kps: Float32Array,
  conf: Float32Array,
  _scale: number,
  history: Float32Array[] = [],
): { hit: boolean; proximity: number; detail: string } {
  const hasL = conf[L_WRIST] > CONF_GATE;
  const hasR = conf[R_WRIST] > CONF_GATE;

  if (hasL && hasR) {
    const d = dist(kp(kps, L_WRIST), kp(kps, R_WRIST));
    // COCO wrist keypoints are at wrist joints, NOT fingertips. When palms
    // touch, wrist-to-wrist is still ~forearm-width apart (~0.15-0.25 in 0-1).
    // At rest with arms down, distance is ~0.3-0.5.
    const hitThreshold = 0.28;
    const proximityRange = 0.45;

    // Dynamic: hands approaching over 2 frames
    if (history.length >= 2) {
      const prev = history[history.length - 1];
      if (prev) {
        const prevD = dist(kp(prev, L_WRIST), kp(prev, R_WRIST));
        if (prevD > d && d < 0.35) {
          const approach = prevD - d;
          if (approach > 0.008) {
            return { hit: true, proximity: Math.min(1, approach / 0.02), detail: `dynamic d=${d.toFixed(3)} prev=${prevD.toFixed(3)} approach=${approach.toFixed(3)}` };
          }
        }
      }
    }

    if (d < hitThreshold) return { hit: true, proximity: Math.max(0.5, 1 - d / hitThreshold), detail: `static d=${d.toFixed(3)} thr=${hitThreshold}` };
    return { hit: false, proximity: Math.max(0, 1 - d / proximityRange), detail: `dist d=${d.toFixed(3)} range=${proximityRange}` };
  }

  // Single wrist near body center — when hands clap, one wrist occludes the other
  if (hasL || hasR) {
    const wristIdx = hasL ? L_WRIST : R_WRIST;
    const shoulderOk = conf[L_SHOULDER] > CONF_GATE || conf[R_SHOULDER] > CONF_GATE;
    if (shoulderOk) {
      const lsOk = conf[L_SHOULDER] > CONF_GATE;
      const rsOk = conf[R_SHOULDER] > CONF_GATE;
      const midX = lsOk && rsOk
        ? (kps[L_SHOULDER * 2] + kps[R_SHOULDER * 2]) / 2
        : lsOk ? kps[L_SHOULDER * 2] : kps[R_SHOULDER * 2];
      const dCenter = Math.abs(kps[wristIdx * 2] - midX);
      const centerThreshold = 0.12;
      if (dCenter < centerThreshold) {
        return { hit: true, proximity: Math.max(0.5, 1 - dCenter / centerThreshold), detail: `1wrist-center dC=${dCenter.toFixed(3)} thr=${centerThreshold}` };
      }
      return { hit: false, proximity: Math.max(0.1, 0.5 * (1 - dCenter / 0.25)), detail: `1wrist dC=${dCenter.toFixed(3)}` };
    }
  }

  return { hit: false, proximity: 0, detail: `noWrists lC=${conf[L_WRIST]?.toFixed(3)} rC=${conf[R_WRIST]?.toFixed(3)}` };
}

function detectRaiseArms(
  kps: Float32Array,
  conf: Float32Array,
  _scale: number,
): { hit: boolean; proximity: number; detail: string } {
  const hasLeft = conf[L_WRIST] > CONF_GATE && conf[L_SHOULDER] > CONF_GATE;
  const hasRight = conf[R_WRIST] > CONF_GATE && conf[R_SHOULDER] > CONF_GATE;
  const hasLeftElbow = !hasLeft && conf[L_ELBOW] > CONF_GATE && conf[L_SHOULDER] > CONF_GATE;
  const hasRightElbow = !hasRight && conf[R_ELBOW] > CONF_GATE && conf[R_SHOULDER] > CONF_GATE;

  if (!hasLeft && !hasRight && !hasLeftElbow && !hasRightElbow)
    return { hit: false, proximity: 0, detail: `noKP lW=${conf[L_WRIST]?.toFixed(3)} rW=${conf[R_WRIST]?.toFixed(3)} lS=${conf[L_SHOULDER]?.toFixed(3)} rS=${conf[R_SHOULDER]?.toFixed(3)}` };

  // In 0-1 space, Y increases downward. Wrist above shoulder = positive diff.
  // margin: 2% of frame height (~5px in 240-high frame)
  const margin = 0.02;
  let bestProximity = 0;
  let hit = false;
  let detail = "";

  if (hasLeft) {
    const diff = kps[L_SHOULDER * 2 + 1] - kps[L_WRIST * 2 + 1];
    if (diff > margin) hit = true;
    const p = Math.max(0, (diff + 0.05) / 0.15);
    bestProximity = Math.max(bestProximity, p);
    detail += `Lw:diff=${diff.toFixed(3)} `;
  }
  if (hasRight) {
    const diff = kps[R_SHOULDER * 2 + 1] - kps[R_WRIST * 2 + 1];
    if (diff > margin) hit = true;
    const p = Math.max(0, (diff + 0.05) / 0.15);
    bestProximity = Math.max(bestProximity, p);
    detail += `Rw:diff=${diff.toFixed(3)} `;
  }
  if (hasLeftElbow) {
    const diff = kps[L_SHOULDER * 2 + 1] - kps[L_ELBOW * 2 + 1];
    if (diff > 0.03) hit = true;
    const p = Math.max(0, (diff + 0.03) / 0.12);
    bestProximity = Math.max(bestProximity, p);
    detail += `Le:diff=${diff.toFixed(3)} `;
  }
  if (hasRightElbow) {
    const diff = kps[R_SHOULDER * 2 + 1] - kps[R_ELBOW * 2 + 1];
    if (diff > 0.03) hit = true;
    const p = Math.max(0, (diff + 0.03) / 0.12);
    bestProximity = Math.max(bestProximity, p);
    detail += `Re:diff=${diff.toFixed(3)} `;
  }

  detail += `margin=${margin}`;
  return { hit, proximity: Math.min(1, bestProximity), detail };
}

function detectTouchHead(
  kps: Float32Array,
  conf: Float32Array,
  _scale: number,
): { hit: boolean; proximity: number; detail: string } {
  // Same head-region approach as touch_nose but slightly more generous
  const lOk = conf[L_WRIST] > CONF_GATE;
  const rOk = conf[R_WRIST] > CONF_GATE;
  const shouldersOk = conf[L_SHOULDER] > CONF_GATE && conf[R_SHOULDER] > CONF_GATE;
  if ((!lOk && !rOk) || !shouldersOk)
    return { hit: false, proximity: 0, detail: "low conf" };

  const faceCenterX = (kps[L_SHOULDER * 2] + kps[R_SHOULDER * 2]) / 2;
  const shoulderY = (kps[L_SHOULDER * 2 + 1] + kps[R_SHOULDER * 2 + 1]) / 2;
  const shoulderWidth = Math.abs(kps[L_SHOULDER * 2] - kps[R_SHOULDER * 2]);

  let bestProx = 0;
  let hit = false;
  let detail = "";

  for (const [ok, idx, label] of [[lOk, L_WRIST, "L"], [rOk, R_WRIST, "R"]] as const) {
    if (!ok) continue;
    const dx = Math.abs(kps[idx * 2] - faceCenterX) / Math.max(shoulderWidth, 0.01);
    const dy = shoulderY - kps[idx * 2 + 1];
    const prox = Math.min(Math.max(0, 1 - dx), Math.max(0, Math.min(1, (dy + 0.15) / 0.20)));
    if (dx < 1.0 && dy > -0.15) hit = true;
    if (prox > bestProx) bestProx = prox;
    detail += `${label}:dx=${dx.toFixed(2)} dy=${dy.toFixed(3)} `;
  }

  return { hit, proximity: bestProx, detail };
}

function detectTouchEars(
  kps: Float32Array,
  conf: Float32Array,
  _scale: number,
): { hit: boolean; proximity: number; detail: string } {
  const lOk = conf[L_WRIST] > CONF_GATE && conf[L_EAR] > CONF_GATE;
  const rOk = conf[R_WRIST] > CONF_GATE && conf[R_EAR] > CONF_GATE;
  if (!lOk && !rOk) return { hit: false, proximity: 0, detail: "low conf" };
  const dL = lOk ? dist(kp(kps, L_WRIST), kp(kps, L_EAR)) : Infinity;
  const dR = rOk ? dist(kp(kps, R_WRIST), kp(kps, R_EAR)) : Infinity;
  const minD = Math.min(dL, dR);
  // In 0-1 space, ear-to-wrist when touching ≈ 0.02-0.05
  const threshold = 0.10;
  return { hit: minD < threshold, proximity: Math.max(0, 1 - minD / (threshold * 2)), detail: `d=${minD.toFixed(3)} thr=${threshold}` };
}

// ── Main detection function ──────────────────────────────────────────

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

  // Normalize pixel coords (320×240) to 0-1 range
  const nkps = normalizeKeypoints(keypoints);
  const nHistory = history.map(h => normalizeKeypoints(h));
  const scale = bodyScale(nkps);
  const meta = ACTION_META[action];

  let result: { hit: boolean; proximity: number; detail: string };
  switch (action) {
    case "touch_nose":
      result = detectTouchNose(nkps, confidence, scale);
      break;
    case "wave":
      result = detectWave(nkps, confidence, scale, nHistory);
      break;
    case "clap":
      result = detectClap(nkps, confidence, scale, nHistory);
      break;
    case "raise_arms":
      result = detectRaiseArms(nkps, confidence, scale);
      break;
    case "touch_head":
      result = detectTouchHead(nkps, confidence, scale);
      break;
    case "touch_ears":
      result = detectTouchEars(nkps, confidence, scale);
      break;
    default:
      result = { hit: false, proximity: 0, detail: "unknown" };
  }

  return {
    detected: result.hit,
    confidence: result.proximity,
    label: meta.label,
    emoji: meta.emoji,
    _detail: result.detail,
  } as ActionResult;
}

// ── Sustained detection tracker ──────────────────────────────────────

export const REQUIRED_CONSECUTIVE = 3;

export class ActionTracker {
  private consecutiveHits = 0;
  private confirmed = false;
  private history: Float32Array[] = [];
  private frameCount = 0;

  reset(): void {
    this.consecutiveHits = 0;
    this.confirmed = false;
    this.history = [];
    this.frameCount = 0;
  }

  /** Feed a new frame and return whether the action is confirmed. */
  update(
    keypoints: Float32Array,
    confidence: Float32Array,
    action: ActionId,
  ): ActionResult & { confirmed: boolean; consecutiveHits: number; requiredHits: number } {
    this.history.push(new Float32Array(keypoints));
    if (this.history.length > 15) this.history.shift();

    this.frameCount++;

    // Diagnostic logging every 30th frame
    if (this.frameCount % 30 === 0) {
      const nose = kp(keypoints, NOSE);
      const ls = kp(keypoints, L_SHOULDER);
      const rs = kp(keypoints, R_SHOULDER);
      const lw = kp(keypoints, L_WRIST);
      const rw = kp(keypoints, R_WRIST);
      const rawScale = bodyScale(keypoints);
      const normScale = bodyScale(normalizeKeypoints(keypoints));
      console.log(
        `[ActionDiag] f=${this.frameCount} action=${action} rawScale=${rawScale.toFixed(1)} normScale=${normScale.toFixed(3)}`,
        `\n  nose=(${nose[0].toFixed(1)},${nose[1].toFixed(1)}) c=${confidence[NOSE].toFixed(3)}`,
        `\n  lSh=(${ls[0].toFixed(1)},${ls[1].toFixed(1)}) c=${confidence[L_SHOULDER].toFixed(3)}`,
        `\n  rSh=(${rs[0].toFixed(1)},${rs[1].toFixed(1)}) c=${confidence[R_SHOULDER].toFixed(3)}`,
        `\n  lWr=(${lw[0].toFixed(1)},${lw[1].toFixed(1)}) c=${confidence[L_WRIST].toFixed(3)}`,
        `\n  rWr=(${rw[0].toFixed(1)},${rw[1].toFixed(1)}) c=${confidence[R_WRIST].toFixed(3)}`,
        `\n  conf=[${Array.from(confidence).map(v => v.toFixed(2)).join(",")}]`,
      );
    }

    const result = detectAction(keypoints, confidence, action, this.history);

    if (result.detected) {
      this.consecutiveHits++;
    } else {
      this.consecutiveHits = Math.max(0, this.consecutiveHits - 1);
    }

    if (this.consecutiveHits >= REQUIRED_CONSECUTIVE) {
      this.confirmed = true;
    }

     
    const fnDetail = (result as any)._detail ?? "";
    debugLog({
      action,
      hit: result.detected,
      proximity: result.confidence,
      consec: this.consecutiveHits,
      scale: bodyScale(normalizeKeypoints(keypoints)),
      detail: `${action} ${result.detected ? "HIT" : "---"} p=${result.confidence.toFixed(2)} c=${this.consecutiveHits}/${REQUIRED_CONSECUTIVE} | ${fnDetail}`,
    });

    return {
      ...result,
      confirmed: this.confirmed,
      consecutiveHits: Math.min(this.consecutiveHits, REQUIRED_CONSECUTIVE),
      requiredHits: REQUIRED_CONSECUTIVE,
    };
  }
}
