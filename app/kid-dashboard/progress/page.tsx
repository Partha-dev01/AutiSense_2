"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { useAuthGuard } from "../../hooks/useAuthGuard";
import { getTodayActivity, getActivityRange, getTotalGamesPlayed } from "../../lib/db/gameActivity.repository";
import { getStreak } from "../../lib/db/streak.repository";
import type { GameActivity } from "../../types/gameActivity";

type Tab = "today" | "week" | "alltime";
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const fredoka = "'Fredoka',sans-serif";

function fmtDur(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
}

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function dateStr(off: number): string {
  const d = new Date();
  d.setDate(d.getDate() + off);
  return d.toISOString().slice(0, 10);
}

function monOff(): number {
  const day = new Date().getDay(); // 0=Sun, 1=Mon ... 6=Sat
  return day === 0 ? -6 : 1 - day;
}

function scColor(score: number): string {
  if (score >= 80) return "var(--sage-500)";
  if (score >= 50) return "var(--sage-400)";
  return "var(--sage-300)";
}

function gameName(id: string): string {
  return id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const sc: React.CSSProperties = {
  padding: "16px 18px",
  borderRadius: "var(--r-lg)",
  background: "var(--card)",
  border: "1px solid var(--border)",
  textAlign: "center",
};

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div style={sc}>
      <div style={{ fontSize: "1.6rem", fontFamily: fredoka, fontWeight: 700, color: "var(--sage-600)" }}>{value}</div>
      <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: 4 }}>{label}</div>
    </div>
  );
}

function ScoreBar({ score }: { score: number }) {
  return (
    <div style={{ flex: 1, height: 8, borderRadius: 4, background: "var(--sage-100)", overflow: "hidden" }}>
      <div style={{ width: `${score}%`, height: "100%", borderRadius: 4, background: scColor(score), transition: "width 400ms var(--ease)" }} />
    </div>
  );
}

