"use client";

import Link from "next/link";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuthGuard } from "../../hooks/useAuthGuard";
import { DOCTORS, SPECIALTY_COLORS, type Doctor } from "../../lib/data/doctors";
import { INSTITUTES, CATEGORY_LABELS, CATEGORY_COLORS, type Institute } from "../../lib/data/institutes";
import NavLogo from "../../components/NavLogo";

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
  const { loading: authLoading, isAuthenticated } = useAuthGuard();

  /* Theme */
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    const saved = (typeof window !== "undefined" && localStorage.getItem("autisense-theme")) || "light";
    setTheme(saved as "light" | "dark");
  }, []);
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    if (typeof window !== "undefined") localStorage.setItem("autisense-theme", theme);
  }, [theme]);

  /* State */
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewToggle>("all");
  const [activeChips, setActiveChips] = useState<Set<string>>(new Set());
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [MapComponent, setMapComponent] = useState<any>(null);

  /* Reset chips when toggle changes */
  useEffect(() => {
    setActiveChips(new Set());
  }, [view]);

  /* Dynamically load Leaflet */
  useEffect(() => {
    async function loadLeaflet() {
      try {
        if (!document.querySelector('link[href*="leaflet"]')) {
          const link = document.createElement("link");
          link.rel = "stylesheet";
          link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
          document.head.appendChild(link);
        }
        // @ts-expect-error — leaflet may not be installed
        const L = await import(/* webpackIgnore: true */ "leaflet");
        // @ts-expect-error — react-leaflet may not be installed
        const RL = await import(/* webpackIgnore: true */ "react-leaflet");
        setMapComponent({ L, RL });
      } catch {
        setMapComponent(null);
      }
    }
    loadLeaflet();
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
      },
      () => {
        setGeoLoading(false);
      },
    );
  }, []);

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

  /* Filtered items */
  const filtered = useMemo(() => {
    let list = ALL_ITEMS;

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
  }, [view, activeChips, search]);

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
          <button
            onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
            className="btn btn-outline"
            style={{ minHeight: 40, padding: "8px 14px", fontSize: "0.85rem" }}
          >
            {theme === "light" ? "Dark" : "Light"}
          </button>
          <Link
            href="/kid-dashboard"
            className="btn btn-outline"
            style={{ minHeight: 40, padding: "8px 14px", fontSize: "0.85rem" }}
          >
            Home
          </Link>
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
        {MapComponent && (
          <div
            className="fade fade-3"
            style={{
              height: 350,
              borderRadius: "var(--r-lg)",
              overflow: "hidden",
              marginBottom: 20,
              border: "1px solid var(--border)",
            }}
          >
            <LeafletMap
              modules={MapComponent}
              items={sortedFiltered}
              userLat={userLat}
              userLng={userLng}
            />
          </div>
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

/* ═══════════════════════════════════════════════════════════════════════
   LeafletMap Sub-component
   ═══════════════════════════════════════════════════════════════════════ */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function LeafletMap({
  modules,
  items,
  userLat,
  userLng,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  modules: any;
  items: NearbyItem[];
  userLat: number | null;
  userLng: number | null;
}) {
  const { RL } = modules;
  const { MapContainer, TileLayer, Marker, Popup } = RL;

  const center: [number, number] =
    userLat !== null && userLng !== null ? [userLat, userLng] : [20.5937, 78.9629]; // India center

  const zoom = userLat !== null ? 10 : 5;

  return (
    <MapContainer center={center} zoom={zoom} style={{ width: "100%", height: "100%" }} scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {items.map((item, i) => (
        <Marker key={`${item.type}-${i}`} position={[item.lat, item.lng]}>
          <Popup>
            <strong>{item.name}</strong>
            <br />
            <span style={{ fontSize: "0.8em", color: item.badgeColor }}>{item.badgeLabel}</span>
            <br />
            {item.address}, {item.city}
            <br />
            {item.phone && (
              <>
                <a href={`tel:${item.phone}`}>{item.phone}</a>
                <br />
              </>
            )}
            {item.website && (
              <a href={item.website} target="_blank" rel="noopener noreferrer">
                Website
              </a>
            )}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
