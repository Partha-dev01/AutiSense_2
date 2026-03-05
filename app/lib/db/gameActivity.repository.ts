import { db } from "./schema";
import type { GameActivity } from "../../types/gameActivity";

/** Get today's date as YYYY-MM-DD. */
function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Record a completed game activity. */
export async function addGameActivity(
  childId: string,
  gameId: string,
  score: number,
  duration: number,
  difficulty: number,
): Promise<void> {
  await db.gameActivity.add({
    childId,
    gameId,
    score: Math.round(Math.max(0, Math.min(100, score))),
    duration: Math.round(duration),
    difficulty,
    completedAt: Date.now(),
    date: todayStr(),
  });
}

/** Get all game activity for a child on a specific date. */
export async function getActivityByDate(
  childId: string,
  date: string,
): Promise<GameActivity[]> {
  return db.gameActivity
    .where({ childId, date })
    .toArray();
}

/** Get all game activity for a child today. */
export async function getTodayActivity(childId: string): Promise<GameActivity[]> {
  return getActivityByDate(childId, todayStr());
}

/** Get game activity for a child within a date range. */
export async function getActivityRange(
  childId: string,
  startDate: string,
  endDate: string,
): Promise<GameActivity[]> {
  return db.gameActivity
    .where("childId")
    .equals(childId)
    .and((a) => a.date >= startDate && a.date <= endDate)
    .toArray();
}

/** Get the total number of games played by a child. */
export async function getTotalGamesPlayed(childId: string): Promise<number> {
  return db.gameActivity.where("childId").equals(childId).count();
}
