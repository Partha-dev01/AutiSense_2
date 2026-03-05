"use client";

import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";
import DetectorVideoCanvas from "../../components/DetectorVideoCanvas";
import DetectorResultsPanel from "../../components/DetectorResultsPanel";
import { useDetectorInference } from "../../hooks/useDetectorInference";
import { getUserMediaWithFallback, getCameraErrorMessage } from "../../lib/camera/cameraUtils";
import NavLogo from "../../components/NavLogo";
import { useAuthGuard } from "../../hooks/useAuthGuard";
import type { PipelineResult } from "../../types/inference";

const LARGE_TOTAL = 3600; // 1 hour — used so DetectorResultsPanel progress bar works

export default function DetectionPage() {
  const { loading: authLoading, isAuthenticated } = useAuthGuard();

  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [started, setStarted] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [camReady, setCamReady] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startingRef = useRef(false);
  const finalResultRef = useRef<PipelineResult | null>(null);

  const { result, isModelLoaded, error, modelError, backend, modality, setModality } =
    useDetectorInference(videoRef, canvasRef, camReady && started && !stopped);

  // Persist latest result for the stopped summary screen
  useEffect(() => {
    if (result) finalResultRef.current = result;
  }, [result]);

  // Theme init
  useEffect(() => {
    const saved =
      (typeof window !== "undefined" && localStorage.getItem("autisense-theme")) || "light";
    setTheme(saved as "light" | "dark");
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    if (typeof window !== "undefined") localStorage.setItem("autisense-theme", theme);
  }, [theme]);

  // ---- Camera ----
  const startCamera = useCallback(async () => {
    try {
      const stream = await getUserMediaWithFallback();
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        try {
          await video.play();
        } catch (playErr) {
          if (!(playErr instanceof DOMException && playErr.name === "AbortError")) {
            throw playErr;
          }
        }
      }
      setCamReady(true);
    } catch (err) {
      setCamError(getCameraErrorMessage(err));
    }
  }, []);

  // Re-attach stream when video element mounts after camera obtained
  useEffect(() => {
    if (!started || !streamRef.current) return;
    const check = setInterval(() => {
      const video = videoRef.current;
      if (video && streamRef.current && !video.srcObject) {
        video.srcObject = streamRef.current;
        video.play().catch(() => {});
      }
    }, 200);
    return () => clearInterval(check);
  }, [started]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // ---- Start detection ----
  const startDetection = useCallback(async () => {
    if (startingRef.current) return;
    startingRef.current = true;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    await startCamera();
    setStarted(true);
    setStopped(false);
    setElapsed(0);
    finalResultRef.current = null;

    // Count-up timer
    const origin = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - origin) / 1000));
    }, 1000);

    startingRef.current = false;
  }, [startCamera]);

  // ---- Stop detection ----
  const stopDetection = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setStopped(true);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  // ---- Detect again ----
  const detectAgain = useCallback(() => {
    setStopped(false);
    setStarted(false);
    setCamReady(false);
    setCamError(null);
    setElapsed(0);
    finalResultRef.current = null;
    startingRef.current = false;
  }, []);

  // ---- Format elapsed for display ----
  const fmtElapsed = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  // ---- Auth loading state ----
  if (authLoading || !isAuthenticated) {
    return (
      <div
        className="page"
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
        }}
      >
        <p style={{ color: "var(--text-secondary)" }}>Loading...</p>
      </div>
    );
  }

  // Use final snapshot when stopped, live result when running
  const displayResult = stopped ? finalResultRef.current : result;

  return (
    <div className="page">
      {/* ---- Nav ---- */}
      <nav className="nav">
        <NavLogo />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
            className="btn btn-outline"
            style={{ minHeight: 40, padding: "8px 14px", fontSize: "0.85rem" }}
            aria-label="Toggle theme"
          >
            {theme === "light" ? "Dark" : "Light"}
          </button>
          <Link
            href="/kid-dashboard"
            className="btn btn-outline"
            style={{ minHeight: 40, padding: "8px 16px", fontSize: "0.9rem" }}
          >
            Home
          </Link>
        </div>
      </nav>

      <main className="main-wide" style={{ position: "relative" }}>
        {/* ======== STATE 1: Start screen ======== */}
        {!started && !stopped && (
          <div style={{ maxWidth: 620, margin: "0 auto" }}>
            <div
              className="fade fade-1"
              style={{ textAlign: "center", marginBottom: 28 }}
            >
              <div
                style={{
                  fontSize: "3.5rem",
                  marginBottom: 8,
                }}
              >
                📹
              </div>
            </div>

            <h1
              className="page-title fade fade-2"
              style={{ fontFamily: "'Fredoka',sans-serif" }}
            >
              Live <em>Detection</em>
            </h1>

            <p className="subtitle fade fade-2">
              Start the camera to observe body pose and facial expressions in
              real time. All analysis runs entirely on your device — no video
              is recorded, stored, or uploaded.
            </p>

            <div
              className="card fade fade-3"
              style={{
                padding: "20px 24px",
                marginBottom: 24,
                background: "var(--sage-50)",
                borderColor: "var(--sage-300)",
              }}
            >
              <p
                style={{
                  fontSize: "0.9rem",
                  color: "var(--sage-600)",
                  fontWeight: 600,
                  lineHeight: 1.7,
                  margin: 0,
                }}
              >
                Privacy: The camera feed is processed entirely on your device.
                No video or images ever leave your browser. This is a
                free-form detection tool — there is no time limit.
              </p>
            </div>

            <div
              className="fade fade-4"
              style={{ display: "flex", gap: 12 }}
            >
              <Link
                href="/kid-dashboard"
                className="btn btn-outline"
                style={{ minWidth: 100 }}
              >
                Back
              </Link>
              <button
                className="btn btn-primary btn-full"
                onClick={startDetection}
                disabled={started}
              >
                Start Detection
              </button>
            </div>
          </div>
        )}

        {/* ======== STATE 2: Running ======== */}
        {started && !stopped && (
          <div className="fade fade-3">
            <div className="video-capture-grid">
              {/* Left: Video feed */}
              <div>
                <DetectorVideoCanvas
                  videoRef={videoRef}
                  canvasRef={canvasRef}
                  result={result}
                  isCamReady={camReady}
                  isModelLoaded={isModelLoaded}
                />

                {/* Modality toggle */}
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    marginTop: 12,
                    justifyContent: "center",
                  }}
                >
                  {(["body", "face", "both"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setModality(m)}
                      className={
                        modality === m ? "btn btn-primary" : "btn btn-outline"
                      }
                      style={{
                        minHeight: 36,
                        padding: "6px 16px",
                        fontSize: "0.8rem",
                      }}
                    >
                      {m === "body"
                        ? "Body"
                        : m === "face"
                          ? "Face"
                          : "Both"}
                    </button>
                  ))}
                </div>

                {/* Errors */}
                {(camError || modelError || error) && (
                  <div
                    style={{
                      marginTop: 12,
                      padding: "12px 16px",
                      borderRadius: "var(--r-md)",
                      background: "var(--peach-100)",
                      border: "2px solid var(--peach-300)",
                      textAlign: "center",
                    }}
                  >
                    <p
                      style={{
                        fontSize: "0.85rem",
                        color: "var(--peach-300)",
                        fontWeight: 600,
                        marginBottom: camError ? 12 : 0,
                      }}
                    >
                      {camError || modelError || error}
                    </p>
                    {camError && (
                      <div
                        style={{
                          display: "flex",
                          gap: 10,
                          justifyContent: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        <button
                          className="btn btn-primary"
                          style={{
                            minHeight: 36,
                            padding: "6px 16px",
                            fontSize: "0.85rem",
                          }}
                          onClick={() => {
                            setCamError(null);
                            startCamera();
                          }}
                        >
                          Retry Camera
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Elapsed + stop */}
                <div
                  style={{
                    textAlign: "center",
                    marginTop: 16,
                    display: "flex",
                    gap: 12,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.85rem",
                      color: "var(--text-muted)",
                      fontWeight: 600,
                      fontFamily: "'Fredoka',sans-serif",
                    }}
                  >
                    Elapsed: {fmtElapsed(elapsed)}
                  </span>
                  <button
                    className="btn btn-outline"
                    onClick={stopDetection}
                    style={{
                      minHeight: 40,
                      padding: "8px 20px",
                      fontSize: "0.85rem",
                    }}
                  >
                    Stop Detection
                  </button>
                </div>
              </div>

              {/* Right: Results panel */}
              <DetectorResultsPanel
                result={result}
                isModelLoaded={isModelLoaded}
                backend={backend}
                timeLeft={LARGE_TOTAL - elapsed}
                totalTime={LARGE_TOTAL}
              />
            </div>
          </div>
        )}

        {/* ======== STATE 3: Stopped ======== */}
        {stopped && (
          <div style={{ maxWidth: 620, margin: "0 auto" }}>
            <div
              className="card fade fade-3"
              style={{
                padding: "36px 28px",
                textAlign: "center",
                background: "var(--sage-50)",
                borderColor: "var(--sage-300)",
              }}
            >
              <div style={{ fontSize: "3rem", marginBottom: 16 }}>
                {displayResult?.multimodal ? "✅" : "📹"}
              </div>
              <h2
                style={{
                  fontFamily: "'Fredoka',sans-serif",
                  fontWeight: 600,
                  fontSize: "1.4rem",
                  marginBottom: 14,
                  color: "var(--text-primary)",
                }}
              >
                Detection Complete
              </h2>
              <p
                style={{
                  color: "var(--text-secondary)",
                  fontSize: "0.95rem",
                  lineHeight: 1.7,
                  marginBottom: 12,
                }}
              >
                The session ran for{" "}
                <strong>{fmtElapsed(elapsed)}</strong>. Your camera has been
                turned off and no video was stored.
              </p>

              {/* Final results summary */}
              {displayResult?.multimodal && (
                <div
                  style={{
                    display: "flex",
                    gap: 20,
                    justifyContent: "center",
                    marginBottom: 20,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ textAlign: "center" }}>
                    <div
                      style={{
                        fontSize: "1.8rem",
                        fontWeight: 700,
                        fontFamily: "'Fredoka',sans-serif",
                        color: "var(--sage-600)",
                      }}
                    >
                      {Math.round(displayResult.multimodal.asdRisk * 100)}%
                    </div>
                    <div
                      style={{
                        fontSize: "0.8rem",
                        color: "var(--text-muted)",
                      }}
                    >
                      ASD Risk
                    </div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div
                      style={{
                        fontSize: "1.8rem",
                        fontWeight: 700,
                        fontFamily: "'Fredoka',sans-serif",
                        color: "var(--sky-300)",
                      }}
                    >
                      {Math.round(displayResult.multimodal.confidence * 100)}%
                    </div>
                    <div
                      style={{
                        fontSize: "0.8rem",
                        color: "var(--text-muted)",
                      }}
                    >
                      Confidence
                    </div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div
                      style={{
                        fontSize: "1.8rem",
                        fontWeight: 700,
                        fontFamily: "'Fredoka',sans-serif",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {fmtElapsed(elapsed)}
                    </div>
                    <div
                      style={{
                        fontSize: "0.8rem",
                        color: "var(--text-muted)",
                      }}
                    >
                      Duration
                    </div>
                  </div>
                </div>
              )}

              {displayResult?.behavior && (
                <div
                  style={{
                    textAlign: "left",
                    padding: "14px 18px",
                    background: "var(--card)",
                    borderRadius: "var(--r-md)",
                    border: "1px solid var(--border)",
                    marginBottom: 8,
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.85rem",
                      fontWeight: 700,
                      fontFamily: "'Fredoka',sans-serif",
                      color: "var(--text-primary)",
                      marginBottom: 6,
                    }}
                  >
                    Last Detected Behavior
                  </div>
                  <div
                    style={{
                      fontSize: "0.9rem",
                      color: "var(--sage-600)",
                      fontWeight: 600,
                    }}
                  >
                    {displayResult.behavior.className
                      .split("_")
                      .map((w) => w[0].toUpperCase() + w.slice(1))
                      .join(" ")}
                    <span
                      style={{
                        marginLeft: 8,
                        fontSize: "0.8rem",
                        color: "var(--text-muted)",
                      }}
                    >
                      (
                      {(
                        displayResult.behavior.probabilities[
                          displayResult.behavior.predictedClass
                        ] * 100
                      ).toFixed(1)}
                      %)
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div
              className="fade fade-4"
              style={{
                display: "flex",
                gap: 12,
                marginTop: 20,
                justifyContent: "center",
                flexWrap: "wrap",
              }}
            >
              <button
                className="btn btn-primary"
                onClick={detectAgain}
                style={{ minWidth: 160 }}
              >
                Detect Again
              </button>
              <Link
                href="/kid-dashboard"
                className="btn btn-outline"
                style={{ minWidth: 160 }}
              >
                Back to Dashboard
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
