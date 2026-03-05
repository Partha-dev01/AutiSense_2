/**
 * Types for the Kids Dashboard game activity tracking,
 * streaks, weekly reports, and chat history.
 */

// ── Game Activity ───────────────────────────────────────────────

export interface GameActivity {
  id?: number;
  childId: string;
  gameId: string;
  score: number;        // 0-100
  duration: number;     // seconds
  difficulty: number;   // 1-5
  completedAt: number;  // timestamp
  date: string;         // YYYY-MM-DD
}

// ── Streaks ─────────────────────────────────────────────────────

export interface Streak {
  childId: string;
  currentStreak: number;
  longestStreak: number;
  lastPlayDate: string; // YYYY-MM-DD
}

// ── Weekly Reports ──────────────────────────────────────────────

export interface WeeklyReport {
  id?: number;
  childId: string;
  weekStart: string;    // YYYY-MM-DD (Monday)
  weekEnd: string;      // YYYY-MM-DD (Sunday)
  gamesPlayed: number;
  avgScore: number;
  topGame: string;
  streakDays: number;
  reportHtml: string;
  generatedAt: number;  // timestamp
  emailed: boolean;
}

// ── Chat History ────────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  audioUrl?: string;
  timestamp: number;
}

export interface ChatSession {
  id?: number;
  childId: string;
  messages: ChatMessage[];
  createdAt: number;
  animalAvatar: string; // "dog" | "cat" | "rabbit" | "parrot"
}

// ── Game metadata for the kids dashboard ────────────────────────

export interface KidGame {
  id: string;
  emoji: string;
  title: string;
  description: string;
  color: string;
  route: string;
  isNew?: boolean;
}
