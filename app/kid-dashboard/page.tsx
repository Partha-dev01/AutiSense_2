"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { useAuthGuard } from "../hooks/useAuthGuard";
import { listProfiles } from "../lib/db/childProfile.repository";
import { getStreak } from "../lib/db/streak.repository";
import { getTodayActivity } from "../lib/db/gameActivity.repository";
import StreakBadge from "../components/StreakBadge";
import type { ChildProfile } from "../types/childProfile";
import type { Streak } from "../types/gameActivity";

const ACTIVE_CHILD_KEY = "autisense-active-child-id";
const DAILY_TARGET = 3;

const quickLinks = [
  { href: "/kid-dashboard/speech", emoji: "🗣️", label: "Speech", color: "var(--feature-peach)" },
  { href: "/kid-dashboard/talking", emoji: "🤝", label: "Talking", color: "var(--feature-blue)" },
  { href: "/kid-dashboard/chat", emoji: "🐾", label: "AI Chat", color: "var(--feature-lavender)" },
  { href: "/kid-dashboard/doctor-connect", emoji: "🩺", label: "Doctor", color: "var(--feature-green)" },
];

const gameCards = [
  { id: "bubble-pop", emoji: "🫧", title: "Bubble Pop", color: "var(--feature-blue)", isNew: true },
  { id: "alphabet-pattern", emoji: "🔤", title: "Alphabet", color: "var(--feature-peach)", isNew: true },
  { id: "tracing", emoji: "✏️", title: "Tracing", color: "var(--feature-green)", isNew: true },
  { id: "match-numbers", emoji: "🔢", title: "Numbers", color: "var(--feature-lavender)", isNew: true },
  { id: "memory", emoji: "🃏", title: "Memory", color: "var(--feature-peach)", isNew: true },
  { id: "social-stories-v2", emoji: "📖", title: "Stories", color: "var(--feature-green)", isNew: true },
  { id: "emotion-match", emoji: "😊", title: "Emotions", color: "var(--feature-peach)" },
  { id: "sorting", emoji: "🗂️", title: "Sorting", color: "var(--feature-blue)" },
  { id: "sequence", emoji: "🎵", title: "Sequence", color: "var(--feature-lavender)" },
  { id: "breathing", emoji: "🌿", title: "Breathing", color: "var(--feature-green)" },
  { id: "pattern-match", emoji: "🔲", title: "Patterns", color: "var(--feature-blue)" },
  { id: "color-sound", emoji: "🎨", title: "Color", color: "var(--feature-lavender)" },
];

