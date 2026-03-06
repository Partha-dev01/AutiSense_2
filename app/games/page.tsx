"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useAuthGuard } from "../hooks/useAuthGuard";
import NavLogo from "../components/NavLogo";
import ThemeToggle from "../components/ThemeToggle";

const games = [
  {
    id: "emotion-match",
    emoji: "😊",
    title: "Emotion Match",
    description: "Match emoji faces to their emotion words. Builds emotional recognition skills.",
    color: "var(--feature-peach)",
  },
  {
    id: "sorting",
    emoji: "🗂️",
    title: "Category Sorting",
    description: "Drag items into the correct category. Strengthens classification and reasoning.",
    color: "var(--feature-blue)",
  },
  {
    id: "sequence",
    emoji: "🎵",
    title: "Sequence Memory",
    description: "Remember and repeat color sequences. A Simon Says style memory game.",
    color: "var(--feature-lavender)",
  },
  {
    id: "social-stories",
    emoji: "📖",
    title: "Social Stories",
    description: "Interactive social scenarios with choices. Practice appropriate social responses.",
    color: "var(--feature-green)",
  },
  {
    id: "breathing",
    emoji: "🌿",
    title: "Calm Breathing",
    description: "Guided breathing with a gentle expanding circle. Helps with self-regulation.",
    color: "var(--feature-green)",
  },
  {
    id: "pattern-match",
    emoji: "🔲",
    title: "Pattern Match",
    description: "Find the odd pattern in a grid. Develops visual discrimination and attention.",
    color: "var(--feature-blue)",
  },
  {
    id: "color-sound",
    emoji: "🎨",
    title: "Color & Sound",
    description: "Tap colors that match a sound cue. Builds multisensory processing skills.",
    color: "var(--feature-lavender)",
  },
];

export default function GamesHubPage() {
  const { loading: authLoading, isAuthenticated } = useAuthGuard();
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const saved =
      (typeof window !== "undefined" && localStorage.getItem("autisense-theme")) || "light";
    setTheme(saved as "light" | "dark");
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    if (typeof window !== "undefined") localStorage.setItem("autisense-theme", theme);
  }, [theme]);

  if (authLoading || !isAuthenticated) {
    return (
      <div className="page" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <p style={{ color: "var(--text-secondary)" }}>Checking authentication...</p>
      </div>
    );
  }

  return (
    <div className="page">
      {/* Nav */}
      <nav className="nav">
        <NavLogo />
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <ThemeToggle theme={theme} onToggle={() => setTheme((t) => (t === "light" ? "dark" : "light"))} />
          <Link
            href="/kid-dashboard"
            className="btn btn-outline"
            style={{ minHeight: 40, padding: "8px 16px", fontSize: "0.9rem" }}
          >
            Dashboard
          </Link>
        </div>
      </nav>

      {/* Main */}
      <div
        className="main fade fade-1"
        style={{ maxWidth: 900, padding: "40px 28px 80px" }}
      >
        <h1 className="page-title">
          Therapy <em>Games</em>
        </h1>
        <p className="subtitle">
          Adaptive activities that support your child&apos;s development. Each game adjusts to their pace.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
            gap: 18,
          }}
        >
          {games.map((game, index) => (
            <Link
              key={game.id}
              href={`/games/${game.id}`}
              className={`card fade fade-${Math.min(index + 2, 5)}`}
              style={{
                padding: "28px 22px",
                textDecoration: "none",
                color: "inherit",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                gap: 12,
                transition: "transform 350ms var(--ease), box-shadow 350ms var(--ease)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.transform = "translateY(-3px)";
                (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-md)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-sm)";
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "var(--r-md)",
                  background: game.color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.7rem",
                }}
              >
                {game.emoji}
              </div>
              <h3
                style={{
                  fontFamily: "'Fredoka',sans-serif",
                  fontWeight: 600,
                  fontSize: "1.05rem",
                  color: "var(--text-primary)",
                }}
              >
                {game.title}
              </h3>
              <p
                style={{
                  fontSize: "0.88rem",
                  color: "var(--text-secondary)",
                  lineHeight: 1.65,
                  flex: 1,
                }}
              >
                {game.description}
              </p>
              <span
                style={{
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  color: "var(--sage-500)",
                  marginTop: 4,
                }}
              >
                Play now
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
