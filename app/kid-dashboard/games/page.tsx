"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useAuthGuard } from "../../hooks/useAuthGuard";
import NavLogo from "../../components/NavLogo";
import ThemeToggle from "../../components/ThemeToggle";

const games = [
  { id: "bubble-pop", emoji: "🫧", title: "Bubble Pop", description: "Pop the right bubbles as they float up! Builds focus and reaction speed.", color: "var(--feature-blue)", isNew: true },
  { id: "alphabet-pattern", emoji: "🔤", title: "Alphabet Pattern", description: "Fill in the missing letters in a sequence. Strengthens pattern recognition.", color: "var(--feature-peach)", isNew: true },
  { id: "tracing", emoji: "✏️", title: "Basic Tracing", description: "Trace letters and shapes with your finger. Develops fine motor skills.", color: "var(--feature-green)", isNew: true },
  { id: "match-numbers", emoji: "🔢", title: "Match Numbers", description: "Match numerals to dot quantities. Builds number sense and counting.", color: "var(--feature-lavender)", isNew: true },
  { id: "memory", emoji: "🃏", title: "Memory Game", description: "Flip cards to find matching pairs. Trains working memory and focus.", color: "var(--feature-peach)", isNew: true },
  { id: "social-stories-v2", emoji: "📖", title: "Social Stories", description: "Choose the best response in social situations. Builds empathy and reasoning.", color: "var(--feature-green)", isNew: true },
];

const existingGames = [
  { id: "emotion-match", emoji: "🧠", title: "Emotion Quiz", description: "Read a situation and pick the right feeling. Builds emotional understanding.", color: "var(--feature-peach)" },
  { id: "sorting", emoji: "🗂️", title: "Category Sorting", description: "Drag items into the correct category.", color: "var(--feature-blue)" },
  { id: "sequence", emoji: "🎵", title: "Sequence Memory", description: "Remember and repeat color sequences.", color: "var(--feature-lavender)" },
  { id: "social-stories", emoji: "📖", title: "Social Stories", description: "Interactive social scenarios with choices.", color: "var(--feature-green)" },
  { id: "breathing", emoji: "🌿", title: "Calm Breathing", description: "Guided breathing with a gentle circle.", color: "var(--feature-green)" },
  { id: "pattern-match", emoji: "🔲", title: "Pattern Match", description: "Find the odd pattern in a grid.", color: "var(--feature-blue)" },
  { id: "color-sound", emoji: "🎨", title: "Color & Sound", description: "Tap colors matching a sound cue.", color: "var(--feature-lavender)" },
];

export default function KidGamesHubPage() {
  const { loading: authLoading, isAuthenticated } = useAuthGuard();
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const saved = (typeof window !== "undefined" && localStorage.getItem("autisense-theme")) || "light";
    setTheme(saved as "light" | "dark");
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    if (typeof window !== "undefined") localStorage.setItem("autisense-theme", theme);
  }, [theme]);

  if (authLoading || !isAuthenticated) {
    return (
      <div className="page" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <p style={{ color: "var(--text-secondary)" }}>Loading...</p>
      </div>
    );
  }

  const renderCard = (game: { id: string; emoji: string; title: string; description: string; color: string; isNew?: boolean }, href: string, index: number) => (
    <Link
      key={game.id}
      href={href}
      className={`card fade fade-${Math.min(index + 2, 5)}`}
      style={{
        padding: "24px 20px",
        textDecoration: "none",
        color: "inherit",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        position: "relative",
        transition: "transform 300ms var(--ease), box-shadow 300ms var(--ease)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "translateY(-3px)";
        (e.currentTarget as HTMLElement).style.boxShadow = "0 6px 20px rgba(0,0,0,0.08)";
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
            top: 10,
            right: 10,
            fontSize: "0.65rem",
            fontWeight: 700,
            background: "var(--sage-500)",
            color: "white",
            padding: "2px 8px",
            borderRadius: "var(--r-full)",
            fontFamily: "'Fredoka',sans-serif",
          }}
        >
          NEW
        </span>
      )}
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: "var(--r-md)",
          background: game.color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "1.6rem",
        }}
      >
        {game.emoji}
      </div>
      <h3
        style={{
          fontFamily: "'Fredoka',sans-serif",
          fontWeight: 600,
          fontSize: "1rem",
          color: "var(--text-primary)",
          margin: 0,
        }}
      >
        {game.title}
      </h3>
      <p
        style={{
          fontSize: "0.82rem",
          color: "var(--text-secondary)",
          lineHeight: 1.6,
          flex: 1,
          margin: 0,
        }}
      >
        {game.description}
      </p>
      <span
        style={{
          fontSize: "0.78rem",
          fontWeight: 700,
          color: "var(--sage-500)",
          marginTop: 2,
        }}
      >
        Play now
      </span>
    </Link>
  );

  return (
    <div className="page">
      <nav className="nav">
        <NavLogo />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ThemeToggle theme={theme} onToggle={() => setTheme((t) => (t === "light" ? "dark" : "light"))} />
          <Link href="/kid-dashboard" className="btn btn-outline" style={{ minHeight: 40, padding: "8px 14px", fontSize: "0.85rem" }}>
            Home
          </Link>
        </div>
      </nav>

      <div className="main fade fade-1" style={{ maxWidth: 900, padding: "32px 24px 80px" }}>
        <h1 className="page-title">All <em>Games</em></h1>
        <p className="subtitle">Play, learn, and grow at your own pace.</p>

        {/* New Games */}
        <h2
          style={{
            fontFamily: "'Fredoka',sans-serif",
            fontWeight: 600,
            fontSize: "1.1rem",
            color: "var(--text-primary)",
            marginBottom: 14,
            marginTop: 8,
          }}
        >
          New Games
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: 16,
            marginBottom: 36,
          }}
        >
          {games.map((game, i) => renderCard(game, `/kid-dashboard/games/${game.id}`, i))}
        </div>

        {/* Existing Games */}
        <h2
          style={{
            fontFamily: "'Fredoka',sans-serif",
            fontWeight: 600,
            fontSize: "1.1rem",
            color: "var(--text-primary)",
            marginBottom: 14,
          }}
        >
          Classic Games
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: 16,
          }}
        >
          {existingGames.map((game, i) => renderCard(game, `/games/${game.id}`, i + games.length))}
        </div>
      </div>
    </div>
  );
}
