"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { listSessions } from "../lib/db/session.repository";
import { aggregateBiomarkers } from "../lib/db/biomarker.repository";
import { listProfiles } from "../lib/db/childProfile.repository";
import { getCurrentUserId } from "../lib/identity/identity";
import { useAuthGuard } from "../hooks/useAuthGuard";
import type { Session } from "../types/session";
import type { ChildProfile } from "../types/childProfile";
import type { BiomarkerAggregate } from "../types/biomarker";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface ScorePoint {
  date: string;
  score: number;
}

export default function DashboardPage() {
  const { loading: authLoading, isAuthenticated } = useAuthGuard();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [profiles, setProfiles] = useState<ChildProfile[]>([]);
  const [avgScore, setAvgScore] = useState<number | null>(null);
  const [chartData, setChartData] = useState<ScorePoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = (typeof window !== "undefined" && localStorage.getItem("autisense-theme")) || "light";
    setTheme(saved as "light" | "dark");
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    if (typeof window !== "undefined") localStorage.setItem("autisense-theme", theme);
  }, [theme]);

  const loadData = useCallback(async () => {
    try {
      const [sessList, profileList] = await Promise.all([
        listSessions(),
        listProfiles(),
      ]);

      setSessions(sessList);
      setProfiles(profileList);

      // Aggregate scores for completed sessions
      const completedSessions = sessList.filter((s) => s.status === "completed" || s.status === "synced");
      const aggregates: (BiomarkerAggregate | null)[] = await Promise.all(
        completedSessions.map((s) => aggregateBiomarkers(s.id)),
      );

      const validAggregates = aggregates.filter(
        (a): a is BiomarkerAggregate => a !== null,
      );

      if (validAggregates.length > 0) {
        const total = validAggregates.reduce((sum, a) => sum + a.overallScore, 0);
        setAvgScore(Math.round(total / validAggregates.length));
      }

      // Build chart data from completed sessions
      const points: ScorePoint[] = [];
      for (let i = 0; i < completedSessions.length; i++) {
        const agg = aggregates[i];
        if (agg) {
          points.push({
            date: new Date(completedSessions[i].createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            }),
            score: agg.overallScore,
          });
        }
      }
      setChartData(points.reverse());
    } catch {
      // IndexedDB may not be available in SSR
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (authLoading || !isAuthenticated) {
    return (
      <div className="page" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <p style={{ color: "var(--text-secondary)" }}>Checking authentication...</p>
      </div>
    );
  }

  return (
    <div className="page">
      {/* Nav */}
      <nav className="nav">
        <Link href="/" className="logo">
          Auti<em>Sense</em>
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
            className="btn btn-outline"
            style={{ minHeight: 40, padding: "8px 16px", fontSize: "0.9rem", gap: 6 }}
            aria-label="Toggle theme"
          >
            {theme === "light" ? "Dark" : "Light"}
          </button>
          <span
            style={{
              fontSize: "0.85rem",
              color: "var(--text-muted)",
              fontWeight: 600,
            }}
          >
            {typeof window !== "undefined" ? getCurrentUserId().slice(0, 12) + "..." : ""}
          </span>
        </div>
      </nav>

      {/* Main */}
      <div
        className="main fade fade-1"
        style={{ maxWidth: 900, padding: "40px 28px 80px" }}
      >
        <h1 className="page-title">
          Your <em>Dashboard</em>
        </h1>
        <p className="subtitle">
          Track your child&apos;s screening progress, manage profiles, and access therapy games.
        </p>

        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>
            Loading...
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div
              className="fade fade-2"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 16,
                marginBottom: 36,
              }}
            >
              <div className="card" style={{ padding: "24px 20px", textAlign: "center" }}>
                <div
                  style={{
                    fontSize: "2rem",
                    fontFamily: "'Fredoka',sans-serif",
                    fontWeight: 700,
                    color: "var(--sage-500)",
                  }}
                >
                  {sessions.length}
                </div>
                <div
                  style={{
                    fontSize: "0.85rem",
                    color: "var(--text-secondary)",
                    fontWeight: 600,
                    marginTop: 4,
                  }}
                >
                  Total Sessions
                </div>
              </div>

              <div className="card" style={{ padding: "24px 20px", textAlign: "center" }}>
                <div
                  style={{
                    fontSize: "2rem",
                    fontFamily: "'Fredoka',sans-serif",
                    fontWeight: 700,
                    color: "var(--sage-500)",
                  }}
                >
                  {profiles.length}
                </div>
                <div
                  style={{
                    fontSize: "0.85rem",
                    color: "var(--text-secondary)",
                    fontWeight: 600,
                    marginTop: 4,
                  }}
                >
                  Children
                </div>
              </div>

              <div className="card" style={{ padding: "24px 20px", textAlign: "center" }}>
                <div
                  style={{
                    fontSize: "2rem",
                    fontFamily: "'Fredoka',sans-serif",
                    fontWeight: 700,
                    color: "var(--sage-500)",
                  }}
                >
                  {avgScore !== null ? `${avgScore}%` : "--"}
                </div>
                <div
                  style={{
                    fontSize: "0.85rem",
                    color: "var(--text-secondary)",
                    fontWeight: 600,
                    marginTop: 4,
                  }}
                >
                  Avg Score
                </div>
              </div>
            </div>

            {/* Score Trend Chart */}
            {chartData.length > 1 && (
              <div
                className="card fade fade-3"
                style={{ padding: "24px 20px", marginBottom: 36 }}
              >
                <h2
                  style={{
                    fontFamily: "'Fredoka',sans-serif",
                    fontWeight: 600,
                    fontSize: "1.15rem",
                    marginBottom: 20,
                    color: "var(--text-primary)",
                  }}
                >
                  Screening Scores Over Time
                </h2>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12, fill: "var(--text-muted)" }}
                      stroke="var(--border)"
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 12, fill: "var(--text-muted)" }}
                      stroke="var(--border)"
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--card)",
                        border: "2px solid var(--border)",
                        borderRadius: 12,
                        fontSize: "0.85rem",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="var(--sage-500)"
                      strokeWidth={3}
                      dot={{ fill: "var(--sage-400)", r: 5 }}
                      activeDot={{ r: 7, fill: "var(--sage-600)" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* CTA Button */}
            <div className="fade fade-3" style={{ marginBottom: 36 }}>
              <Link
                href="/intake/profile"
                className="btn btn-primary btn-full"
                style={{ maxWidth: 400 }}
              >
                Start New Screening
              </Link>
            </div>

            {/* Quick Links */}
            <div
              className="fade fade-3"
              style={{ display: "flex", gap: 12, marginBottom: 36, flexWrap: "wrap" }}
            >
              <Link
                href="/kid-dashboard"
                className="btn btn-primary"
                style={{ minHeight: 48, padding: "10px 24px", fontSize: "0.95rem" }}
              >
                Kids Dashboard
              </Link>
              <Link
                href="/games"
                className="btn btn-secondary"
                style={{ minHeight: 48, padding: "10px 24px", fontSize: "0.95rem" }}
              >
                Therapy Games
              </Link>
              <Link
                href="/feed"
                className="btn btn-secondary"
                style={{ minHeight: 48, padding: "10px 24px", fontSize: "0.95rem" }}
              >
                Community Feed
              </Link>
            </div>

            {/* Child Profiles */}
            <div className="fade fade-4" style={{ marginBottom: 36 }}>
              <h2
                style={{
                  fontFamily: "'Fredoka',sans-serif",
                  fontWeight: 600,
                  fontSize: "1.2rem",
                  marginBottom: 16,
                  color: "var(--text-primary)",
                }}
              >
                Child Profiles
              </h2>
              {profiles.length === 0 ? (
                <div
                  className="card"
                  style={{
                    padding: "32px 20px",
                    textAlign: "center",
                    color: "var(--text-muted)",
                  }}
                >
                  No child profiles yet. Start a screening to create one.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {profiles.map((p) => (
                    <Link
                      key={p.id}
                      href={`/dashboard/child/${p.id}`}
                      className="card"
                      style={{
                        padding: "18px 22px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        textDecoration: "none",
                        color: "inherit",
                        cursor: "pointer",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: "1rem",
                            color: "var(--text-primary)",
                          }}
                        >
                          {p.name}
                        </div>
                        <div
                          style={{
                            fontSize: "0.85rem",
                            color: "var(--text-secondary)",
                            marginTop: 2,
                          }}
                        >
                          {Math.floor(p.ageMonths / 12)}y {p.ageMonths % 12}m
                          &nbsp;&middot;&nbsp;{p.language}
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: "0.85rem",
                          color: "var(--text-muted)",
                          fontWeight: 600,
                        }}
                      >
                        View
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Sessions */}
            <div className="fade fade-5">
              <h2
                style={{
                  fontFamily: "'Fredoka',sans-serif",
                  fontWeight: 600,
                  fontSize: "1.2rem",
                  marginBottom: 16,
                  color: "var(--text-primary)",
                }}
              >
                Recent Sessions
              </h2>
              {sessions.length === 0 ? (
                <div
                  className="card"
                  style={{
                    padding: "32px 20px",
                    textAlign: "center",
                    color: "var(--text-muted)",
                  }}
                >
                  No sessions yet. Start your first screening above.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {sessions.slice(0, 10).map((s) => (
                    <div
                      key={s.id}
                      className="card"
                      style={{
                        padding: "18px 22px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: "0.95rem",
                            color: "var(--text-primary)",
                          }}
                        >
                          {s.childName}
                        </div>
                        <div
                          style={{
                            fontSize: "0.82rem",
                            color: "var(--text-secondary)",
                            marginTop: 2,
                          }}
                        >
                          {new Date(s.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </div>
                      </div>
                      <span
                        className="chip"
                        style={{
                          marginBottom: 0,
                          background:
                            s.status === "completed" || s.status === "synced"
                              ? "var(--sage-100)"
                              : "var(--peach-100)",
                          color:
                            s.status === "completed" || s.status === "synced"
                              ? "var(--sage-600)"
                              : "var(--peach-300)",
                          borderColor:
                            s.status === "completed" || s.status === "synced"
                              ? "var(--sage-200)"
                              : "var(--peach-300)",
                        }}
                      >
                        {s.status === "synced"
                          ? "Synced"
                          : s.status === "completed"
                            ? "Completed"
                            : "In Progress"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
