"use client";
import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { aggregateBiomarkers } from "../../lib/db/biomarker.repository";
import { getSession } from "../../lib/db/session.repository";
import type { BiomarkerAggregate } from "../../types/biomarker";
import type { Session } from "../../types/session";
import { useTheme } from "../../hooks/useTheme";

const STEPS = [
  "Welcome", "Profile", "Device", "Communicate", "Behavior",
  "Prepare", "Motor", "Video", "Summary", "Report",
];
const STEP_IDX = 9;

type ReportType = "summary" | "clinical";

interface ClinicalSections {
  criterionA: string;
  criterionB: string;
  motor: string;
  recommendations: string;
}

export default function ReportPageWrapper() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center" }}>Loading report...</div>}>
      <ReportPage />
    </Suspense>
  );
}

function ReportPage() {
  const { theme, toggle: toggleTheme } = useTheme();
  const searchParams = useSearchParams();
  const paramSessionId = searchParams.get("sessionId");

  const [generating, setGenerating] = useState(false);
  const [reportReady, setReportReady] = useState(false);
  const [reportType, setReportType] = useState<ReportType>("summary");
  const [reportText, setReportText] = useState("");
  const [sections, setSections] = useState<ClinicalSections | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [aiEnriched, setAiEnriched] = useState<boolean | null>(null);
  const [usingFallbackBio, setUsingFallbackBio] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(paramSessionId);
  const [session, setSession] = useState<Session | null>(null);
  const [biomarkers, setBiomarkers] = useState<BiomarkerAggregate | null>(null);

  // Resolve sessionId from URL params or localStorage fallback
  useEffect(() => {

    if (!paramSessionId) {
      try {
        const fallback = localStorage.getItem("autisense_current_session_id");
        if (fallback) setSessionId(fallback);
      } catch {
        // localStorage not available
      }
    }
  }, [paramSessionId]);

  // Load session and biomarkers from IndexedDB
  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;

    async function loadData() {
      try {
        const sess = await getSession(sessionId!);
        if (cancelled) return;
        if (sess) setSession(sess);
        const agg = await aggregateBiomarkers(sessionId!, sess?.ageMonths);
        if (cancelled) return;
        if (agg) setBiomarkers(agg);
      } catch (err) {
        console.error("[Report] Failed to load session data:", err);
      }
    }

    loadData();
    return () => { cancelled = true; };
  }, [sessionId]);

  const generateReport = useCallback(async (type: ReportType) => {
    setReportType(type);
    setGenerating(true);
    setErrorMsg(null);
    setReportReady(false);
    setReportText("");
    setSections(null);
    setAiEnriched(null);

    try {
      // Build a fallback biomarker object if none loaded from DB
      const isFallback = !biomarkers;
      setUsingFallbackBio(isFallback);
      const bio: BiomarkerAggregate = biomarkers ?? {
        sessionId: sessionId ?? "unknown",
        avgGazeScore: 0.5,
        avgMotorScore: 0.5,
        avgVocalizationScore: 0.5,
        avgResponseLatencyMs: null,
        sampleCount: 0,
        overallScore: 50,
        flags: { socialCommunication: false, restrictedBehavior: false },
      };

      if (type === "summary") {
        const res = await fetch("/api/report/summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: sessionId ?? "unknown", biomarkers: bio }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error ?? `Server error (${res.status})`);
        }

        const data = await res.json();
        setReportText(data.summary);
        setAiEnriched(data.fallback === false);
        setReportReady(true);
      } else {
        const res = await fetch("/api/report/clinical", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: sessionId ?? "unknown",
            biomarkers: bio,
            childAge: session?.ageMonths,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error ?? `Server error (${res.status})`);
        }

        const data = await res.json();
        setReportText(data.report);
        setSections(data.sections ?? null);
        setAiEnriched(data.aiEnriched === true);
        setReportReady(true);
      }
    } catch (err) {
      console.error("[Report] Generation failed:", err);
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while generating the report.",
      );
    } finally {
      setGenerating(false);
    }
  }, [biomarkers, sessionId, session]);

  const downloadPdf = useCallback(async () => {
    if (!reportText) return;
    setDownloading(true);
    setErrorMsg(null);

    try {
      const sessionDate = session?.createdAt
        ? new Date(session.createdAt).toLocaleDateString("en-GB")
        : new Date().toLocaleDateString("en-GB");

      const scores = {
        gaze: biomarkers?.avgGazeScore ?? 0.5,
        motor: biomarkers?.avgMotorScore ?? 0.5,
        vocal: biomarkers?.avgVocalizationScore ?? 0.5,
        overall: biomarkers?.overallScore ?? 50,
      };

      const res = await fetch("/api/report/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          report: reportText,
          childName: session?.childName ?? "Child",
          sessionDate,
          scores,
          childAge: session?.ageMonths,
          assessmentDuration: session?.completedAt && session?.createdAt
            ? Math.round((new Date(session.completedAt).getTime() - new Date(session.createdAt).getTime()) / 60000)
            : undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error ?? `PDF generation failed (${res.status})`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `AutiSense_Report_${sessionDate.replace(/\//g, "-")}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[Report] PDF download failed:", err);
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Failed to download the PDF report.",
      );
    } finally {
      setDownloading(false);
    }
  }, [reportText, session, biomarkers]);

  return (
    <div className="page">
      <nav className="nav">
        <Link href="/" className="logo"><img src="/logo.jpeg" alt="" className="logo-icon" /><span>Auti<em>Sense</em></span></Link>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={toggleTheme} className="btn btn-outline" style={{ minHeight: 40, padding: "8px 14px", fontSize: "0.88rem" }}>
            {theme === "light" ? "\u{1F319}" : "\u{2600}\u{FE0F}"}
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
                {i < STEP_IDX ? "\u2713" : i + 1}
              </div>
              {i < STEPS.length - 1 && <div className={`step-line ${i < STEP_IDX ? "done" : ""}`} />}
            </div>
          ))}
        </div>
      </div>

      <main className="main">
        <div className="fade fade-1" style={{ textAlign: "center", marginBottom: 28 }}>
          <div className="breathe-orb" style={{ margin: "0 auto" }}>
            <div className="breathe-inner">{reportReady ? "\u2705" : "\u{1F4C4}"}</div>
          </div>
        </div>

        <div className="chip fade fade-1">Step 10 -- Clinical Report</div>
        <h1 className="page-title fade fade-2">
          Your <em>clinical report</em>
        </h1>
        <p className="subtitle fade fade-2">
          We generate a DSM-5 aligned clinical summary based on your
          child&apos;s screening data. This report is designed to be shared with a
          paediatrician or autism specialist.
        </p>

        {/* Error display */}
        {errorMsg && (
          <div className="card fade fade-3" style={{
            padding: "16px 20px", marginBottom: 16,
            borderColor: "var(--peach-300)", background: "var(--peach-100)",
          }}>
            <p style={{ color: "var(--peach-300)", fontSize: "0.9rem", fontWeight: 600, margin: 0 }}>
              {errorMsg}
            </p>
          </div>
        )}

        {!reportReady ? (
          <div className="card fade fade-3" style={{ padding: "36px 28px", textAlign: "center" }}>
            <div style={{ fontSize: "3rem", marginBottom: 16 }}>{"\u{1FA7A}"}</div>
            <h2 style={{ fontFamily: "'Fredoka',sans-serif", fontWeight: 600, fontSize: "1.2rem", marginBottom: 14 }}>
              Generate your clinical report
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", lineHeight: 1.7, marginBottom: 24, maxWidth: 400, margin: "0 auto 24px" }}>
              The report maps your child&apos;s screening results to DSM-5 diagnostic criteria
              (Social Communication & Interaction, Restricted & Repetitive Behaviours).
              It includes actionable recommendations for your specialist.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
              {/* Quick Summary option */}
              <button
                onClick={() => !generating && generateReport("summary")}
                disabled={generating}
                className="card"
                style={{
                  padding: "16px 20px", width: "100%", maxWidth: 380, textAlign: "left",
                  cursor: generating ? "not-allowed" : "pointer", border: reportType === "summary" && generating ? "2.5px solid var(--sage-400)" : undefined,
                  background: reportType === "summary" && generating ? "var(--sage-50)" : undefined,
                }}
              >
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: "var(--r-md)",
                    background: "var(--sage-50)", border: "1.5px solid var(--sage-200)",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem",
                  }}>{"\u{1F4CA}"}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>Quick Summary</div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      Behavioral Analysis &middot; Quick Summary
                    </div>
                  </div>
                </div>
              </button>

              {/* Full Clinical Report option */}
              <button
                onClick={() => !generating && generateReport("clinical")}
                disabled={generating}
                className="card"
                style={{
                  padding: "16px 20px", width: "100%", maxWidth: 380, textAlign: "left",
                  cursor: generating ? "not-allowed" : "pointer", border: reportType === "clinical" && generating ? "2.5px solid var(--sage-400)" : undefined,
                  background: reportType === "clinical" && generating ? "var(--sage-50)" : undefined,
                }}
              >
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: "var(--r-md)",
                    background: "var(--sage-50)", border: "1.5px solid var(--sage-200)",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem",
                  }}>{"\u{1F4CB}"}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>Full Clinical Report</div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      DSM-5 Aligned &middot; Full Clinical Report
                    </div>
                  </div>
                </div>
              </button>
            </div>

            {generating && (
              <div style={{ marginTop: 24 }}>
                <div style={{
                  height: 4, background: "var(--sage-100)", borderRadius: 2,
                  overflow: "hidden", maxWidth: 300, margin: "0 auto",
                }}>
                  <div style={{
                    height: "100%", width: "60%", background: "var(--sage-500)",
                    borderRadius: 2, animation: "fadeUp 2s ease-in-out infinite",
                  }} />
                </div>
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: 10 }}>
                  {reportType === "summary"
                    ? "Generating parent-friendly summary..."
                    : "Analyzing screening data and generating DSM-5 mappings..."}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="fade fade-3">
            {/* Success header */}
            <div className="card" style={{
              padding: "32px 28px", textAlign: "center",
              background: "var(--sage-50)", borderColor: "var(--sage-300)", marginBottom: 20,
            }}>
              <div style={{ fontSize: "2.5rem", marginBottom: 14 }}>{"\u2705"}</div>
              <h2 style={{ fontFamily: "'Fredoka',sans-serif", fontWeight: 600, fontSize: "1.3rem", marginBottom: 8 }}>
                {reportType === "summary" ? "Summary generated!" : "Report generated!"}
              </h2>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", lineHeight: 1.7, marginBottom: 12 }}>
                {reportType === "summary"
                  ? "Your screening summary is ready below."
                  : "Your DSM-5 aligned clinical report is ready. Download it as a PDF and share it with your child's specialist."}
              </p>
              <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginBottom: 12 }}>
                {aiEnriched !== null && (
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "4px 12px", borderRadius: "var(--r-full)",
                    fontSize: "0.75rem", fontWeight: 700,
                    background: aiEnriched ? "var(--sage-100)" : "var(--peach-100)",
                    color: aiEnriched ? "var(--sage-600)" : "var(--peach-300)",
                    border: `1.5px solid ${aiEnriched ? "var(--sage-200)" : "var(--peach-300)"}`,
                  }}>
                    {aiEnriched ? "\u2728 AI-Enriched (Nova Pro)" : "\u26A0\uFE0F Template Only \u2014 AI unavailable"}
                  </span>
                )}
                {usingFallbackBio && (
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "4px 12px", borderRadius: "var(--r-full)",
                    fontSize: "0.75rem", fontWeight: 700,
                    background: "var(--peach-100)", color: "var(--peach-300)",
                    border: "1.5px solid var(--peach-300)",
                  }}>
                    No screening data \u2014 using placeholder values
                  </span>
                )}
              </div>
              <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                <button
                  className="btn btn-primary"
                  style={{ minHeight: 48, padding: "10px 28px" }}
                  onClick={downloadPdf}
                  disabled={downloading}
                >
                  {downloading ? "Preparing PDF..." : "\u{1F4E5} Download PDF Report"}
                </button>
                <button
                  className="btn btn-outline"
                  style={{ minHeight: 48, padding: "10px 20px" }}
                  onClick={() => {
                    setReportReady(false);
                    setReportText("");
                    setSections(null);
                    setErrorMsg(null);
                  }}
                >
                  Generate Another
                </button>
              </div>
            </div>

            {/* Report content display */}
            {reportType === "clinical" && sections ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div className="card" style={{ padding: "18px 22px" }}>
                  <h3 style={{ fontFamily: "'Fredoka',sans-serif", fontWeight: 600, fontSize: "0.95rem", marginBottom: 8, color: "var(--sage-600)" }}>
                    Criterion A -- Social Communication & Interaction
                  </h3>
                  <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                    {sections.criterionA || "Analysis of social gaze patterns, facial affect recognition, communication responsiveness, and joint attention indicators from the screening tasks."}
                  </p>
                </div>

                <div className="card" style={{ padding: "18px 22px" }}>
                  <h3 style={{ fontFamily: "'Fredoka',sans-serif", fontWeight: 600, fontSize: "0.95rem", marginBottom: 8, color: "var(--sage-600)" }}>
                    Criterion B -- Restricted & Repetitive Behaviours
                  </h3>
                  <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                    {sections.criterionB || "Body behavior classification from video analysis, motor pattern assessment, and repetitive movement detection using AI pose estimation."}
                  </p>
                </div>

                <div className="card" style={{ padding: "18px 22px" }}>
                  <h3 style={{ fontFamily: "'Fredoka',sans-serif", fontWeight: 600, fontSize: "0.95rem", marginBottom: 8, color: "var(--sage-600)" }}>
                    Motor Development Assessment
                  </h3>
                  <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                    {sections.motor || "Motor coordination and movement pattern analysis from the screening tasks."}
                  </p>
                </div>

                <div className="card" style={{ padding: "18px 22px" }}>
                  <h3 style={{ fontFamily: "'Fredoka',sans-serif", fontWeight: 600, fontSize: "0.95rem", marginBottom: 8, color: "var(--sage-600)" }}>
                    Recommendations
                  </h3>
                  <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                    {sections.recommendations || "Suggested next steps based on screening results, including specialist referral guidance and available support resources."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="card" style={{ padding: "22px 24px" }}>
                <h3 style={{ fontFamily: "'Fredoka',sans-serif", fontWeight: 600, fontSize: "0.95rem", marginBottom: 12, color: "var(--sage-600)" }}>
                  Screening Summary
                </h3>
                <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
                  {reportText}
                </p>
              </div>
            )}
          </div>
        )}

        <div className="fade fade-4" style={{ display: "flex", gap: 12, marginTop: 28 }}>
          <Link href={sessionId ? `/intake/summary?sessionId=${sessionId}` : "/intake/summary"}
            className="btn btn-outline" style={{ minWidth: 100 }}>
            &larr; Summary
          </Link>
          <Link href="/" className="btn btn-primary btn-full">
            Finish & Go Home
          </Link>
        </div>

        <p style={{
          textAlign: "center", marginTop: 22, fontSize: "0.8rem",
          color: "var(--text-muted)", lineHeight: 1.6,
        }}>
          This report is a screening summary, not a clinical diagnosis.
          <br />
          Always consult a qualified autism specialist or paediatrician.
        </p>
      </main>
    </div>
  );
}
