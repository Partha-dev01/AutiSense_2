import { db } from "./schema";
import type { Streak } from "../../types/gameActivity";

/** Get today's date as YYYY-MM-DD. */
function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Get yesterday's date as YYYY-MM-DD. */
function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Get or initialize the streak record for a child. */
export async function getStreak(childId: string): Promise<Streak> {
  const existing = await db.streaks.get(childId);
  if (existing) return existing;
  return { childId, currentStreak: 0, longestStreak: 0, lastPlayDate: "" };
}

/**
 * Update streak after a game completion.
 * - Same day → no change
 * - Consecutive day → streak++
 * - Gap → reset to 1
 */
export async function updateStreak(childId: string): Promise<Streak> {
  const today = todayStr();
  const yesterday = yesterdayStr();
  const streak = await getStreak(childId);

  if (streak.lastPlayDate === today) {
    // Already played today — no streak change
    return streak;
  }

  if (streak.lastPlayDate === yesterday) {
    streak.currentStreak += 1;
  } else {
    streak.currentStreak = 1;
  }

  streak.longestStreak = Math.max(streak.longestStreak, streak.currentStreak);
  streak.lastPlayDate = today;

  await db.streaks.put(streak);
  return streak;
}
