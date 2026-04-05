/**
 * POST /api/nearby
 *
 * Queries the Overpass API (OpenStreetMap) for nearby healthcare facilities.
 * Returns hospitals, clinics, doctors, and social facilities.
 *
 * Body: { lat: number, lng: number, radius?: number }
 * Response: { results: NearbyResult[], source: "overpass" }
 */

import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/app/lib/logger";

const log = logger("nearby");

interface NearbyResult {
  id: number;
  name: string;
  lat: number;
  lng: number;
  type: string;
  phone?: string;
  website?: string;
}

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

export async function POST(req: NextRequest) {
  // IP-based rate limiting (unauthenticated endpoint, proxies to Overpass)
  const { apiRateLimiter } = await import("@/app/lib/rateLimit");
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = apiRateLimiter.check(`nearby:${ip}`);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  let body: { lat: number; lng: number; radius?: number };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { lat, lng, radius: rawRadius = 10000 } = body;

  if (typeof lat !== "number" || typeof lng !== "number" ||
      !Number.isFinite(lat) || !Number.isFinite(lng) ||
      Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: "Invalid lat/lng" }, { status: 400 });
  }

  const radius = Math.min(Math.max(Number(rawRadius) || 10000, 100), 50000);

  // Overpass QL query: hospitals, clinics, doctors, healthcare, social facilities
  const query = `
    [out:json][timeout:15];
    (
      node["amenity"~"hospital|clinic|doctors"](around:${radius},${lat},${lng});
      node["healthcare"](around:${radius},${lat},${lng});
      node["amenity"="social_facility"](around:${radius},${lat},${lng});
      way["amenity"~"hospital|clinic|doctors"](around:${radius},${lat},${lng});
      way["healthcare"](around:${radius},${lat},${lng});
    );
    out center body;
  `;

  try {
    const res = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Overpass API error", results: [], source: "overpass" },
        { status: 502 },
      );
    }

    const data = await res.json();
    const elements: Array<{
      id: number;
      type: string;
      lat?: number;
      lon?: number;
      center?: { lat: number; lon: number };
      tags?: Record<string, string>;
    }> = data.elements || [];

    const results: NearbyResult[] = elements
      .filter((el) => {
        const name = el.tags?.name;
        return !!name;
      })
      .map((el) => {
        const elLat = el.lat ?? el.center?.lat ?? 0;
        const elLng = el.lon ?? el.center?.lon ?? 0;
        const tags = el.tags || {};
        const amenity = tags.amenity || tags.healthcare || "facility";

        return {
          id: el.id,
          name: tags.name || "Unknown",
          lat: elLat,
          lng: elLng,
          type: amenity,
          ...(tags.phone ? { phone: tags.phone } : {}),
          ...(tags.website ? { website: tags.website } : {}),
        };
      });

    return NextResponse.json(
      { results, source: "overpass" },
      {
        headers: {
          "Cache-Control": "public, max-age=3600, s-maxage=3600",
        },
      },
    );
  } catch (err) {
    log.error("Overpass query failed", { error: err });
    return NextResponse.json(
      { error: "Failed to query nearby facilities", results: [], source: "overpass" },
      { status: 500 },
    );
  }
}
