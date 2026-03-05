"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useAuthGuard } from "../../hooks/useAuthGuard";
import { DOCTORS, type Doctor } from "../../lib/data/doctors";

const SPECIALTIES = [
  "All",
  "Pediatric Neurologist",
  "Child Psychologist",
  "Speech Therapist",
  "Occupational Therapist",
] as const;

const BADGE_COLORS: Record<Doctor["specialty"], string> = {
  "Pediatric Neurologist": "var(--feature-blue)",
  "Child Psychologist": "var(--feature-lavender)",
  "Speech Therapist": "var(--feature-peach)",
  "Occupational Therapist": "var(--feature-green)",
};

export default function DoctorConnectPage() {
  const { loading: authLoading, isAuthenticated } = useAuthGuard();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [filter, setFilter] = useState<string>("All");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const saved = (typeof window !== "undefined" && localStorage.getItem("autisense-theme")) || "light";
    setTheme(saved as "light" | "dark");
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    if (typeof window !== "undefined") localStorage.setItem("autisense-theme", theme);
  }, [theme]);

  const filtered = DOCTORS.filter((d) => {
    const matchesSpecialty = filter === "All" || d.specialty === filter;
    const q = search.toLowerCase();
    const matchesSearch = !q || d.name.toLowerCase().includes(q) || d.city.toLowerCase().includes(q);
    return matchesSpecialty && matchesSearch;
  });

  if (authLoading || !isAuthenticated) {
    return (
      <div className="page" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <p style={{ color: "var(--text-secondary)" }}>Loading...</p>
      </div>
    );
  }

  return (
    <div className="page">
      {/* Nav */}
      <nav className="nav">
        <Link href="/" className="logo">Auti<em>Sense</em></Link>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
            className="btn btn-outline"
            style={{ minHeight: 40, padding: "8px 14px", fontSize: "0.85rem" }}
          >
            {theme === "light" ? "Dark" : "Light"}
          </button>
          <Link href="/kid-dashboard" className="btn btn-outline" style={{ minHeight: 40, padding: "8px 14px", fontSize: "0.85rem" }}>
            Home
          </Link>
        </div>
      </nav>

      <div className="main fade fade-1" style={{ maxWidth: 900, padding: "24px 20px 40px" }}>
        {/* Header */}
        <h1
          style={{
            fontFamily: "'Fredoka',sans-serif",
            fontWeight: 700,
            fontSize: "1.5rem",
            color: "var(--text-primary)",
            margin: 0,
            marginBottom: 6,
          }}
        >
          Doctor Connect
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem", marginBottom: 20 }}>
          Find specialists who can help with autism screening and support.
        </p>

        {/* Search */}
        <input
          type="text"
          placeholder="Search by name or city..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%",
            padding: "12px 16px",
            borderRadius: "var(--r-full)",
            border: "1px solid var(--border)",
            background: "var(--card)",
            color: "var(--text-primary)",
            fontSize: "0.9rem",
            outline: "none",
            marginBottom: 16,
            transition: "border-color 200ms var(--ease)",
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "var(--border-focus)"; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
        />

        {/* Filter Chips */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 22 }}>
          {SPECIALTIES.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              style={{
                padding: "7px 16px",
                borderRadius: "var(--r-full)",
                border: "1px solid var(--border)",
                background: filter === s ? "var(--sage-100)" : "var(--card)",
                color: filter === s ? "var(--sage-700)" : "var(--text-secondary)",
                fontWeight: filter === s ? 700 : 500,
                fontSize: "0.8rem",
                fontFamily: "'Fredoka',sans-serif",
                cursor: "pointer",
                transition: "all 200ms var(--ease)",
              }}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Results count */}
        <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginBottom: 14 }}>
          {filtered.length} specialist{filtered.length !== 1 ? "s" : ""} found
        </p>

        {/* Doctor Cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 32 }}>
          {filtered.length === 0 && (
            <div className="card" style={{ padding: "28px 20px", textAlign: "center", color: "var(--text-secondary)", fontSize: "0.9rem" }}>
              No specialists match your search. Try a different filter or city.
            </div>
          )}

          {filtered.map((doc, idx) => (
            <div
              key={`${doc.name}-${idx}`}
              className="card"
              style={{
                padding: "18px 22px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                transition: "transform 250ms var(--ease), box-shadow 250ms var(--ease)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
                (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                (e.currentTarget as HTMLElement).style.boxShadow = "none";
              }}
            >
              {/* Name + Badge */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontFamily: "'Fredoka',sans-serif", fontWeight: 600, fontSize: "1rem", color: "var(--text-primary)" }}>
                  {doc.name}
                </span>
                <span style={{
                  padding: "3px 10px", borderRadius: "var(--r-full)", background: BADGE_COLORS[doc.specialty],
                  fontSize: "0.7rem", fontWeight: 600, fontFamily: "'Fredoka',sans-serif",
                  color: "var(--text-primary)", whiteSpace: "nowrap",
                }}>
                  {doc.specialty}
                </span>
              </div>
              {/* Hospital */}
              {doc.hospital && (
                <span style={{ fontSize: "0.84rem", color: "var(--text-secondary)" }}>{doc.hospital}</span>
              )}
              {/* Location + Phone */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{doc.location}, {doc.city}</span>
                <a
                  href={`tel:${doc.phone}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 16px",
                    borderRadius: "var(--r-full)",
                    background: "var(--sage-100)",
                    color: "var(--sage-700)",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    fontFamily: "'Fredoka',sans-serif",
                    textDecoration: "none",
                    transition: "background 200ms var(--ease)",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--sage-200)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--sage-100)"; }}
                >
                  Call {doc.phone}
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* Disclaimer */}
        <div
          className="card"
          style={{
            padding: "16px 22px",
            borderLeft: "4px solid var(--sage-300)",
            background: "var(--bg-secondary)",
            fontSize: "0.82rem",
            color: "var(--text-secondary)",
            lineHeight: 1.55,
          }}
        >
          <strong style={{ color: "var(--text-primary)" }}>Disclaimer:</strong>{" "}
          This directory is for informational purposes only and does not constitute a medical referral.
          Always consult with your primary care provider before seeking specialist services.
        </div>
      </div>
    </div>
  );
}
