"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { aggregateBiomarkers } from "../../lib/db/biomarker.repository";
import { getSession, completeSession } from "../../lib/db/session.repository";
import { isOnline, flushSyncQueue } from "../../lib/sync/sync";
import type { BiomarkerAggregate } from "../../types/biomarker";
import type { Session } from "../../types/session";

const STEPS = [
  "Welcome", "Profile", "Device", "Communicate", "Behavior",
  "Prepare", "Motor", "Video", "Summary", "Report",
];

function scoreLabel(score: number): { label: string; color: string } {
  if (score >= 70) return { label: "In range", color: "var(--sage-500)" };
  if (score >= 45) return { label: "Some indicators", color: "#c48a30" };
  return { label: "Needs attention", color: "var(--peach-300)" };
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export default function SummaryPageWrapper() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center" }}>Loading summary...</div>}>
      <SummaryPage />
    </Suspense>
  );
}

function SummaryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId") || (typeof window !== "undefined" ? localStorage.getItem("autisense-current-session-id") : null);

  const [session, setSession] = useState<Session | null>(null);
  const [aggregate, setAggregate] = useState<BiomarkerAggregate | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<
    "idle" | "syncing" | "done" | "offline"
  >("idle");
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

  // Load data from IndexedDB
  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }

    async function load() {
      try {
        const sess = await getSession(sessionId!);
        const agg = await aggregateBiomarkers(sessionId!, sess?.ageMonths);

        // Mark session as completed if not already
        if (sess && sess.status === "in_progress") {
          await completeSession(sessionId!);
        }

        setSession(sess ?? null);
        setAggregate(agg);
      } catch (err) {
        console.error("[Summary] Failed to load from IndexedDB:", err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [sessionId]);

  // Try to sync when online (only if user consented at Stage 10)
  const triggerSync = useCallback(async () => {
    let consent = true;
    try {
      consent = localStorage.getItem("autisense-sync-consent") !== "no";
    } catch { /* default to yes */ }

    if (!consent) {
      setSyncStatus("idle");
      return;
    }
    if (!isOnline()) {
      setSyncStatus("offline");
      return;
    }
    setSyncStatus("syncing");
    await flushSyncQueue();
    setSyncStatus("done");
  }, []);

  useEffect(() => {
    if (!loading && session) triggerSync();
  }, [loading, session, triggerSync]);

  if (loading) {
    return (
      <div
        className="page"
        style={{ alignItems: "center", justifyContent: "center" }}
      >
        <div className="breathe-orb">
          <div className="breathe-inner">📊</div>
        </div>
        <p
          style={{
            marginTop: 24,
            color: "var(--text-secondary)",
            fontWeight: 600,
          }}
        >
          Loading your results…
        </p>
      </div>
    );
  }

  if (!session) {
    return (
      <div
        className="page"
        style={{
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 24px",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "3rem", marginBottom: 20 }}>🔍</div>
        <h1 className="page-title">Session not found</h1>
        <p className="subtitle" style={{ marginBottom: 32 }}>
          We could not find a session with that ID in your local data.
        </p>
        <Link href="/" className="btn btn-primary">
          Back to Home
        </Link>
      </div>
    );
  }

  const overall = aggregate?.overallScore ?? 0;
  const { label: overallLabel, color: overallColor } = scoreLabel(overall);

  return (
    <div className="page">
      <nav className="nav">
        <Link href="/" className="logo">
          Auti<em>Sense</em>
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
            Step 11 of 10
          </span>
        </div>
      </nav>

      {/* Progress dots */}
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
                className={`step-dot ${i < 10 ? "done" : i === 10 ? "active" : "upcoming"}`}
                title={s}
              >
                {i < 10 ? "✓" : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`step-line ${i < 10 ? "done" : ""}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      <main className="main">
        {/* Sync status banner */}
        {syncStatus !== "idle" && (
          <div
            className="fade fade-1"
            style={{
              padding: "12px 18px",
              borderRadius: "var(--r-md)",
              marginBottom: 24,
              background:
                syncStatus === "done"
                  ? "var(--sage-50)"
                  : syncStatus === "offline"
                    ? "var(--sky-100)"
                    : "var(--sand-100)",
              border: `2px solid ${
                syncStatus === "done"
                  ? "var(--sage-300)"
                  : syncStatus === "offline"
                    ? "var(--sky-300)"
                    : "var(--sage-200)"
              }`,
              fontSize: "0.88rem",
              color: "var(--text-secondary)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {syncStatus === "syncing" && (
              <>
                <span style={{ fontSize: "1rem" }}>⏳</span> Syncing to cloud…
              </>
            )}
            {syncStatus === "done" && (
              <>
                <span style={{ fontSize: "1rem" }}>☁️</span> Results saved to
                cloud
              </>
            )}
            {syncStatus === "offline" && (
              <>
                <span style={{ fontSize: "1rem" }}>📴</span> Offline — results
                saved locally, will sync when reconnected
              </>
            )}
          </div>
        )}

        <div className="chip fade fade-1">Step 11 — Your Results</div>
        <h1 className="page-title fade fade-2">
          {session.childName}&apos;s <em>screening summary</em>
        </h1>
        <p className="subtitle fade fade-2" style={{ marginBottom: 32 }}>
          This is a screening summary based on {aggregate?.sampleCount ?? 0}{" "}
          observations across the autism indicator tasks. It is not a diagnosis.
        </p>

        {/* Overall score card */}
        <div
          className="card fade fade-3"
          style={{
            padding: "32px 28px",
            marginBottom: 24,
            textAlign: "center",
          }}
        >
          {/* Circular score display */}
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: "50%",
              margin: "0 auto 20px",
              background: `conic-gradient(${overallColor} ${overall}%, var(--sage-100) 0%)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 0 0 8px var(--bg)`,
              position: "relative",
            }}
          >
            <div
              style={{
                width: 88,
                height: 88,
                borderRadius: "50%",
                background: "var(--card)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span
                style={{
                  fontFamily: "'Fredoka',sans-serif",
                  fontWeight: 700,
                  fontSize: "1.8rem",
                  color: overallColor,
                  lineHeight: 1,
                }}
              >
                {overall}
              </span>
              <span
                style={{
                  fontSize: "0.7rem",
                  color: "var(--text-muted)",
                  fontWeight: 700,
                }}
              >
                / 100
              </span>
            </div>
          </div>

          <div
            style={{
              fontFamily: "'Fredoka',sans-serif",
              fontWeight: 600,
              fontSize: "1.2rem",
              color: overallColor,
              marginBottom: 8,
            }}
          >
            {overallLabel}
          </div>
          <p
            style={{
              fontSize: "0.88rem",
              color: "var(--text-secondary)",
              lineHeight: 1.65,
              maxWidth: 360,
              margin: "0 auto",
            }}
          >
            {overall >= 70
              ? "Scores are within typical range across the observed indicators."
              : overall >= 45
                ? "Some indicators suggest areas that may benefit from specialist attention."
                : "Several indicators suggest this child may benefit from a formal autism assessment."}
          </p>
        </div>

        {/* Per-domain scores */}
        {aggregate ? (
          <div
            className="fade fade-4"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              marginBottom: 28,
            }}
          >
            <h2
              style={{
                fontFamily: "'Fredoka',sans-serif",
                fontWeight: 600,
                fontSize: "1.05rem",
                color: "var(--text-secondary)",
                marginBottom: 4,
              }}
            >
              Indicator breakdown
            </h2>

            {[
              {
                label: "Social gaze",
                value: aggregate.avgGazeScore,
                icon: "👁️",
                domain: "Social Communication",
              },
              {
                label: "Motor coordination",
                value: aggregate.avgMotorScore,
                icon: "🖐️",
                domain: "Motor & Repetitive Behaviour",
              },
              {
                label: "Vocalization",
                value: aggregate.avgVocalizationScore,
                icon: "🎙️",
                domain: "Communication Response",
              },
            ].map((item) => {
              const pctVal = item.value * 100;
              const barColor =
                pctVal >= 55
                  ? "var(--sage-400)"
                  : pctVal >= 35
                    ? "#c48a30"
                    : "var(--peach-300)";
              return (
                <div
                  key={item.label}
                  className="card"
                  style={{ padding: "18px 22px" }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: 12,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 2,
                        }}
                      >
                        <span style={{ fontSize: "1.2rem" }}>{item.icon}</span>
                        <span style={{ fontWeight: 700, fontSize: "0.97rem" }}>
                          {item.label}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: "0.78rem",
                          color: "var(--text-muted)",
                        }}
                      >
                        {item.domain}
                      </div>
                    </div>
                    <span
                      style={{
                        fontFamily: "'Fredoka',sans-serif",
                        fontWeight: 700,
                        fontSize: "1.3rem",
                        color: barColor,
                      }}
                    >
                      {pct(item.value)}
                    </span>
                  </div>
                  {/* Score bar */}
                  <div
                    style={{
                      height: 8,
                      background: "var(--sage-100)",
                      borderRadius: "var(--r-full)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${pctVal}%`,
                        background: barColor,
                        borderRadius: "var(--r-full)",
                        transition: "width 800ms var(--ease)",
                      }}
                    />
                  </div>
                </div>
              );
            })}

            {/* DSM-5 domain flags */}
            {(aggregate.flags.socialCommunication ||
              aggregate.flags.restrictedBehavior) && (
              <div
                style={{
                  padding: "16px 20px",
                  background: "var(--peach-100)",
                  border: "2px solid var(--peach-300)",
                  borderRadius: "var(--r-lg)",
                  marginTop: 4,
                }}
              >
                <p
                  style={{
                    fontWeight: 700,
                    fontSize: "0.9rem",
                    marginBottom: 8,
                  }}
                >
                  ⚠️ Areas flagged for specialist review
                </p>
                <ul
                  style={{
                    paddingLeft: 20,
                    fontSize: "0.85rem",
                    color: "var(--text-secondary)",
                    lineHeight: 1.8,
                  }}
                >
                  {aggregate.flags.socialCommunication && (
                    <li>
                      Social Communication & Interaction (DSM-5 Criterion A)
                    </li>
                  )}
                  {aggregate.flags.restrictedBehavior && (
                    <li>
                      Restricted & Repetitive Behaviours (DSM-5 Criterion B)
                    </li>
                  )}
                </ul>
              </div>
            )}

            {/* Response latency */}
            {aggregate.avgResponseLatencyMs !== null && (
              <div
                className="card"
                style={{
                  padding: "16px 20px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>
                    ⏱ Average response time
                  </div>
                  <div
                    style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}
                  >
                    Stimulus-to-response latency
                  </div>
                </div>
                <span
                  style={{
                    fontFamily: "'Fredoka',sans-serif",
                    fontWeight: 700,
                    fontSize: "1.2rem",
                    color: "var(--sage-500)",
                  }}
                >
                  {aggregate.avgResponseLatencyMs}ms
                </span>
              </div>
            )}

            {/* AI Video Analysis (Stage 10 detector data) */}
            {aggregate.avgAsdRisk != null && (
              <div className="card" style={{ padding: "20px 22px", background: "var(--sage-50)", borderColor: "var(--sage-300)" }}>
                <h2 style={{ fontFamily: "'Fredoka',sans-serif", fontWeight: 600, fontSize: "1.05rem", marginBottom: 14 }}>
                  📹 AI Video Analysis
                </h2>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
                  <div style={{ textAlign: "center", flex: "1 1 80px" }}>
                    <div style={{ fontSize: "1.4rem", fontWeight: 700, fontFamily: "'Fredoka',sans-serif", color: aggregate.avgAsdRisk >= 0.7 ? "var(--peach-300)" : aggregate.avgAsdRisk >= 0.4 ? "#c48a30" : "var(--sage-500)" }}>
                      {Math.round(aggregate.avgAsdRisk * 100)}%
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>ASD Risk</div>
                  </div>
                  {aggregate.dominantBodyBehavior && (
                    <div style={{ textAlign: "center", flex: "1 1 100px" }}>
                      <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-primary)" }}>
                        {aggregate.dominantBodyBehavior.replace(/_/g, " ")}
                      </div>
                      <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Body behavior</div>
                    </div>
                  )}
                  {aggregate.dominantFaceBehavior && (
                    <div style={{ textAlign: "center", flex: "1 1 100px" }}>
                      <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-primary)" }}>
                        {aggregate.dominantFaceBehavior.replace(/_/g, " ")}
                      </div>
                      <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Face behavior</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div
            className="card fade fade-4"
            style={{ padding: "28px", textAlign: "center", marginBottom: 28 }}
          >
            <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>
              No task data was recorded for this session yet.
              <br />
              Complete the screening tasks to see your results here.
            </p>
          </div>
        )}

        {/* Actions */}
        <div
          className="fade fade-5"
          style={{ display: "flex", gap: 12, flexWrap: "wrap" }}
        >
          <button
            className="btn btn-primary btn-full"
            onClick={() => router.push(`/intake/report?sessionId=${sessionId}`)}
          >
            Generate Clinical Report →
          </button>
          <Link href="/" className="btn btn-outline btn-full">
            Back to Home
          </Link>
        </div>

        <p
          style={{
            textAlign: "center",
            marginTop: 20,
            fontSize: "0.8rem",
            color: "var(--text-muted)",
            lineHeight: 1.6,
          }}
        >
          This is a screening summary only, not a clinical diagnosis.
          <br />
          Please share this with a qualified autism specialist.
        </p>
      </main>
    </div>
  );
}
