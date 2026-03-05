"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { getDifficulty, saveDifficulty } from "../../../lib/games/difficultyEngine";
import { addGameActivity } from "../../../lib/db/gameActivity.repository";
import { updateStreak } from "../../../lib/db/streak.repository";
import NavLogo from "../../../components/NavLogo";

type Screen = "start" | "play" | "result";

interface Bubble {
  id: number;
  label: string;
  x: number;
  duration: number;
  delay: number;
  size: number;
  color: string;
  popped: boolean;
  shaking: boolean;
}

const POOL = [..."ABCDEFGHIJ", ..."0123456789"];

const BUBBLE_COLORS = [
  "var(--sage-200)", "var(--sage-300)", "var(--sky-200)", "var(--sky-300)",
  "var(--peach-100)", "var(--peach-200)", "#d1c4e9", "#c5e1a5", "#ffe0b2", "#b3e5fc",
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const statStyle = {
  fontSize: "1.8rem", fontFamily: "'Fredoka',sans-serif", fontWeight: 700 as const,
  color: "var(--sage-500)",
};
const statLabel = {
  fontSize: "0.82rem", color: "var(--text-secondary)", fontWeight: 600 as const,
};

export default function BubblePopPage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [screen, setScreen] = useState<Screen>("start");
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [target, setTarget] = useState("");
  const [score, setScore] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [totalPops, setTotalPops] = useState(0);
  const [poppedCount, setPoppedCount] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [nextId, setNextId] = useState(0);
  const [speedMult, setSpeedMult] = useState(1);
  const [maxBubbles, setMaxBubbles] = useState(4);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const s = (typeof window !== "undefined" && localStorage.getItem("autisense-theme")) || "light";
    setTheme(s as "light" | "dark");
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    if (typeof window !== "undefined") localStorage.setItem("autisense-theme", theme);
  }, [theme]);

  const pickNewTarget = useCallback(() => {
    const t = pickRandom(POOL);
    setTarget(t);
    return t;
  }, []);

  const spawnBubble = useCallback(
    (currentTarget: string, idStart: number, count: number): Bubble[] => {
      const result: Bubble[] = [];
      const targetIdx = Math.random() < 0.5 ? Math.floor(Math.random() * count) : -1;

      for (let i = 0; i < count; i++) {
        const isTarget = i === targetIdx;
        let label = isTarget ? currentTarget : pickRandom(POOL);
        while (!isTarget && label === currentTarget) label = pickRandom(POOL);

        result.push({
          id: idStart + i,
          label,
          x: 8 + Math.random() * 74,
          duration: (5 + Math.random() * 3) / (0.8 + speedMult * 0.2),
          delay: Math.random() * 1.5,
          size: 56 + Math.floor(Math.random() * 20),
          color: pickRandom(BUBBLE_COLORS),
          popped: false,
          shaking: false,
        });
      }
      return result;
    },
    [speedMult],
  );

  const startGame = useCallback(() => {
    const childId =
      (typeof window !== "undefined" && localStorage.getItem("autisense-active-child-id")) || "default";
    const config = getDifficulty("bubble-pop", childId);
    const neededPops = config.itemCount * 3;

    setSpeedMult(config.speed);
    setMaxBubbles(Math.min(2 + config.level, 6));
    setTotalPops(neededPops);
    setPoppedCount(0);
    setScore(0);
    setAttempts(0);
    setStartTime(Date.now());
    setElapsed(0);
    setSaved(false);

    const t = pickRandom(POOL);
    setTarget(t);

    const initialCount = Math.min(3 + config.level, 6);
    const initial = spawnBubble(t, 0, initialCount);
    if (!initial.some((b) => b.label === t)) initial[0].label = t;
    setBubbles(initial);
    setNextId(initialCount);
    setScreen("play");
  }, [spawnBubble]);

  // Elapsed timer
  useEffect(() => {
    if (screen !== "play") return;
    const iv = setInterval(() => setElapsed(Date.now() - startTime), 500);
    return () => clearInterval(iv);
  }, [screen, startTime]);

  // Spawn new bubbles periodically
  useEffect(() => {
    if (screen !== "play") return;
    const interval = Math.max(1200, 2800 - speedMult * 400);
    const iv = setInterval(() => {
      setBubbles((prev) => {
        const active = prev.filter((b) => !b.popped);
        if (active.length >= maxBubbles) return prev;
        const count = Math.min(2, maxBubbles - active.length);
        const spawned = spawnBubble(target, nextId, count);
        setNextId((n) => n + count);
        return [...prev, ...spawned];
      });
    }, interval);
    return () => clearInterval(iv);
  }, [screen, target, nextId, maxBubbles, speedMult, spawnBubble]);

  // Clean up old popped bubbles
  useEffect(() => {
    if (screen !== "play") return;
    const iv = setInterval(() => {
      setBubbles((prev) => prev.filter((b) => !b.popped || prev.indexOf(b) >= prev.length - 5));
    }, 4000);
    return () => clearInterval(iv);
  }, [screen]);

  // Save results on result screen
  useEffect(() => {
    if (screen !== "result" || saved) return;
    setSaved(true);
    const childId =
      (typeof window !== "undefined" && localStorage.getItem("autisense-active-child-id")) || "default";
    const fs = attempts > 0 ? Math.round((score / attempts) * 100) : 0;
    const config = getDifficulty("bubble-pop", childId);
    saveDifficulty("bubble-pop", childId, fs);
    addGameActivity(childId, "bubble-pop", fs, Math.floor(elapsed / 1000), config.level);
    updateStreak(childId);
  }, [screen, saved, score, attempts, elapsed]);

  const handleBubbleTap = (bubble: Bubble) => {
    if (bubble.popped) return;

    if (bubble.label === target) {
      setBubbles((prev) => prev.map((b) => (b.id === bubble.id ? { ...b, popped: true } : b)));
      const newPopped = poppedCount + 1;
      setPoppedCount(newPopped);
      setScore((s) => s + 1);
      setAttempts((a) => a + 1);

      if (newPopped >= totalPops) {
        setScreen("result");
      } else if (newPopped % 3 === 0) {
        pickNewTarget();
      }
    } else {
      setAttempts((a) => a + 1);
      setBubbles((prev) => prev.map((b) => (b.id === bubble.id ? { ...b, shaking: true } : b)));
      setTimeout(() => {
        setBubbles((prev) => prev.map((b) => (b.id === bubble.id ? { ...b, shaking: false } : b)));
      }, 500);
    }
  };

  const finalScore = attempts > 0 ? Math.round((score / attempts) * 100) : 0;

  return (
    <div className="page">
      <style>{`
        @keyframes floatUp {
          0% { transform: translateY(100%); opacity: 0.9; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(-120%); opacity: 0; }
        }
        @keyframes popAnim {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0.5; }
          100% { transform: scale(0); opacity: 0; }
        }
        @keyframes gentleShake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          50% { transform: translateX(4px); }
          75% { transform: translateX(-3px); }
        }
      `}</style>

      <nav className="nav">
        <NavLogo />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
            className="btn btn-outline"
            style={{ minHeight: 40, padding: "8px 16px", fontSize: "0.9rem" }}
            aria-label="Toggle theme"
          >
            {theme === "light" ? "Dark" : "Light"}
          </button>
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

        {screen === "start" && (
          <div className="fade fade-2" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "3.5rem", marginBottom: 20 }}>{"\uD83E\uDEE7"}</div>
            <h1 className="page-title">
              Bubble <em>Pop</em>
            </h1>
            <p className="subtitle">
              Pop the bubbles with the right letter or number. Be quick but stay calm!
            </p>
            <button onClick={startGame} className="btn btn-primary btn-full" style={{ maxWidth: 340 }}>
              Start Game
            </button>
          </div>
        )}

        {screen === "play" && (
          <div className="fade fade-2" style={{ textAlign: "center" }}>
            <div style={{
              display: "flex", justifyContent: "space-between", marginBottom: 12,
              fontSize: "0.9rem", color: "var(--text-secondary)", fontWeight: 600,
            }}>
              <span>{poppedCount} / {totalPops}</span>
              <span>Score: {score}</span>
              <span>{Math.floor(elapsed / 1000)}s</span>
            </div>

            <div style={{
              fontFamily: "'Fredoka',sans-serif", fontSize: "1.4rem", fontWeight: 600,
              color: "var(--text-primary)", marginBottom: 16, padding: "12px 20px",
              background: "var(--sage-50)", borderRadius: "var(--r-lg)", border: "2px solid var(--sage-200)",
            }}>
              Pop the <span style={{ color: "var(--sage-500)", fontSize: "1.6rem" }}>{target}</span>!
            </div>

            <div style={{
              position: "relative", width: "100%", height: 380,
              borderRadius: "var(--r-lg)", border: "2px solid var(--border)",
              background: "var(--card)", overflow: "hidden",
            }}>
              {bubbles.filter((b) => !b.popped).map((bubble) => (
                <button
                  key={bubble.id}
                  onClick={() => handleBubbleTap(bubble)}
                  aria-label={`Bubble ${bubble.label}`}
                  style={{
                    position: "absolute", left: `${bubble.x}%`, bottom: 0,
                    width: bubble.size, height: bubble.size, borderRadius: "50%",
                    border: "3px solid var(--border)", background: bubble.color,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "'Fredoka',sans-serif", fontWeight: 700, fontSize: "1.3rem",
                    color: "var(--text-primary)", cursor: "pointer", padding: 0,
                    animation: bubble.shaking
                      ? "gentleShake 0.5s ease"
                      : `floatUp ${bubble.duration}s ${bubble.delay}s linear forwards`,
                    transition: "border-color 200ms var(--ease)",
                  }}
                >
                  {bubble.label}
                </button>
              ))}
              {bubbles.filter((b) => b.popped).slice(-5).map((bubble) => (
                <div
                  key={`pop-${bubble.id}`}
                  style={{
                    position: "absolute", left: `${bubble.x}%`, bottom: 0,
                    width: bubble.size, height: bubble.size, borderRadius: "50%",
                    background: "var(--sage-300)", display: "flex",
                    alignItems: "center", justifyContent: "center",
                    fontFamily: "'Fredoka',sans-serif", fontWeight: 700, fontSize: "1.3rem",
                    color: "var(--text-primary)", animation: "popAnim 0.35s ease-out forwards",
                    pointerEvents: "none",
                  }}
                >
                  {bubble.label}
                </div>
              ))}
            </div>
          </div>
        )}

        {screen === "result" && (
          <div className="fade fade-2" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "3.5rem", marginBottom: 20 }}>
              {finalScore >= 70 ? "\uD83C\uDFC6" : "\uD83C\uDF1F"}
            </div>
            <h1 className="page-title">
              {finalScore >= 70 ? (<>Great <em>Popping!</em></>) : (<>Nice <em>Try!</em></>)}
            </h1>
            <div style={{
              display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap", marginBottom: 32,
            }}>
              <div className="card" style={{ padding: "20px 24px", textAlign: "center" }}>
                <div style={statStyle}>{finalScore}%</div>
                <div style={statLabel}>Accuracy</div>
              </div>
              <div className="card" style={{ padding: "20px 24px", textAlign: "center" }}>
                <div style={statStyle}>{score}/{totalPops}</div>
                <div style={statLabel}>Popped</div>
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
