"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { useAuthGuard } from "../hooks/useAuthGuard";
import { listProfiles } from "../lib/db/childProfile.repository";
import { getStreak } from "../lib/db/streak.repository";
import { getTodayActivity, getRecentGameIds } from "../lib/db/gameActivity.repository";
import StreakBadge from "../components/StreakBadge";
import NavLogo from "../components/NavLogo";
import UserMenu from "../components/UserMenu";
import ThemeToggle from "../components/ThemeToggle";
import { Mic, Camera, Bot, MapPin, ClipboardList, Users } from "lucide-react";
import type { ChildProfile } from "../types/childProfile";
import type { Streak } from "../types/gameActivity";

const ACTIVE_CHILD_KEY = "autisense-active-child-id";
const DAILY_TARGET = 3;

const quickLinks = [
  { href: "/kid-dashboard/speech", icon: Mic, label: "Speech", color: "var(--feature-peach)" },
  { href: "/kid-dashboard/detection", icon: Camera, label: "Detection", color: "var(--feature-blue)" },
  { href: "/kid-dashboard/chat", icon: Bot, label: "AI Chat", color: "var(--feature-lavender)" },
  { href: "/kid-dashboard/nearby-help", icon: MapPin, label: "Nearby", color: "var(--feature-green)" },
  { href: "/intake/profile", icon: ClipboardList, label: "Screening", color: "var(--feature-peach)" },
  { href: "/feed", icon: Users, label: "Community", color: "var(--feature-blue)" },
];

const gameCards = [
  { id: "bubble-pop", emoji: "🫧", title: "Bubble Pop", color: "var(--feature-blue)", isNew: true },
  { id: "alphabet-pattern", emoji: "🔤", title: "Alphabet", color: "var(--feature-peach)", isNew: true },
  { id: "tracing", emoji: "✏️", title: "Tracing", color: "var(--feature-green)", isNew: true },
  { id: "match-numbers", emoji: "🔢", title: "Numbers", color: "var(--feature-lavender)", isNew: true },
  { id: "memory", emoji: "🃏", title: "Memory", color: "var(--feature-peach)", isNew: true },
  { id: "social-stories-v2", emoji: "📖", title: "Stories", color: "var(--feature-green)", isNew: true },
  { id: "emotion-match", emoji: "🧠", title: "Emotions", color: "var(--feature-peach)" },
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
  const [recentGameIds, setRecentGameIds] = useState<string[]>([]);
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
      : all[0]?.id || "default";

    if (childId) {
      setActiveChildId(childId);
      if (typeof window !== "undefined") localStorage.setItem(ACTIVE_CHILD_KEY, childId);
      const [s, today, recent] = await Promise.all([
        getStreak(childId),
        getTodayActivity(childId),
        getRecentGameIds(childId, 4),
      ]);
      setStreak(s);
      setTodayCount(today.length);
      setRecentGameIds(recent);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) loadData();
  }, [isAuthenticated, loadData]);

  const switchChild = async (childId: string) => {
    setActiveChildId(childId);
    localStorage.setItem(ACTIVE_CHILD_KEY, childId);
    const [s, today, recent] = await Promise.all([
      getStreak(childId),
      getTodayActivity(childId),
      getRecentGameIds(childId, 4),
    ]);
    setStreak(s);
    setTodayCount(today.length);
    setRecentGameIds(recent);
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
        <NavLogo />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ThemeToggle theme={theme} onToggle={() => setTheme((t) => (t === "light" ? "dark" : "light"))} />
          <UserMenu />
        </div>
      </nav>

      <div className="main fade fade-1" style={{ maxWidth: 900, padding: "24px 20px 24px" }}>
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
            gridTemplateColumns: "repeat(3, 1fr)",
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
              <link.icon size={24} strokeWidth={2} style={{ color: "var(--text-primary)" }} />
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

        {/* Recent Games */}
        <div className="fade fade-4" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h2 style={{ fontFamily: "'Fredoka',sans-serif", fontWeight: 600, fontSize: "1.15rem", color: "var(--text-primary)", margin: 0 }}>
            {recentGameIds.length > 0 ? "Recent Games" : "Featured Games"}
          </h2>
          <Link href="/kid-dashboard/games" style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--sage-500)", textDecoration: "none" }}>
            See All →
          </Link>
        </div>
        <div
          className="fade fade-4"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 12,
          }}
        >
          {(() => {
            const DEFAULT_IDS = ["bubble-pop", "memory", "emotion-match", "breathing"];
            const displayIds = recentGameIds.length > 0 ? recentGameIds.slice(0, 4) : DEFAULT_IDS;
            return displayIds.map((id) => {
              const game = gameCards.find((g) => g.id === id) || gameCards[0];
              const href = game.isNew ? `/kid-dashboard/games/${game.id}` : `/games/${game.id}`;
              return (
                <Link
                  key={game.id}
                  href={href}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                    padding: "16px 8px", borderRadius: "var(--r-lg)", background: "var(--card)",
                    border: "1px solid var(--border)", textDecoration: "none",
                    transition: "transform 250ms var(--ease), box-shadow 250ms var(--ease)",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
                >
                  <div style={{
                    width: 48, height: 48, borderRadius: "var(--r-md)", background: game.color,
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem",
                  }}>
                    {game.emoji}
                  </div>
                  <span style={{
                    fontFamily: "'Fredoka',sans-serif", fontWeight: 600, fontSize: "0.78rem",
                    color: "var(--text-primary)", textAlign: "center",
                  }}>
                    {game.title}
                  </span>
                </Link>
              );
            });
          })()}
        </div>
      </div>
    </div>
  );
}
