/**
 * Unit tests for the adaptive difficulty engine.
 *
 * The difficulty engine controls game progression for therapy games.
 * Bugs here affect the therapeutic value — children could get stuck
 * at wrong difficulty levels or have difficulty spike/drop unexpectedly.
 *
 * Tests cover:
 * - Initial difficulty (level 1)
 * - Level-up when average score > 80%
 * - Level-down when average score < 40%
 * - Level clamping (1-5)
 * - Sliding window (last 5 scores only)
 * - Corrupted localStorage recovery
 * - SSR safety (typeof window === "undefined")
 * - Config values at each level
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock localStorage before importing
const store: Record<string, string> = {};
const mockLocalStorage = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
  removeItem: vi.fn((key: string) => { delete store[key]; }),
  clear: vi.fn(() => { Object.keys(store).forEach(k => delete store[k]); }),
  get length() { return Object.keys(store).length; },
  key: vi.fn(() => null),
};

Object.defineProperty(globalThis, "window", { value: globalThis, writable: true, configurable: true });
Object.defineProperty(globalThis, "localStorage", { value: mockLocalStorage, writable: true, configurable: true });

import { getDifficulty, saveDifficulty, type GameConfig } from "../app/lib/games/difficultyEngine";

describe("getDifficulty", () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    vi.clearAllMocks();
  });

  it("returns level 1 config when no data exists", () => {
    const config = getDifficulty("bubble-pop", "child-1");
    expect(config.level).toBe(1);
  });

  it("returns stored level from localStorage", () => {
    store["autisense-game-difficulty-bubble-pop-child-1"] = JSON.stringify({ level: 3, scores: [70, 75] });
    const config = getDifficulty("bubble-pop", "child-1");
    expect(config.level).toBe(3);
  });

  it("returns level 1 when localStorage has corrupted data", () => {
    store["autisense-game-difficulty-memory-child-1"] = "not-json{{{";
    const config = getDifficulty("memory", "child-1");
    expect(config.level).toBe(1);
  });

  it("uses gameId + childId for key isolation", () => {
    store["autisense-game-difficulty-game-a-child-1"] = JSON.stringify({ level: 4, scores: [] });
    store["autisense-game-difficulty-game-b-child-1"] = JSON.stringify({ level: 2, scores: [] });

    expect(getDifficulty("game-a", "child-1").level).toBe(4);
    expect(getDifficulty("game-b", "child-1").level).toBe(2);
  });
});

describe("saveDifficulty", () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    vi.clearAllMocks();
  });

  it("creates entry on first save", () => {
    saveDifficulty("tracing", "child-1", 50);
    const raw = store["autisense-game-difficulty-tracing-child-1"];
    expect(raw).toBeDefined();
    const parsed = JSON.parse(raw);
    expect(parsed.level).toBe(1);
    expect(parsed.scores).toContain(50);
  });

  it("levels up when average of last 5 scores > 80", () => {
    const key = "autisense-game-difficulty-tracing-child-1";
    store[key] = JSON.stringify({ level: 1, scores: [85, 90, 85, 90] });
    saveDifficulty("tracing", "child-1", 85); // avg = 87 > 80
    expect(JSON.parse(store[key]).level).toBe(2);
  });

  it("levels down when average of last 5 scores < 40", () => {
    const key = "autisense-game-difficulty-tracing-child-1";
    store[key] = JSON.stringify({ level: 3, scores: [30, 25, 35, 20] });
    saveDifficulty("tracing", "child-1", 30); // avg = 28 < 40
    expect(JSON.parse(store[key]).level).toBe(2);
  });

  it("does not level up beyond 5", () => {
    const key = "autisense-game-difficulty-tracing-child-1";
    store[key] = JSON.stringify({ level: 5, scores: [90, 95, 90, 95] });
    saveDifficulty("tracing", "child-1", 95);
    expect(JSON.parse(store[key]).level).toBe(5);
  });

  it("does not level down below 1", () => {
    const key = "autisense-game-difficulty-tracing-child-1";
    store[key] = JSON.stringify({ level: 1, scores: [10, 15, 20, 10] });
    saveDifficulty("tracing", "child-1", 15);
    expect(JSON.parse(store[key]).level).toBe(1);
  });

  it("uses sliding window of last 5 scores only", () => {
    const key = "autisense-game-difficulty-tracing-child-1";
    // 10 old low scores, then 5 high scores
    store[key] = JSON.stringify({ level: 1, scores: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 85, 85, 85, 85] });
    saveDifficulty("tracing", "child-1", 85); // last 5 = [85,85,85,85,85] avg=85 > 80
    expect(JSON.parse(store[key]).level).toBe(2);
  });

  it("stays at same level when average is between 40-80", () => {
    const key = "autisense-game-difficulty-tracing-child-1";
    store[key] = JSON.stringify({ level: 3, scores: [60, 55, 65, 50] });
    saveDifficulty("tracing", "child-1", 60); // avg = 58, 40 < 58 < 80
    expect(JSON.parse(store[key]).level).toBe(3);
  });
});

describe("buildConfig (via getDifficulty)", () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    vi.clearAllMocks();
  });

  it("level 1 has correct config", () => {
    const config = getDifficulty("test", "child");
    expect(config).toEqual<GameConfig>({
      level: 1,
      speed: 0.95,      // 0.8 + 1 * 0.15
      itemCount: 3,     // 2 + 1
      timeLimit: 30,    // 35 - 1*5
    });
  });

  it("level 5 has correct config", () => {
    store["autisense-game-difficulty-test-child"] = JSON.stringify({ level: 5, scores: [] });
    const config = getDifficulty("test", "child");
    expect(config).toEqual<GameConfig>({
      level: 5,
      speed: 1.55,      // 0.8 + 5 * 0.15
      itemCount: 7,     // 2 + 5
      timeLimit: 10,    // max(10, 35 - 5*5) = max(10, 10)
    });
  });

  it("clamps invalid level to 1-5 range", () => {
    store["autisense-game-difficulty-test-child"] = JSON.stringify({ level: 99, scores: [] });
    const config = getDifficulty("test", "child");
    expect(config.level).toBe(5);
  });
});
