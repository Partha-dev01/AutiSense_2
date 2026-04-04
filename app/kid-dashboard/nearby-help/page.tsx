"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuthGuard } from "../../hooks/useAuthGuard";
import { DOCTORS, SPECIALTY_COLORS, type Doctor } from "../../lib/data/doctors";
import { INSTITUTES, CATEGORY_LABELS, CATEGORY_COLORS, type Institute } from "../../lib/data/institutes";
import NavLogo from "../../components/NavLogo";
import UserMenu from "../../components/UserMenu";
import ThemeToggle from "../../components/ThemeToggle";
import type { MapMarker } from "../../components/LeafletMap";
import { useTheme } from "../../hooks/useTheme";

const LeafletMapDynamic = dynamic(() => import("../../components/LeafletMap"), { ssr: false });

/* ─── Unified item type ─────────────────────────────────────────────── */

type NearbyItem =
  | {
      type: "doctor";
      name: string;
      subtitle: string;
      address: string;
      city: string;
      lat: number;
      lng: number;
      phone: string;
      website?: string;
      badgeLabel: string;
      badgeColor: string;
      category: Doctor["specialty"];
    }
  | {
      type: "institute";
      name: string;
      subtitle: string;
      address: string;
      city: string;
      lat: number;
      lng: number;
      phone?: string;
      website?: string;
      badgeLabel: string;
      badgeColor: string;
      category: Institute["category"];
      isLive?: boolean;
    };

/* ─── Normalize data into NearbyItem[] ──────────────────────────────── */

const ALL_ITEMS: NearbyItem[] = [
  ...DOCTORS.map(
    (d): NearbyItem => ({
      type: "doctor",
      name: d.name,
      subtitle: d.hospital ?? d.specialty,
      address: d.location,
      city: d.city,
      lat: d.lat,
      lng: d.lng,
      phone: d.phone,
      website: d.website,
      badgeLabel: d.specialty,
      badgeColor: SPECIALTY_COLORS[d.specialty],
      category: d.specialty,
    }),
  ),
  ...INSTITUTES.map(
    (i): NearbyItem => ({
      type: "institute",
      name: i.name,
      subtitle: CATEGORY_LABELS[i.category],
      address: i.address,
      city: i.city,
      lat: i.lat,
      lng: i.lng,
      phone: i.phone,
      website: i.website,
      badgeLabel: CATEGORY_LABELS[i.category],
      badgeColor: CATEGORY_COLORS[i.category],
      category: i.category,
    }),
  ),
];

/* ─── Toggle + chip definitions ─────────────────────────────────────── */

type ViewToggle = "all" | "doctors" | "institutes";

interface ChipDef {
  value: string;
  label: string;
  color: string;
}

const DOCTOR_CHIPS: ChipDef[] = [
  { value: "Pediatric Neurologist", label: "Neurologist", color: SPECIALTY_COLORS["Pediatric Neurologist"] },
  { value: "Child Psychologist", label: "Psychologist", color: SPECIALTY_COLORS["Child Psychologist"] },
  { value: "Speech Therapist", label: "Speech", color: SPECIALTY_COLORS["Speech Therapist"] },
  { value: "Occupational Therapist", label: "OT", color: SPECIALTY_COLORS["Occupational Therapist"] },
];

const INSTITUTE_CHIPS: ChipDef[] = [
  { value: "hospital", label: "Hospital", color: CATEGORY_COLORS["hospital"] },
  { value: "therapy_center", label: "Therapy", color: CATEGORY_COLORS["therapy_center"] },
  { value: "special_school", label: "School", color: CATEGORY_COLORS["special_school"] },
  { value: "support_group", label: "Support", color: CATEGORY_COLORS["support_group"] },
];

/* ─── Haversine distance ────────────────────────────────────────────── */

const distance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/* ═══════════════════════════════════════════════════════════════════════
   Page Component
   ═══════════════════════════════════════════════════════════════════════ */

