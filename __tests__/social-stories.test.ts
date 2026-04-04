import { describe, it, expect } from "vitest";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const OPTIONS = [
  { text: "Wave back and say hello", correct: true, feedback: "Great!" },
  { text: "Walk away without looking", correct: false, feedback: "Try again." },
  { text: "Stare at the ground", correct: false, feedback: "Try again." },
];

describe("Social Stories option shuffling", () => {
  it("shuffle returns a different order at least once in 20 runs", () => {
    const original = OPTIONS.map((o) => o.text).join(",");
    let sawDifferent = false;
    for (let i = 0; i < 20; i++) {
      const shuffled = shuffle(OPTIONS).map((o) => o.text).join(",");
      if (shuffled !== original) {
        sawDifferent = true;
        break;
      }
    }
    expect(sawDifferent).toBe(true);
  });

  it("shuffle preserves all items", () => {
    const result = shuffle(OPTIONS);
    expect(result).toHaveLength(OPTIONS.length);
    for (const opt of OPTIONS) {
      expect(result.find((r) => r.text === opt.text)).toBeTruthy();
    }
  });

  it("correct answer is not always first after shuffling", () => {
    let correctAlwaysFirst = true;
    for (let i = 0; i < 30; i++) {
      const result = shuffle(OPTIONS);
      if (!result[0].correct) {
        correctAlwaysFirst = false;
        break;
      }
    }
    expect(correctAlwaysFirst).toBe(false);
  });
});
