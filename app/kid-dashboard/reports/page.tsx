"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { useAuthGuard } from "../../hooks/useAuthGuard";
import type { WeeklyReport } from "../../types/gameActivity";
import { db } from "../../lib/db/schema";
import NavLogo from "../../components/NavLogo";
import ThemeToggle from "../../components/ThemeToggle";

type View = "kid" | "parent";

export default function ReportsPage() {
  const { loading: authLoading, isAuthenticated } = useAuthGuard();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [generating, setGenerating] = useState(false);
  const [selectedReport, setSelectedReport] = useState<WeeklyReport | null>(null);
  const [view, setView] = useState<View>("kid");
  const [loading, setLoading] = useState(true);

  const childId =
    typeof window !== "undefined"
      ? localStorage.getItem("autisense-active-child-id") || "default"
      : "default";
  const childName =
    typeof window !== "undefined"
      ? localStorage.getItem("autisense-child-name") || "Superstar"
      : "Superstar";

  useEffect(() => {
    const saved = (typeof window !== "undefined" && localStorage.getItem("autisense-theme")) || "light";
    setTheme(saved as "light" | "dark");
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    if (typeof window !== "undefined") localStorage.setItem("autisense-theme", theme);
  }, [theme]);

  const loadReports = useCallback(async () => {
    try {
      const list = await db.weeklyReports
        .where("childId")
        .equals(childId)
        .reverse()
        .sortBy("generatedAt");
      setReports(list);
    } catch {
      // IndexedDB may fail in SSR
    } finally {
      setLoading(false);
    }
  }, [childId]);

  useEffect(() => {
    if (isAuthenticated) loadReports();
  }, [isAuthenticated, loadReports]);

  const generateReport = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/report/weekly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childId, childName }),
      });
      if (res.ok) {
        await loadReports();
      }
    } catch {
      // silently fail
    } finally {
      setGenerating(false);
    }
  };

  const splitHtml = (html: string): { kid: string; parent: string } => {
    const parts = html.split("<!-- SPLIT -->");
    return {
      kid: (parts[0] || "").replace("<!-- KID -->", ""),
      parent: (parts[1] || "").replace("<!-- PARENT -->", ""),
    };
  };

  if (authLoading || !isAuthenticated) {
    return (
      <div className="page" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <p style={{ color: "var(--text-secondary)" }}>Loading...</p>
      </div>
    );
  }

  return (
    <div className="page">
      <nav className="nav">
        <NavLogo />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ThemeToggle theme={theme} onToggle={() => setTheme((t) => (t === "light" ? "dark" : "light"))} />
          <Link href="/kid-dashboard" className="btn btn-outline" style={{ minHeight: 40, padding: "8px 14px", fontSize: "0.85rem" }}>
            Home
          </Link>
        </div>
      </nav>

      <div className="main fade fade-1" style={{ maxWidth: 700, padding: "32px 24px 80px" }}>
        <h1 className="page-title">Weekly <em>Reports</em></h1>
        <p className="subtitle">See how you&apos;re doing each week.</p>

        {/* Generate button */}
        <div className="fade fade-2" style={{ marginBottom: 24 }}>
          <button
            onClick={generateReport}
            disabled={generating}
            className="btn btn-primary btn-full"
            style={{ maxWidth: 320, opacity: generating ? 0.6 : 1 }}
          >
            {generating ? "Generating..." : "Generate This Week's Report"}
          </button>
        </div>

        {/* Report viewer */}
        {selectedReport && (
          <div className="card fade fade-2" style={{ padding: "20px", marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => setView("kid")}
                  className="btn"
                  style={{
                    padding: "6px 16px",
                    fontSize: "0.82rem",
                    fontWeight: view === "kid" ? 700 : 500,
                    background: view === "kid" ? "var(--sage-100)" : "var(--card)",
                    color: view === "kid" ? "var(--sage-700)" : "var(--text-secondary)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--r-full)",
                    minHeight: 36,
                  }}
                >
                  Kid Version
                </button>
                <button
                  onClick={() => setView("parent")}
                  className="btn"
                  style={{
                    padding: "6px 16px",
                    fontSize: "0.82rem",
                    fontWeight: view === "parent" ? 700 : 500,
                    background: view === "parent" ? "var(--sage-100)" : "var(--card)",
                    color: view === "parent" ? "var(--sage-700)" : "var(--text-secondary)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--r-full)",
                    minHeight: 36,
                  }}
                >
                  Parent Version
                </button>
              </div>
              <button
                onClick={() => setSelectedReport(null)}
                className="btn btn-outline"
                style={{ minHeight: 36, padding: "4px 12px", fontSize: "0.8rem" }}
              >
                Close
              </button>
            </div>
            <div
              dangerouslySetInnerHTML={{
                __html: view === "kid"
                  ? splitHtml(selectedReport.reportHtml).kid
                  : splitHtml(selectedReport.reportHtml).parent,
              }}
            />
          </div>
        )}

        {/* Report list */}
        <h2
          className="fade fade-3"
          style={{
            fontFamily: "'Fredoka',sans-serif",
            fontWeight: 600,
            fontSize: "1.05rem",
            color: "var(--text-primary)",
            marginBottom: 12,
          }}
        >
          Past Reports
        </h2>

        {loading ? (
          <p style={{ color: "var(--text-muted)", textAlign: "center", padding: 40 }}>Loading...</p>
        ) : reports.length === 0 ? (
          <div className="card" style={{ padding: "32px 20px", textAlign: "center", color: "var(--text-muted)" }}>
            No reports yet. Generate your first one above!
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {reports.map((r) => (
              <button
                key={r.id}
                onClick={() => { setSelectedReport(r); setView("kid"); }}
                className="card"
                style={{
                  padding: "16px 20px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  cursor: "pointer",
                  border: selectedReport?.id === r.id ? "2px solid var(--sage-500)" : "1px solid var(--border)",
                  textAlign: "left",
                  background: "var(--card)",
                  width: "100%",
                }}
              >
                <div>
                  <div
                    style={{
                      fontFamily: "'Fredoka',sans-serif",
                      fontWeight: 600,
                      fontSize: "0.92rem",
                      color: "var(--text-primary)",
                    }}
                  >
                    {r.weekStart} &ndash; {r.weekEnd}
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: 2 }}>
                    {r.gamesPlayed} games &middot; {r.avgScore}% avg
                  </div>
                </div>
                <div
                  style={{
                    fontFamily: "'Fredoka',sans-serif",
                    fontWeight: 700,
                    fontSize: "0.85rem",
                    color: "var(--sage-500)",
                  }}
                >
                  View
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
