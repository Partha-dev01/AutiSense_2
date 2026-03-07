"use client";
import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { addBiomarker } from "../../lib/db/biomarker.repository";
import { getCurrentSessionId } from "../../lib/session/currentSession";
import { useActionCamera } from "../../hooks/useActionCamera";
import { ACTION_META, type ActionId, getDebugLog } from "../../lib/actions/actionDetector";
import SkipStageDialog from "../../components/SkipStageDialog";

const STEPS = [
  "Welcome", "Profile", "Device", "Communicate", "Behavior",
  "Prepare", "Motor", "Video", "Summary", "Report",
];
const STEP_IDX = 5;

const ACTIONS: ActionId[] = ["wave", "touch_nose", "clap", "raise_arms"];
const ACTION_TIMEOUT_MS = 20_000;
const SUCCESS_DISPLAY_MS = 1500;
const COUNTDOWN_SECONDS = 3;
const MIN_DETECTED = 2; // Criteria gate

type Phase = "pre_start" | "active" | "complete";
type ActionPhase = "countdown" | "detecting" | "detected" | "timeout";

function getConfidenceColor(c: number): string {
  if (c < 0.3) return "var(--peach-300)";
  if (c < 0.7) return "var(--sky-300)";
  return "var(--sage-500)";
}

