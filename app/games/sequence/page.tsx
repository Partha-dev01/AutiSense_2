"use client";

import Link from "next/link";
import { useState, useEffect, useCallback, useRef } from "react";
import { getDifficulty, saveDifficulty } from "../../lib/games/difficultyEngine";
import { addGameActivity } from "../../lib/db/gameActivity.repository";
import { updateStreak } from "../../lib/db/streak.repository";
import NavLogo from "../../components/NavLogo";
import ThemeToggle from "../../components/ThemeToggle";
import { useTheme } from "../../hooks/useTheme";

type Screen = "start" | "play" | "result";
type Phase = "showing" | "input" | "feedback";

const COLORS = [
  { name: "Red", bg: "#e57373", active: "#ef5350", freq: 262 },
  { name: "Blue", bg: "#64b5f6", active: "#42a5f5", freq: 330 },
  { name: "Green", bg: "#81c784", active: "#66bb6a", freq: 392 },
  { name: "Yellow", bg: "#ffd54f", active: "#ffca28", freq: 523 },
];

function playTone(frequency: number, duration: number = 300) {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration / 1000);
  } catch { /* audio not available */ }
}

export default function SequenceGamePage() {
  const { theme, toggle: toggleTheme } = useTheme();
  const [screen, setScreen] = useState<Screen>("start");
  const [sequence, setSequence] = useState<number[]>([]);
  const [playerInput, setPlayerInput] = useState<number[]>([]);
  const [phase, setPhase] = useState<Phase>("showing");
  const [activeColor, setActiveColor] = useState<number | null>(null);
  const [showingIndex, setShowingIndex] = useState(0);
  const [showingTotal, setShowingTotal] = useState(0);
  const [round, setRound] = useState(1);
  const [maxRounds, setMaxRounds] = useState(5);
  const [score, setScore] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const playSequence = useCallback(
    (seq: number[], speed: number) => {
      setPhase("showing");
      setShowingTotal(seq.length);
      let i = 0;
      const interval = 700 / speed;
      const gapMs = 300; // gap between items — all buttons dim briefly

      const showNext = () => {
        if (i < seq.length) {
          setShowingIndex(i + 1);
          setActiveColor(seq[i]);
          playTone(COLORS[seq[i]].freq, interval * 0.8);
          timeoutRef.current = setTimeout(() => {
            setActiveColor(null);
            i++;
            timeoutRef.current = setTimeout(showNext, gapMs);
          }, interval);
        } else {
          setShowingIndex(0);
          setShowingTotal(0);
          setPhase("input");
          setPlayerInput([]);
        }
      };

      timeoutRef.current = setTimeout(showNext, 500);
    },
    [],
  );

  const startGame = useCallback(() => {
    const config = getDifficulty("sequence", "default");
    setMaxRounds(config.itemCount);
    setRound(1);
    setScore(0);
    setStartTime(Date.now());
    setScreen("play");

    // Start with a sequence of 2
    const initial = [
      Math.floor(Math.random() * 4),
      Math.floor(Math.random() * 4),
    ];
    setSequence(initial);
    playSequence(initial, config.speed);
  }, [playSequence]);

  useEffect(() => {
    if (screen !== "play") return;
    const iv = setInterval(() => setElapsed(Date.now() - startTime), 500);
    return () => clearInterval(iv);
  }, [screen, startTime]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleColorPress = (colorIndex: number) => {
    if (phase !== "input") return;

    setActiveColor(colorIndex);
    playTone(COLORS[colorIndex].freq, 200);
    setTimeout(() => setActiveColor(null), 200);

    const newInput = [...playerInput, colorIndex];
    setPlayerInput(newInput);

    const pos = newInput.length - 1;

    if (newInput[pos] !== sequence[pos]) {
      // Wrong — show feedback with try-again option
      setPhase("feedback");
      return;
    }

    if (newInput.length === sequence.length) {
      // Correct round
      setScore((s) => s + 1);
      const nextRound = round + 1;

      if (nextRound > maxRounds) {
        // All rounds complete
        const finalScore = Math.round(((score + 1) / maxRounds) * 100);
        saveDifficulty("sequence", "default", finalScore);
        setTimeout(() => setScreen("result"), 500);
        return;
      }

      setRound(nextRound);
      const config = getDifficulty("sequence", "default");

      // Add one more to the sequence
      const extended = [...sequence, Math.floor(Math.random() * 4)];
      setSequence(extended);

      setTimeout(() => {
        playSequence(extended, config.speed);
      }, 800);
    }
  };

  // Retry same round (replay same sequence)
  const retryRound = useCallback(() => {
    setPlayerInput([]);
    playSequence(sequence, getDifficulty("sequence", "default").speed);
  }, [sequence, playSequence]);

  // End game from wrong-answer screen
  const endGame = useCallback(() => {
    const fs = Math.round((score / maxRounds) * 100);
    saveDifficulty("sequence", "default", fs);
    setScreen("result");
  }, [score, maxRounds]);

  // Save game activity on result
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (screen !== "result" || saved) return;
    setSaved(true);
    const childId =
      (typeof window !== "undefined" && localStorage.getItem("autisense-active-child-id")) || "default";
    const fs = Math.round((score / Math.max(1, maxRounds)) * 100);
    const config = getDifficulty("sequence", childId);
    addGameActivity(childId, "sequence", fs, Math.floor(elapsed / 1000), config.level);
    updateStreak(childId);
  }, [screen, saved, score, maxRounds, elapsed]);

  const finalScore = Math.round((score / Math.max(1, maxRounds)) * 100);

  return (
    <div className="page">
      <nav className="nav">
        <NavLogo />
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
      </nav>

      <div className="main fade fade-1" style={{ maxWidth: 500, padding: "40px 28px 80px" }}>
        <Link
          href="/kid-dashboard/games"
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
            <div style={{ fontSize: "3.5rem", marginBottom: 20 }}>🎵</div>
            <h1 className="page-title">
              Sequence <em>Memory</em>
            </h1>
            <p className="subtitle">
              Watch the color sequence, then repeat it from memory. The sequence gets longer each round!
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
              <span>Round {round}/{maxRounds}</span>
              <span>
                {phase === "showing"
                  ? `Watch! (${showingIndex} of ${showingTotal})`
                  : phase === "input"
                    ? "Your turn!"
                    : "Wrong!"}
              </span>
              <span>{Math.floor(elapsed / 1000)}s</span>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
                maxWidth: 320,
                margin: "0 auto",
              }}
            >
              {COLORS.map((color, i) => (
                <button
                  key={color.name}
                  onClick={() => handleColorPress(i)}
                  disabled={phase !== "input"}
                  style={{
                    width: "100%",
                    aspectRatio: "1",
                    borderRadius: "var(--r-lg)",
                    border: "3px solid transparent",
                    background: activeColor === i ? color.active : color.bg,
                    opacity: activeColor === i ? 1 : phase === "showing" ? 0.3 : 0.7,
                    transform: activeColor === i ? "scale(1.15)" : "scale(1)",
                    transition: "all 150ms var(--ease)",
                    cursor: phase === "input" ? "pointer" : "default",
                    boxShadow:
                      activeColor === i
                        ? `0 0 30px 8px ${color.active}60`
                        : "none",
                  }}
                  aria-label={color.name}
                />
              ))}
            </div>

            <div
              style={{
                marginTop: 24,
                fontSize: "0.85rem",
                color: "var(--text-muted)",
              }}
            >
              {phase === "input" &&
                `${playerInput.length} / ${sequence.length} entered`}
            </div>

            {/* Wrong answer — show correct sequence + retry/end */}
            {phase === "feedback" && (
              <div className="card fade fade-1" style={{
                marginTop: 16, padding: "20px 24px", textAlign: "center",
                background: "var(--peach-50)", borderColor: "var(--peach-300)",
              }}>
                <p style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text-primary)", marginBottom: 8 }}>
                  Oops! The correct sequence was:
                </p>
                <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 16 }}>
                  {sequence.map((c, i) => (
                    <div key={i} style={{
                      width: 36, height: 36, borderRadius: 8,
                      background: COLORS[c].bg, border: "2px solid var(--border)",
                    }} />
                  ))}
                </div>
                <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                  <button onClick={retryRound} className="btn btn-primary" style={{ minHeight: 44, padding: "8px 24px" }}>
                    Try Again
                  </button>
                  <button onClick={endGame} className="btn btn-outline" style={{ minHeight: 44, padding: "8px 24px" }}>
                    End Game
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {screen === "result" && (
          <div className="fade fade-2" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "3.5rem", marginBottom: 20 }}>
              {finalScore >= 60 ? "🌟" : "💪"}
            </div>
            <h1 className="page-title">
              {finalScore >= 60 ? (
                <>
                  Great <em>Memory!</em>
                </>
              ) : (
                <>
                  Keep <em>Practicing!</em>
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
                  {score}/{maxRounds}
                </div>
                <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", fontWeight: 600 }}>
                  Rounds
                </div>
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
