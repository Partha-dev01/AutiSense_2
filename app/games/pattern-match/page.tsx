"use client";

import Link from "next/link";
import { useState, useEffect, useCallback, useRef } from "react";
import { getDifficulty, saveDifficulty } from "../../lib/games/difficultyEngine";
import NavLogo from "../../components/NavLogo";

type Screen = "start" | "play" | "result";

const PATTERNS = ["●", "■", "▲", "◆", "★", "⬟"];
const PATTERN_COLORS = [
  "var(--sage-400)",
  "var(--sky-300)",
  "var(--peach-300)",
  "#b39ddb",
  "#ff8a65",
  "#4fc3f7",
];

interface GridItem {
  pattern: string;
  color: string;
  isOdd: boolean;
}

export default function PatternMatchPage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [screen, setScreen] = useState<Screen>("start");
  const [grid, setGrid] = useState<GridItem[]>([]);
  const [gridSize, setGridSize] = useState(9);
  const [selected, setSelected] = useState<number | null>(null);
  const [round, setRound] = useState(0);
  const [maxRounds, setMaxRounds] = useState(5);
  const [correct, setCorrect] = useState(0);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [startTime, setStartTime] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [timer, setTimer] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const saved =
      (typeof window !== "undefined" && localStorage.getItem("autisense-theme")) || "light";
    setTheme(saved as "light" | "dark");
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    if (typeof window !== "undefined") localStorage.setItem("autisense-theme", theme);
  }, [theme]);

  const generateRound = useCallback(
    (level: number) => {
      const size = level <= 2 ? 4 : level <= 4 ? 6 : 9;
      setGridSize(size);

      const mainIdx = Math.floor(Math.random() * PATTERNS.length);
      const mainPattern = PATTERNS[mainIdx];
      const mainColor = PATTERN_COLORS[mainIdx];

      // Pick a different pattern for the odd one
      let oddIdx = mainIdx;
      while (oddIdx === mainIdx) {
        oddIdx = Math.floor(Math.random() * PATTERNS.length);
      }
      const oddPattern = PATTERNS[oddIdx];
      let oddColor = PATTERN_COLORS[oddIdx];

      // Progressive similarity: at higher levels, use same color, different shape
      if (level >= 3) {
        oddColor = mainColor; // same color, harder to distinguish
      }

      const oddPosition = Math.floor(Math.random() * size);

      const newGrid: GridItem[] = [];
      for (let i = 0; i < size; i++) {
        if (i === oddPosition) {
          newGrid.push({ pattern: oddPattern, color: oddColor, isOdd: true });
        } else {
          newGrid.push({ pattern: mainPattern, color: mainColor, isOdd: false });
        }
      }
      setGrid(newGrid);
      setSelected(null);
      setFeedback(null);

      // Timer logic for higher levels
      if (timerRef.current) clearInterval(timerRef.current);
      if (level >= 3) {
        const seconds = Math.max(3, 8 - level);
        setTimer(seconds);
        timerRef.current = setInterval(() => {
          setTimer(prev => {
            if (prev !== null && prev <= 1) {
              if (timerRef.current) clearInterval(timerRef.current);
              timerRef.current = null;
              return 0;
            }
            return prev !== null ? prev - 1 : null;
          });
        }, 1000);
      } else {
        setTimer(null);
      }
    },
    [],
  );

  const startGame = useCallback(() => {
    const config = getDifficulty("pattern-match", "default");
    setMaxRounds(config.itemCount);
    setRound(1);
    setCorrect(0);
    setStartTime(Date.now());
    setScreen("play");
    generateRound(config.level);
  }, [generateRound]);

  useEffect(() => {
    if (screen !== "play") return;
    const iv = setInterval(() => setElapsed(Date.now() - startTime), 500);
    return () => {
      clearInterval(iv);
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    };
  }, [screen, startTime]);

  useEffect(() => {
    if (timer === 0 && feedback === null) {
      // Time's up
      setFeedback("wrong");
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      setTimeout(() => {
        const nextRound = round + 1;
        if (nextRound > maxRounds) {
          const score = Math.round((correct / maxRounds) * 100);
          saveDifficulty("pattern-match", "default", score);
          setScreen("result");
        } else {
          setRound(nextRound);
          const config = getDifficulty("pattern-match", "default");
          generateRound(config.level);
        }
      }, 700);
    }
  }, [timer]);

  const handleSelect = (index: number) => {
    if (feedback !== null) return;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setTimer(null);
    setSelected(index);

    const isCorrect = grid[index].isOdd;
    setFeedback(isCorrect ? "correct" : "wrong");
    if (isCorrect) setCorrect((c) => c + 1);

    setTimeout(() => {
      const nextRound = round + 1;
      if (nextRound > maxRounds) {
        const score = Math.round(((correct + (isCorrect ? 1 : 0)) / maxRounds) * 100);
        saveDifficulty("pattern-match", "default", score);
        setScreen("result");
      } else {
        setRound(nextRound);
        const config = getDifficulty("pattern-match", "default");
        generateRound(config.level);
      }
    }, 700);
  };

  const finalScore =
    maxRounds > 0 ? Math.round((correct / maxRounds) * 100) : 0;

  const cols = gridSize <= 4 ? 2 : 3;

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

      <div className="main fade fade-1" style={{ maxWidth: 500, padding: "40px 28px 80px" }}>
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
            <div style={{ fontSize: "3.5rem", marginBottom: 20 }}>🔲</div>
            <h1 className="page-title">
              Pattern <em>Match</em>
            </h1>
            <p className="subtitle">
              Find the pattern that&apos;s different from the rest. Tap the odd one out!
            </p>
            <button onClick={startGame} className="btn btn-primary btn-full" style={{ maxWidth: 340 }}>
              Start Game
            </button>
          </div>
        )}

        {screen === "play" && (
          <div className="fade fade-2" style={{ textAlign: "center" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 24,
                fontSize: "0.9rem",
                color: "var(--text-secondary)",
                fontWeight: 600,
              }}
            >
              <span>
                Round {round}/{maxRounds}
              </span>
              <span>Correct: {correct}</span>
              <span>
                {timer !== null ? (
                  <span style={{ color: timer <= 2 ? "var(--peach-300)" : "var(--text-secondary)" }}>
                    ⏱ {timer}s
                  </span>
                ) : (
                  `${Math.floor(elapsed / 1000)}s`
                )}
              </span>
            </div>

            <p
              style={{
                fontSize: "0.95rem",
                color: "var(--text-secondary)",
                marginBottom: 20,
                fontWeight: 600,
              }}
            >
              Tap the odd one out
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${cols}, 1fr)`,
                gap: 12,
                maxWidth: 320,
                margin: "0 auto",
              }}
            >
              {grid.map((item, i) => (
                <button
                  key={i}
                  onClick={() => handleSelect(i)}
                  disabled={feedback !== null}
                  style={{
                    aspectRatio: "1",
                    borderRadius: "var(--r-lg)",
                    border: "3px solid",
                    borderColor:
                      selected === i
                        ? feedback === "correct"
                          ? "var(--sage-400)"
                          : "var(--peach-300)"
                        : "var(--border)",
                    background:
                      selected === i
                        ? feedback === "correct"
                          ? "var(--sage-50)"
                          : "var(--peach-100)"
                        : "var(--card)",
                    fontSize: "2rem",
                    color: item.color,
                    cursor: feedback !== null ? "default" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 200ms var(--ease)",
                  }}
                >
                  {item.pattern}
                </button>
              ))}
            </div>
          </div>
        )}

        {screen === "result" && (
          <div className="fade fade-2" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "3.5rem", marginBottom: 20 }}>
              {finalScore >= 60 ? "🎯" : "👀"}
            </div>
            <h1 className="page-title">
              {finalScore >= 60 ? (
                <>
                  Sharp <em>Eyes!</em>
                </>
              ) : (
                <>
                  Keep <em>Looking!</em>
                </>
              )}
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
                  {finalScore}%
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
                  {correct}/{maxRounds}
                </div>
                <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", fontWeight: 600 }}>
                  Correct
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
