"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { getDifficulty, saveDifficulty } from "../../../lib/games/difficultyEngine";
import { addGameActivity } from "../../../lib/db/gameActivity.repository";
import { updateStreak } from "../../../lib/db/streak.repository";
import NavLogo from "../../../components/NavLogo";
import ThemeToggle from "../../../components/ThemeToggle";

type Screen = "start" | "play" | "result";

interface Card {
  id: number;
  emoji: string;
  flipped: boolean;
  matched: boolean;
}

const EMOJI_POOL = [
  "\uD83D\uDC36", "\uD83D\uDC31", "\uD83D\uDC30", "\uD83E\uDD81", "\uD83D\uDC38", "\uD83E\uDD8B",
  "\uD83C\uDF4E", "\uD83C\uDF4C", "\uD83C\uDF4A", "\uD83C\uDF47", "\uD83C\uDF1F", "\u2B50",
  "\uD83C\uDF08", "\uD83C\uDF88", "\uD83C\uDF3A", "\uD83D\uDC20",
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildDeck(pairCount: number): Card[] {
  const picked = shuffle(EMOJI_POOL).slice(0, pairCount);
  const pairs = [...picked, ...picked];
  return shuffle(pairs).map((emoji, i) => ({
    id: i,
    emoji,
    flipped: false,
    matched: false,
  }));
}

function getPairsForLevel(level: number): number {
  if (level <= 1) return 3;  // 6 cards — 3×2
  return 4;                  // 8 cards — 3×3 (one slot empty)
}

function getGridCols(): number {
  return 3; // always 3 columns for a manageable grid
}

function playMatchSound() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(523, ctx.currentTime);
    osc.frequency.setValueAtTime(659, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);
  } catch { /* audio not available */ }
}

const statStyle = {
  fontSize: "1.8rem", fontFamily: "'Fredoka',sans-serif" as const,
  fontWeight: 700 as const, color: "var(--sage-500)",
};
const statLabel = {
  fontSize: "0.82rem", color: "var(--text-secondary)", fontWeight: 600 as const,
};

