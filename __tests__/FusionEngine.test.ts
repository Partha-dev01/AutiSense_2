/**
 * Unit tests for the multimodal FusionEngine.
 *
 * This is the CORE of the ASD screening pipeline — it combines body pose
 * and face analysis into a single risk score. A bug in fusion weights or
 * probability indexing could produce false positives/negatives.
 *
 * Body classes: [hand_flapping, body_rocking, head_banging, spinning, toe_walking, non_autistic]
 *   Index 5 = non_autistic → bodyRisk = 1 - P(non_autistic)
 *
 * Face classes: [typical_expression, flat_affect, atypical_expression, gaze_avoidance]
 *   faceRisk = P(flat_affect) + P(atypical_expression) + P(gaze_avoidance)
 *
 * Tests cover:
 * - Both modalities present (default 70/30 weighting)
 * - Body-only mode (face unavailable, confidence = 0.7)
 * - Face-only mode (confidence = 0.5)
 * - Null inputs
 * - Score clamping (0-1 range)
 * - Custom weight configuration
 * - Edge cases (all probabilities 0, all probabilities 1)
 */
import { describe, it, expect } from "vitest";
import { FusionEngine, type FusionResult } from "../app/lib/inference/FusionEngine";

// Helper: create a body result with 6 class probabilities
function bodyResult(probs: number[]) {
  return {
    classIndex: probs.indexOf(Math.max(...probs)),
    className: "test",
    probabilities: probs,
    confidence: Math.max(...probs),
  };
}

// Helper: create a face result with 4 class probabilities
function faceResult(probs: number[]) {
  return {
    classIndex: probs.indexOf(Math.max(...probs)),
    className: "test",
    probabilities: probs,
    confidence: Math.max(...probs),
  };
}

describe("FusionEngine.fuse (both modalities)", () => {
  const engine = new FusionEngine(); // default 70/30

  it("combines body and face risk with 70/30 weighting", () => {
    // Body: P(non_autistic) = 0.8 → bodyRisk = 0.2
    // Face: P(flat_affect=0.1, atypical=0.1, gaze_avoidance=0.1) → faceRisk = 0.3
    // asdRisk = 0.7*0.2 + 0.3*0.3 = 0.14 + 0.09 = 0.23
    const result = engine.fuse(
      bodyResult([0.05, 0.05, 0.05, 0.03, 0.02, 0.8]),
      faceResult([0.7, 0.1, 0.1, 0.1]),
    );

    expect(result).not.toBeNull();
    expect(result!.asdRisk).toBeCloseTo(0.23, 2);
    expect(result!.bodyRisk).toBeCloseTo(0.2, 2);
    expect(result!.faceRisk).toBeCloseTo(0.3, 2);
    expect(result!.confidence).toBe(1.0);
  });

  it("returns high risk when body shows autistic behaviors", () => {
    // Body: P(non_autistic) = 0.1 → bodyRisk = 0.9
    // Face: all atypical → faceRisk = 0.9
    const result = engine.fuse(
      bodyResult([0.3, 0.3, 0.2, 0.05, 0.05, 0.1]),
      faceResult([0.1, 0.3, 0.3, 0.3]),
    );

    expect(result!.asdRisk).toBeCloseTo(0.9, 1); // 0.7*0.9 + 0.3*0.9 = 0.9
    expect(result!.asdRisk).toBeGreaterThan(0.7);
  });

  it("returns low risk when both modalities are typical", () => {
    // Body: P(non_autistic) = 0.95 → bodyRisk = 0.05
    // Face: P(typical) = 0.95 → faceRisk = 0.05
    const result = engine.fuse(
      bodyResult([0.01, 0.01, 0.01, 0.01, 0.01, 0.95]),
      faceResult([0.95, 0.02, 0.02, 0.01]),
    );

    expect(result!.asdRisk).toBeLessThan(0.1);
  });

  it("clamps face risk to max 1.0", () => {
    // Face probabilities that sum > 1 for atypical classes
    const result = engine.fuse(
      bodyResult([0, 0, 0, 0, 0, 0.5]),
      faceResult([0, 0.5, 0.4, 0.4]), // faceRisk = 1.3 → clamped to 1.0
    );

    expect(result!.faceRisk).toBe(1.0);
  });

  it("clamps final asdRisk to [0, 1]", () => {
    const result = engine.fuse(
      bodyResult([0.2, 0.2, 0.2, 0.2, 0.2, 0]),  // bodyRisk = 1.0
      faceResult([0, 0.5, 0.3, 0.2]),              // faceRisk = 1.0
    );

    expect(result!.asdRisk).toBeLessThanOrEqual(1.0);
    expect(result!.asdRisk).toBeGreaterThanOrEqual(0);
  });
});

describe("FusionEngine.fuse (body only)", () => {
  const engine = new FusionEngine();

  it("returns body-only result when face is null", () => {
    const result = engine.fuse(
      bodyResult([0.1, 0.1, 0.1, 0.1, 0.1, 0.5]),
      null,
    );

    expect(result).not.toBeNull();
    expect(result!.bodyRisk).toBeCloseTo(0.5, 2);
    expect(result!.faceRisk).toBe(0);
    expect(result!.asdRisk).toBeCloseTo(0.5, 2);
    expect(result!.confidence).toBe(0.7); // reduced confidence
  });

  it("returns null when body is null", () => {
    expect(engine.fuse(null, faceResult([0.8, 0.1, 0.05, 0.05]))).toBeNull();
  });

  it("returns null when both are null", () => {
    expect(engine.fuse(null, null)).toBeNull();
  });
});

describe("FusionEngine.fuseFaceOnly", () => {
  const engine = new FusionEngine();

  it("returns face-only result with confidence 0.5", () => {
    const result = engine.fuseFaceOnly(
      faceResult([0.6, 0.15, 0.15, 0.1]),
    );

    expect(result).not.toBeNull();
    expect(result!.faceRisk).toBeCloseTo(0.4, 2);
    expect(result!.bodyRisk).toBe(0);
    expect(result!.asdRisk).toBeCloseTo(0.4, 2);
    expect(result!.confidence).toBe(0.5);
  });

  it("returns null when face is null", () => {
    expect(engine.fuseFaceOnly(null)).toBeNull();
  });
});

describe("FusionEngine custom weights", () => {
  it("respects custom body/face weights", () => {
    const engine = new FusionEngine(0.5, 0.5); // equal weights

    const result = engine.fuse(
      bodyResult([0, 0, 0, 0, 0, 0.6]), // bodyRisk = 0.4
      faceResult([0.5, 0.2, 0.2, 0.1]), // faceRisk = 0.5
    );

    // 0.5*0.4 + 0.5*0.5 = 0.45
    expect(result!.asdRisk).toBeCloseTo(0.45, 2);
  });
});
