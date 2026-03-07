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
  wave: { label: "Wave hello", emoji: "\uD83D\uDC4B" },
  touch_nose: { label: "Touch your nose", emoji: "\uD83D\uDC43" },
  clap: { label: "Clap your hands", emoji: "\uD83D\uDC4F" },
  raise_arms: { label: "Raise your arms", emoji: "\uD83D\uDE4C" },
  touch_head: { label: "Touch your head", emoji: "\uD83E\uDD1A" },
  touch_ears: { label: "Touch your ears", emoji: "\uD83D\uDC42" },
};

// ── Debug logging (attached to window for live inspection) ──────────

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__actionDebug = DEBUG_LOG;
  }
}

export function getDebugLog(): DebugEntry[] {
  return DEBUG_LOG;
}

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
  return s > 0 ? s : 1;
}

// ── Confidence gate — very low so skeleton-visible keypoints pass ────
const CONF_GATE = 0.05;

// ── Per-action detection rules ──────────────────────────────────────

function detectTouchNose(
  kps: Float32Array,
  conf: Float32Array,
  scale: number,
): { hit: boolean; proximity: number; detail: string } {
  // HEAD-REGION approach: YOLO nose keypoint drifts when hand occludes face,
  // so instead of measuring wrist-to-nose distance, check if wrist is in the
  // "face zone" — above shoulders, horizontally between them.
  const lOk = conf[L_WRIST] > CONF_GATE;
  const rOk = conf[R_WRIST] > CONF_GATE;
  const shouldersOk = conf[L_SHOULDER] > CONF_GATE && conf[R_SHOULDER] > CONF_GATE;
  if ((!lOk && !rOk) || !shouldersOk)
    return { hit: false, proximity: 0, detail: `lW=${conf[L_WRIST]?.toFixed(2)} rW=${conf[R_WRIST]?.toFixed(2)} sOk=${shouldersOk}` };

  // Face zone: center between shoulders, above shoulder line
  const faceCenterX = (kps[L_SHOULDER * 2] + kps[R_SHOULDER * 2]) / 2;
  const shoulderY = (kps[L_SHOULDER * 2 + 1] + kps[R_SHOULDER * 2 + 1]) / 2;
  const shoulderWidth = Math.abs(kps[L_SHOULDER * 2] - kps[R_SHOULDER * 2]);

  // Check each wrist: how close to face zone?
  let bestProx = 0;
  let bestHit = false;
  let detail = "";

  for (const [ok, idx, label] of [[lOk, L_WRIST, "L"], [rOk, R_WRIST, "R"]] as const) {
    if (!ok) continue;
    const wx = kps[idx * 2];
    const wy = kps[idx * 2 + 1];
    // Horizontal: how far from face center (normalized by shoulder width)
    const dx = Math.abs(wx - faceCenterX) / Math.max(shoulderWidth, 0.01);
    // Vertical: how far above shoulders (positive = above)
    const dy = (shoulderY - wy) / scale;
    // Wrist is in face zone if: horizontally within 1× shoulder width, and above shoulder line
    const hProx = Math.max(0, 1 - dx); // 1.0 at center, 0 at 1× shoulder width away
    const vProx = Math.max(0, Math.min(1, dy / 0.3)); // 1.0 when 0.3×scale above shoulders
    const prox = Math.min(hProx, vProx);
    const isHit = dx < 0.8 && dy > -0.05; // generous: within shoulder width, roughly at or above shoulder
    detail += `${label}:dx=${dx.toFixed(2)} dy=${dy.toFixed(2)} hp=${hProx.toFixed(2)} vp=${vProx.toFixed(2)} `;
    if (prox > bestProx) bestProx = prox;
    if (isHit) bestHit = true;
  }

  detail += `scale=${scale.toFixed(3)} shW=${shoulderWidth.toFixed(3)}`;
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
  const variance =
    xValues.reduce((a, x) => a + (x - mean) ** 2, 0) / xValues.length;
  const threshold = 0.008;
  return {
    hit: variance > threshold,
    proximity: Math.min(1, variance / threshold),
    detail: `var=${variance.toFixed(4)} thr=${threshold}`,
  };
}

