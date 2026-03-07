"use client";

import Link from "next/link";
import { useState, useEffect, useCallback, useRef } from "react";
import { getDifficulty, saveDifficulty } from "../../../lib/games/difficultyEngine";
import { addGameActivity } from "../../../lib/db/gameActivity.repository";
import { updateStreak } from "../../../lib/db/streak.repository";
import NavLogo from "../../../components/NavLogo";
import ThemeToggle from "../../../components/ThemeToggle";

type Screen = "start" | "play" | "result";

interface Bubble {
  id: number;
  label: string;
  x: number;
  y: number;
  size: number;
  color: string;
}

const POOL = [..."ABCDEFGHIJ", ..."0123456789"];
const GAME_DURATION = 30; // seconds
const NICE_WORDS = ["Nice!", "Great!", "Awesome!", "Super!", "Yes!"];

const BUBBLE_COLORS = [
  "var(--sage-200)", "var(--sage-300)", "var(--sky-200)", "var(--sky-300)",
  "var(--peach-100)", "var(--peach-200)", "#d1c4e9", "#c5e1a5", "#ffe0b2", "#b3e5fc",
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function spawnLayout(target: string, count: number, idStart: number): Bubble[] {
  const bubbles: Bubble[] = [];
  const targetIdx = Math.floor(Math.random() * count);
  const occupied: { x: number; y: number }[] = [];

  for (let i = 0; i < count; i++) {
    const isTarget = i === targetIdx;
    let label = isTarget ? target : pickRandom(POOL);
    while (!isTarget && label === target) label = pickRandom(POOL);

    const size = 58 + Math.floor(Math.random() * 18);
    let x = 0, y = 0;
    for (let attempt = 0; attempt < 30; attempt++) {
      x = 8 + Math.random() * 72;
      y = 8 + Math.random() * 72;
      const tooClose = occupied.some((o) => {
        const dx = x - o.x;
        const dy = y - o.y;
        return Math.sqrt(dx * dx + dy * dy) < 18;
      });
      if (!tooClose) break;
    }
    occupied.push({ x, y });

    bubbles.push({
      id: idStart + i,
      label, x, y, size,
      color: pickRandom(BUBBLE_COLORS),
    });
  }
  // Guarantee at least one target
  if (!bubbles.some((b) => b.label === target)) bubbles[0].label = target;
  return bubbles;
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
  const [misses, setMisses] = useState(0);
  const [rounds, setRounds] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [shakingId, setShakingId] = useState<number | null>(null);
  const [poppingId, setPoppingId] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const nextIdRef = useRef(0);
  const bubbleCountRef = useRef(4);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gameActiveRef = useRef(false);

  useEffect(() => {
    const s = (typeof window !== "undefined" && localStorage.getItem("autisense-theme")) || "light";
    setTheme(s as "light" | "dark");
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    if (typeof window !== "undefined") localStorage.setItem("autisense-theme", theme);
  }, [theme]);

  const startRound = useCallback(() => {
    const t = pickRandom(POOL);
    setTarget(t);
    const count = bubbleCountRef.current;
    const id = nextIdRef.current;
    setBubbles(spawnLayout(t, count, id));
    nextIdRef.current = id + count;
    setFeedback(null);
    setPoppingId(null);
    setShakingId(null);
  }, []);

  const startGame = useCallback(() => {
    const childId =
      (typeof window !== "undefined" && localStorage.getItem("autisense-active-child-id")) || "default";
    const config = getDifficulty("bubble-pop", childId);
    bubbleCountRef.current = Math.min(3 + config.level, 7);
    setScore(0);
    setMisses(0);
    setRounds(0);
    setTimeLeft(GAME_DURATION);
    setSaved(false);
    nextIdRef.current = 0;
    gameActiveRef.current = true;
    setScreen("play");
    // Start first round
    const t = pickRandom(POOL);
    setTarget(t);
    setBubbles(spawnLayout(t, bubbleCountRef.current, 0));
    nextIdRef.current = bubbleCountRef.current;
    setFeedback(null);
    setPoppingId(null);
    setShakingId(null);
  }, []);

  // Countdown timer
  useEffect(() => {
    if (screen !== "play") return;
    const iv = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          gameActiveRef.current = false;
          setScreen("result");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [screen]);

  // Save results
  useEffect(() => {
    if (screen !== "result" || saved) return;
    setSaved(true);
    const childId =
      (typeof window !== "undefined" && localStorage.getItem("autisense-active-child-id")) || "default";
    const total = score + misses;
    const accuracy = total > 0 ? Math.round((score / total) * 100) : 0;
    const config = getDifficulty("bubble-pop", childId);
    saveDifficulty("bubble-pop", childId, accuracy);
    addGameActivity(childId, "bubble-pop", accuracy, GAME_DURATION, config.level);
    updateStreak(childId);
  }, [screen, saved, score, misses]);

  const handleBubbleTap = useCallback((bubble: Bubble) => {
    if (!gameActiveRef.current || feedback || poppingId !== null) return;

    if (bubble.label === target) {
      // Correct! Show pop animation, then "Nice!", then new round
      setPoppingId(bubble.id);
      setScore((s) => s + 1);
      setRounds((r) => r + 1);

      // After pop animation (300ms), show feedback
      setTimeout(() => {
        setPoppingId(null);
        setFeedback(pickRandom(NICE_WORDS));
        // After feedback (600ms), spawn new round
        feedbackTimerRef.current = setTimeout(() => {
          if (gameActiveRef.current) startRound();
        }, 600);
      }, 300);
    } else {
      // Wrong — shake it
      setMisses((m) => m + 1);
      setShakingId(bubble.id);
      setTimeout(() => setShakingId(null), 500);
    }
  }, [target, feedback, poppingId, startRound]);

  const totalAttempts = score + misses;
  const accuracy = totalAttempts > 0 ? Math.round((score / totalAttempts) * 100) : 0;

  // Cleanup feedback timer on unmount
  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  return (
    <div className="page">
      <style>{`
        @keyframes bubbleIdle {
          0%, 100% { transform: translate(-50%,-50%) scale(1); }
          33% { transform: translate(-50%,-50%) translateY(-5px) scale(1.03); }
          66% { transform: translate(-50%,-50%) translateY(3px) scale(0.97); }
        }
        @keyframes bubbleAppear {
          0% { transform: translate(-50%,-50%) scale(0); opacity: 0; }
          60% { transform: translate(-50%,-50%) scale(1.12); opacity: 1; }
          100% { transform: translate(-50%,-50%) scale(1); opacity: 1; }
        }
        @keyframes popBurst {
          0% { transform: translate(-50%,-50%) scale(1); opacity: 1; }
          50% { transform: translate(-50%,-50%) scale(1.6); opacity: 0.3; }
          100% { transform: translate(-50%,-50%) scale(0); opacity: 0; }
        }
        @keyframes gentleShake {
          0%, 100% { transform: translate(-50%,-50%) translateX(0); }
          25% { transform: translate(-50%,-50%) translateX(-6px); }
          50% { transform: translate(-50%,-50%) translateX(6px); }
          75% { transform: translate(-50%,-50%) translateX(-4px); }
        }
        @keyframes feedbackPop {
          0% { transform: scale(0); opacity: 0; }
          50% { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes targetPulse {
          0%, 100% { box-shadow: 0 0 0 0 var(--sage-200); }
          50% { box-shadow: 0 0 0 8px transparent; }
        }
        @keyframes timerUrgent {
          0%, 100% { color: var(--peach-300); }
          50% { color: var(--text-secondary); }
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

        {screen === "start" && (
          <div className="fade fade-2" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "3.5rem", marginBottom: 20 }}>{"\uD83E\uDEE7"}</div>
            <h1 className="page-title">
              Bubble <em>Pop</em>
            </h1>
            <p className="subtitle">
              Pop the right bubble as fast as you can! You have 30 seconds — how many rounds can you clear?
            </p>
            <button onClick={startGame} className="btn btn-primary btn-full" style={{ maxWidth: 340 }}>
              Start Game
            </button>
          </div>
        )}

        {screen === "play" && (
          <div className="fade fade-2" style={{ textAlign: "center" }}>
            {/* Status bar */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12,
              fontSize: "0.9rem", color: "var(--text-secondary)", fontWeight: 600,
            }}>
              <span>Score: <strong style={{ color: "var(--sage-500)", fontSize: "1.1rem" }}>{score}</strong></span>
              <span>Round {rounds + 1}</span>
              <span style={{
                fontWeight: 700, fontSize: "1.1rem",
                color: timeLeft <= 5 ? "var(--peach-300)" : "var(--text-secondary)",
                animation: timeLeft <= 5 ? "timerUrgent 0.6s ease-in-out infinite" : "none",
              }}>
                {timeLeft}s
              </span>
            </div>

            {/* Timer bar */}
            <div style={{
              height: 6, background: "var(--sage-100)", borderRadius: 3, overflow: "hidden", marginBottom: 14,
            }}>
              <div style={{
                height: "100%", width: `${(timeLeft / GAME_DURATION) * 100}%`,
                background: timeLeft <= 5 ? "var(--peach-300)" : "var(--sage-500)",
                borderRadius: 3, transition: "width 1s linear, background 0.3s",
              }} />
            </div>

            {/* Target prompt */}
            <div style={{
              fontFamily: "'Fredoka',sans-serif", fontSize: "1.4rem", fontWeight: 600,
              color: "var(--text-primary)", marginBottom: 14, padding: "12px 20px",
              background: "var(--sage-50)", borderRadius: "var(--r-lg)", border: "3px solid var(--sage-300)",
              animation: "targetPulse 2s ease-in-out infinite",
            }}>
              Find <span style={{ color: "var(--sage-500)", fontSize: "2.6rem", fontWeight: 700, lineHeight: 1 }}>{target}</span>
            </div>

            {/* Play area */}
            <div style={{
              position: "relative", width: "100%", height: 400,
              borderRadius: "var(--r-lg)", border: "2px solid var(--border)",
              background: "var(--card)", overflow: "hidden",
            }}>
              {/* Feedback overlay */}
              {feedback && (
                <div style={{
                  position: "absolute", inset: 0, display: "flex",
                  alignItems: "center", justifyContent: "center",
                  zIndex: 10, pointerEvents: "none",
                }}>
                  <span style={{
                    fontFamily: "'Fredoka',sans-serif", fontSize: "2.8rem", fontWeight: 700,
                    color: "var(--sage-500)",
                    textShadow: "0 2px 12px rgba(0,0,0,0.15)",
                    animation: "feedbackPop 0.3s ease-out",
                  }}>
                    {feedback}
                  </span>
                </div>
              )}

              {/* Bubbles */}
              {!feedback && bubbles.map((bubble) => (
                <button
                  key={bubble.id}
                  onClick={() => handleBubbleTap(bubble)}
                  aria-label={`Bubble ${bubble.label}`}
                  style={{
                    position: "absolute",
                    left: `${bubble.x}%`, top: `${bubble.y}%`,
                    width: bubble.size, height: bubble.size, borderRadius: "50%",
                    border: "3px solid rgba(255,255,255,0.5)", background: bubble.color,
                    boxShadow: "0 4px 15px rgba(0,0,0,0.1), inset 0 -4px 8px rgba(0,0,0,0.06), inset 0 4px 8px rgba(255,255,255,0.4)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "'Fredoka',sans-serif", fontWeight: 700, fontSize: "1.4rem",
                    color: "var(--text-primary)", cursor: "pointer", padding: 0,
                    animation: poppingId === bubble.id
                      ? "popBurst 0.3s ease-out forwards"
                      : shakingId === bubble.id
                        ? "gentleShake 0.4s ease"
                        : `bubbleAppear 0.3s ease-out, bubbleIdle ${2.5 + (bubble.id % 3) * 0.4}s 0.3s ease-in-out infinite`,
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  {bubble.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {screen === "result" && (
          <div className="fade fade-2" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "3.5rem", marginBottom: 20 }}>
              {score >= 10 ? "\uD83C\uDFC6" : score >= 5 ? "\uD83C\uDF1F" : "\uD83D\uDCAA"}
            </div>
            <h1 className="page-title">
              {score >= 10 ? (<>Amazing <em>Popping!</em></>) : score >= 5 ? (<>Great <em>Job!</em></>) : (<>Nice <em>Try!</em></>)}
            </h1>
            <div style={{
              display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", marginBottom: 32,
            }}>
              <div className="card" style={{ padding: "18px 22px", textAlign: "center" }}>
                <div style={statStyle}>{score}</div>
                <div style={statLabel}>Popped</div>
              </div>
              <div className="card" style={{ padding: "18px 22px", textAlign: "center" }}>
                <div style={statStyle}>{accuracy}%</div>
                <div style={statLabel}>Accuracy</div>
              </div>
              <div className="card" style={{ padding: "18px 22px", textAlign: "center" }}>
                <div style={statStyle}>{rounds}</div>
                <div style={statLabel}>Rounds</div>
              </div>
              <div className="card" style={{ padding: "18px 22px", textAlign: "center" }}>
                <div style={{...statStyle, fontSize: "1.4rem"}}>{totalAttempts > 0 ? (GAME_DURATION / score).toFixed(1) : "--"}s</div>
                <div style={statLabel}>Avg Speed</div>
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