export default function MemoryGamePage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [screen, setScreen] = useState<Screen>("start");
  const [cards, setCards] = useState<Card[]>([]);
  const [flippedIds, setFlippedIds] = useState<number[]>([]);
  const [matches, setMatches] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [totalPairs, setTotalPairs] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [locked, setLocked] = useState(false);
  const [saved, setSaved] = useState(false);

  /* ---------- theme ---------- */
  useEffect(() => {
    const s = (typeof window !== "undefined" && localStorage.getItem("autisense-theme")) || "light";
    setTheme(s as "light" | "dark");
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    if (typeof window !== "undefined") localStorage.setItem("autisense-theme", theme);
  }, [theme]);

  /* ---------- elapsed timer ---------- */
  useEffect(() => {
    if (screen !== "play") return;
    const iv = setInterval(() => setElapsed(Date.now() - startTime), 500);
    return () => clearInterval(iv);
  }, [screen, startTime]);

  /* ---------- start game ---------- */
  const startGame = useCallback(() => {
    const childId =
      (typeof window !== "undefined" && localStorage.getItem("autisense-active-child-id")) || "default";
    const config = getDifficulty("memory", childId);
    const pairs = getPairsForLevel(config.level);
    const deck = buildDeck(pairs);

    setCards(deck);
    setTotalPairs(pairs);
    setMatches(0);
    setAttempts(0);
    setFlippedIds([]);
    setLocked(false);
    setStartTime(Date.now());
    setElapsed(0);
    setSaved(false);
    setScreen("play");
  }, []);

  /* ---------- save results ---------- */
  useEffect(() => {
    if (screen !== "result" || saved) return;
    setSaved(true);
    const childId =
      (typeof window !== "undefined" && localStorage.getItem("autisense-active-child-id")) || "default";
    const finalScore = Math.min(100, Math.round((totalPairs / Math.max(1, attempts)) * 100));
    const config = getDifficulty("memory", childId);
    saveDifficulty("memory", childId, finalScore);
    addGameActivity(childId, "memory", finalScore, Math.floor(elapsed / 1000), config.level);
    updateStreak(childId);
  }, [screen, saved, totalPairs, attempts, elapsed]);

  /* ---------- card tap ---------- */
  const handleCardTap = useCallback(
    (card: Card) => {
      if (locked || card.flipped || card.matched) return;

      const newCards = cards.map((c) =>
        c.id === card.id ? { ...c, flipped: true } : c,
      );
      setCards(newCards);
      const newFlipped = [...flippedIds, card.id];
      setFlippedIds(newFlipped);

      if (newFlipped.length === 2) {
        setAttempts((a) => a + 1);
        const [firstId, secondId] = newFlipped;
        const first = newCards.find((c) => c.id === firstId)!;
        const second = newCards.find((c) => c.id === secondId)!;

        if (first.emoji === second.emoji) {
          /* match */
          playMatchSound();
          const matched = newCards.map((c) =>
            c.id === firstId || c.id === secondId ? { ...c, matched: true } : c,
          );
          setCards(matched);
          setFlippedIds([]);
          const newMatches = matches + 1;
          setMatches(newMatches);
          if (newMatches >= totalPairs) {
            setTimeout(() => setScreen("result"), 600);
          }
        } else {
          /* no match — flip back after 800ms */
          setLocked(true);
          setTimeout(() => {
            setCards((prev) =>
              prev.map((c) =>
                c.id === firstId || c.id === secondId ? { ...c, flipped: false } : c,
              ),
            );
            setFlippedIds([]);
            setLocked(false);
          }, 800);
        }
      }
    },
    [cards, flippedIds, locked, matches, totalPairs],
  );

  const finalScore = Math.min(100, Math.round((totalPairs / Math.max(1, attempts)) * 100));
  const gridCols = getGridCols();

  return (
    <div className="page">
      <style>{`
        @keyframes cardFlip {
          0% { transform: rotateY(0deg); }
          100% { transform: rotateY(180deg); }
        }
        @keyframes matchPulse {
          0% { transform: scale(1); }
          50% { transform: scale(0.92); }
          100% { transform: scale(0.95); }
        }
      `}</style>

      <nav className="nav">
        <NavLogo />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ThemeToggle theme={theme} onToggle={() => setTheme((t) => (t === "light" ? "dark" : "light"))} />
          <Link href="/kid-dashboard/games" className="btn btn-outline" style={{ minHeight: 40, padding: "8px 14px", fontSize: "0.85rem" }}>
            ← Games
          </Link>
        </div>
      </nav>

      <div className="main fade fade-1" style={{ maxWidth: 540, padding: "40px 28px 80px" }}>
        <Link
          href="/kid-dashboard/games"
          className="btn btn-outline"
          style={{ minHeight: 40, padding: "8px 18px", fontSize: "0.88rem", marginBottom: 28, display: "inline-flex" }}
        >
          Back to Games
        </Link>

        {/* ---------- START ---------- */}
        {screen === "start" && (
          <div className="fade fade-2" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "3.5rem", marginBottom: 20 }}>{"\uD83E\uDDE9"}</div>
            <h1 className="page-title" style={{ fontFamily: "'Fredoka',sans-serif" }}>
              Memory <em>Match</em>
            </h1>
            <p className="subtitle">
              Flip the cards and find matching pairs. Remember where each picture is hiding!
            </p>
            <button onClick={startGame} className="btn btn-primary btn-full" style={{ maxWidth: 340 }}>
              Start Game
            </button>
          </div>
        )}

        {/* ---------- PLAY ---------- */}
        {screen === "play" && (
          <div className="fade fade-2" style={{ textAlign: "center" }}>
            <div style={{
              display: "flex", justifyContent: "space-between", marginBottom: 12,
              fontSize: "0.9rem", color: "var(--text-secondary)", fontWeight: 600,
            }}>
              <span>{matches} / {totalPairs} pairs</span>
              <span>Tries: {attempts}</span>
              <span>{Math.floor(elapsed / 1000)}s</span>
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
              gap: 10,
              maxWidth: 420,
              margin: "0 auto",
            }}>
              {cards.map((card) => (
                <button
                  key={card.id}
                  onClick={() => handleCardTap(card)}
                  aria-label={card.flipped || card.matched ? card.emoji : "Hidden card"}
                  style={{
                    width: "100%",
                    aspectRatio: "1 / 1",
                    minHeight: 80,
                    borderRadius: "var(--r-lg, 16px)",
                    border: `2px solid ${card.matched ? "var(--sage-300)" : "var(--border)"}`,
                    background: card.matched
                      ? "var(--sage-50, #f0f5ee)"
                      : card.flipped
                        ? "var(--card)"
                        : "var(--sage-200, #d4e0d2)",
                    cursor: card.matched ? "default" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: card.flipped || card.matched ? "2rem" : "1.4rem",
                    fontFamily: "'Fredoka',sans-serif",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    padding: 0,
                    transition: "all 300ms var(--ease, ease)",
                    transform: card.matched ? "scale(0.95)" : "scale(1)",
                    animation: card.matched ? "matchPulse 0.4s ease forwards" : "none",
                    opacity: card.matched ? 0.75 : 1,
                  }}
                >
                  {card.flipped || card.matched ? card.emoji : "?"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ---------- RESULT ---------- */}
        {screen === "result" && (
          <div className="fade fade-2" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "3.5rem", marginBottom: 20 }}>
              {finalScore >= 70 ? "\uD83C\uDFC6" : "\uD83C\uDF1F"}
            </div>
            <h1 className="page-title" style={{ fontFamily: "'Fredoka',sans-serif" }}>
              {finalScore >= 70 ? (<>Great <em>Memory!</em></>) : (<>Nice <em>Try!</em></>)}
            </h1>

            <div style={{
              display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap", marginBottom: 32,
            }}>
              <div className="card" style={{ padding: "20px 24px", textAlign: "center" }}>
                <div style={statStyle}>{finalScore}%</div>
                <div style={statLabel}>Score</div>
              </div>
              <div className="card" style={{ padding: "20px 24px", textAlign: "center" }}>
                <div style={statStyle}>{matches}/{totalPairs}</div>
                <div style={statLabel}>Pairs</div>
              </div>
              <div className="card" style={{ padding: "20px 24px", textAlign: "center" }}>
                <div style={statStyle}>{attempts}</div>
                <div style={statLabel}>Tries</div>
              </div>
              <div className="card" style={{ padding: "20px 24px", textAlign: "center" }}>
                <div style={statStyle}>{Math.floor(elapsed / 1000)}s</div>
                <div style={statLabel}>Time</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <button onClick={startGame} className="btn btn-primary" style={{ minWidth: 160 }}>
                Play Again
              </button>
              <Link href="/kid-dashboard/games" className="btn btn-outline" style={{ minWidth: 160 }}>
                All Games
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