function detectClap(
  kps: Float32Array,
  conf: Float32Array,
  scale: number,
  history: Float32Array[] = [],
): { hit: boolean; proximity: number; detail: string } {
  const hasL = conf[L_WRIST] > CONF_GATE;
  const hasR = conf[R_WRIST] > CONF_GATE;

  if (hasL && hasR) {
    const d = dist(kp(kps, L_WRIST), kp(kps, R_WRIST));
    const hitThreshold = 1.0 * scale; // 1× body scale — very generous
    const proximityRange = 2.0 * scale;

    // Dynamic: hands approaching over 2 frames
    if (history.length >= 2) {
      const prev = history[history.length - 1];
      if (prev) {
        const prevD = dist(kp(prev, L_WRIST), kp(prev, R_WRIST));
        if (prevD > d && d < 1.2 * scale) {
          const approach = (prevD - d) / scale;
          if (approach > 0.02) {
            return { hit: true, proximity: Math.min(1, approach / 0.05), detail: `dynamic d=${d.toFixed(3)} prev=${prevD.toFixed(3)} approach=${approach.toFixed(3)}` };
          }
        }
      }
    }

    if (d < hitThreshold) return { hit: true, proximity: Math.max(0.5, 1 - d / hitThreshold), detail: `static d=${d.toFixed(3)} thr=${hitThreshold.toFixed(3)}` };
    return { hit: false, proximity: Math.max(0, 1 - d / proximityRange), detail: `dist d=${d.toFixed(3)} range=${proximityRange.toFixed(3)}` };
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
      const centerThreshold = 0.5 * scale; // very generous
      if (dCenter < centerThreshold) {
        return { hit: true, proximity: Math.max(0.5, 1 - dCenter / centerThreshold), detail: `1wrist-center dC=${dCenter.toFixed(3)} thr=${centerThreshold.toFixed(3)}` };
      }
      return { hit: false, proximity: Math.max(0.1, 0.5 * (1 - dCenter / scale)), detail: `1wrist dC=${dCenter.toFixed(3)}` };
    }
  }

  return { hit: false, proximity: 0, detail: `noWrists lC=${conf[L_WRIST]?.toFixed(2)} rC=${conf[R_WRIST]?.toFixed(2)}` };
}

function detectRaiseArms(
  kps: Float32Array,
  conf: Float32Array,
  scale: number,
): { hit: boolean; proximity: number; detail: string } {
  // Accept ANY confidence — if skeleton is drawn, keypoints exist
  const hasLeft = conf[L_WRIST] > CONF_GATE && conf[L_SHOULDER] > CONF_GATE;
  const hasRight = conf[R_WRIST] > CONF_GATE && conf[R_SHOULDER] > CONF_GATE;
  // Fallback: check elbows (indices 7, 8) if wrists not visible
  const L_ELBOW = 7, R_ELBOW = 8;
  const hasLeftElbow = !hasLeft && conf[L_ELBOW] > CONF_GATE && conf[L_SHOULDER] > CONF_GATE;
  const hasRightElbow = !hasRight && conf[R_ELBOW] > CONF_GATE && conf[R_SHOULDER] > CONF_GATE;

  if (!hasLeft && !hasRight && !hasLeftElbow && !hasRightElbow)
    return { hit: false, proximity: 0, detail: `noKP lW=${conf[L_WRIST]?.toFixed(2)} rW=${conf[R_WRIST]?.toFixed(2)} lS=${conf[L_SHOULDER]?.toFixed(2)} rS=${conf[R_SHOULDER]?.toFixed(2)}` };

  // In image coords, Y increases downward. Wrist above shoulder = wrist_y < shoulder_y = positive diff.
  const margin = 0.01 * scale; // near-zero margin — any raise counts
  let bestProximity = 0;
  let hit = false;
  let detail = "";

  // Check wrists
  if (hasLeft) {
    const diff = kps[L_SHOULDER * 2 + 1] - kps[L_WRIST * 2 + 1];
    if (diff > margin) hit = true;
    const p = Math.max(0, (diff + 0.15 * scale) / (0.4 * scale));
    bestProximity = Math.max(bestProximity, p);
    detail += `Lw:diff=${diff.toFixed(3)} `;
  }
  if (hasRight) {
    const diff = kps[R_SHOULDER * 2 + 1] - kps[R_WRIST * 2 + 1];
    if (diff > margin) hit = true;
    const p = Math.max(0, (diff + 0.15 * scale) / (0.4 * scale));
    bestProximity = Math.max(bestProximity, p);
    detail += `Rw:diff=${diff.toFixed(3)} `;
  }
  // Fallback: elbows above shoulders also counts
  if (hasLeftElbow) {
    const diff = kps[L_SHOULDER * 2 + 1] - kps[L_ELBOW * 2 + 1];
    if (diff > 0.05 * scale) hit = true;
    const p = Math.max(0, (diff + 0.1 * scale) / (0.3 * scale));
    bestProximity = Math.max(bestProximity, p);
    detail += `Le:diff=${diff.toFixed(3)} `;
  }
  if (hasRightElbow) {
    const diff = kps[R_SHOULDER * 2 + 1] - kps[R_ELBOW * 2 + 1];
    if (diff > 0.05 * scale) hit = true;
    const p = Math.max(0, (diff + 0.1 * scale) / (0.3 * scale));
    bestProximity = Math.max(bestProximity, p);
    detail += `Re:diff=${diff.toFixed(3)} `;
  }

  detail += `margin=${margin.toFixed(3)} scale=${scale.toFixed(3)}`;
  return { hit, proximity: Math.min(1, bestProximity), detail };
}