export default function NearbyHelpPage() {
  const { theme, toggle: toggleTheme } = useTheme();
  const { loading: authLoading, isAuthenticated } = useAuthGuard();

  /* Theme */

  /* State */
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewToggle>("all");
  const [activeChips, setActiveChips] = useState<Set<string>>(new Set());
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [liveResults, setLiveResults] = useState<NearbyItem[]>([]);
  const [liveLoading, setLiveLoading] = useState(false);

  /* Reset chips when toggle changes */
  useEffect(() => {
    setActiveChips(new Set());
  }, [view]);

  /* Fetch live results from Overpass API when geolocation is available */
  const fetchLiveResults = useCallback(async (lat: number, lng: number) => {
    setLiveLoading(true);
    try {
      const res = await fetch("/api/nearby", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lng, radius: 15000 }),
      });
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      const items: NearbyItem[] = (data.results || []).map(
        (r: { id: number; name: string; lat: number; lng: number; type: string; phone?: string; website?: string }): NearbyItem => ({
          type: "institute" as const,
          name: r.name,
          subtitle: r.type,
          address: r.type,
          city: "Nearby",
          lat: r.lat,
          lng: r.lng,
          phone: r.phone,
          website: r.website,
          badgeLabel: r.type,
          badgeColor: "#4d8058",
          category: "hospital" as Institute["category"],
          isLive: true,
        }),
      );
      setLiveResults(items);
    } catch {
      setLiveResults([]);
    } finally {
      setLiveLoading(false);
    }
  }, []);

  /* Geolocation */
  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLat(pos.coords.latitude);
        setUserLng(pos.coords.longitude);
        setGeoLoading(false);
        fetchLiveResults(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        setGeoLoading(false);
      },
    );
  }, [fetchLiveResults]);

  /* Visible chips based on current toggle */
  const visibleChips = useMemo<ChipDef[]>(() => {
    if (view === "doctors") return DOCTOR_CHIPS;
    if (view === "institutes") return INSTITUTE_CHIPS;
    return [...DOCTOR_CHIPS, ...INSTITUTE_CHIPS];
  }, [view]);

  /* Toggle a chip on/off */
  const toggleChip = useCallback((value: string) => {
    setActiveChips((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }, []);

  /* Filtered items (merge live results) */
  const filtered = useMemo(() => {
    let list: NearbyItem[] = [...ALL_ITEMS, ...liveResults];

    /* View toggle */
    if (view === "doctors") list = list.filter((it) => it.type === "doctor");
    if (view === "institutes") list = list.filter((it) => it.type === "institute");

    /* Chip filters (OR within group) */
    if (activeChips.size > 0) {
      list = list.filter((it) => activeChips.has(it.category));
    }

    /* Search */
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (it) =>
          it.name.toLowerCase().includes(q) ||
          it.city.toLowerCase().includes(q) ||
          it.address.toLowerCase().includes(q) ||
          it.badgeLabel.toLowerCase().includes(q),
      );
    }

    return list;
  }, [view, activeChips, search, liveResults]);

  /* Sort by distance when available */
  const sortedFiltered = useMemo(() => {
    if (userLat === null || userLng === null) return filtered;
    return [...filtered].sort(
      (a, b) => distance(userLat, userLng, a.lat, a.lng) - distance(userLat, userLng, b.lat, b.lng),
    );
  }, [filtered, userLat, userLng]);

  /* ─── Auth guard ────────────────────────────────────────────────── */

  if (authLoading || !isAuthenticated) {
    return (
      <div className="page" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <p style={{ color: "var(--text-secondary)" }}>Loading...</p>
      </div>
    );
  }

  /* ─── Render ────────────────────────────────────────────────────── */

  const toggles: { value: ViewToggle; label: string }[] = [
    { value: "all", label: "All" },
    { value: "doctors", label: "Doctors" },
    { value: "institutes", label: "Institutes" },
  ];

  return (
    <div className="page">
      {/* ── Nav ─────────────────────────────────────────────────────── */}
      <nav className="nav">
        <NavLogo />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <Link
            href="/kid-dashboard"
            className="btn btn-outline"
            style={{ minHeight: 40, padding: "8px 14px", fontSize: "0.85rem" }}
          >
            Home
          </Link>
          <UserMenu />
        </div>
      </nav>

      {/* ── Main ───────────────────────────────────────────────────── */}
      <div className="main fade fade-1" style={{ maxWidth: 900, padding: "24px 20px 80px" }}>
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
          Nearby <em>Help</em>
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem", marginBottom: 20 }}>
          Find doctors, hospitals, therapy centers, and support groups near you.
        </p>

        {/* ── Search + Near Me ──────────────────────────────────────── */}
        <div className="fade fade-2" style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <input
            type="text"
            placeholder="Search by name, city, or specialty..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input"
            style={{ flex: 1, minHeight: 48 }}
          />
          <button
            onClick={requestLocation}
            className="btn btn-primary"
            disabled={geoLoading}
            style={{
              minHeight: 48,
              padding: "8px 18px",
              fontSize: "0.85rem",
              whiteSpace: "nowrap",
              opacity: geoLoading ? 0.7 : 1,
            }}
          >
            {geoLoading ? "Locating..." : "Near Me"}
          </button>
        </div>

        {/* ── View toggles ─────────────────────────────────────────── */}
        <div className="fade fade-2" style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {toggles.map((t) => (
            <button
              key={t.value}
              onClick={() => setView(t.value)}
              className="btn"
              style={{
                padding: "7px 18px",
                fontSize: "0.82rem",
                fontWeight: view === t.value ? 700 : 500,
                fontFamily: "'Fredoka',sans-serif",
                background: view === t.value ? "var(--sage-600)" : "var(--card)",
                color: view === t.value ? "#fff" : "var(--text-secondary)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-full)",
                minHeight: 36,
                cursor: "pointer",
                transition: "all 200ms ease",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Category chips ───────────────────────────────────────── */}
        <div className="fade fade-2" style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
          {visibleChips.map((c) => {
            const active = activeChips.has(c.value);
            return (
              <button
                key={c.value}
                onClick={() => toggleChip(c.value)}
                className="btn"
                style={{
                  padding: "6px 14px",
                  fontSize: "0.78rem",
                  fontWeight: active ? 700 : 500,
                  background: active ? c.color + "22" : "var(--card)",
                  color: active ? c.color : "var(--text-secondary)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-full)",
                  minHeight: 34,
                  cursor: "pointer",
                  transition: "all 200ms ease",
                }}
              >
                {c.label}
              </button>
            );
          })}
          {activeChips.size > 0 && (
            <button
              onClick={() => setActiveChips(new Set())}
              className="btn"
              style={{
                padding: "6px 14px",
                fontSize: "0.78rem",
                fontWeight: 500,
                background: "transparent",
                color: "var(--text-muted)",
                border: "1px dashed var(--border)",
                borderRadius: "var(--r-full)",
                minHeight: 34,
                cursor: "pointer",
              }}
            >
              Clear filters
            </button>
          )}
        </div>

        {/* ── Results count ─────────────────────────────────────────── */}
        <p className="fade fade-3" style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: 16 }}>
          {sortedFiltered.length} result{sortedFiltered.length !== 1 ? "s" : ""}
          {userLat !== null && " (sorted by distance)"}
        </p>

        {/* ── Map ──────────────────────────────────────────────────── */}
        <div
          className="fade fade-3"
          style={{
            marginBottom: 20,
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
            overflow: "hidden",
          }}
        >
          <LeafletMapDynamic
            center={userLat !== null && userLng !== null ? [userLat, userLng] : [20.5937, 78.9629]}
            zoom={userLat !== null ? 10 : 5}
            height={350}
            markers={sortedFiltered.map((item, i): MapMarker => ({
              id: `${item.type}-${i}`,
              lat: item.lat,
              lng: item.lng,
              name: item.name,
              type: item.badgeLabel,
              phone: item.phone,
              website: item.website,
              isLive: item.type === "institute" && "isLive" in item && !!item.isLive,
            }))}
          />
        </div>
        {liveLoading && (
          <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: 12, textAlign: "center" }}>
            Searching for nearby facilities...
          </p>
        )}

        {/* ── List view ────────────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sortedFiltered.length === 0 && (
            <div
              className="card"
              style={{ padding: "28px 20px", textAlign: "center", color: "var(--text-secondary)", fontSize: "0.9rem" }}
            >
              No results match your search. Try a different filter or city.
            </div>
          )}

          {sortedFiltered.map((item, i) => (
            <div
              key={`${item.type}-${item.name}-${i}`}
              className="card"
              style={{ padding: "16px 20px", display: "flex", gap: 14, alignItems: "flex-start" }}
            >
              {/* Color dot */}
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: item.badgeColor,
                  marginTop: 6,
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Name + type tag */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span
                    style={{
                      fontFamily: "'Fredoka',sans-serif",
                      fontWeight: 600,
                      fontSize: "0.92rem",
                      color: "var(--text-primary)",
                    }}
                  >
                    {item.name}
                  </span>
                  <span
                    style={{
                      fontSize: "0.62rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      padding: "2px 7px",
                      borderRadius: "var(--r-full)",
                      background: item.type === "doctor" ? "var(--sage-100)" : "var(--sage-100)",
                      color: item.type === "doctor" ? "var(--sage-700)" : "var(--sage-600)",
                    }}
                  >
                    {item.type === "doctor" ? "Doctor" : "Institute"}
                  </span>
                  {"isLive" in item && item.isLive && (
                    <span style={{
                      fontSize: "0.6rem", fontWeight: 700, padding: "2px 6px",
                      borderRadius: "var(--r-full)", background: "var(--sage-500)", color: "#fff",
                    }}>
                      Live
                    </span>
                  )}
                </div>

                {/* Subtitle (hospital / category) */}
                <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: 2 }}>
                  {item.address}, {item.city}
                </div>

                {/* Badges + actions */}
                <div style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap", alignItems: "center" }}>
                  <span
                    style={{
                      fontSize: "0.68rem",
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: "var(--r-full)",
                      background: item.badgeColor + "18",
                      color: item.badgeColor,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.badgeLabel}
                  </span>
                  {item.phone && (
                    <a
                      href={`tel:${item.phone}`}
                      style={{ fontSize: "0.78rem", color: "var(--sage-500)", fontWeight: 600, textDecoration: "none" }}
                    >
                      {item.phone}
                    </a>
                  )}
                  {item.website && (
                    <a
                      href={item.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: "0.78rem", color: "var(--sage-500)", fontWeight: 600, textDecoration: "none" }}
                    >
                      Website
                    </a>
                  )}
                </div>

                {/* Distance */}
                {userLat !== null && userLng !== null && (
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 4 }}>
                    ~{Math.round(distance(userLat, userLng, item.lat, item.lng))} km away
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* ── Disclaimer ───────────────────────────────────────────── */}
        <div
          className="card"
          style={{
            marginTop: 24,
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

