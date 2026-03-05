"use client";

import Link from "next/link";
import { useState, useEffect, useCallback, useRef } from "react";
import { getDifficulty, saveDifficulty } from "../../lib/games/difficultyEngine";
import NavLogo from "../../components/NavLogo";

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
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [screen, setScreen] = useState<Screen>("start");
  const [sequence, setSequence] = useState<number[]>([]);
  const [playerInput, setPlayerInput] = useState<number[]>([]);
  const [phase, setPhase] = useState<Phase>("showing");
  const [activeColor, setActiveColor] = useState<number | null>(null);
  const [round, setRound] = useState(1);
  const [maxRounds, setMaxRounds] = useState(5);
  const [score, setScore] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const saved =
      (typeof window !== "undefined" && localStorage.getItem("autisense-theme")) || "light";
    setTheme(saved as "light" | "dark");
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    if (typeof window !== "undefined") localStorage.setItem("autisense-theme", theme);
  }, [theme]);

  const playSequence = useCallback(
    (seq: number[], speed: number) => {
      setPhase("showing");
      let i = 0;
      const interval = 700 / speed;

      const showNext = () => {
        if (i < seq.length) {
          setActiveColor(seq[i]);
          playTone(COLORS[seq[i]].freq, interval * 0.8);
          timeoutRef.current = setTimeout(() => {
            setActiveColor(null);
            i++;
            timeoutRef.current = setTimeout(showNext, interval * 0.3);
          }, interval);
        } else {
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
      // Wrong
      setPhase("feedback");
      const finalScore = Math.round((score / maxRounds) * 100);
      saveDifficulty("sequence", "default", finalScore);
      setTimeout(() => setScreen("result"), 1000);
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

  const finalScore = Math.round((score / Math.max(1, maxRounds)) * 100);

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
                  ? "Watch..."
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
                    opacity: activeColor === i ? 1 : 0.7,
                    transform: activeColor === i ? "scale(1.05)" : "scale(1)",
                    transition: "all 150ms var(--ease)",
                    cursor: phase === "input" ? "pointer" : "default",
                    boxShadow:
                      activeColor === i
                        ? `0 0 20px ${color.active}40`
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
