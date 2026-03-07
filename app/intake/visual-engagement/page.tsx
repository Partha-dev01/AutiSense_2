"use client";
import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { addBiomarker } from "../../lib/db/biomarker.repository";
import { getCurrentSessionId } from "../../lib/session/currentSession";

const STEPS = [
  "Welcome", "Profile", "Device", "Communicate", "Visual", "Behavior",
  "Prepare", "Motor", "Audio", "Video", "Summary", "Report",
];
const STEP_IDX = 4;

interface Stimulus {
  emoji: string;
  x: number;
  y: number;
  type: "social" | "object";
  id: number;
}

export default function VisualEngagementPage() {
  const router = useRouter();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [started, setStarted] = useState(false);
  const [taskComplete, setTaskComplete] = useState(false);
  const [stimuli, setStimuli] = useState<Stimulus[]>([]);
  const [taps, setTaps] = useState<{ x: number; y: number; type: string; time: number }[]>([]);
  const [timeLeft, setTimeLeft] = useState(45);
  const [round, setRound] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nextId = useRef(0);

  useEffect(() => {
    const saved = document.documentElement.getAttribute("data-theme") as "light" | "dark" | null;
    if (saved) setTheme(saved);
  }, []);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
  };

  const generateStimuli = useCallback(() => {
    const social = ["😊", "👶", "👋", "🤗"];
    const objects = ["🔵", "⭐", "🔺", "🟢"];
    const items: Stimulus[] = [];
    // 2 social + 2 object stimuli per round
    for (let i = 0; i < 2; i++) {
      items.push({
        emoji: social[Math.floor(Math.random() * social.length)],
        x: 15 + Math.random() * 70,
        y: 15 + Math.random() * 60,
        type: "social",
        id: nextId.current++,
      });
      items.push({
        emoji: objects[Math.floor(Math.random() * objects.length)],
        x: 15 + Math.random() * 70,
        y: 15 + Math.random() * 60,
        type: "object",
        id: nextId.current++,
      });
    }
    setStimuli(items);
  }, []);

  const startTask = useCallback(() => {
    setStarted(true);
    setRound(1);
    generateStimuli();
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setTaskComplete(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }, [generateStimuli]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleTap = (stim: Stimulus) => {
    setTaps((prev) => [...prev, { x: stim.x, y: stim.y, type: stim.type, time: Date.now() }]);
    setStimuli((prev) => prev.filter((s) => s.id !== stim.id));
    // When all stimuli cleared, generate new round
    if (stimuli.length <= 1) {
      setTimeout(() => {
        setRound((r) => r + 1);
        generateStimuli();
      }, 600);
    }
  };

  const socialTaps = taps.filter((t) => t.type === "social").length;
  const objectTaps = taps.filter((t) => t.type === "object").length;

  return (
    <div className="page">
      <nav className="nav">
        <Link href="/" className="logo"><img src="/logo.svg" alt="" className="logo-icon" />Auti<em>Sense</em></Link>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={toggleTheme} className="btn btn-outline" style={{ minHeight: 40, padding: "8px 14px", fontSize: "0.88rem" }}>
            {theme === "light" ? "🌙" : "☀️"}
          </button>
          <span style={{ fontSize: "0.88rem", color: "var(--text-muted)", fontWeight: 600 }}>
            Step {STEP_IDX + 1} of 12
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

      <main className="main">
        <div className="fade fade-1" style={{ textAlign: "center", marginBottom: 28 }}>
          <div className="breathe-orb" style={{ margin: "0 auto" }}>
            <div className="breathe-inner">👀</div>
          </div>
        </div>

        <div className="chip fade fade-1">Step 5 — Visual Engagement</div>
        <h1 className="page-title fade fade-2">
          What catches <em>their eye?</em>
        </h1>
        <p className="subtitle fade fade-2">
          Faces and shapes will appear on screen. Let your child tap whichever ones
          they notice first. This helps us understand their visual preferences.
        </p>

        {!started ? (
          <div className="fade fade-3" style={{ textAlign: "center" }}>
            <button className="btn btn-primary" onClick={startTask} style={{ minHeight: 52, padding: "12px 36px" }}>
              👀 Start Visual Task
            </button>
          </div>
        ) : !taskComplete ? (
          <div className="fade fade-3">
            {/* Timer + score bar */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text-secondary)" }}>
                Round {round} &nbsp;·&nbsp; Taps: {taps.length}
              </span>
              <span style={{
                fontWeight: 700, fontSize: "0.9rem",
                color: timeLeft <= 10 ? "var(--peach-300)" : "var(--sage-500)",
              }}>
                {timeLeft}s left
              </span>
            </div>

            {/* Stimulus area */}
            <div ref={containerRef} style={{
              position: "relative", width: "100%", height: 320,
              background: "var(--card)", border: "2px solid var(--border)",
              borderRadius: "var(--r-lg)", overflow: "hidden",
            }}>
              {stimuli.map((stim) => (
                <button key={stim.id} onClick={() => handleTap(stim)} style={{
                  position: "absolute", left: `${stim.x}%`, top: `${stim.y}%`,
                  transform: "translate(-50%, -50%)",
                  fontSize: "2.2rem", background: "none", border: "none",
                  cursor: "pointer", padding: 8,
                  transition: "transform 200ms var(--ease)",
                  animation: "fadeUp 400ms var(--ease) both",
                }}>
                  {stim.emoji}
                </button>
              ))}
              {stimuli.length === 0 && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)", fontWeight: 600 }}>
                  Loading next round...
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="card fade fade-3" style={{ padding: "32px 28px", textAlign: "center", background: "var(--sage-50)", borderColor: "var(--sage-300)" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: 14 }}>✅</div>
            <h2 style={{ fontFamily: "'Fredoka',sans-serif", fontWeight: 600, fontSize: "1.3rem", marginBottom: 14 }}>
              Visual task complete!
            </h2>
            <div style={{ display: "flex", gap: 20, justifyContent: "center", marginBottom: 10 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--sage-600)" }}>{socialTaps}</div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Social taps</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--sky-300)" }}>{objectTaps}</div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Object taps</div>
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
                const total = socialTaps + objectTaps;
                const gazeScore = total > 0 ? Math.min(1, socialTaps / total) : 0.5;
                await addBiomarker(sid, "social_visual_engagement", {
                  gazeScore,
                  motorScore: 0.5,
                  vocalizationScore: 0.5,
                }).catch(() => {});
              }
              router.push("/intake/behavioral-observation");
            }}>
            Continue →
          </button>
        </div>
      </main>
    </div>
  );
}
