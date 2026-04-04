"use client";
import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { addBiomarker } from "../../lib/db/biomarker.repository";
import { getCurrentSessionId } from "../../lib/session/currentSession";
import SkipStageDialog from "../../components/SkipStageDialog";
import { useTheme } from "../../hooks/useTheme";

const STEPS = [
  "Welcome", "Profile", "Device", "Communicate", "Behavior",
  "Prepare", "Motor", "Video", "Summary", "Report",
];
const STEP_IDX = 6;

interface Target {
  id: number;
  x: number;
  y: number;
  size: number;
  spawnTime: number;
}

export default function MotorAssessmentPage() {
  const { theme, toggle: toggleTheme } = useTheme();
  const router = useRouter();
  const [started, setStarted] = useState(false);
  const [taskComplete, setTaskComplete] = useState(false);
  const [target, setTarget] = useState<Target | null>(null);
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [reactionTimes, setReactionTimes] = useState<number[]>([]);
  const [timeLeft, setTimeLeft] = useState(30);
  const [round, setRound] = useState(0);
  const nextIdRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const spawnTarget = useCallback(() => {
    // Targets get smaller over rounds for progressive difficulty
    const baseSize = Math.max(44, 70 - round * 2);
    setTarget({
      id: nextIdRef.current++,
      x: 10 + Math.random() * 80,
      y: 10 + Math.random() * 75,
      size: baseSize,
      spawnTime: Date.now(),
    });
  }, [round]);

  const startTask = useCallback(() => {
    setStarted(true);
    spawnTarget();
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
  }, [spawnTarget]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const hitTarget = () => {
    if (!target) return;
    const reaction = Date.now() - target.spawnTime;
    setReactionTimes((prev) => [...prev, reaction]);
    setHits((h) => h + 1);
    setRound((r) => r + 1);
    setTarget(null);
    // Brief pause then spawn next
    setTimeout(spawnTarget, 400);
  };

  const missTarget = () => {
    setMisses((m) => m + 1);
  };

  const handleSkipStage = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    const sid = getCurrentSessionId();
    if (sid) {
      await addBiomarker(sid, "motor_assessment", {
        gazeScore: 0.5,
        motorScore: 0.5,
        vocalizationScore: 0.5,
      }).catch(() => {});
    }
    router.push("/intake/video-capture");
  }, [router]);

  const avgReaction = reactionTimes.length > 0
    ? Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length)
    : 0;
  const accuracy = hits + misses > 0 ? Math.round((hits / (hits + misses)) * 100) : 0;

  return (
    <div className="page">
      <nav className="nav">
        <Link href="/" className="logo"><img src="/logo.jpeg" alt="" className="logo-icon" /><span>Auti<em>Sense</em></span></Link>
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
            <div className="breathe-inner">🎯</div>
          </div>
        </div>

        <div className="chip fade fade-1">Step 7 — Motor Skills</div>
        <h1 className="page-title fade fade-2">
          Tap the <em>targets!</em>
        </h1>
        <p className="subtitle fade fade-2">
          Green circles will appear one at a time. Let your child tap them as
          quickly and accurately as possible. This tests fine motor coordination.
        </p>

        {!started ? (
          <div className="fade fade-3" style={{ textAlign: "center" }}>
            <button className="btn btn-primary" onClick={startTask} style={{ minHeight: 52, padding: "12px 36px" }}>
              🎯 Start Motor Test
            </button>
          </div>
        ) : !taskComplete ? (
          <div className="fade fade-3">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--sage-600)" }}>
                Hits: {hits} &nbsp;·&nbsp; Misses: {misses}
              </span>
              <span style={{
                fontWeight: 700, fontSize: "0.9rem",
                color: timeLeft <= 10 ? "var(--peach-300)" : "var(--text-secondary)",
              }}>
                {timeLeft}s left
              </span>
            </div>

            {/* Target area */}
            <div
              onClick={missTarget}
              style={{
                position: "relative", width: "100%", height: 340,
                background: "var(--card)", border: "2px solid var(--border)",
                borderRadius: "var(--r-lg)", overflow: "hidden",
                cursor: "crosshair", touchAction: "manipulation",
              }}
            >
              {target && (
                <button
                  onClick={(e) => { e.stopPropagation(); hitTarget(); }}
                  style={{
                    position: "absolute",
                    left: `${target.x}%`, top: `${target.y}%`,
                    transform: "translate(-50%, -50%)",
                    width: target.size, height: target.size,
                    borderRadius: "50%",
                    background: "var(--sage-500)",
                    border: "3px solid var(--sage-300)",
                    cursor: "pointer",
                    boxShadow: "0 4px 16px rgba(77, 128, 88, 0.35)",
                    animation: "fadeUp 250ms var(--ease) both",
                  }}
                />
              )}
            </div>
          </div>
        ) : (
          <div className="card fade fade-3" style={{ padding: "32px 28px", textAlign: "center", background: "var(--sage-50)", borderColor: "var(--sage-300)" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: 14 }}>🎯</div>
            <h2 style={{ fontFamily: "'Fredoka',sans-serif", fontWeight: 600, fontSize: "1.3rem", marginBottom: 14 }}>
              Motor assessment complete!
            </h2>
            <div style={{ display: "flex", gap: 20, justifyContent: "center" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--sage-600)" }}>{hits}</div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Targets hit</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--sky-300)" }}>{avgReaction}ms</div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Avg reaction</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--peach-300)" }}>{accuracy}%</div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Accuracy</div>
              </div>
            </div>
          </div>
        )}

        <div className="fade fade-4" style={{ display: "flex", gap: 12, marginTop: 28 }}>
          <Link href="/intake/preparation" className="btn btn-outline" style={{ minWidth: 100 }}>
            ← Back
          </Link>
          <button className="btn btn-primary btn-full" disabled={!taskComplete}
            onClick={async () => {
              const sid = getCurrentSessionId();
              if (sid) {
                await addBiomarker(sid, "motor_assessment", {
                  gazeScore: 0.5,
                  motorScore: Math.min(1, accuracy / 100),
                  vocalizationScore: 0.5,
                  responseLatencyMs: avgReaction || null,
                }).catch(() => {});
              }
              router.push("/intake/video-capture");
            }}>
            Continue →
          </button>
        </div>
      </main>
    </div>
  );
}