export default function KidDashboardPage() {
  const { loading: authLoading, isAuthenticated } = useAuthGuard();
  const [profiles, setProfiles] = useState<ChildProfile[]>([]);
  const [activeChildId, setActiveChildId] = useState<string>("");
  const [streak, setStreak] = useState<Streak>({ childId: "", currentStreak: 0, longestStreak: 0, lastPlayDate: "" });
  const [todayCount, setTodayCount] = useState(0);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const saved = (typeof window !== "undefined" && localStorage.getItem("autisense-theme")) || "light";
    setTheme(saved as "light" | "dark");
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    if (typeof window !== "undefined") localStorage.setItem("autisense-theme", theme);
  }, [theme]);

  const loadData = useCallback(async () => {
    const all = await listProfiles();
    setProfiles(all);

    const savedChild = typeof window !== "undefined" ? localStorage.getItem(ACTIVE_CHILD_KEY) : null;
    const childId = savedChild && all.find((p) => p.id === savedChild)
      ? savedChild
      : all[0]?.id || "";

    if (childId) {
      setActiveChildId(childId);
      if (typeof window !== "undefined") localStorage.setItem(ACTIVE_CHILD_KEY, childId);
      const [s, today] = await Promise.all([
        getStreak(childId),
        getTodayActivity(childId),
      ]);
      setStreak(s);
      setTodayCount(today.length);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) loadData();
  }, [isAuthenticated, loadData]);

  const switchChild = async (childId: string) => {
    setActiveChildId(childId);
    localStorage.setItem(ACTIVE_CHILD_KEY, childId);
    const [s, today] = await Promise.all([
      getStreak(childId),
      getTodayActivity(childId),
    ]);
    setStreak(s);
    setTodayCount(today.length);
  };

  const activeChild = profiles.find((p) => p.id === activeChildId);
  const progressPct = Math.min(100, Math.round((todayCount / DAILY_TARGET) * 100));

  if (authLoading || !isAuthenticated) {
    return (
      <div className="page" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <p style={{ color: "var(--text-secondary)" }}>Loading...</p>
      </div>
    );
  }

  return (
    <div className="page">
      {/* Header */}
      <nav className="nav">
        <Link href="/" className="logo">Auti<em>Sense</em></Link>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
            className="btn btn-outline"
            style={{ minHeight: 40, padding: "8px 14px", fontSize: "0.85rem" }}
          >
            {theme === "light" ? "Dark" : "Light"}
          </button>
          <Link href="/dashboard" className="btn btn-outline" style={{ minHeight: 40, padding: "8px 14px", fontSize: "0.85rem" }}>
            Parent
          </Link>
        </div>
      </nav>

      <div className="main fade fade-1" style={{ maxWidth: 900, padding: "24px 20px 40px" }}>
        {/* Welcome */}
        <div className="fade fade-1" style={{ marginBottom: 20 }}>
          <h1
            style={{
              fontFamily: "'Fredoka',sans-serif",
              fontWeight: 700,
              fontSize: "1.6rem",
              color: "var(--text-primary)",
              margin: 0,
            }}
          >
            Hi, {activeChild?.name || "there"}! 👋
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginTop: 4 }}>
            Ready to play and learn today?
          </p>
        </div>

        {/* Child selector (if multiple) */}
        {profiles.length > 1 && (
          <div className="fade fade-2" style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
            {profiles.map((p) => (
              <button
                key={p.id}
                onClick={() => switchChild(p.id)}
                className="btn"
                style={{
                  padding: "6px 16px",
                  fontSize: "0.82rem",
                  fontWeight: p.id === activeChildId ? 700 : 500,
                  background: p.id === activeChildId ? "var(--sage-100)" : "var(--card)",
                  color: p.id === activeChildId ? "var(--sage-700)" : "var(--text-secondary)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-full)",
                  minHeight: 36,
                }}
              >
                {p.name}
              </button>
            ))}
          </div>
        )}

        {/* Streak */}
        <div className="fade fade-2" style={{ marginBottom: 20 }}>
          <StreakBadge currentStreak={streak.currentStreak} longestStreak={streak.longestStreak} />
        </div>

        {/* Today's Progress */}
        <div
          className="card fade fade-3"
          style={{
            padding: "18px 22px",
            marginBottom: 24,
            display: "flex",
            alignItems: "center",
            gap: 18,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: `conic-gradient(var(--sage-500) ${progressPct * 3.6}deg, var(--sage-100) 0deg)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: "var(--card)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "'Fredoka',sans-serif",
                fontWeight: 700,
                fontSize: "0.85rem",
                color: "var(--sage-600)",
              }}
            >
              {todayCount}/{DAILY_TARGET}
            </div>
          </div>
          <div>
            <div
              style={{
                fontFamily: "'Fredoka',sans-serif",
                fontWeight: 600,
                fontSize: "0.95rem",
                color: "var(--text-primary)",
              }}
            >
              Today&apos;s Progress
            </div>
            <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginTop: 2 }}>
              {todayCount >= DAILY_TARGET
                ? "Daily goal reached! Great job!"
                : `${DAILY_TARGET - todayCount} more game${DAILY_TARGET - todayCount === 1 ? "" : "s"} to hit your goal`}
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div
          className="fade fade-3"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 10,
            marginBottom: 28,
          }}
        >
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                padding: "14px 8px",
                borderRadius: "var(--r-lg)",
                background: link.color,
                textDecoration: "none",
                transition: "transform 200ms var(--ease)",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(1.04)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
            >
              <span style={{ fontSize: "1.5rem" }}>{link.emoji}</span>
              <span
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  fontFamily: "'Fredoka',sans-serif",
                  color: "var(--text-primary)",
                }}
              >
                {link.label}
              </span>
            </Link>
          ))}
        </div>

        {/* Games Grid */}
        <h2
          className="fade fade-4"
          style={{
            fontFamily: "'Fredoka',sans-serif",
            fontWeight: 600,
            fontSize: "1.15rem",
            color: "var(--text-primary)",
            marginBottom: 14,
          }}
        >
          Games
        </h2>
        <div
          className="fade fade-4"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
            gap: 12,
          }}
        >
          {gameCards.map((game) => {
            const href = game.isNew
              ? `/kid-dashboard/games/${game.id}`
              : `/games/${game.id}`;

            return (
              <Link
                key={game.id}
                href={href}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 8,
                  padding: "20px 12px",
                  borderRadius: "var(--r-lg)",
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  textDecoration: "none",
                  position: "relative",
                  transition: "transform 250ms var(--ease), box-shadow 250ms var(--ease)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "none";
                }}
              >
                {game.isNew && (
                  <span
                    style={{
                      position: "absolute",
                      top: 6,
                      right: 6,
                      fontSize: "0.6rem",
                      fontWeight: 700,
                      background: "var(--sage-500)",
                      color: "white",
                      padding: "2px 6px",
                      borderRadius: "var(--r-full)",
                      fontFamily: "'Fredoka',sans-serif",
                    }}
                  >
                    NEW
                  </span>
                )}
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "var(--r-md)",
                    background: game.color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1.4rem",
                  }}
                >
                  {game.emoji}
                </div>
                <span
                  style={{
                    fontFamily: "'Fredoka',sans-serif",
                    fontWeight: 600,
                    fontSize: "0.82rem",
                    color: "var(--text-primary)",
                    textAlign: "center",
                  }}
                >
                  {game.title}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
