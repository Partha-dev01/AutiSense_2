"use client";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Camera, Mic, Globe } from "lucide-react";

const STEPS = [
  "Welcome", "Profile", "Device", "Communicate", "Behavior",
  "Prepare", "Motor", "Video", "Summary", "Report",
];

type CheckStatus = "idle" | "checking" | "pass" | "fail";

interface DeviceCheck {
  id: string;
  label: string;
  emoji: string;
  description: string;
  status: CheckStatus;
  errorMsg?: string;
}

export default function DeviceCheckPage() {
  const router = useRouter();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const iconMap: Record<string, React.ReactNode> = {
    camera: <Camera size={18} />,
    microphone: <Mic size={18} />,
    browser: <Globe size={18} />,
  };

  const [checks, setChecks] = useState<DeviceCheck[]>([
    {
      id: "camera",
      label: "Camera access",
      emoji: "",
      description: "Needed to observe movement and facial expressions",
      status: "idle",
    },
    {
      id: "microphone",
      label: "Microphone access",
      emoji: "",
      description: "Used for audio-based screening tasks",
      status: "idle",
    },
    {
      id: "browser",
      label: "Browser compatibility",
      emoji: "",
      description: "Checking for required features (WebAssembly, etc.)",
      status: "idle",
    },
  ]);
  const [started, setStarted] = useState(false);
  const allPassed = checks.every((c) => c.status === "pass");
  const anyFailed = checks.some((c) => c.status === "fail");
  const isChecking = checks.some((c) => c.status === "checking");

  useEffect(() => {
    const saved = document.documentElement.getAttribute("data-theme") as
      | "light"
      | "dark"
      | null;
    if (saved) setTheme(saved);
  }, []);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
  };

  const updateCheck = useCallback(
    (id: string, updates: Partial<DeviceCheck>) => {
      setChecks((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
      );
    },
    []
  );

  const runChecks = useCallback(async () => {
    setStarted(true);

    // Reset all to checking
    setChecks((prev) => prev.map((c) => ({ ...c, status: "checking" as const, errorMsg: undefined })));

    // Check camera
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((t) => t.stop());
      updateCheck("camera", { status: "pass" });
    } catch {
      updateCheck("camera", {
        status: "fail",
        errorMsg:
          "Camera not available. Please allow camera access in your browser settings.",
      });
    }

    // Check microphone
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      updateCheck("microphone", { status: "pass" });
    } catch {
      updateCheck("microphone", {
        status: "fail",
        errorMsg:
          "Microphone not available. Please allow microphone access in your browser settings.",
      });
    }

    // Check browser compatibility
    const hasWasm = typeof WebAssembly !== "undefined";
    const hasMedia = typeof navigator.mediaDevices !== "undefined";
    if (hasWasm && hasMedia) {
      updateCheck("browser", { status: "pass" });
    } else {
      updateCheck("browser", {
        status: "fail",
        errorMsg:
          "Your browser is missing required features. Please use Chrome, Edge, or Firefox.",
      });
    }
  }, [updateCheck]);

  return (
    <div className="page">
      <nav className="nav">
        <Link href="/" className="logo">
          <img src="/logo.svg" alt="" className="logo-icon" />Auti<em>Sense</em>
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={toggleTheme}
            className="btn btn-outline"
            style={{ minHeight: 40, padding: "8px 14px", fontSize: "0.88rem" }}
          >
            {theme === "light" ? "🌙" : "☀️"}
          </button>
          <span
            style={{
              fontSize: "0.88rem",
              color: "var(--text-muted)",
              fontWeight: 600,
            }}
          >
            Step 3 of 10
          </span>
        </div>
      </nav>

      <div className="progress-wrap">
        <div className="progress-steps">
          {STEPS.map((s, i) => (
            <div
              key={s}
              style={{
                display: "flex",
                alignItems: "center",
                flex: i < STEPS.length - 1 ? 1 : "none",
              }}
            >
              <div
                className={`step-dot ${i < 2 ? "done" : i === 2 ? "active" : "upcoming"}`}
                title={s}
              >
                {i < 2 ? "✓" : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`step-line ${i < 2 ? "done" : ""}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      <main className="main">
        <div
          className="fade fade-1"
          style={{ textAlign: "center", marginBottom: 28 }}
        >
          <div className="breathe-orb" style={{ margin: "0 auto" }}>
            <div className="breathe-inner">📱</div>
          </div>
        </div>

        <div className="chip fade fade-1">Step 3 — Device Check</div>
        <h1 className="page-title fade fade-2">
          Let's check <em>your device</em>
        </h1>
        <p className="subtitle fade fade-2">
          We need camera and microphone access to run the autism screening.
          Everything stays on your phone — nothing is recorded or uploaded.
        </p>

        {/* Check rows */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
            marginBottom: 28,
          }}
        >
          {checks.map((check) => (
            <div key={check.id} className={`check-row ${check.status}`}>
              <div className={`check-icon ${check.status}`}>
                {check.status === "idle" && iconMap[check.id]}
                {check.status === "checking" && ""}
                {check.status === "pass" && "✓"}
                {check.status === "fail" && "✕"}
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: "1rem",
                    color: "var(--text-primary)",
                  }}
                >
                  {check.label}
                </div>
                <div
                  style={{
                    fontSize: "0.88rem",
                    color:
                      check.status === "fail"
                        ? "var(--peach-300)"
                        : "var(--text-secondary)",
                    lineHeight: 1.55,
                  }}
                >
                  {check.errorMsg || check.description}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Status message */}
        {allPassed && (
          <div
            className="card"
            style={{
              padding: "20px 24px",
              marginBottom: 28,
              background: "var(--sage-50)",
              borderColor: "var(--sage-300)",
              textAlign: "center",
            }}
          >
            <p
              style={{
                fontWeight: 700,
                color: "var(--sage-600)",
                fontSize: "1rem",
              }}
            >
              All checks passed! Your device is ready for the screening.
            </p>
          </div>
        )}

        {anyFailed && !isChecking && (
          <div
            className="card"
            style={{
              padding: "20px 24px",
              marginBottom: 28,
              background: "var(--peach-100)",
              borderColor: "var(--peach-300)",
              textAlign: "center",
            }}
          >
            <p
              style={{
                fontWeight: 700,
                color: "var(--peach-300)",
                fontSize: "0.95rem",
                lineHeight: 1.6,
                marginBottom: 12,
              }}
            >
              Some checks failed. You can retry or continue with limited screening.
            </p>
            <button className="btn btn-secondary" onClick={runChecks}
              style={{ minHeight: 44, padding: "8px 24px", fontSize: "0.9rem" }}>
              Retry Checks
            </button>
          </div>
        )}

        {/* Navigation */}
        <div className="fade fade-4" style={{ display: "flex", gap: 12 }}>
          <Link
            href="/intake/child-profile"
            className="btn btn-outline"
            style={{ minWidth: 100 }}
          >
            ← Back
          </Link>
          {!started ? (
            <button className="btn btn-primary btn-full" onClick={runChecks}>
              Check My Device
            </button>
          ) : isChecking ? (
            <button className="btn btn-primary btn-full" disabled>
              Checking...
            </button>
          ) : (
            <button
              className="btn btn-primary btn-full"
              onClick={() => router.push("/intake/communication")}
            >
              Continue →
            </button>
          )}
        </div>

        <p
          style={{
            textAlign: "center",
            marginTop: 22,
            fontSize: "0.8rem",
            color: "var(--text-muted)",
            lineHeight: 1.6,
          }}
        >
          Camera and microphone access is required for the autism screening
          tasks.
          <br />
          No video or audio is ever stored, transmitted, or uploaded.
        </p>
      </main>
    </div>
  );
}
