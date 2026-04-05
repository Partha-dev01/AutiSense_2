/**
 * Unit tests for age-based score normalization.
 *
 * This module directly affects clinical screening accuracy — a bug here
 * could cause false positives/negatives for specific age groups.
 *
 * Tests cover:
 * - Age group boundary classification (12-24, 24-48, 48-72, 72+)
 * - Score normalization with age multipliers
 * - Score capping at 1.0
 * - DSM-5 threshold values per age group
 */
import { describe, it, expect } from "vitest";
import {
  getAgeGroup,
  normalizeScore,
  AGE_MULTIPLIERS,
  AGE_THRESHOLDS,
} from "../app/lib/scoring/ageNormalization";

describe("getAgeGroup", () => {
  it("classifies ages below 24 months as 12-24", () => {
    expect(getAgeGroup(12)).toBe("12-24");
    expect(getAgeGroup(18)).toBe("12-24");
    expect(getAgeGroup(23)).toBe("12-24");
  });

  it("classifies age 24 as 24-48 (boundary: >= 24)", () => {
    expect(getAgeGroup(24)).toBe("24-48");
  });

  it("classifies ages 24-47 as 24-48", () => {
    expect(getAgeGroup(30)).toBe("24-48");
    expect(getAgeGroup(47)).toBe("24-48");
  });

  it("classifies age 48 as 48-72 (boundary: >= 48)", () => {
    expect(getAgeGroup(48)).toBe("48-72");
  });

  it("classifies ages 48-71 as 48-72", () => {
    expect(getAgeGroup(60)).toBe("48-72");
    expect(getAgeGroup(71)).toBe("48-72");
  });

  it("classifies age 72 as 72+ (boundary: >= 72)", () => {
    expect(getAgeGroup(72)).toBe("72+");
  });

  it("classifies ages above 72 as 72+", () => {
    expect(getAgeGroup(96)).toBe("72+");
    expect(getAgeGroup(144)).toBe("72+");
  });

  it("handles edge case: very young child (below 12 months)", () => {
    // Still falls into 12-24 group (no infant group defined)
    expect(getAgeGroup(6)).toBe("12-24");
    expect(getAgeGroup(0)).toBe("12-24");
  });
});

describe("normalizeScore", () => {
  it("applies multiplier for youngest age group (12-24m)", () => {
    // gaze multiplier for 12-24 = 1.4
    const result = normalizeScore(0.5, "gaze", 18);
    expect(result).toBeCloseTo(0.7, 5); // 0.5 * 1.4 = 0.7
  });

  it("caps normalized score at 1.0", () => {
    // 0.9 * 1.4 = 1.26 → capped to 1.0
    const result = normalizeScore(0.9, "gaze", 18);
    expect(result).toBe(1.0);
  });

  it("does not modify scores for 48-72 group (multiplier = 1.0)", () => {
    const result = normalizeScore(0.6, "motor", 60);
    expect(result).toBeCloseTo(0.6, 5);
  });

  it("applies correct domain-specific multipliers", () => {
    // 24-48 group: gaze=1.15, motor=1.2, vocal=1.3
    expect(normalizeScore(0.5, "gaze", 36)).toBeCloseTo(0.575, 5);
    expect(normalizeScore(0.5, "motor", 36)).toBeCloseTo(0.6, 5);
    expect(normalizeScore(0.5, "vocal", 36)).toBeCloseTo(0.65, 5);
  });

  it("handles zero score", () => {
    expect(normalizeScore(0, "gaze", 18)).toBe(0);
  });

  it("handles score of exactly 1.0", () => {
    expect(normalizeScore(1.0, "gaze", 60)).toBe(1.0);
  });
});

describe("AGE_MULTIPLIERS", () => {
  it("has entries for all 4 age groups", () => {
    expect(Object.keys(AGE_MULTIPLIERS)).toEqual(["12-24", "24-48", "48-72", "72+"]);
  });

  it("youngest group has highest multipliers (compensates for age)", () => {
    const youngest = AGE_MULTIPLIERS["12-24"];
    const oldest = AGE_MULTIPLIERS["72+"];
    expect(youngest.gaze).toBeGreaterThan(oldest.gaze);
    expect(youngest.motor).toBeGreaterThan(oldest.motor);
    expect(youngest.vocal).toBeGreaterThan(oldest.vocal);
  });

  it("multipliers decrease or stay flat with age", () => {
    const groups = ["12-24", "24-48", "48-72", "72+"] as const;
    for (let i = 1; i < groups.length; i++) {
      expect(AGE_MULTIPLIERS[groups[i]].gaze).toBeLessThanOrEqual(AGE_MULTIPLIERS[groups[i - 1]].gaze);
    }
  });
});

describe("AGE_THRESHOLDS", () => {
  it("has entries for all 4 age groups", () => {
    expect(Object.keys(AGE_THRESHOLDS)).toEqual(["12-24", "24-48", "48-72", "72+"]);
  });

  it("youngest group has lowest thresholds (more lenient)", () => {
    const youngest = AGE_THRESHOLDS["12-24"];
    const middle = AGE_THRESHOLDS["48-72"];
    expect(youngest.gazeFlag).toBeLessThanOrEqual(middle.gazeFlag);
    expect(youngest.vocalFlag).toBeLessThanOrEqual(middle.vocalFlag);
  });

  it("latency thresholds decrease with age (faster responses expected)", () => {
    expect(AGE_THRESHOLDS["12-24"].latencyFlag).toBeGreaterThan(AGE_THRESHOLDS["48-72"].latencyFlag);
  });
});