export default function ProgressPage() {
  const { loading: authLoading, isAuthenticated } = useAuthGuard();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [tab, setTab] = useState<Tab>("today");
  const [childId, setChildId] = useState("default");
  const [todayActs, setTodayActs] = useState<GameActivity[]>([]);
  const [weekActs, setWeekActs] = useState<GameActivity[]>([]);
  const [weekDayCounts, setWeekDayCounts] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [totalGames, setTotalGames] = useState(0);
  const [curStreak, setCurStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [lwActs, setLwActs] = useState<GameActivity[]>([]);
  const [fourWeekAvgs, setFourWeekAvgs] = useState<number[]>([0, 0, 0, 0]);

  useEffect(() => {
    const s = (typeof window !== "undefined" && localStorage.getItem("autisense-theme")) || "light";
    setTheme(s as "light" | "dark");
  }, []);
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    if (typeof window !== "undefined") localStorage.setItem("autisense-theme", theme);
  }, [theme]);
  useEffect(() => {
    if (typeof window !== "undefined") setChildId(localStorage.getItem("autisense-active-child-id") || "default");
  }, []);

  const loadToday = useCallback(async () => {
    const acts = await getTodayActivity(childId);
    setTodayActs(acts);
  }, [childId]);

  const loadWeek = useCallback(async () => {
    const mo = monOff();
    const acts = await getActivityRange(childId, dateStr(mo), dateStr(mo + 6));
    setWeekActs(acts);
    const counts = [0, 0, 0, 0, 0, 0, 0];
    acts.forEach((a) => {
      const dayOfWeek = new Date(a.date + "T00:00:00").getDay();
      const idx = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Mon=0 ... Sun=6
      counts[idx]++;
    });
    setWeekDayCounts(counts);
  }, [childId]);

  const loadAllTime = useCallback(async () => {
    const [total, streak] = await Promise.all([getTotalGamesPlayed(childId), getStreak(childId)]);
    setTotalGames(total);
    setCurStreak(streak.currentStreak);
    setBestStreak(streak.longestStreak);
    const mo = monOff();
    setLwActs(await getActivityRange(childId, dateStr(mo - 7), dateStr(mo - 1)));
    const avgs: number[] = [];
    for (let w = 3; w >= 0; w--) {
      const wActs = await getActivityRange(childId, dateStr(mo - w * 7), dateStr(mo - w * 7 + 6));
      avgs.push(wActs.length ? Math.round(wActs.reduce((s, a) => s + a.score, 0) / wActs.length) : 0);
    }
    setFourWeekAvgs(avgs);
  }, [childId]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (tab === "today") loadToday();
    else if (tab === "week") loadWeek();
    else loadAllTime();
  }, [isAuthenticated, tab, loadToday, loadWeek, loadAllTime]);

  // Derived
  const todayAvg = todayActs.length ? Math.round(todayActs.reduce((s, a) => s + a.score, 0) / todayActs.length) : 0;
  const todayTime = todayActs.reduce((s, a) => s + a.duration, 0);
  const weekAvg = weekActs.length ? Math.round(weekActs.reduce((s, a) => s + a.score, 0) / weekActs.length) : 0;

  // Per-game breakdown for the week tab
  const gameScores: Record<string, { total: number; count: number }> = {};
  weekActs.forEach((a) => {
    if (!gameScores[a.gameId]) gameScores[a.gameId] = { total: 0, count: 0 };
    gameScores[a.gameId].total += a.score;
    gameScores[a.gameId].count++;
  });
  const gameBk = Object.entries(gameScores)
    .map(([id, v]) => ({ gameId: id, avg: Math.round(v.total / v.count), count: v.count }))
    .sort((a, b) => b.count - a.count);

  // Favorite game (most played across recent weeks)
  const allCounts: Record<string, number> = {};
  weekActs.concat(lwActs).forEach((a) => {
    allCounts[a.gameId] = (allCounts[a.gameId] || 0) + 1;
  });
  const favGame = Object.entries(allCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || "None yet";
  const lwAvg = lwActs.length ? Math.round(lwActs.reduce((s, a) => s + a.score, 0) / lwActs.length) : 0;
  const improvement = weekAvg - lwAvg;

  if (authLoading || !isAuthenticated) {
    return (
      <div className="page" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <p style={{ color: "var(--text-secondary)" }}>Loading...</p>
      </div>
    );
  }

  const heading: React.CSSProperties = { fontFamily: fredoka, fontWeight: 600, fontSize: "0.95rem", color: "var(--text-primary)", margin: "0 0 10px" };

  return (
    <div className="page">
      <nav className="nav">
        <Link href="/" className="logo">Auti<em>Sense</em></Link>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => setTheme(t => t === "light" ? "dark" : "light")} className="btn btn-outline" style={{ minHeight: 40, padding: "8px 14px", fontSize: "0.85rem" }}>
            {theme === "light" ? "Dark" : "Light"}
          </button>
          <Link href="/kid-dashboard" className="btn btn-outline" style={{ minHeight: 40, padding: "8px 14px", fontSize: "0.85rem" }}>Home</Link>
        </div>
      </nav>

      <div className="main fade fade-1" style={{ maxWidth: 900, padding: "32px 24px 80px" }}>
        <h1 style={{ fontFamily: fredoka, fontWeight: 700, fontSize: "1.5rem", color: "var(--text-primary)", margin: "0 0 6px" }}>My Progress</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem", margin: "0 0 24px" }}>See how far you&apos;ve come!</p>

        {/* Tab bar */}
        <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
          {([["today", "Today"], ["week", "This Week"], ["alltime", "All Time"]] as [Tab, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} className="btn" style={{
              padding: "8px 20px", fontSize: "0.84rem", fontFamily: fredoka,
              fontWeight: tab === key ? 700 : 500, background: tab === key ? "var(--sage-100)" : "var(--card)",
              color: tab === key ? "var(--sage-700)" : "var(--text-secondary)", border: "1px solid var(--border)",
              borderRadius: "var(--r-full)", cursor: "pointer", transition: "all 200ms var(--ease)",
            }}>
              {label}
            </button>
          ))}
        </div>

        {/* TODAY */}
        {tab === "today" && (
          <div className="fade fade-2">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
              <Stat value={todayActs.length} label="Games Played" />
              <Stat value={`${todayAvg}%`} label="Avg Score" />
              <Stat value={fmtDur(todayTime)} label="Time Spent" />
            </div>
            {todayActs.length === 0 ? (
              <div style={{ ...sc, padding: "36px 24px", textAlign: "center" }}>
                <div style={{ fontSize: "1.1rem", fontFamily: fredoka, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>No games played today</div>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", margin: "0 0 16px" }}>Let&apos;s play!</p>
                <Link href="/kid-dashboard/games" className="btn" style={{
                  display: "inline-block", padding: "10px 24px", background: "var(--sage-500)", color: "white",
                  borderRadius: "var(--r-full)", fontFamily: fredoka, fontWeight: 600, fontSize: "0.88rem", textDecoration: "none",
                }}>Go to Games</Link>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <h3 style={heading}>Today&apos;s Games</h3>
                {todayActs.map((act, i) => (
                  <div key={act.id ?? i} style={{ ...sc, textAlign: "left", padding: "14px 18px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontFamily: fredoka, fontWeight: 600, fontSize: "0.9rem", color: "var(--text-primary)" }}>{gameName(act.gameId)}</span>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{fmtTime(act.completedAt)} &middot; {fmtDur(act.duration)}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <ScoreBar score={act.score} />
                      <span style={{ fontSize: "0.8rem", fontWeight: 700, color: scColor(act.score), minWidth: 36, textAlign: "right" }}>{act.score}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* THIS WEEK */}
        {tab === "week" && (
          <div className="fade fade-2">
            <div style={{ ...sc, marginBottom: 20, padding: "20px 24px" }}>
              <h3 style={{ ...heading, textAlign: "center" }}>This Week</h3>
              <div style={{ display: "flex", justifyContent: "center", gap: 14, marginBottom: 10 }}>
                {DAYS.map((day, i) => {
                  const c = weekDayCounts[i];
                  const bg = c === 0 ? "var(--sage-100)" : c <= 2 ? "var(--sage-300)" : "var(--sage-500)";
                  return (
                    <div key={day} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 700, color: c > 0 ? "white" : "var(--text-secondary)", transition: "background 300ms var(--ease)" }}>{c}</div>
                      <span style={{ fontSize: "0.68rem", color: "var(--text-secondary)" }}>{day}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
              <Stat value={`${weekAvg}%`} label="Avg Score" />
              <Stat value={weekActs.length} label="Total Games" />
            </div>
            {gameBk.length > 0 && (
              <div style={{ ...sc, textAlign: "left", padding: "18px 20px" }}>
                <h3 style={heading}>Per-Game Scores</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {gameBk.map(g => (
                    <div key={g.gameId}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)" }}>{gameName(g.gameId)}</span>
                        <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>{g.avg}% avg ({g.count}x)</span>
                      </div>
                      <ScoreBar score={g.avg} />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {weekActs.length === 0 && (
              <div style={{ ...sc, padding: "28px 24px", textAlign: "center" }}>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem", margin: 0 }}>No games played this week yet. Start playing to see your progress!</p>
              </div>
            )}
          </div>
        )}

        {/* ALL TIME */}
        {tab === "alltime" && (
          <div className="fade fade-2">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 20 }}>
              <Stat value={totalGames} label="Total Games" />
              <Stat value={bestStreak} label="Best Streak" />
              <Stat value={curStreak} label="Current Streak" />
              <div style={sc}>
                <div style={{ fontSize: "1.1rem", fontFamily: fredoka, fontWeight: 700, color: "var(--sage-600)", textTransform: "capitalize" }}>{favGame.replace(/-/g, " ")}</div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: 4 }}>Favorite Game</div>
              </div>
            </div>

            {/* Improvement */}
            <div style={{ ...sc, marginBottom: 20, padding: "18px 22px", display: "flex", alignItems: "center", gap: 14, textAlign: "left" }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: improvement >= 0 ? "var(--sage-100)" : "var(--feature-peach)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem" }}>
                {improvement > 0 ? "\u2191" : improvement < 0 ? "\u2193" : "\u2192"}
              </div>
              <div>
                <div style={{ fontFamily: fredoka, fontWeight: 600, fontSize: "0.95rem", color: "var(--text-primary)" }}>
                  {improvement > 0 ? `+${improvement}%` : improvement < 0 ? `${improvement}%` : "Same"} vs last week
                </div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: 2 }}>This week {weekAvg}% &middot; Last week {lwAvg}%</div>
              </div>
            </div>

            {/* 4-week trend */}
            <div style={{ ...sc, padding: "18px 22px" }}>
              <h3 style={heading}>4-Week Trend</h3>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 80, justifyContent: "center" }}>
                {fourWeekAvgs.map((avg, i) => (
                  <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--text-secondary)" }}>{avg}%</span>
                    <div style={{ width: 36, height: Math.max(4, (avg / 100) * 60), borderRadius: 4, background: i === 3 ? "var(--sage-500)" : "var(--sage-300)", transition: "height 400ms var(--ease)" }} />
                    <span style={{ fontSize: "0.65rem", color: "var(--text-secondary)" }}>{i === 3 ? "Now" : `W-${3 - i}`}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
