"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { getDifficulty, saveDifficulty } from "../../lib/games/difficultyEngine";
import NavLogo from "../../components/NavLogo";

type Screen = "start" | "play" | "result";

interface ColorItem {
  name: string;
  hex: string;
  frequency: number; // for tone generation
}

const COLORS: ColorItem[] = [
  { name: "Red", hex: "#e57373", frequency: 262 },
  { name: "Blue", hex: "#64b5f6", frequency: 330 },
  { name: "Green", hex: "#81c784", frequency: 392 },
  { name: "Yellow", hex: "#ffd54f", frequency: 523 },
  { name: "Purple", hex: "#b39ddb", frequency: 440 },
  { name: "Orange", hex: "#ff8a65", frequency: 349 },
];

function playTone(frequency: number, duration: number = 400, onPlayingChange?: (playing: boolean) => void) {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration / 1000);
    if (onPlayingChange) {
      onPlayingChange(true);
      setTimeout(() => onPlayingChange(false), duration);
    }
  } catch {
    // Audio not available
  }
}

export default function ColorSoundPage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [screen, setScreen] = useState<Screen>("start");
  const [targetColor, setTargetColor] = useState<ColorItem | null>(null);
  const [displayColors, setDisplayColors] = useState<ColorItem[]>([]);
  const [round, setRound] = useState(0);
  const [maxRounds, setMaxRounds] = useState(5);
  const [correct, setCorrect] = useState(0);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [startTime, setStartTime] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [hintText, setHintText] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);

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
      const numOptions = Math.min(2 + level, COLORS.length);
      // Shuffle and pick options
      const shuffled = [...COLORS].sort(() => Math.random() - 0.5);
      const options = shuffled.slice(0, numOptions);
      const target = options[Math.floor(Math.random() * options.length)];

      setDisplayColors(options);
      setTargetColor(target);
      setSelectedIndex(null);
      setFeedback(null);
      setHintText(`Tap the ${target.name} color`);

      // Play the tone after a short delay
      setTimeout(() => {
        playTone(target.frequency, 500, setIsPlaying);
      }, 400);
    },
    [],
  );

  const startGame = useCallback(() => {
    const config = getDifficulty("color-sound", "default");
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
    return () => clearInterval(iv);
  }, [screen, startTime]);

  const handleSelect = (index: number) => {
    if (feedback !== null || !targetColor) return;

    setSelectedIndex(index);
    const isCorrect = displayColors[index].name === targetColor.name;
    setFeedback(isCorrect ? "correct" : "wrong");
    if (isCorrect) setCorrect((c) => c + 1);

    // Play the selected color's tone
    playTone(displayColors[index].frequency, 300, setIsPlaying);

    setTimeout(() => {
      const nextRound = round + 1;
      if (nextRound > maxRounds) {
        const score = Math.round(((correct + (isCorrect ? 1 : 0)) / maxRounds) * 100);
        saveDifficulty("color-sound", "default", score);
        setScreen("result");
      } else {
        setRound(nextRound);
        const config = getDifficulty("color-sound", "default");
        generateRound(config.level);
      }
    }, 800);
  };

  const replaySound = () => {
    if (targetColor) {
      playTone(targetColor.frequency, 500, setIsPlaying);
    }
  };

  const finalScore =
    maxRounds > 0 ? Math.round((correct / maxRounds) * 100) : 0;

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
            <div style={{ fontSize: "3.5rem", marginBottom: 20 }}>🎨</div>
            <h1 className="page-title">
              Color & <em>Sound</em>
            </h1>
            <p className="subtitle">
              Listen to the sound cue and tap the matching color. Each color has its own unique tone!
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
              <span>{Math.floor(elapsed / 1000)}s</span>
            </div>

            <p
              style={{
                fontFamily: "'Fredoka',sans-serif",
                fontSize: "1.1rem",
                fontWeight: 600,
                color: "var(--text-primary)",
                marginBottom: 8,
              }}
            >
              {hintText}
            </p>

            <button
              onClick={replaySound}
              className="btn btn-secondary"
              style={{
                minHeight: 44,
                padding: "10px 20px",
                fontSize: "0.9rem",
                marginBottom: 24,
              }}
            >
              Replay Sound
            </button>

            {/* Waveform visualization */}
            <div
              style={{
                display: "flex",
                gap: 4,
                justifyContent: "center",
                alignItems: "flex-end",
                height: 40,
                marginBottom: 20,
              }}
            >
              {[0, 1, 2, 3, 4].map((i) => {
                const heights = [20, 32, 36, 28, 16];
                return (
                  <div
                    key={i}
                    style={{
                      width: 6,
                      borderRadius: 3,
                      background: isPlaying ? "var(--sage-500)" : "var(--sage-200)",
                      height: isPlaying ? heights[i] : 8,
                      animation: isPlaying
                        ? `waveform 0.5s ease-in-out ${i * 0.08}s infinite alternate`
                        : "none",
                      transition: "background 200ms ease, height 200ms ease",
                    }}
                  />
                );
              })}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${Math.min(displayColors.length, 3)}, 1fr)`,
                gap: 14,
                maxWidth: 360,
                margin: "0 auto",
              }}
            >
              {displayColors.map((color, i) => (
                <button
                  key={color.name}
                  onClick={() => handleSelect(i)}
                  disabled={feedback !== null}
                  style={{
                    aspectRatio: "1",
                    borderRadius: "var(--r-lg)",
                    border: "4px solid",
                    borderColor:
                      selectedIndex === i
                        ? feedback === "correct"
                          ? "var(--sage-500)"
                          : "var(--peach-300)"
                        : "transparent",
                    background: color.hex,
                    cursor: feedback !== null ? "default" : "pointer",
                    transition: "all 200ms var(--ease)",
                    transform: selectedIndex === i ? "scale(0.95)" : "scale(1)",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                    minHeight: 80,
                  }}
                  aria-label={color.name}
                />
              ))}
            </div>

            {feedback && (
              <div
                style={{
                  marginTop: 20,
                  fontSize: "1rem",
                  fontWeight: 700,
                  color: feedback === "correct" ? "var(--sage-500)" : "var(--peach-300)",
                }}
              >
                {feedback === "correct" ? "Correct!" : `That was ${displayColors[selectedIndex!]?.name}. The answer was ${targetColor?.name}.`}
              </div>
            )}
          </div>
        )}

        {screen === "result" && (
          <div className="fade fade-2" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "3.5rem", marginBottom: 20 }}>
              {finalScore >= 60 ? "🎶" : "👂"}
            </div>
            <h1 className="page-title">
              {finalScore >= 60 ? (
                <>
                  Great <em>Ears!</em>
                </>
              ) : (
                <>
                  Keep <em>Listening!</em>
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
