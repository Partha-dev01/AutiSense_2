import Dexie, { type Table } from "dexie";
import type { Session } from "../../types/session";
import type { Biomarker } from "../../types/biomarker";
import type { ChildProfile } from "../../types/childProfile";
import type { FeedPost } from "../../types/feedPost";
import type { GameActivity, Streak, WeeklyReport, ChatSession } from "../../types/gameActivity";

//sessions       — one row per screening session
//biomarkers     — multiple rows per session (one per task screen pass)
//syncQueue      — pending session IDs waiting to be uploaded to DynamoDB
//childProfiles  — one row per child added by the user
//feedPosts      — community feed posts stored locally
//gameActivity   — one row per completed game round (kids dashboard)
//streaks        — one row per child tracking daily play streaks
//weeklyReports  — generated weekly progress summaries
//chatHistory    — AI chat conversation logs

export interface SyncQueueEntry {
  id?: number;
  sessionId: string;
  queuedAt: number;
  retryCount: number;
}

export class AutiSenseDB extends Dexie {
  sessions!: Table<Session>;
  biomarkers!: Table<Biomarker>;
  syncQueue!: Table<SyncQueueEntry>;
  childProfiles!: Table<ChildProfile>;
  feedPosts!: Table<FeedPost>;
  gameActivity!: Table<GameActivity>;
  streaks!: Table<Streak>;
  weeklyReports!: Table<WeeklyReport>;
  chatHistory!: Table<ChatSession>;

  constructor() {
    super("AutiSenseDB");
    this.version(1).stores({
      sessions: "id, userId, createdAt, synced, status",
      biomarkers: "++id, sessionId, userId, timestamp, taskId",
      syncQueue: "++id, sessionId, queuedAt, retryCount",
    });
    // v2: Extended biomarker fields for Stage 10 detector (optional columns — no data migration needed)
    this.version(2).stores({
      sessions: "id, userId, createdAt, synced, status",
      biomarkers: "++id, sessionId, userId, timestamp, taskId",
      syncQueue: "++id, sessionId, queuedAt, retryCount",
    });
    // v3: Child profiles + community feed posts
    this.version(3).stores({
      sessions: "id, userId, createdAt, synced, status",
      biomarkers: "++id, sessionId, userId, timestamp, taskId",
      syncQueue: "++id, sessionId, queuedAt, retryCount",
      childProfiles: "id, userId, createdAt",
      feedPosts: "++id, userId, createdAt",
    });
    // v4: Kids dashboard — game activity, streaks, weekly reports, chat history
    this.version(4).stores({
      sessions: "id, userId, createdAt, synced, status",
      biomarkers: "++id, sessionId, userId, timestamp, taskId",
      syncQueue: "++id, sessionId, queuedAt, retryCount",
      childProfiles: "id, userId, createdAt",
      feedPosts: "++id, userId, createdAt",
      gameActivity: "++id, childId, date, gameId",
      streaks: "childId",
      weeklyReports: "++id, childId, weekStart",
      chatHistory: "++id, childId, createdAt",
    });
  }
}

export const db = new AutiSenseDB(); //singleton db instance
