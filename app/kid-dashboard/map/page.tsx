"use client";

import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import { useAuthGuard } from "../../hooks/useAuthGuard";
import { INSTITUTES, CATEGORY_LABELS, CATEGORY_COLORS, type Institute } from "../../lib/data/institutes";

type CategoryFilter = Institute["category"] | "all";

export default function MapPage() {
  const { loading: authLoading, isAuthenticated } = useAuthGuard();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [MapComponent, setMapComponent] = useState<any>(null);

  useEffect(() => {
    const saved = (typeof window !== "undefined" && localStorage.getItem("autisense-theme")) || "light";
    setTheme(saved as "light" | "dark");
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    if (typeof window !== "undefined") localStorage.setItem("autisense-theme", theme);
  }, [theme]);

  // Try loading Leaflet dynamically
  useEffect(() => {
    async function loadLeaflet() {
      try {
        // Add Leaflet CSS
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
        // Leaflet not installed — fallback to list view
        setMapComponent(null);
      }
    }
    loadLeaflet();
  }, []);

  const filtered = useMemo(() => {
    let list = INSTITUTES;
    if (category !== "all") {
      list = list.filter((i) => i.category === category);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.city.toLowerCase().includes(q) ||
          i.address.toLowerCase().includes(q),
      );
    }
    return list;
  }, [category, search]);

  const requestLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLat(pos.coords.latitude);
        setUserLng(pos.coords.longitude);
      },
      () => {/* denied */},
    );
  };

  const distance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const sortedFiltered = useMemo(() => {
    if (userLat === null || userLng === null) return filtered;
    return [...filtered].sort(
      (a, b) => distance(userLat, userLng, a.lat, a.lng) - distance(userLat, userLng, b.lat, b.lng),
    );
  }, [filtered, userLat, userLng]);

  const categories: { value: CategoryFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "hospital", label: "Hospital" },
    { value: "therapy_center", label: "Therapy" },
    { value: "special_school", label: "School" },
    { value: "support_group", label: "Support" },
  ];

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

      <div className="main fade fade-1" style={{ maxWidth: 900, padding: "24px 20px 80px" }}>
        <h1 className="page-title">Nearby <em>Institutes</em></h1>
        <p className="subtitle">Find autism support centers, hospitals, and schools near you.</p>

        {/* Search + Near Me */}
        <div className="fade fade-2" style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <input
            type="text"
            placeholder="Search by name or city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input"
            style={{ flex: 1, minHeight: 48 }}
          />
          <button
            onClick={requestLocation}
            className="btn btn-primary"
            style={{ minHeight: 48, padding: "8px 18px", fontSize: "0.85rem", whiteSpace: "nowrap" }}
          >
            Near Me
          </button>
        </div>

        {/* Category filters */}
        <div className="fade fade-2" style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
          {categories.map((c) => (
            <button
              key={c.value}
              onClick={() => setCategory(c.value)}
              className="btn"
              style={{
                padding: "6px 14px",
                fontSize: "0.78rem",
                fontWeight: category === c.value ? 700 : 500,
                background: category === c.value
                  ? c.value === "all" ? "var(--sage-100)" : CATEGORY_COLORS[c.value as Institute["category"]] + "22"
                  : "var(--card)",
                color: category === c.value
                  ? c.value === "all" ? "var(--sage-700)" : CATEGORY_COLORS[c.value as Institute["category"]]
                  : "var(--text-secondary)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-full)",
                minHeight: 34,
              }}
            >
              {c.label}
            </button>
          ))}
        </div>

        <p className="fade fade-3" style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: 16 }}>
          {sortedFiltered.length} result{sortedFiltered.length !== 1 ? "s" : ""}
          {userLat !== null && " (sorted by distance)"}
        </p>

        {/* Map (if leaflet available) */}
        {MapComponent && (
          <div className="fade fade-3" style={{ height: 350, borderRadius: "var(--r-lg)", overflow: "hidden", marginBottom: 20, border: "1px solid var(--border)" }}>
            <LeafletMap
              modules={MapComponent}
              institutes={sortedFiltered}
              userLat={userLat}
              userLng={userLng}
            />
          </div>
        )}

        {/* List view */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sortedFiltered.map((inst, i) => (
            <div
              key={i}
              className="card"
              style={{ padding: "16px 20px", display: "flex", gap: 14, alignItems: "flex-start" }}
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: CATEGORY_COLORS[inst.category],
                  marginTop: 6,
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "'Fredoka',sans-serif", fontWeight: 600, fontSize: "0.92rem", color: "var(--text-primary)" }}>
                  {inst.name}
                </div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: 2 }}>
                  {inst.address}, {inst.city}
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
                  <span
                    style={{
                      fontSize: "0.68rem",
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: "var(--r-full)",
                      background: CATEGORY_COLORS[inst.category] + "18",
                      color: CATEGORY_COLORS[inst.category],
                    }}
                  >
                    {CATEGORY_LABELS[inst.category]}
                  </span>
                  {inst.phone && (
                    <a href={`tel:${inst.phone}`} style={{ fontSize: "0.78rem", color: "var(--sage-500)", fontWeight: 600 }}>
                      {inst.phone}
                    </a>
                  )}
                  {inst.website && (
                    <a href={inst.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: "0.78rem", color: "var(--sage-500)", fontWeight: 600 }}>
                      Website
                    </a>
                  )}
                </div>
                {userLat !== null && userLng !== null && (
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 4 }}>
                    ~{Math.round(distance(userLat, userLng, inst.lat, inst.lng))} km away
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function LeafletMap({ modules, institutes, userLat, userLng }: { modules: any; institutes: Institute[]; userLat: number | null; userLng: number | null }) {
  const { RL } = modules;
  const { MapContainer, TileLayer, Marker, Popup } = RL;

  const center: [number, number] = userLat !== null && userLng !== null
    ? [userLat, userLng]
    : [20.5937, 78.9629]; // India center
  const zoom = userLat !== null ? 10 : 5;

  return (
    <MapContainer center={center} zoom={zoom} style={{ width: "100%", height: "100%" }} scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {institutes.map((inst, i) => (
        <Marker key={i} position={[inst.lat, inst.lng]}>
          <Popup>
            <strong>{inst.name}</strong><br />
            <span style={{ fontSize: "0.8em", color: CATEGORY_COLORS[inst.category] }}>{CATEGORY_LABELS[inst.category]}</span><br />
            {inst.address}, {inst.city}<br />
            {inst.phone && <><a href={`tel:${inst.phone}`}>{inst.phone}</a><br /></>}
            {inst.website && <a href={inst.website} target="_blank" rel="noopener noreferrer">Website</a>}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
