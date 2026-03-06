"use client";

import Link from "next/link";
import { useState, useEffect, useCallback, use } from "react";
import NavLogo from "../../../components/NavLogo";
import ThemeToggle from "../../../components/ThemeToggle";
import { getProfile } from "../../../lib/db/childProfile.repository";
import { listSessions } from "../../../lib/db/session.repository";
import { aggregateBiomarkers } from "../../../lib/db/biomarker.repository";
import type { ChildProfile } from "../../../types/childProfile";
import type { Session } from "../../../types/session";
import type { BiomarkerAggregate } from "../../../types/biomarker";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

interface ScorePoint {
  date: string;
  score: number;
}

interface DomainBar {
  domain: string;
  score: number;
}

export default function ChildDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [profile, setProfile] = useState<ChildProfile | null>(null);
  const [childSessions, setChildSessions] = useState<Session[]>([]);
  const [chartData, setChartData] = useState<ScorePoint[]>([]);
  const [domainData, setDomainData] = useState<DomainBar[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved =
      (typeof window !== "undefined" && localStorage.getItem("autisense-theme")) || "light";
    setTheme(saved as "light" | "dark");
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    if (typeof window !== "undefined") localStorage.setItem("autisense-theme", theme);
  }, [theme]);

  const loadData = useCallback(async () => {
    try {
      const prof = await getProfile(id);
      if (!prof) {
        setLoading(false);
        return;
      }
      setProfile(prof);

      // Get all sessions and filter for this child by name match
      const allSessions = await listSessions();
      const matched = allSessions.filter(
        (s) =>
          s.childName.toLowerCase() === prof.name.toLowerCase() &&
          s.ageMonths === prof.ageMonths,
      );
      setChildSessions(matched);

      // Aggregate scores for completed sessions
      const completed = matched.filter(
        (s) => s.status === "completed" || s.status === "synced",
      );
      const aggregates = await Promise.all(
        completed.map((s) => aggregateBiomarkers(s.id)),
      );

      // Score history chart
      const points: ScorePoint[] = [];
      for (let i = 0; i < completed.length; i++) {
        const agg = aggregates[i];
        if (agg) {
          points.push({
            date: new Date(completed[i].createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            }),
            score: agg.overallScore,
          });
        }
      }
      setChartData(points.reverse());

      // DSM-5 domain breakdown from the most recent aggregate
      const validAggs = aggregates.filter(
        (a): a is BiomarkerAggregate => a !== null,
      );
      if (validAggs.length > 0) {
        const latest = validAggs[0];
        setDomainData([
          { domain: "Gaze", score: Math.round(latest.avgGazeScore * 100) },
          { domain: "Motor", score: Math.round(latest.avgMotorScore * 100) },
          { domain: "Vocal", score: Math.round(latest.avgVocalizationScore * 100) },
        ]);
      }
    } catch {
      // IndexedDB may not be available during SSR
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="page">
      {/* Nav */}
      <nav className="nav">
        <NavLogo />
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <ThemeToggle theme={theme} onToggle={() => setTheme((t) => (t === "light" ? "dark" : "light"))} />
        </div>
      </nav>

      {/* Main */}
      <div
        className="main fade fade-1"
        style={{ maxWidth: 800, padding: "40px 28px 80px" }}
      >
        {/* Back */}
        <Link
          href="/kid-dashboard"
          className="btn btn-outline"
          style={{
            minHeight: 40,
            padding: "8px 18px",
            fontSize: "0.88rem",
            marginBottom: 28,
            display: "inline-flex",
          }}
        >
          Back to Dashboard
        </Link>

        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>
            Loading...
          </div>
        ) : !profile ? (
          <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>
            Profile not found.
          </div>
        ) : (
          <>
            {/* Child Info */}
            <div className="fade fade-2">
              <h1 className="page-title">
                <em>{profile.name}</em>
              </h1>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 32 }}>
                <span className="chip" style={{ marginBottom: 0 }}>
                  {Math.floor(profile.ageMonths / 12)}y {profile.ageMonths % 12}m
                </span>
                <span className="chip" style={{ marginBottom: 0 }}>
                  {profile.language}
                </span>
                <span className="chip" style={{ marginBottom: 0 }}>
                  {profile.gender}
                </span>
              </div>
            </div>

            {/* Score History Chart */}
            {chartData.length > 0 && (
              <div
                className="card fade fade-3"
                style={{ padding: "24px 20px", marginBottom: 28 }}
              >
                <h2
                  style={{
                    fontFamily: "'Fredoka',sans-serif",
                    fontWeight: 600,
                    fontSize: "1.1rem",
                    marginBottom: 20,
                    color: "var(--text-primary)",
                  }}
                >
                  Score History
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

            {/* DSM-5 Domain Breakdown */}
            {domainData.length > 0 && (
              <div
                className="card fade fade-4"
                style={{ padding: "24px 20px", marginBottom: 28 }}
              >
                <h2
                  style={{
                    fontFamily: "'Fredoka',sans-serif",
                    fontWeight: 600,
                    fontSize: "1.1rem",
                    marginBottom: 20,
                    color: "var(--text-primary)",
                  }}
                >
                  DSM-5 Domain Breakdown
                </h2>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={domainData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      tick={{ fontSize: 12, fill: "var(--text-muted)" }}
                      stroke="var(--border)"
                    />
                    <YAxis
                      type="category"
                      dataKey="domain"
                      tick={{ fontSize: 13, fill: "var(--text-secondary)", fontWeight: 600 }}
                      stroke="var(--border)"
                      width={60}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--card)",
                        border: "2px solid var(--border)",
                        borderRadius: 12,
                        fontSize: "0.85rem",
                      }}
                    />
                    <Bar
                      dataKey="score"
                      fill="var(--sage-400)"
                      radius={[0, 8, 8, 0]}
                      barSize={24}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Sessions for this child */}
            <div className="fade fade-5">
              <h2
                style={{
                  fontFamily: "'Fredoka',sans-serif",
                  fontWeight: 600,
                  fontSize: "1.1rem",
                  marginBottom: 16,
                  color: "var(--text-primary)",
                }}
              >
                Screening Sessions ({childSessions.length})
              </h2>
              {childSessions.length === 0 ? (
                <div
                  className="card"
                  style={{
                    padding: "32px 20px",
                    textAlign: "center",
                    color: "var(--text-muted)",
                  }}
                >
                  No sessions found for this child.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {childSessions.map((s) => (
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
                          {new Date(s.createdAt).toLocaleDateString("en-US", {
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </div>
                        <div
                          style={{
                            fontSize: "0.82rem",
                            color: "var(--text-secondary)",
                            marginTop: 2,
                          }}
                        >
                          Status: {s.status}
                        </div>
                      </div>
                      {(s.status === "completed" || s.status === "synced") && (
                        <Link
                          href={`/intake/report?sessionId=${s.id}`}
                          className="btn btn-outline"
                          style={{
                            minHeight: 38,
                            padding: "6px 16px",
                            fontSize: "0.82rem",
                          }}
                        >
                          View Report
                        </Link>
                      )}
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