function detectTouchHead(
  kps: Float32Array,
  conf: Float32Array,
  scale: number,
): { hit: boolean; proximity: number; detail: string } {
  // Same head-region approach as touch_nose — wrist above shoulders, near center
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
    const dy = (shoulderY - kps[idx * 2 + 1]) / scale;
    const prox = Math.min(Math.max(0, 1 - dx), Math.max(0, Math.min(1, dy / 0.3)));
    if (dx < 1.0 && dy > -0.1) hit = true; // even more generous than touch_nose
    if (prox > bestProx) bestProx = prox;
    detail += `${label}:dx=${dx.toFixed(2)} dy=${dy.toFixed(2)} `;
  }

  return { hit, proximity: bestProx, detail };
}

function detectTouchEars(
  kps: Float32Array,
  conf: Float32Array,
  scale: number,
): { hit: boolean; proximity: number; detail: string } {
  const lOk = conf[L_WRIST] > CONF_GATE && conf[L_EAR] > CONF_GATE;
  const rOk = conf[R_WRIST] > CONF_GATE && conf[R_EAR] > CONF_GATE;
  if (!lOk && !rOk) return { hit: false, proximity: 0, detail: "low conf" };
  const dL = lOk ? dist(kp(kps, L_WRIST), kp(kps, L_EAR)) : Infinity;
  const dR = rOk ? dist(kp(kps, R_WRIST), kp(kps, R_EAR)) : Infinity;
  const minD = Math.min(dL, dR);
  const threshold = 0.5 * scale;
  return { hit: minD < threshold, proximity: Math.max(0, 1 - minD / (threshold * 2)), detail: `d=${minD.toFixed(2)} thr=${threshold.toFixed(2)}` };
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

  let result: { hit: boolean; proximity: number; detail: string };
  switch (action) {
    case "touch_nose":
      result = detectTouchNose(keypoints, confidence, scale);
      break;
    case "wave":
      result = detectWave(keypoints, confidence, scale, history);
      break;
    case "clap":
      result = detectClap(keypoints, confidence, scale, history);
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
      result = { hit: false, proximity: 0, detail: "unknown" };
  }

  return {
    detected: result.hit,
    confidence: result.proximity,
    label: meta.label,
    emoji: meta.emoji,
    _detail: result.detail, // pass through for debug
  } as ActionResult;
}

// ── Sustained detection tracker ─────────────────────────────────────

const REQUIRED_CONSECUTIVE = 3;

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

    const scale = bodyScale(keypoints);
    const result = detectAction(keypoints, confidence, action, this.history);

    if (result.detected) {
      this.consecutiveHits++;
    } else {
      // Gentle decay — don't reset to 0, just drop by 1
      this.consecutiveHits = Math.max(0, this.consecutiveHits - 1);
    }

    if (this.consecutiveHits >= REQUIRED_CONSECUTIVE) {
      this.confirmed = true;
    }

    // Debug log every frame — include per-function detail
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fnDetail = (result as any)._detail ?? "";
    debugLog({
      action,
      hit: result.detected,
      proximity: result.confidence,
      consec: this.consecutiveHits,
      scale,
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
