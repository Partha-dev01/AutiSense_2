/**
 * ENDPOINT: /
 * Landing page — public-facing marketing + entry point
 * Routes to: /intake/profile (start of screening flow)
 * Auth-aware: shows login/dashboard when applicable
 */
"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useAuth } from "./hooks/useAuth";

export default function LandingPage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const { user, loading, isAuthenticated, logout } = useAuth();

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const features = [
    {
      emoji: "\u{1F9E0}",
      color: "var(--feature-green)",
      title: "Runs on your phone",
      body: "No video or audio ever leaves your device. All processing happens right here, privately.",
    },
    {
      emoji: "\u{1F4F6}",
      color: "var(--feature-blue)",
      title: "Works without internet",
      body: "Complete the full autism screening offline. Results sync automatically when you reconnect.",
    },
    {
      emoji: "\u{1F4CB}",
      color: "var(--feature-peach)",
      title: "A report for your doctor",
      body: "We create a clear clinical summary mapped to DSM-5 criteria \u2014 ready to hand to any specialist.",
    },
    {
      emoji: "\u{1F3AE}",
      color: "var(--feature-lavender)",
      title: "Post-diagnosis care games",
      body: "Daily adaptive activities that support your child after diagnosis \u2014 adjusting to their pace.",
    },
  ];

  const steps = [
    {
      n: "1",
      label: "Create a profile",
      desc: "Your child's name, age, and background",
    },
    {
      n: "2",
      label: "Check your device",
      desc: "Allow camera and microphone \u2014 stays private",
    },
    {
      n: "3",
      label: "Run the screening",
      desc: "5 autism-focused tasks, about 15 minutes",
    },
    {
      n: "4",
      label: "Get your report",
      desc: "A DSM-5 aligned summary for your specialist",
    },
  ];

  const pillars = [
    { icon: "\u{1F50D}", label: "Early Screening" },
    { icon: "\u{1FA7A}", label: "Diagnosis Support" },
    { icon: "\u{1F49A}", label: "Post-Diagnosis Care" },
  ];

  return (
    <div className="page">
      {/* Nav */}
      <nav className="nav">
        <span className="logo">
          Auti<em>Sense</em>
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
            className="btn btn-outline"
            style={{
              minHeight: 40,
              padding: "8px 14px",
              fontSize: "0.88rem",
            }}
            aria-label="Toggle theme"
          >
            {theme === "light" ? "\u{1F319}" : "\u{2600}\u{FE0F}"}
          </button>

          {!loading && isAuthenticated ? (
            <>
              <Link
                href="/dashboard"
                className="btn btn-outline"
                style={{ minHeight: 40, padding: "8px 16px", fontSize: "0.88rem" }}
              >
                Dashboard
              </Link>
              <div className="user-chip">
                <div className="avatar">
                  {user?.name?.charAt(0)?.toUpperCase() || "U"}
                </div>
                <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)" }}>
                  {user?.name?.split(" ")[0] || "User"}
                </span>
              </div>
              <button
                onClick={() => logout()}
                className="btn btn-outline"
                style={{ minHeight: 40, padding: "8px 14px", fontSize: "0.85rem", color: "var(--text-muted)" }}
              >
                Sign Out
              </button>
            </>
          ) : !loading ? (
            <>
              <Link
                href="/auth/login"
                className="btn btn-outline"
                style={{ minHeight: 40, padding: "8px 18px", fontSize: "0.88rem" }}
              >
                Sign In
              </Link>
              <Link
                href="/intake/profile"
                className="btn btn-primary"
                style={{ minHeight: 44, padding: "10px 20px", fontSize: "0.92rem" }}
              >
                Start &rarr;
              </Link>
            </>
          ) : (
            <Link
              href="/intake/profile"
              className="btn btn-primary"
              style={{ minHeight: 44, padding: "10px 20px", fontSize: "0.92rem" }}
            >
              Start &rarr;
            </Link>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section
        style={{
          padding: "64px 28px 56px",
          textAlign: "center",
          maxWidth: 660,
          margin: "0 auto",
          width: "100%",
        }}
      >
        <div className="breathe-orb" style={{ margin: "0 auto 32px" }}>
          <div className="breathe-inner">{"\u{1F9E9}"}</div>
        </div>

        {/* Three-pillar chips */}
        <div
          className="fade fade-1"
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "center",
            flexWrap: "wrap",
            marginBottom: 28,
          }}
        >
          {pillars.map((p) => (
            <span key={p.label} className="chip" style={{ marginBottom: 0 }}>
              {p.icon} {p.label}
            </span>
          ))}
        </div>

        <h1
          className="page-title fade fade-2"
          style={{ fontSize: "clamp(2rem,6vw,3rem)", marginBottom: 16 }}
        >
          Computer-assisted autism screening,
          <br />
          <em>wherever you are</em>
        </h1>

        <p
          className="subtitle fade fade-3"
          style={{ maxWidth: 500, margin: "0 auto 40px" }}
        >
          AutiSense gives every family access to early autism screening,
          clinical diagnosis support, and post-diagnosis care &mdash; all from a
          smartphone, no clinic visit required.
        </p>

        {/* Auth-aware CTAs */}
        <div
          className="fade fade-4"
          style={{
            display: "flex",
            gap: 12,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          {isAuthenticated ? (
            <>
              <Link
                href="/dashboard"
                className="btn btn-primary btn-full"
                style={{ maxWidth: 300 }}
              >
                Go to Dashboard &rarr;
              </Link>
              <Link
                href="/intake/profile"
                className="btn btn-outline"
                style={{ maxWidth: 260, minHeight: 48 }}
              >
                Start New Screening
              </Link>
            </>
          ) : (
            <Link
              href="/intake/profile"
              className="btn btn-primary btn-full"
              style={{ maxWidth: 340 }}
            >
              Begin Free Autism Screening &rarr;
            </Link>
          )}
        </div>

        <p
          className="fade fade-5"
          style={{
            marginTop: 20,
            fontSize: "0.85rem",
            color: "var(--text-muted)",
            lineHeight: 1.6,
          }}
        >
          {isAuthenticated
            ? "Sign in to save progress, access therapy games, and join the community."
            : "Takes about 15 minutes \u00A0\u00B7\u00A0 Works offline \u00A0\u00B7\u00A0 No account needed"}
        </p>

        {!isAuthenticated && (
          <p
            className="fade fade-5"
            style={{
              marginTop: 8,
              fontSize: "0.82rem",
              color: "var(--text-muted)",
            }}
          >
            <Link
              href="/auth/login"
              style={{ color: "var(--sage-500)", fontWeight: 600, textDecoration: "underline" }}
            >
              Sign in
            </Link>{" "}
            to save progress and access therapy games
          </p>
        )}
      </section>

      {/* Quick Actions — only for authenticated users */}
      {isAuthenticated && (
        <section
          style={{
            padding: "0 28px 40px",
            maxWidth: 700,
            margin: "0 auto",
            width: "100%",
          }}
        >
          <h2
            style={{
              fontFamily: "'Fredoka',sans-serif",
              fontWeight: 600,
              fontSize: "1.3rem",
              textAlign: "center",
              marginBottom: 20,
              color: "var(--text-primary)",
            }}
          >
            Your Platform
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
              gap: 14,
            }}
          >
            <Link href="/dashboard" className="card" style={{ padding: "22px 18px", textDecoration: "none", textAlign: "center" }}>
              <div style={{ fontSize: "1.8rem", marginBottom: 10 }}>{"\u{1F4CA}"}</div>
              <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: 4 }}>Dashboard</div>
              <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>View your screenings</div>
            </Link>
            <Link href="/kid-dashboard" className="card" style={{ padding: "22px 18px", textDecoration: "none", textAlign: "center" }}>
              <div style={{ fontSize: "1.8rem", marginBottom: 10 }}>{"\u{1F476}"}</div>
              <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: 4 }}>Kids Dashboard</div>
              <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>Games, chat & progress</div>
            </Link>
            <Link href="/games" className="card" style={{ padding: "22px 18px", textDecoration: "none", textAlign: "center" }}>
              <div style={{ fontSize: "1.8rem", marginBottom: 10 }}>{"\u{1F3AE}"}</div>
              <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: 4 }}>Therapy Games</div>
              <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>7 adaptive games</div>
            </Link>
            <Link href="/feed" className="card" style={{ padding: "22px 18px", textDecoration: "none", textAlign: "center" }}>
              <div style={{ fontSize: "1.8rem", marginBottom: 10 }}>{"\u{1F4AC}"}</div>
              <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: 4 }}>Community Feed</div>
              <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>Share & connect</div>
            </Link>
          </div>
        </section>
      )}

      {/* Three pillars section */}
      <section
        style={{
          background: "var(--card)",
          borderTop: "2px solid var(--border)",
          borderBottom: "2px solid var(--border)",
          padding: "52px 28px",
        }}
      >
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          <h2
            style={{
              fontFamily: "'Fredoka',sans-serif",
              fontWeight: 600,
              fontSize: "clamp(1.4rem,4vw,1.9rem)",
              textAlign: "center",
              marginBottom: 36,
              color: "var(--text-primary)",
            }}
          >
            Three stages. One platform.
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
              gap: 16,
            }}
          >
            {[
              {
                icon: "\u{1F50D}",
                title: "Early Screening",
                desc: "Computer-assisted observation of gaze, motor patterns, and vocalisations to flag early autism indicators \u2014 before a formal assessment.",
              },
              {
                icon: "\u{1FA7A}",
                title: "Diagnosis Support",
                desc: "DSM-5 aligned clinical reports your specialist can use. Reduces the gap between concern and confirmed diagnosis.",
              },
              {
                icon: "\u{1F49A}",
                title: "Post-Diagnosis Care",
                desc: "Adaptive therapy games and monthly re-evaluations that support your child long after the diagnosis is received.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="card"
                style={{ padding: "28px 22px" }}
              >
                <div style={{ fontSize: "2rem", marginBottom: 14 }}>
                  {item.icon}
                </div>
                <h3
                  style={{
                    fontFamily: "'Fredoka',sans-serif",
                    fontWeight: 600,
                    fontSize: "1.05rem",
                    marginBottom: 10,
                  }}
                >
                  {item.title}
                </h3>
                <p
                  style={{
                    fontSize: "0.88rem",
                    color: "var(--text-secondary)",
                    lineHeight: 1.7,
                  }}
                >
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section
        style={{
          padding: "56px 28px",
          maxWidth: 600,
          margin: "0 auto",
          width: "100%",
        }}
      >
        <h2
          style={{
            fontFamily: "'Fredoka',sans-serif",
            fontWeight: 600,
            fontSize: "clamp(1.4rem,4vw,1.9rem)",
            textAlign: "center",
            marginBottom: 40,
            color: "var(--text-primary)",
          }}
        >
          How the screening works
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {steps.map((s, i) => (
            <div
              key={i}
              style={{ display: "flex", alignItems: "center", gap: 20 }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: "50%",
                  background: "var(--sage-500)",
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "'Fredoka',sans-serif",
                  fontWeight: 700,
                  fontSize: "1.2rem",
                  flexShrink: 0,
                }}
              >
                {s.n}
              </div>
              <div>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: "1rem",
                    color: "var(--text-primary)",
                  }}
                >
                  {s.label}
                </div>
                <div
                  style={{
                    fontSize: "0.88rem",
                    color: "var(--text-secondary)",
                  }}
                >
                  {s.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section
        style={{
          background: "var(--card)",
          borderTop: "2px solid var(--border)",
          borderBottom: "2px solid var(--border)",
          padding: "56px 28px",
        }}
      >
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <h2
            style={{
              fontFamily: "'Fredoka',sans-serif",
              fontWeight: 600,
              fontSize: "clamp(1.4rem,4vw,1.9rem)",
              textAlign: "center",
              marginBottom: 36,
              color: "var(--text-primary)",
            }}
          >
            Built to be safe and accessible
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
              gap: 16,
            }}
          >
            {features.map((f) => (
              <div
                key={f.title}
                className="card"
                style={{ padding: "26px 22px" }}
              >
                <div
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: "var(--r-md)",
                    background: f.color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1.6rem",
                    marginBottom: 16,
                  }}
                >
                  {f.emoji}
                </div>
                <h3
                  style={{ fontWeight: 700, fontSize: "1rem", marginBottom: 8 }}
                >
                  {f.title}
                </h3>
                <p
                  style={{
                    fontSize: "0.9rem",
                    color: "var(--text-secondary)",
                    lineHeight: 1.65,
                  }}
                >
                  {f.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section
        style={{
          padding: "56px 28px 64px",
          maxWidth: 620,
          margin: "0 auto",
          width: "100%",
          textAlign: "center",
        }}
      >
        <div
          style={{
            background:
              "linear-gradient(135deg, var(--sage-600), var(--sage-500))",
            borderRadius: "var(--r-xl)",
            padding: "48px 36px",
            boxShadow: "0 16px 48px rgba(58,99,68,0.25)",
          }}
        >
          <div style={{ fontSize: "2.5rem", marginBottom: 16 }}>{"\u{1F9E9}"}</div>
          <h2
            style={{
              fontFamily: "'Fredoka',sans-serif",
              fontWeight: 600,
              fontSize: "1.7rem",
              color: "white",
              marginBottom: 14,
            }}
          >
            Early detection changes everything
          </h2>
          <p
            style={{
              color: "rgba(255,255,255,0.82)",
              marginBottom: 28,
              lineHeight: 1.7,
            }}
          >
            AutiSense gives families in remote areas the same autism screening
            quality as a specialist clinic &mdash; for free.
          </p>
          <Link
            href="/intake/profile"
            className="btn"
            style={{
              background: "white",
              color: "var(--sage-600)",
              fontFamily: "'Fredoka',sans-serif",
              fontSize: "1.1rem",
            }}
          >
            Start the Autism Screening &rarr;
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          borderTop: "2px solid var(--border)",
          padding: "24px 28px",
          textAlign: "center",
        }}
      >
        <span
          className="logo"
          style={{ fontSize: "1.2rem", display: "block", marginBottom: 8 }}
        >
          Auti<em>Sense</em>
        </span>

        {/* Footer navigation links */}
        <div className="footer-links" style={{ marginBottom: 12 }}>
          <Link href="/">Home</Link>
          <span>{"\u00B7"}</span>
          <Link href="/dashboard">Dashboard</Link>
          <span>{"\u00B7"}</span>
          <Link href="/games">Games</Link>
          <span>{"\u00B7"}</span>
          <Link href="/feed">Feed</Link>
          <span>{"\u00B7"}</span>
          {isAuthenticated ? (
            <button
              onClick={() => logout()}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-muted)",
                fontSize: "0.82rem",
                cursor: "pointer",
                padding: 0,
                fontFamily: "inherit",
              }}
            >
              Sign Out
            </button>
          ) : (
            <Link href="/auth/login">Sign In</Link>
          )}
        </div>

        <p
          style={{
            fontSize: "0.8rem",
            color: "var(--text-muted)",
            lineHeight: 1.6,
          }}
        >
          AutiSense provides autism screening summaries and diagnosis support &mdash;
          not a confirmed diagnosis.
          <br />
          Always consult a qualified autism specialist or paediatrician.
        </p>
      </footer>
    </div>
  );
}
