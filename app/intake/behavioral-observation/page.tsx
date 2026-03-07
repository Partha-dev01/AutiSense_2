"use client";
import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { addBiomarker } from "../../lib/db/biomarker.repository";
import { getCurrentSessionId } from "../../lib/session/currentSession";
import SkipStageDialog from "../../components/SkipStageDialog";

const STEPS = [
  "Welcome", "Profile", "Device", "Communicate", "Behavior",
  "Prepare", "Motor", "Video", "Summary", "Report",
];
const STEP_IDX = 4;

interface Bubble {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  speed: number;
}

const COLORS = [
  "var(--sage-400)", "var(--sky-300)", "var(--peach-300)",
  "var(--sage-500)", "#9b8ec4", "var(--sage-300)",
];

export default function BehavioralObservationPage() {
  const router = useRouter();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [started, setStarted] = useState(false);
  const [taskComplete, setTaskComplete] = useState(false);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [popTimes, setPopTimes] = useState<number[]>([]);
  const nextIdRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const spawnRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPopRef = useRef(Date.now());

  useEffect(() => {
    const saved = document.documentElement.getAttribute("data-theme") as "light" | "dark" | null;
    if (saved) setTheme(saved);
  }, []);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
  };

  const spawnBubble = useCallback(() => {
    const bubble: Bubble = {
      id: nextIdRef.current++,
      x: 10 + Math.random() * 80,
      y: 10 + Math.random() * 70,
      size: 40 + Math.random() * 30,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      speed: 2 + Math.random() * 3,
    };
    setBubbles((prev) => [...prev.slice(-12), bubble]); // max 13 bubbles
  }, []);

  const startTask = useCallback(() => {
    setStarted(true);
    lastPopRef.current = Date.now();
    // Spawn initial bubbles
    for (let i = 0; i < 5; i++) spawnBubble();

    // Spawn new bubble every 1.5s
    spawnRef.current = setInterval(spawnBubble, 1500);

    // Countdown timer
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          if (spawnRef.current) clearInterval(spawnRef.current);
          setTaskComplete(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }, [spawnBubble]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (spawnRef.current) clearInterval(spawnRef.current);
    };
  }, []);

  const popBubble = (id: number) => {
    const now = Date.now();
    const timeSinceLastPop = now - lastPopRef.current;
    setPopTimes((prev) => [...prev, timeSinceLastPop]);
    lastPopRef.current = now;
    setScore((s) => s + 1);
    setBubbles((prev) => prev.filter((b) => b.id !== id));
  };

  const handleSkipStage = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (spawnRef.current) clearInterval(spawnRef.current);
    const sid = getCurrentSessionId();
    if (sid) {
      await addBiomarker(sid, "behavioral_observation", {
        gazeScore: 0.5,
        motorScore: 0.5,
        vocalizationScore: 0.5,
      }).catch(() => {});
    }
    router.push("/intake/preparation");
  }, [router]);

  const avgPopTime = popTimes.length > 1
    ? Math.round(popTimes.slice(1).reduce((a, b) => a + b, 0) / (popTimes.length - 1))
    : 0;

  return (
    <div className="page">
      <nav className="nav">
        <Link href="/" className="logo"><img src="/logo.jpeg" alt="" className="logo-icon" />Auti<em>Sense</em></Link>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={toggleTheme} className="btn btn-outline" style={{ minHeight: 40, padding: "8px 14px", fontSize: "0.88rem" }}>
            {theme === "light" ? "🌙" : "☀️"}
          </button>
          <span style={{ fontSize: "0.88rem", color: "var(--text-muted)", fontWeight: 600 }}>
            Step {STEP_IDX + 1} of 10
          </span>
        </div>
      </nav>

      <div className="progress-wrap">
        <div className="progress-steps">
          {STEPS.map((s, i) => (
            <div key={s} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : "none" }}>
              <div className={`step-dot ${i < STEP_IDX ? "done" : i === STEP_IDX ? "active" : "upcoming"}`} title={s}>
                {i < STEP_IDX ? "✓" : i + 1}
              </div>
              {i < STEPS.length - 1 && <div className={`step-line ${i < STEP_IDX ? "done" : ""}`} />}
            </div>
          ))}
        </div>
      </div>

      <main className="main" style={{ position: "relative" }}>
        <SkipStageDialog onConfirm={handleSkipStage} />
        <div className="fade fade-1" style={{ textAlign: "center", marginBottom: 28 }}>
          <div className="breathe-orb" style={{ margin: "0 auto" }}>
            <div className="breathe-inner">🫧</div>
          </div>
        </div>

        <div className="chip fade fade-1">Step 5 — Free Play</div>
        <h1 className="page-title fade fade-2">
          Pop the <em>bubbles!</em>
        </h1>
        <p className="subtitle fade fade-2">
          Colorful bubbles will appear. Let your child pop as many as they can!
          This free-play activity helps us observe their interaction patterns.
        </p>

        {!started ? (
          <div className="fade fade-3" style={{ textAlign: "center" }}>
            <button className="btn btn-primary" onClick={startTask} style={{ minHeight: 52, padding: "12px 36px" }}>
              🫧 Start Bubble Pop!
            </button>
          </div>
        ) : !taskComplete ? (
          <div className="fade fade-3">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--sage-600)" }}>
                🫧 Score: {score}
              </span>
              <span style={{
                fontWeight: 700, fontSize: "0.9rem",
                color: timeLeft <= 10 ? "var(--peach-300)" : "var(--text-secondary)",
              }}>
                {timeLeft}s left
              </span>
            </div>

            {/* Bubble area */}
            <div style={{
              position: "relative", width: "100%", height: 340,
              background: "var(--card)", border: "2px solid var(--border)",
              borderRadius: "var(--r-lg)", overflow: "hidden",
              touchAction: "manipulation",
            }}>
              {bubbles.map((b) => (
                <button key={b.id} onClick={() => popBubble(b.id)} style={{
                  position: "absolute",
                  left: `${b.x}%`, top: `${b.y}%`,
                  transform: "translate(-50%, -50%)",
                  width: b.size, height: b.size,
                  borderRadius: "50%",
                  background: b.color,
                  border: "none", cursor: "pointer",
                  opacity: 0.85,
                  boxShadow: `0 4px 12px ${b.color}40`,
                  transition: "transform 150ms var(--ease), opacity 150ms",
                  animation: "fadeUp 350ms var(--ease) both",
                }} />
              ))}
            </div>
          </div>
        ) : (
          <div className="card fade fade-3" style={{ padding: "32px 28px", textAlign: "center", background: "var(--sage-50)", borderColor: "var(--sage-300)" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: 14 }}>🎉</div>
            <h2 style={{ fontFamily: "'Fredoka',sans-serif", fontWeight: 600, fontSize: "1.3rem", marginBottom: 14 }}>
              Great job! {score} bubbles popped!
            </h2>
            <div style={{ display: "flex", gap: 20, justifyContent: "center" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--sage-600)" }}>{score}</div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Total pops</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--sky-300)" }}>{avgPopTime}ms</div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Avg time</div>
              </div>
            </div>
          </div>
        )}

        <div className="fade fade-4" style={{ display: "flex", gap: 12, marginTop: 28 }}>
          <Link href="/intake/communication" className="btn btn-outline" style={{ minWidth: 100 }}>
            ← Back
          </Link>
          <button className="btn btn-primary btn-full" disabled={!taskComplete}
            onClick={async () => {
              const sid = getCurrentSessionId();
              if (sid) {
                await addBiomarker(sid, "behavioral_observation", {
                  gazeScore: 0.5,
                  motorScore: Math.min(1, score / 30),
                  vocalizationScore: 0.5,
                  responseLatencyMs: avgPopTime || null,
                }).catch(() => {});
              }
              router.push("/intake/preparation");
            }}>
            Continue →
          </button>
        </div>
      </main>
    </div>
  );
}
