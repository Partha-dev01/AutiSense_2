"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { getDifficulty, saveDifficulty } from "../../lib/games/difficultyEngine";
import NavLogo from "../../components/NavLogo";

function playMatchSound() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    osc1.type = "sine";
    osc2.type = "sine";
    osc1.frequency.setValueAtTime(523, ctx.currentTime);
    osc2.frequency.setValueAtTime(659, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);
    osc1.start();
    osc1.stop(ctx.currentTime + 0.15);
    osc2.start(ctx.currentTime + 0.15);
    osc2.stop(ctx.currentTime + 0.4);
  } catch { /* audio not available */ }
}

type Screen = "start" | "play" | "result";

interface EmotionCard {
  id: number;
  emoji: string;
  label: string;
  flipped: boolean;
  matched: boolean;
}

const EMOTION_PAIRS = [
  { emoji: "😊", label: "Happy" },
  { emoji: "😢", label: "Sad" },
  { emoji: "😠", label: "Angry" },
  { emoji: "😨", label: "Scared" },
  { emoji: "😲", label: "Surprised" },
  { emoji: "🤢", label: "Disgusted" },
  { emoji: "😌", label: "Calm" },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function EmotionMatchPage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [screen, setScreen] = useState<Screen>("start");
  const [cards, setCards] = useState<EmotionCard[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [matches, setMatches] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [pairCount, setPairCount] = useState(3);
  const [lastMatchedLabel, setLastMatchedLabel] = useState<string | null>(null);
  const [startTime, setStartTime] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const saved =
      (typeof window !== "undefined" && localStorage.getItem("autisense-theme")) || "light";
    setTheme(saved as "light" | "dark");
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    if (typeof window !== "undefined") localStorage.setItem("autisense-theme", theme);
  }, [theme]);

  const startGame = useCallback(() => {
    const config = getDifficulty("emotion-match", "default");
    const count = Math.min(config.itemCount, EMOTION_PAIRS.length);
    setPairCount(count);

    const chosen = shuffle(EMOTION_PAIRS).slice(0, count);
    // Create pairs: emoji cards + label cards
    const emojiCards: EmotionCard[] = chosen.map((e, i) => ({
      id: i * 2,
      emoji: e.emoji,
      label: e.label,
      flipped: false,
      matched: false,
    }));
    const labelCards: EmotionCard[] = chosen.map((e, i) => ({
      id: i * 2 + 1,
      emoji: e.emoji,
      label: e.label,
      flipped: false,
      matched: false,
    }));

    setCards(shuffle([...emojiCards, ...labelCards]));
    setSelected([]);
    setMatches(0);
    setAttempts(0);
    setStartTime(Date.now());
    setScreen("play");
  }, []);

  // Timer
  useEffect(() => {
    if (screen !== "play") return;
    const iv = setInterval(() => setElapsed(Date.now() - startTime), 500);
    return () => clearInterval(iv);
  }, [screen, startTime]);

  const handleCardClick = (index: number) => {
    if (selected.length >= 2) return;
    if (cards[index].matched || selected.includes(index)) return;

    const newSelected = [...selected, index];
    const newCards = cards.map((c, i) =>
      i === index ? { ...c, flipped: true } : c,
    );
    setCards(newCards);
    setSelected(newSelected);

    if (newSelected.length === 2) {
      setAttempts((a) => a + 1);
      const c1 = newCards[newSelected[0]];
      const c2 = newCards[newSelected[1]];

      if (c1.label === c2.label && c1.id !== c2.id) {
        // Match — play sound and trigger animation
        playMatchSound();
        setLastMatchedLabel(c1.label);
        setTimeout(() => {
          setCards((prev) =>
            prev.map((c) =>
              c.label === c1.label ? { ...c, matched: true, flipped: true } : c,
            ),
          );
          setSelected([]);
          setTimeout(() => setLastMatchedLabel(null), 500);
          setMatches((m) => {
            const newM = m + 1;
            if (newM === pairCount) {
              const score = Math.round(
                (pairCount / Math.max(1, attempts + 1)) * 100,
              );
              saveDifficulty("emotion-match", "default", Math.min(score, 100));
              setScreen("result");
            }
            return newM;
          });
        }, 500);
      } else {
        // No match — flip back
        setTimeout(() => {
          setCards((prev) =>
            prev.map((c, i) =>
              newSelected.includes(i) && !c.matched
                ? { ...c, flipped: false }
                : c,
            ),
          );
          setSelected([]);
        }, 800);
      }
    }
  };

  const score = Math.round((pairCount / Math.max(1, attempts)) * 100);

  return (
    <div className="page">
      <nav className="nav">
        <NavLogo />
        <button
          onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
          className="btn btn-outline"
          style={{ minHeight: 40, padding: "8px 16px", fontSize: "0.9rem" }}
          aria-label="Toggle theme"
        >
          {theme === "light" ? "Dark" : "Light"}
        </button>
      </nav>

      <div className="main fade fade-1" style={{ maxWidth: 700, padding: "40px 28px 80px" }}>
        <Link
          href="/games"
          className="btn btn-outline"
          style={{
            minHeight: 40,
            padding: "8px 18px",
            fontSize: "0.88rem",
            marginBottom: 28,
            display: "inline-flex",
          }}
        >
          Back to Games
        </Link>

        {screen === "start" && (
          <div className="fade fade-2" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "3.5rem", marginBottom: 20 }}>😊</div>
            <h1 className="page-title">
              Emotion <em>Match</em>
            </h1>
            <p className="subtitle">
              Flip cards to find matching emoji-emotion pairs. Match all pairs to win!
            </p>
            <button onClick={startGame} className="btn btn-primary btn-full" style={{ maxWidth: 340 }}>
              Start Game
            </button>
          </div>
        )}

        {screen === "play" && (
          <div className="fade fade-2">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 20,
                fontSize: "0.9rem",
                color: "var(--text-secondary)",
                fontWeight: 600,
              }}
            >
              <span>
                Matches: {matches}/{pairCount}
              </span>
              <span>Attempts: {attempts}</span>
              <span>{Math.floor(elapsed / 1000)}s</span>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(auto-fill, minmax(100px, 1fr))`,
                gap: 12,
              }}
            >
              {cards.map((card, index) => {
                const justMatched = lastMatchedLabel === card.label;
                return (
                <button
                  key={card.id}
                  onClick={() => handleCardClick(index)}
                  className={`card${justMatched ? " match-pop" : ""}`}
                  style={{
                    padding: "20px 12px",
                    minHeight: 90,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: card.matched ? "default" : "pointer",
                    opacity: card.matched && !justMatched ? 0.5 : 1,
                    background: card.flipped || card.matched
                      ? "var(--sage-50)"
                      : "var(--card)",
                    borderColor: justMatched
                      ? "var(--sage-500)"
                      : card.matched
                        ? "var(--sage-400)"
                        : card.flipped
                          ? "var(--sage-300)"
                          : "var(--border)",
                    fontSize: card.flipped || card.matched ? "1.3rem" : "1.5rem",
                    fontFamily: "'Fredoka',sans-serif",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    border: "2.5px solid",
                    borderRadius: "var(--r-lg)",
                    transition: "all 300ms var(--ease)",
                    boxShadow: justMatched ? "0 0 20px var(--sage-300)" : undefined,
                  }}
                >
                  {card.flipped || card.matched
                    ? index % 2 === 0
                      ? card.emoji
                      : card.label
                    : "?"}
                </button>
                );
              })}
            </div>
          </div>
        )}

        {screen === "result" && (
          <div className="fade fade-2" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "3.5rem", marginBottom: 20 }}>🎉</div>
            <h1 className="page-title">
              Great <em>Job!</em>
            </h1>
            <div
              style={{
                display: "flex",
                gap: 16,
                justifyContent: "center",
                flexWrap: "wrap",
                marginBottom: 32,
              }}
            >
              <div className="card" style={{ padding: "20px 24px", textAlign: "center" }}>
                <div
                  style={{
                    fontSize: "1.8rem",
                    fontFamily: "'Fredoka',sans-serif",
                    fontWeight: 700,
                    color: "var(--sage-500)",
                  }}
                >
                  {Math.min(score, 100)}%
                </div>
                <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", fontWeight: 600 }}>
                  Score
                </div>
              </div>
              <div className="card" style={{ padding: "20px 24px", textAlign: "center" }}>
                <div
                  style={{
                    fontSize: "1.8rem",
                    fontFamily: "'Fredoka',sans-serif",
                    fontWeight: 700,
                    color: "var(--sage-500)",
                  }}
                >
                  {attempts}
                </div>
                <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", fontWeight: 600 }}>
                  Attempts
                </div>
              </div>
              <div className="card" style={{ padding: "20px 24px", textAlign: "center" }}>
                <div
                  style={{
                    fontSize: "1.8rem",
                    fontFamily: "'Fredoka',sans-serif",
                    fontWeight: 700,
                    color: "var(--sage-500)",
                  }}
                >
                  {Math.floor(elapsed / 1000)}s
                </div>
                <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", fontWeight: 600 }}>
                  Time
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <button onClick={startGame} className="btn btn-primary" style={{ minWidth: 160 }}>
                Play Again
              </button>
              <Link href="/games" className="btn btn-outline" style={{ minWidth: 160 }}>
                All Games
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
