/**
 * POST /api/report/weekly
 *   Generate a weekly report for a child and persist it to IndexedDB.
 *   Body: { childId: string }
 *   Returns: the saved WeeklyReport row.
 *
 * GET /api/report/weekly?childId=xxx
 *   List all saved weekly reports for a child (newest first).
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../lib/db/schema";
import { generateWeeklyReport, renderKidReport, renderParentReport } from "../../../lib/reports/weeklyReport";

// ── POST: generate + save ──────────────────────────────────────

interface GenerateBody {
  childId: string;
  childName?: string;
}

export async function POST(req: NextRequest) {
  let body: GenerateBody;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body?.childId) {
    return NextResponse.json(
      { error: "Missing required field: childId" },
      { status: 400 },
    );
  }

  try {
    const data = await generateWeeklyReport(body.childId);
    const name = body.childName || "Superstar";

    // Combine kid + parent HTML into one stored blob (separated by a marker)
    const kidHtml = renderKidReport(data, name);
    const parentHtml = renderParentReport(data, name);
    const combinedHtml = `<!-- KID -->${kidHtml}<!-- SPLIT --><!-- PARENT -->${parentHtml}`;

    const row = {
      childId: data.childId,
      weekStart: data.weekStart,
      weekEnd: data.weekEnd,
      gamesPlayed: data.gamesPlayed,
      avgScore: data.avgScore,
      topGame: data.topGame,
      streakDays: data.streakDays,
      reportHtml: combinedHtml,
      generatedAt: Date.now(),
      emailed: false,
    };

    const id = await db.weeklyReports.add(row);

    return NextResponse.json({ ...row, id, reportData: data });
  } catch (err) {
    console.error("[Report/Weekly] Generation failed:", err);
    return NextResponse.json(
      { error: "Failed to generate weekly report" },
      { status: 500 },
    );
  }
}

// ── GET: list saved reports ────────────────────────────────────

export async function GET(req: NextRequest) {
  const childId = req.nextUrl.searchParams.get("childId");

  if (!childId) {
    return NextResponse.json(
      { error: "Missing query param: childId" },
      { status: 400 },
    );
  }

  try {
    const reports = await db.weeklyReports
      .where("childId")
      .equals(childId)
      .reverse()
      .sortBy("generatedAt");

    return NextResponse.json({ reports });
  } catch (err) {
    console.error("[Report/Weekly] Listing failed:", err);
    return NextResponse.json(
      { error: "Failed to list weekly reports" },
      { status: 500 },
    );
  }
}
