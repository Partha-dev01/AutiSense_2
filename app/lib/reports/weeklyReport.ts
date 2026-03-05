/**
 * Weekly report generation for the Kids Dashboard.
 *
 * Computes per-child stats for the most recent full week (Mon–Sun),
 * compares with the previous week for an improvement percentage,
 * and renders two HTML variants: a kid-friendly version (colorful,
 * emoji-heavy) and a parent-facing version (table layout, trends).
 */

import { getActivityRange } from "../db/gameActivity.repository";
import { getStreak } from "../db/streak.repository";
import type { GameActivity } from "../../types/gameActivity";

// ── Public types ───────────────────────────────────────────────

export interface WeeklyReportData {
  childId: string;
  weekStart: string;   // YYYY-MM-DD (Monday)
  weekEnd: string;     // YYYY-MM-DD (Sunday)
  gamesPlayed: number;
  avgScore: number;
  topGame: string;
  streakDays: number;
  perGameStats: { gameId: string; count: number; avgScore: number }[];
  improvement: number; // % change vs previous week
}

// ── Helpers ────────────────────────────────────────────────────

/** Return YYYY-MM-DD for a Date. */
function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Get last Monday (start of the most recent full week). */
function lastMonday(): Date {
  const now = new Date();
  const day = now.getDay(); // 0=Sun … 6=Sat
  // Go back to last week's Monday
  const offset = day === 0 ? 8 : day + 7;
  const mon = new Date(now);
  mon.setDate(mon.getDate() - offset);
  mon.setHours(0, 0, 0, 0);
  return mon;
}

/** Human-friendly game name from a kebab-case id. */
function gameName(id: string): string {
  return id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Compute per-game breakdown from a list of activities. */
function perGame(acts: GameActivity[]): { gameId: string; count: number; avgScore: number }[] {
  const map: Record<string, { total: number; count: number }> = {};
  for (const a of acts) {
    if (!map[a.gameId]) map[a.gameId] = { total: 0, count: 0 };
    map[a.gameId].total += a.score;
    map[a.gameId].count++;
  }
  return Object.entries(map)
    .map(([gameId, v]) => ({ gameId, count: v.count, avgScore: Math.round(v.total / v.count) }))
    .sort((a, b) => b.count - a.count);
}

/** Average score of an activity list (0 if empty). */
function avg(acts: GameActivity[]): number {
  if (acts.length === 0) return 0;
  return Math.round(acts.reduce((s, a) => s + a.score, 0) / acts.length);
}

// ── Core generation ────────────────────────────────────────────

export async function generateWeeklyReport(childId: string): Promise<WeeklyReportData> {
  const mon = lastMonday();
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);

  const weekStart = fmt(mon);
  const weekEnd = fmt(sun);

  // Previous week boundaries
  const prevMon = new Date(mon);
  prevMon.setDate(mon.getDate() - 7);
  const prevSun = new Date(mon);
  prevSun.setDate(mon.getDate() - 1);

  // Fetch activity for both weeks + streak
  const [acts, prevActs, streak] = await Promise.all([
    getActivityRange(childId, weekStart, weekEnd),
    getActivityRange(childId, fmt(prevMon), fmt(prevSun)),
    getStreak(childId),
  ]);

  const stats = perGame(acts);
  const topGame = stats.length > 0 ? stats[0].gameId : "none";
  const thisAvg = avg(acts);
  const prevAvg = avg(prevActs);
  const improvement = prevAvg === 0 ? 0 : Math.round(((thisAvg - prevAvg) / prevAvg) * 100);

  return {
    childId,
    weekStart,
    weekEnd,
    gamesPlayed: acts.length,
    avgScore: thisAvg,
    topGame,
    streakDays: streak.currentStreak,
    perGameStats: stats,
    improvement,
  };
}

// ── Kid-friendly HTML ──────────────────────────────────────────

export function renderKidReport(data: WeeklyReportData, childName: string): string {
  const trend =
    data.improvement > 0
      ? `You improved by ${data.improvement}%! Keep it up!`
      : data.improvement < 0
        ? `You dipped a little this week — no worries, you'll bounce back!`
        : "You stayed steady — nice consistency!";

  const gameRows = data.perGameStats
    .map(
      (g) =>
        `<div style="display:flex;justify-content:space-between;padding:8px 12px;background:#f0fdf4;border-radius:10px;margin-bottom:6px;">
          <span style="font-weight:600;">${gameName(g.gameId)}</span>
          <span>${g.count}x &middot; ${g.avgScore}%</span>
        </div>`,
    )
    .join("");

  return `
<div style="font-family:'Fredoka',sans-serif;max-width:520px;margin:0 auto;padding:28px 24px;background:linear-gradient(135deg,#e0f2fe,#fef9c3);border-radius:20px;">
  <h1 style="text-align:center;font-size:1.6rem;color:#15803d;margin:0 0 4px;">
    Your Weekly Report
  </h1>
  <p style="text-align:center;color:#4b5563;font-size:0.9rem;margin:0 0 20px;">
    ${data.weekStart} &ndash; ${data.weekEnd}
  </p>

  <p style="font-size:1.1rem;text-align:center;color:#1f2937;margin:0 0 18px;">
    Hey <strong>${childName}</strong>! You played <strong>${data.gamesPlayed}</strong> game${data.gamesPlayed !== 1 ? "s" : ""} this week! Amazing!
  </p>

  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:18px;">
    <div style="text-align:center;padding:14px 8px;background:#fff;border-radius:14px;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
      <div style="font-size:1.4rem;font-weight:700;color:#15803d;">${data.avgScore}%</div>
      <div style="font-size:0.72rem;color:#6b7280;">Avg Score</div>
    </div>
    <div style="text-align:center;padding:14px 8px;background:#fff;border-radius:14px;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
      <div style="font-size:1.4rem;font-weight:700;color:#15803d;">${data.streakDays}</div>
      <div style="font-size:0.72rem;color:#6b7280;">Day Streak</div>
    </div>
    <div style="text-align:center;padding:14px 8px;background:#fff;border-radius:14px;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
      <div style="font-size:1.4rem;font-weight:700;color:#15803d;">${gameName(data.topGame)}</div>
      <div style="font-size:0.72rem;color:#6b7280;">Top Game</div>
    </div>
  </div>

  <p style="text-align:center;font-size:0.95rem;color:#374151;margin:0 0 16px;">${trend}</p>

  ${data.perGameStats.length > 0 ? `<h3 style="font-size:0.95rem;color:#15803d;margin:0 0 8px;">Your Games</h3>${gameRows}` : ""}

  <p style="text-align:center;margin:20px 0 0;font-size:1.3rem;">Keep being awesome!</p>
</div>`;
}