export default function PreparationPage() {
  const router = useRouter();
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const [phase, setPhase] = useState<Phase>("pre_start");
  const [actionPhase, setActionPhase] = useState<ActionPhase>("countdown");
  const [currentIdx, setCurrentIdx] = useState(0);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [results, setResults] = useState<Map<number, boolean>>(new Map());
  const [timeoutSeconds, setTimeoutSeconds] = useState(Math.ceil(ACTION_TIMEOUT_MS / 1000));
  const [forceComplete, setForceComplete] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [debugLines, setDebugLines] = useState<string[]>([]);

  const [displayStatus, setDisplayStatus] = useState<string>("looking");
  const [displayHits, setDisplayHits] = useState(0);
  const stableStatusRef = useRef<string>("looking");
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const timeoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const {
    videoRef, overlayRef, isModelLoaded, isActive: cameraActive,
    cameraError, startCamera, stopCamera, startDetecting, stopDetecting,
    actionResult, actionDetected, consecutiveHits, keypoints,
  } = useActionCamera();

  useEffect(() => {
    const saved = document.documentElement.getAttribute("data-theme") as "light" | "dark" | null;
    if (saved) setTheme(saved);
  }, []);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
  };

  const clearTimers = useCallback(() => {
    if (timeoutTimerRef.current) { clearTimeout(timeoutTimerRef.current); timeoutTimerRef.current = null; }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
  }, []);

  // Debounce status text to prevent flickering — sticky: only upgrade, never downgrade quickly
  const hasKeypoints = keypoints && keypoints.length >= 34;
  const statusCategory = !hasKeypoints ? "no_keypoints"
    : consecutiveHits >= 3 ? "almost"
    : (actionResult?.confidence || 0) > 0.08 ? "closer"
    : "looking";

  const statusRank = (s: string) => s === "almost" ? 3 : s === "closer" ? 2 : s === "looking" ? 1 : 0;

  useEffect(() => {
    if (actionPhase !== "detecting") {
      stableStatusRef.current = "looking";
      setDisplayStatus("looking");
      return;
    }
    if (statusCategory === stableStatusRef.current) return;

    // Upgrade immediately, downgrade with delay
    const isUpgrade = statusRank(statusCategory) > statusRank(stableStatusRef.current);

    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    if (isUpgrade) {
      stableStatusRef.current = statusCategory;
      setDisplayStatus(statusCategory);
    } else {
      statusTimerRef.current = setTimeout(() => {
        stableStatusRef.current = statusCategory;
        setDisplayStatus(statusCategory);
      }, 1200); // slow downgrade
    }

    return () => { if (statusTimerRef.current) { clearTimeout(statusTimerRef.current); statusTimerRef.current = null; } };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusCategory, actionPhase]);

  // Debounce hits display — update only on significant change
  useEffect(() => {
    if (consecutiveHits === 0 || consecutiveHits >= 5 || Math.abs(consecutiveHits - displayHits) >= 1) {
      setDisplayHits(consecutiveHits);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consecutiveHits]);

  // Start the countdown for current action
  const startCountdown = useCallback(() => {
    setActionPhase("countdown");
    setCountdown(COUNTDOWN_SECONDS);

    let c = COUNTDOWN_SECONDS;
    countdownRef.current = setInterval(() => {
      c--;
      setCountdown(c);
      if (c <= 0) {
        if (countdownRef.current) clearInterval(countdownRef.current);
        countdownRef.current = null;
        // Start detecting
        setActionPhase("detecting");
        setTimeoutSeconds(Math.ceil(ACTION_TIMEOUT_MS / 1000));
        startDetecting(ACTIONS[currentIdx]);

        // Timeout countdown tick
        let t = Math.ceil(ACTION_TIMEOUT_MS / 1000);
        tickRef.current = setInterval(() => {
          t--;
          if (t <= 0) {
            if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
            t = 0;
          }
          setTimeoutSeconds(t);
        }, 1000);

        // Timeout
        timeoutTimerRef.current = setTimeout(() => {
          stopDetecting();
          if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
          setActionPhase("timeout");
        }, ACTION_TIMEOUT_MS);
      }
    }, 1000);
  }, [currentIdx, startDetecting, stopDetecting]);

  // Watch for action detected
  useEffect(() => {
    if (actionDetected && actionPhase === "detecting") {
      clearTimers();
      setActionPhase("detected");
      setResults((prev) => new Map(prev).set(currentIdx, true));

      // Auto-advance after celebration
      const t = setTimeout(() => {
        advanceAction();
      }, SUCCESS_DISPLAY_MS);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionDetected]);

  const advanceAction = useCallback(() => {
    clearTimers();
    stopDetecting();
    if (currentIdx >= ACTIONS.length - 1) {
      setPhase("complete");
      stopCamera();
    } else {
      setCurrentIdx((i) => i + 1);
      // Need to wait a tick so startCountdown reads updated currentIdx
      setTimeout(() => startCountdown(), 100);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIdx, clearTimers, stopDetecting, stopCamera]);

  // Fix: startCountdown uses currentIdx via closure, update when it changes
  useEffect(() => {
    // Handled via advanceAction timeout
  }, [currentIdx]);

  const recordSkip = useCallback(() => {
    setResults((prev) => new Map(prev).set(currentIdx, false));
    advanceAction();
  }, [currentIdx, advanceAction]);

  const retryAction = useCallback(() => {
    clearTimers();
    startCountdown();
  }, [clearTimers, startCountdown]);

  const handleStart = useCallback(async () => {
    try {
      await startCamera();
    } catch {
      // Camera unavailable — manual fallback buttons shown
    }
    setPhase("active");
    setTimeout(() => startCountdown(), 300);
  }, [startCamera, startCountdown]);

  const stopEarly = useCallback(() => {
    clearTimers();
    stopDetecting();
    stopCamera();
    // Record remaining as skipped
    setResults((prev) => {
      const m = new Map(prev);
      for (let i = currentIdx; i < ACTIONS.length; i++) {
        if (!m.has(i)) m.set(i, false);
      }
      return m;
    });
    setPhase("complete");
  }, [clearTimers, stopDetecting, stopCamera, currentIdx]);

  const resetStage = useCallback(() => {
    clearTimers();
    stopDetecting();
    setPhase("pre_start");
    setActionPhase("countdown");
    setCurrentIdx(0);
    setResults(new Map());
    setCountdown(COUNTDOWN_SECONDS);
    setForceComplete(false);
  }, [clearTimers, stopDetecting]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  // Debug log poller
  useEffect(() => {
    if (!showDebug || actionPhase !== "detecting") return;
    const iv = setInterval(() => {
      const log = getDebugLog();
      setDebugLines(log.slice(-15).map((e) => e.detail));
    }, 300);
    return () => clearInterval(iv);
  }, [showDebug, actionPhase]);

  const handleSkipStage = useCallback(async () => {
    clearTimers();
    stopDetecting();
    stopCamera();
    const sid = getCurrentSessionId();
    if (sid) {
      await addBiomarker(sid, "preparation_interactive", {
        gazeScore: 0.5,
        motorScore: 0.5,
        vocalizationScore: 0.5,
      }).catch(() => {});
    }
    router.push("/intake/motor");
  }, [router, clearTimers, stopDetecting, stopCamera]);

  const currentAction = ACTIONS[currentIdx];
  const meta = ACTION_META[currentAction];
  const detectedCount = Array.from(results.values()).filter(Boolean).length;
  const meetsCriteria = detectedCount >= MIN_DETECTED;

  return (
    <div className="page">
      <nav className="nav">
        <Link href="/" className="logo">Auti<em>Sense</em></Link>
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
            <div className="breathe-inner">💪</div>
          </div>
        </div>

        <div className="chip fade fade-1">Step 6 — Action Challenge</div>
        <h1 className="page-title fade fade-2">
          Show us your <em>moves!</em>
        </h1>
        <p className="subtitle fade fade-2">
          We'll ask your child to perform {ACTIONS.length} actions.
          The camera detects each action in real-time using pose detection.
        </p>

        {/* Pre-start */}
        {phase === "pre_start" && (
          <div className="fade fade-3" style={{ textAlign: "center" }}>
            <div style={{
              display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center",
              marginBottom: 24, maxWidth: 360, margin: "0 auto 24px",
            }}>
              {ACTIONS.map((a) => (
                <div key={a} style={{
                  padding: "8px 14px", borderRadius: 12,
                  background: "var(--bg-card)", border: "1px solid var(--border-card)",
                  fontSize: "0.85rem", fontWeight: 600,
                }}>
                  {ACTION_META[a].emoji} {ACTION_META[a].label}
                </div>
              ))}
            </div>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: 20 }}>
              Camera access is required. Make sure the child is visible on screen.
            </p>
            <button className="btn btn-primary" onClick={handleStart}
              style={{ minHeight: 52, padding: "12px 36px" }}>
              📷 Start Action Challenge
            </button>
          </div>
        )}

        {/* Active — action detection */}
        {phase === "active" && (
          <div className="card fade fade-1" style={{
            padding: "24px 20px", textAlign: "center",
            borderColor: actionPhase === "detected" ? "var(--sage-400)" : "var(--border-card)",
            transition: "border-color 0.3s",
          }}>
            {/* Progress */}
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: 8, fontWeight: 600 }}>
              Action {currentIdx + 1} of {ACTIONS.length}
            </p>

            {/* Action target */}
            <div style={{ fontSize: "2.5rem", marginBottom: 4 }}>{meta.emoji}</div>
            <h2 style={{
              fontFamily: "'Fredoka',sans-serif", fontWeight: 600,
              fontSize: "1.4rem", marginBottom: 16, color: "var(--text-primary)",
            }}>
              {meta.label}
            </h2>

            {/* Camera feed — visible during all active action phases (including timeout so stream stays attached) */}
            {(actionPhase === "countdown" || actionPhase === "detecting" || actionPhase === "detected" || actionPhase === "timeout") && (
              <>
                {cameraActive && !cameraError ? (
                  <div style={{
                    position: "relative", width: "100%", maxWidth: 400,
                    aspectRatio: "4/3",
                    margin: "0 auto 12px", borderRadius: 16, overflow: "hidden",
                    border: `3px solid ${actionPhase === "detected" ? "var(--sage-400)" : actionPhase === "countdown" ? "var(--sky-300)" : getConfidenceColor(actionResult?.confidence || 0)}`,
                    transition: "border-color 0.2s",
                  }}>
                    <video
                      ref={videoRef}
                      style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)", display: "block" }}
                      playsInline muted autoPlay
                    />
                    <canvas
                      ref={overlayRef}
                      width={320} height={240}
                      style={{
                        position: "absolute", top: 0, left: 0,
                        width: "100%", height: "100%", transform: "scaleX(-1)", pointerEvents: "none",
                      }}
                    />

                    {/* Countdown overlay on camera */}
                    {actionPhase === "countdown" && (
                      <div style={{
                        position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
                        background: "rgba(0,0,0,0.35)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexDirection: "column", gap: 8,
                      }}>
                        <div style={{
                          width: 80, height: 80, borderRadius: "50%",
                          background: "rgba(255,255,255,0.95)", border: "3px solid var(--sky-300)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "2rem", fontWeight: 700, color: "var(--sky-400)",
                          fontFamily: "'Fredoka',sans-serif",
                        }}>
                          {countdown > 0 ? countdown : "Go!"}
                        </div>
                        <p style={{ fontSize: "0.9rem", color: "white", fontWeight: 600 }}>
                          Get ready...
                        </p>
                      </div>
                    )}

                    {/* Success overlay */}
                    {actionPhase === "detected" && (
                      <div style={{
                        position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
                        background: "rgba(104, 159, 56, 0.3)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <div style={{
                          background: "white", borderRadius: "50%",
                          width: 80, height: 80, display: "flex",
                          alignItems: "center", justifyContent: "center",
                          fontSize: "2.5rem", boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
                        }}>
                          ✅
                        </div>
                      </div>
                    )}

                    {/* Model loading */}
                    {!isModelLoaded && (
                      <div style={{
                        position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
                        background: "rgba(0,0,0,0.5)", display: "flex",
                        alignItems: "center", justifyContent: "center",
                        color: "white", fontWeight: 600, fontSize: "0.9rem",
                      }}>
                        Loading pose model...
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{
                    width: "100%", maxWidth: 400, height: 120, margin: "0 auto 12px", borderRadius: 16,
                    background: "var(--bg-card)", border: "2px dashed var(--border-card)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexDirection: "column", gap: 8,
                  }}>
                    <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600 }}>
                      📷 Camera not available
                    </p>
                  </div>
                )}

                {/* Confidence bar */}
                {actionPhase === "detecting" && actionResult && (
                  <div style={{ maxWidth: 280, margin: "0 auto 8px" }}>
                    <div style={{
                      height: 8, borderRadius: 4, background: "var(--bg-elevated)", overflow: "hidden",
                    }}>
                      <div style={{
                        height: "100%", borderRadius: 4,
                        background: getConfidenceColor(actionResult.confidence),
                        width: `${Math.round(actionResult.confidence * 100)}%`,
                        transition: "width 0.15s, background 0.15s",
                      }} />
                    </div>
                  </div>
                )}

                {/* 6-dot frame counter (matches REQUIRED_CONSECUTIVE = 6) */}
                {actionPhase === "detecting" && (
                  <div style={{ display: "flex", gap: 3, justifyContent: "center", marginBottom: 8 }}>
                    {Array.from({ length: 5 }, (_, i) => (
                      <div key={i} style={{
                        width: 14, height: 14, borderRadius: "50%",
                        background: i < displayHits ? "var(--sage-500)" : "var(--bg-elevated)",
                        border: "2px solid var(--sage-300)",
                        transition: "background 0.3s",
                      }} />
                    ))}
                  </div>
                )}

                {/* Status text (debounced to prevent flicker) */}
                {actionPhase === "detecting" && (
                  <p style={{
                    fontSize: "0.9rem", fontWeight: 700, marginBottom: 8,
                    color: displayStatus === "no_keypoints" ? "var(--text-muted)"
                      : displayStatus === "almost" ? "var(--sage-600)"
                      : displayStatus === "closer" ? "var(--sky-400)"
                      : "var(--text-muted)",
                    transition: "color 0.3s",
                  }}>
                    {displayStatus === "no_keypoints" ? "Step into view so we can see you!"
                      : displayStatus === "almost" ? "Almost there! Keep holding..."
                      : displayStatus === "closer" ? "Getting closer!"
                      : `Looking for: ${meta.label}...`}
                  </p>
                )}

                {actionPhase === "detected" && (
                  <p style={{
                    color: "var(--sage-600)", fontWeight: 700, fontSize: "1.1rem",
                    fontFamily: "'Fredoka',sans-serif",
                  }}>
                    Great job! 🎉
                  </p>
                )}

                {/* Timer + controls */}
                {actionPhase === "detecting" && (
                  <div style={{ marginTop: 8 }}>
                    <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 8 }}>
                      Time remaining: {Math.max(0, timeoutSeconds)}s
                    </p>
                    <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                      {(!cameraActive || cameraError) && (
                        <button className="btn btn-primary" style={{ minHeight: 40, padding: "6px 16px", fontSize: "0.85rem" }}
                          onClick={() => { setResults((prev) => new Map(prev).set(currentIdx, true)); advanceAction(); }}>
                          ✓ They did it!
                        </button>
                      )}
                      <button className="btn btn-outline" style={{ minHeight: 40, padding: "6px 16px", fontSize: "0.8rem" }}
                        onClick={recordSkip}>
                        Skip →
                      </button>
                      <button className="btn btn-outline" style={{ minHeight: 40, padding: "6px 16px", fontSize: "0.8rem", color: "var(--text-muted)" }}
                        onClick={stopEarly}>
                        End Early
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Debug panel */}
            {phase === "active" && (
              <div style={{ marginTop: 12, textAlign: "center" }}>
                <button
                  onClick={() => setShowDebug((d) => !d)}
                  style={{
                    background: "none", border: "1px dashed var(--border)", borderRadius: 6,
                    padding: "4px 12px", fontSize: "0.7rem", color: "var(--text-muted)",
                    cursor: "pointer",
                  }}
                >
                  {showDebug ? "Hide Debug" : "Show Debug"}
                </button>
                {showDebug && (
                  <div style={{
                    marginTop: 8, textAlign: "left", background: "var(--bg-secondary)",
                    border: "1px solid var(--border)", borderRadius: 8,
                    padding: "10px 12px", maxHeight: 200, overflowY: "auto",
                    fontFamily: "monospace", fontSize: "0.65rem", lineHeight: 1.5,
                    color: "var(--text-secondary)",
                  }}>
                    <div style={{ marginBottom: 4, fontWeight: 700 }}>
                      Action: {ACTIONS[currentIdx]} | Phase: {actionPhase} | Hits: {consecutiveHits}/5 | Conf: {(actionResult?.confidence || 0).toFixed(2)}
                    </div>
                    {debugLines.map((line, i) => (
                      <div key={i} style={{ opacity: 0.6 + (i / debugLines.length) * 0.4 }}>{line}</div>
                    ))}
                    {debugLines.length === 0 && <div>Waiting for frames...</div>}
                  </div>
                )}
              </div>
            )}

            {/* Timeout */}
            {actionPhase === "timeout" && (
              <div style={{ marginTop: 8 }}>
                <p style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 16 }}>
                  Not detected — that's okay!
                </p>
                <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                  <button className="btn btn-primary" onClick={retryAction}
                    style={{ minHeight: 44, padding: "8px 20px", fontSize: "0.9rem" }}>
                    Try Again
                  </button>
                  <button className="btn btn-secondary" onClick={recordSkip}
                    style={{ minHeight: 44, padding: "8px 20px", fontSize: "0.9rem" }}>
                    Skip →
                  </button>
                  <button className="btn btn-outline" onClick={stopEarly}
                    style={{ minHeight: 40, padding: "6px 16px", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                    End Early
                  </button>
                </div>
              </div>
            )}

            {/* Action progress grid */}
            <div style={{
              display: "flex", gap: 6, justifyContent: "center", marginTop: 16,
              flexWrap: "wrap",
            }}>
              {ACTIONS.map((a, i) => (
                <div key={a} style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: results.has(i)
                    ? (results.get(i) ? "var(--sage-100)" : "var(--peach-100)")
                    : i === currentIdx ? "var(--sky-100)" : "var(--bg-elevated)",
                  border: `2px solid ${results.has(i)
                    ? (results.get(i) ? "var(--sage-400)" : "var(--peach-300)")
                    : i === currentIdx ? "var(--sky-300)" : "var(--border-card)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "1rem",
                  transition: "all 0.2s",
                }}>
                  {results.has(i) ? (results.get(i) ? "✓" : "✗") : ACTION_META[a].emoji}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Complete */}
        {phase === "complete" && (
          <>
            {meetsCriteria || forceComplete ? (
              <div className="card fade fade-3" style={{ padding: "32px 28px", textAlign: "center", background: "var(--sage-50)", borderColor: "var(--sage-300)" }}>
                <div style={{ fontSize: "2.5rem", marginBottom: 14 }}>🏆</div>
                <h2 style={{ fontFamily: "'Fredoka',sans-serif", fontWeight: 600, fontSize: "1.3rem", marginBottom: 14 }}>
                  Action challenge complete!
                </h2>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: 16 }}>
                  {detectedCount} of {ACTIONS.length} actions detected.
                </p>

                {/* Results grid */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
                  {ACTIONS.map((a, i) => (
                    <div key={a} style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "6px 12px", borderRadius: 8,
                      background: results.get(i) ? "var(--sage-50)" : "var(--peach-50)",
                      border: `1px solid ${results.get(i) ? "var(--sage-300)" : "var(--peach-200)"}`,
                      fontSize: "0.85rem", fontWeight: 600,
                    }}>
                      <span>{ACTION_META[a].emoji}</span>
                      <span>{results.get(i) ? "✓" : "✗"}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="card fade fade-3" style={{ padding: "32px 28px", textAlign: "center", background: "var(--peach-50)", borderColor: "var(--peach-300)" }}>
                <div style={{ fontSize: "2.5rem", marginBottom: 14 }}>🔄</div>
                <h2 style={{ fontFamily: "'Fredoka',sans-serif", fontWeight: 600, fontSize: "1.3rem", marginBottom: 10 }}>
                  Let's try again!
                </h2>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: 20 }}>
                  Only {detectedCount} of {ACTIONS.length} actions detected. We need at least {MIN_DETECTED}.
                </p>
                <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                  <button className="btn btn-primary" onClick={resetStage}
                    style={{ minHeight: 44, padding: "8px 24px" }}>
                    Try Again
                  </button>
                  <button className="btn btn-outline" onClick={() => setForceComplete(true)}
                    style={{ minHeight: 44, padding: "8px 24px" }}>
                    Skip This Step
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Navigation */}
        <div className="fade fade-4" style={{ display: "flex", gap: 12, marginTop: 28 }}>
          <Link href="/intake/behavioral-observation" className="btn btn-outline" style={{ minWidth: 100 }}>
            ← Back
          </Link>
          <button className="btn btn-primary btn-full"
            disabled={phase !== "complete" || (!meetsCriteria && !forceComplete)}
            onClick={async () => {
              const sid = getCurrentSessionId();
              if (sid) {
                await addBiomarker(sid, "preparation_interactive", {
                  gazeScore: 0.5,
                  motorScore: ACTIONS.length > 0 ? detectedCount / ACTIONS.length : 0.5,
                  vocalizationScore: 0.5,
                }).catch(() => {});
              }
              router.push("/intake/motor");
            }}>
            Continue →
          </button>
        </div>
      </main>
    </div>
  );
}
