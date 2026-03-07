"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Camera, Lock, BarChart3, Trash2 } from "lucide-react";

const STEPS = [
  "Welcome", "Profile", "Device", "Communicate", "Behavior",
  "Prepare", "Motor", "Video", "Summary", "Report",
];

export default function IntakeStartPage() {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

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

  const privacyPoints = [
    {
      icon: <Camera size={20} />,
      title: "Camera stays on your phone",
      body: "Used only during tasks. Never recorded or uploaded anywhere.",
    },
    {
      icon: <Lock size={20} />,
      title: "Raw data deleted immediately",
      body: "Video and audio are wiped the moment each task ends. Only numbers remain.",
    },
    {
      icon: <BarChart3 size={20} />,
      title: "Only scores are ever sent",
      body: "Anonymous numerical scores sync to our servers — no photos, no video, no personal details.",
    },
    {
      icon: <Trash2 size={20} />,
      title: "Delete everything, any time",
      body: "You can remove all your data from the Settings page at any time.",
    },
  ];

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
            aria-label="Toggle theme"
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
            Step 1 of 10
          </span>
        </div>
      </nav>

      {/* Step progress */}
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
                className={`step-dot ${i === 0 ? "active" : "upcoming"}`}
                title={s}
              >
                {i + 1}
              </div>
              {i < STEPS.length - 1 && <div className="step-line" />}
            </div>
          ))}
        </div>
      </div>

      <main className="main">
        {/* Breathing orb icon */}
        <div
          className="fade fade-1"
          style={{ textAlign: "center", marginBottom: 28 }}
        >
          <div className="breathe-orb" style={{ margin: "0 auto" }}>
            <div className="breathe-inner">👋</div>
          </div>
        </div>

        <div className="chip fade fade-1">Step 1 — Welcome</div>

        <h1 className="page-title fade fade-2">
          Welcome to <em>AutiSense</em>
        </h1>
        <p className="subtitle fade fade-2">
          This autism screening takes about <strong>15 minutes</strong>.<br />
          Everything runs on your phone — no internet connection needed.
        </p>

        {/* Privacy card */}
        <div
          className="card fade fade-3"
          style={{ padding: "28px 24px", marginBottom: 28 }}
        >
          <h2
            style={{
              fontFamily: "'Fredoka',sans-serif",
              fontWeight: 600,
              fontSize: "1.1rem",
              marginBottom: 22,
              color: "var(--text-primary)",
            }}
          >
            🔐 How we protect your child&apos;s privacy
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {privacyPoints.map((p) => (
              <div
                key={p.title}
                style={{ display: "flex", gap: 14, alignItems: "flex-start" }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "var(--r-md)",
                    background: "var(--sage-50)",
                    border: "1.5px solid var(--sage-200)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    color: "var(--sage-500)",
                  }}
                >
                  {p.icon}
                </div>
                <div>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: "0.95rem",
                      marginBottom: 3,
                    }}
                  >
                    {p.title}
                  </div>
                  <div
                    style={{
                      fontSize: "0.88rem",
                      color: "var(--text-secondary)",
                      lineHeight: 1.65,
                    }}
                  >
                    {p.body}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Consent */}
        <label
          className="fade fade-4"
          htmlFor="consent"
          style={{
            display: "flex",
            gap: 16,
            alignItems: "flex-start",
            cursor: "pointer",
            background: agreed ? "var(--sage-50)" : "var(--card)",
            border: `2.5px solid ${agreed ? "var(--sage-300)" : "var(--border)"}`,
            borderRadius: "var(--r-lg)",
            padding: "20px",
            marginBottom: 32,
            transition: "all 350ms var(--ease)",
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              flexShrink: 0,
              marginTop: 2,
              border: `2.5px solid ${agreed ? "var(--sage-500)" : "var(--sage-300)"}`,
              background: agreed ? "var(--sage-500)" : "transparent",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: "1rem",
              fontWeight: 700,
              transition: "all 350ms var(--ease)",
            }}
          >
            {agreed ? "✓" : ""}
          </div>
          <input
            id="consent"
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            style={{ position: "absolute", opacity: 0, pointerEvents: "none" }}
          />
          <p
            style={{
              fontSize: "0.95rem",
              color: "var(--text-secondary)",
              lineHeight: 1.7,
              fontWeight: 500,
            }}
          >
            I understand how AutiSense uses the camera and microphone during the
            autism screening, and I agree for it to be used for my child.
          </p>
        </label>

        {/* Navigation */}
        <div className="fade fade-5" style={{ display: "flex", gap: 12 }}>
          <Link href="/" className="btn btn-outline" style={{ minWidth: 100 }}>
            ← Back
          </Link>
          <button
            className="btn btn-primary btn-full"
            disabled={!agreed}
            onClick={() => router.push("/intake/child-profile")}
          >
            Continue →
          </button>
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
          AutiSense provides autism screening summaries and diagnosis support —
          not a confirmed diagnosis.
          <br />
          Always consult a qualified autism specialist or paediatrician.
        </p>
      </main>
    </div>
  );
}
