import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock window and speechSynthesis before importing the module
const mockCancel = vi.fn();
const mockSpeak = vi.fn();

// @ts-expect-error — mock window for Node environment
globalThis.window = globalThis;
Object.defineProperty(globalThis, "speechSynthesis", {
  value: { cancel: mockCancel, speak: mockSpeak },
  writable: true,
  configurable: true,
});

// Import after mocking
import { stopSpeaking } from "../app/lib/audio/ttsHelper";

describe("stopSpeaking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls speechSynthesis.cancel()", () => {
    stopSpeaking();
    expect(mockCancel).toHaveBeenCalledTimes(1);
  });

  it("does not throw when no audio is playing", () => {
    expect(() => stopSpeaking()).not.toThrow();
  });
});