// ── Parent-friendly HTML ───────────────────────────────────────

export function renderParentReport(data: WeeklyReportData, childName: string): string {
  const trendIcon = data.improvement > 0 ? "+" : "";
  const trendColor = data.improvement >= 0 ? "#16a34a" : "#dc2626";

  const tableRows = data.perGameStats
    .map(
      (g) =>
        `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${gameName(g.gameId)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${g.count}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${g.avgScore}%</td>
        </tr>`,
    )
    .join("");

  const recommendations: string[] = [];
  if (data.gamesPlayed < 5) {
    recommendations.push("Encourage at least 5 game sessions per week for steady skill development.");
  }
  if (data.avgScore < 50) {
    recommendations.push("Average score is below 50% — consider lowering difficulty or revisiting earlier levels.");
  }
  if (data.streakDays < 3) {
    recommendations.push("Building a daily play habit (even 5 minutes) helps reinforce learning.");
  }
  if (data.improvement < -10) {
    recommendations.push("Score decreased significantly this week — check in with your child about any challenges.");
  }
  if (recommendations.length === 0) {
    recommendations.push("Great week! Keep up the consistent practice.");
  }

  const recHtml = recommendations
    .map((r) => `<li style="margin-bottom:6px;color:#374151;font-size:0.88rem;">${r}</li>`)
    .join("");

  return `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:28px 24px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;">
  <h1 style="font-size:1.3rem;color:#111827;margin:0 0 4px;">
    Weekly Progress Report &mdash; ${childName}
  </h1>
  <p style="color:#6b7280;font-size:0.85rem;margin:0 0 22px;">
    ${data.weekStart} &ndash; ${data.weekEnd}
  </p>

  <table style="width:100%;border-collapse:collapse;margin-bottom:18px;">
    <tr style="background:#f9fafb;">
      <td style="padding:10px 12px;font-weight:600;color:#374151;">Games Played</td>
      <td style="padding:10px 12px;text-align:right;font-weight:700;color:#111827;">${data.gamesPlayed}</td>
    </tr>
    <tr>
      <td style="padding:10px 12px;font-weight:600;color:#374151;">Average Score</td>
      <td style="padding:10px 12px;text-align:right;font-weight:700;color:#111827;">${data.avgScore}%</td>
    </tr>
    <tr style="background:#f9fafb;">
      <td style="padding:10px 12px;font-weight:600;color:#374151;">Current Streak</td>
      <td style="padding:10px 12px;text-align:right;font-weight:700;color:#111827;">${data.streakDays} day${data.streakDays !== 1 ? "s" : ""}</td>
    </tr>
    <tr>
      <td style="padding:10px 12px;font-weight:600;color:#374151;">Top Game</td>
      <td style="padding:10px 12px;text-align:right;font-weight:700;color:#111827;">${gameName(data.topGame)}</td>
    </tr>
    <tr style="background:#f9fafb;">
      <td style="padding:10px 12px;font-weight:600;color:#374151;">vs. Previous Week</td>
      <td style="padding:10px 12px;text-align:right;font-weight:700;color:${trendColor};">${trendIcon}${data.improvement}%</td>
    </tr>
  </table>

  ${
    data.perGameStats.length > 0
      ? `<h3 style="font-size:0.95rem;color:#111827;margin:0 0 8px;">Per-Game Breakdown</h3>
         <table style="width:100%;border-collapse:collapse;margin-bottom:18px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
           <thead>
             <tr style="background:#f3f4f6;">
               <th style="padding:8px 12px;text-align:left;font-size:0.82rem;color:#6b7280;font-weight:600;">Game</th>
               <th style="padding:8px 12px;text-align:center;font-size:0.82rem;color:#6b7280;font-weight:600;">Played</th>
               <th style="padding:8px 12px;text-align:center;font-size:0.82rem;color:#6b7280;font-weight:600;">Avg Score</th>
             </tr>
           </thead>
           <tbody>${tableRows}</tbody>
         </table>`
      : ""
  }

  <h3 style="font-size:0.95rem;color:#111827;margin:0 0 8px;">Recommendations</h3>
  <ul style="padding-left:20px;margin:0 0 16px;">${recHtml}</ul>

  <p style="font-size:0.78rem;color:#9ca3af;margin:16px 0 0;text-align:center;">
    Generated by AutiSense &middot; ${new Date().toLocaleDateString()}
  </p>
</div>`;
}
