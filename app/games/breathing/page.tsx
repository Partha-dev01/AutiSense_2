"use client";

import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";
import { saveDifficulty } from "../../lib/games/difficultyEngine";
import NavLogo from "../../components/NavLogo";
import ThemeToggle from "../../components/ThemeToggle";

type Screen = "start" | "play" | "result";
type BreathPhase = "inhale" | "hold" | "exhale" | "rest";

const PHASES: { phase: BreathPhase; label: string; duration: number }[] = [
  { phase: "inhale", label: "Breathe In", duration: 4000 },
  { phase: "hold", label: "Hold", duration: 2000 },
  { phase: "exhale", label: "Breathe Out", duration: 4000 },
  { phase: "rest", label: "Rest", duration: 2000 },
];

function startAmbientTone(): { stop: () => void } | null {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(174, ctx.currentTime);
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    return {
      stop: () => {
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.stop(ctx.currentTime + 0.5);
      },
    };
  } catch {
    return null;
  }
}

function triggerHaptic() {
  try {
    if (navigator.vibrate) navigator.vibrate(50);
  } catch { /* vibration not available */ }
}

export default function BreathingGamePage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [screen, setScreen] = useState<Screen>("start");
  const [breathPhase, setBreathPhase] = useState<BreathPhase>("inhale");
  const [phaseLabel, setPhaseLabel] = useState("Breathe In");
  const [cyclesCompleted, setCyclesCompleted] = useState(0);
  const [totalCycles] = useState(5);
  const [circleScale, setCircleScale] = useState(1);
  const [elapsed, setElapsed] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const animRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cycleRef = useRef(0);
  const ambientRef = useRef<{ stop: () => void } | null>(null);
  const runPhaseRef = useRef<((phaseIndex: number) => void) | null>(null);

  useEffect(() => {
    const saved =
      (typeof window !== "undefined" && localStorage.getItem("autisense-theme")) || "light";
    setTheme(saved as "light" | "dark");
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    if (typeof window !== "undefined") localStorage.setItem("autisense-theme", theme);
  }, [theme]);

  const runPhase = useCallback(
    (phaseIndex: number) => {
      triggerHaptic();
      if (phaseIndex >= PHASES.length) {
        // One cycle done
        cycleRef.current += 1;
        setCyclesCompleted(cycleRef.current);

        if (cycleRef.current >= totalCycles) {
          saveDifficulty("breathing", "default", 100);
          if (ambientRef.current) { ambientRef.current.stop(); ambientRef.current = null; }
          setScreen("result");
          return;
        }

        // Start next cycle
        runPhaseRef.current?.(0);
        return;
      }

      const { phase, label, duration } = PHASES[phaseIndex];
      setBreathPhase(phase);
      setPhaseLabel(label);

      // Animate circle
      if (phase === "inhale") setCircleScale(1.4);
      else if (phase === "exhale") setCircleScale(1);
      else if (phase === "hold") setCircleScale(1.4);
      else setCircleScale(1);

      animRef.current = setTimeout(() => {
        runPhaseRef.current?.(phaseIndex + 1);
      }, duration);
    },
    [totalCycles],
  );
  runPhaseRef.current = runPhase;

  const startGame = useCallback(() => {
    cycleRef.current = 0;
    setCyclesCompleted(0);
    setStartTime(Date.now());
    setScreen("play");
    // Start ambient tone
    if (ambientRef.current) ambientRef.current.stop();
    ambientRef.current = startAmbientTone();
    runPhase(0);
  }, [runPhase]);

  useEffect(() => {
    if (screen !== "play") return;
    const iv = setInterval(() => setElapsed(Date.now() - startTime), 500);
    return () => clearInterval(iv);
  }, [screen, startTime]);

  useEffect(() => {
    return () => {
      if (animRef.current) clearTimeout(animRef.current);
      if (ambientRef.current) { ambientRef.current.stop(); ambientRef.current = null; }
    };
  }, []);

  return (
    <div className="page">
      <nav className="nav">
        <NavLogo />
        <ThemeToggle theme={theme} onToggle={() => setTheme((t) => (t === "light" ? "dark" : "light"))} />
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
            <div className="breathe-orb" style={{ margin: "0 auto 28px" }}>
              <div className="breathe-inner">🌿</div>
            </div>
            <h1 className="page-title">
              Calm <em>Breathing</em>
            </h1>
            <p className="subtitle">
              Follow the circle as it expands and contracts. Breathe in as it grows, out as it shrinks. {totalCycles} cycles of calm.
            </p>
            <button onClick={startGame} className="btn btn-primary btn-full" style={{ maxWidth: 340 }}>
              Start Breathing
            </button>
          </div>
        )}

        {screen === "play" && (
          <div className="fade fade-2" style={{ textAlign: "center" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 32,
                fontSize: "0.9rem",
                color: "var(--text-secondary)",
                fontWeight: 600,
              }}
            >
              <span>
                Cycle {cyclesCompleted + 1}/{totalCycles}
              </span>
              <span>{Math.floor(elapsed / 1000)}s</span>
            </div>

            {/* Breathing circle */}
            <div
              style={{
                width: 200,
                height: 200,
                margin: "0 auto 36px",
                borderRadius: "50%",
                background: "var(--orb-bg)",
                boxShadow: `0 0 ${circleScale > 1.2 ? 48 : 24}px var(--orb-glow)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transform: `scale(${circleScale})`,
                transition: `transform ${
                  breathPhase === "inhale" || breathPhase === "exhale"
                    ? "4s"
                    : "0.5s"
                } ease-in-out, box-shadow 2s ease`,
              }}
            >
              <span
                style={{
                  fontSize: "2.5rem",
                  transform: `scale(${1 / circleScale})`,
                  transition: "transform 2s ease",
                }}
              >
                🌿
              </span>
            </div>

            <div
              style={{
                fontFamily: "'Fredoka',sans-serif",
                fontSize: "1.5rem",
                fontWeight: 600,
                color:
                  breathPhase === "inhale"
                    ? "var(--sage-500)"
                    : breathPhase === "exhale"
                      ? "var(--sky-300)"
                      : "var(--text-muted)",
                marginBottom: 12,
                transition: "color 500ms var(--ease)",
              }}
            >
              {phaseLabel}
            </div>
            <div
              style={{
                fontSize: "0.88rem",
                color: "var(--text-muted)",
              }}
            >
              {breathPhase === "inhale" && "Let the air fill your lungs..."}
              {breathPhase === "hold" && "Hold it gently..."}
              {breathPhase === "exhale" && "Let it all go slowly..."}
              {breathPhase === "rest" && "Relax and prepare..."}
            </div>
          </div>
        )}

        {screen === "result" && (
          <div className="fade fade-2" style={{ textAlign: "center" }}>
            <div className="breathe-orb" style={{ margin: "0 auto 28px" }}>
              <div className="breathe-inner">🕊️</div>
            </div>
            <h1 className="page-title">
              Feeling <em>Calm</em>
            </h1>
            <p className="subtitle" style={{ marginBottom: 16 }}>
              You completed {totalCycles} breathing cycles in {Math.floor(elapsed / 1000)} seconds. Well done staying focused!
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: 24 }}>
              <button onClick={startGame} className="btn btn-primary" style={{ minWidth: 160 }}>
                Breathe Again
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
