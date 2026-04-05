/**
 * POST /api/report/pdf
 *
 * Generates a downloadable PDF clinical report using pdf-lib.
 * Includes: AutiSense logo, child info, letter grades, score bars,
 * pie chart, risk indicator, clinical report text, and disclaimer.
 *
 * Request body:
 *   {
 *     report: string,
 *     childName: string,
 *     sessionDate: string,
 *     scores: { gaze: number, motor: number, vocal: number, overall: number },
 *     childAge?: number,            // months
 *     assessmentDuration?: number,   // minutes
 *   }
 *
 * Response:
 *   Binary PDF (Content-Type: application/pdf)
 */

import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, rgb, StandardFonts, PDFPage } from "pdf-lib";
import { logger } from "../../../lib/logger";

const log = logger("report/pdf");

interface PdfRequestBody {
  report: string;
  childName: string;
  sessionDate: string;
  scores: {
    gaze: number;
    motor: number;
    vocal: number;
    overall: number;
  };
  childAge?: number;
  assessmentDuration?: number;
}

// ── Brand palette ───────────────────────────────────────────────
const SAGE_700 = rgb(40 / 255, 82 / 255, 50 / 255);
const SAGE_600 = rgb(55 / 255, 102 / 255, 65 / 255);
const SAGE_500 = rgb(77 / 255, 128 / 255, 88 / 255);
const SAGE_400 = rgb(107 / 255, 158 / 255, 118 / 255);
const SAGE_300 = rgb(140 / 255, 180 / 255, 148 / 255);
const SAGE_100 = rgb(227 / 255, 237 / 255, 230 / 255);
const SAGE_50 = rgb(240 / 255, 247 / 255, 242 / 255);
const TEXT_PRIMARY = rgb(45 / 255, 58 / 255, 48 / 255);
const TEXT_SECONDARY = rgb(90 / 255, 112 / 255, 96 / 255);
const TEXT_MUTED = rgb(140 / 255, 156 / 255, 143 / 255);
const WHITE = rgb(1, 1, 1);
const PEACH_400 = rgb(220 / 255, 120 / 255, 80 / 255);
const PEACH_100 = rgb(255 / 255, 235 / 255, 225 / 255);
const AMBER_400 = rgb(200 / 255, 170 / 255, 50 / 255);
const AMBER_100 = rgb(255 / 255, 248 / 255, 220 / 255);
const BAR_BG = rgb(230 / 255, 235 / 255, 232 / 255);
const SKY_400 = rgb(80 / 255, 160 / 255, 210 / 255);

// ── Helpers ─────────────────────────────────────────────────────

function wrapText(
  text: string,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  fontSize: number,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (paragraph.trim() === "") { lines.push(""); continue; }
    const words = paragraph.split(/\s+/);
    let cur = "";
    for (const word of words) {
      const test = cur ? `${cur} ${word}` : word;
      if (font.widthOfTextAtSize(test, fontSize) > maxWidth && cur) {
        lines.push(cur);
        cur = word;
      } else {
        cur = test;
      }
    }
    if (cur) lines.push(cur);
  }
  return lines;
}

function getRiskLevel(overall: number): { label: string; color: ReturnType<typeof rgb>; bg: ReturnType<typeof rgb> } {
  if (overall >= 70) return { label: "Low Risk", color: SAGE_500, bg: SAGE_50 };
  if (overall >= 40) return { label: "Moderate Risk", color: AMBER_400, bg: AMBER_100 };
  return { label: "Elevated Risk", color: PEACH_400, bg: PEACH_100 };
}

function getLetterGrade(pct: number): { grade: string; color: ReturnType<typeof rgb> } {
  if (pct >= 90) return { grade: "A+", color: SAGE_600 };
  if (pct >= 80) return { grade: "A", color: SAGE_500 };
  if (pct >= 70) return { grade: "B", color: SAGE_400 };
  if (pct >= 60) return { grade: "C", color: AMBER_400 };
  if (pct >= 45) return { grade: "D", color: PEACH_400 };
  return { grade: "F", color: rgb(180 / 255, 60 / 255, 60 / 255) };
}

function formatAge(months: number): string {
  const y = Math.floor(months / 12), m = months % 12;
  if (y === 0) return `${m} month${m !== 1 ? "s" : ""}`;
  if (m === 0) return `${y} year${y !== 1 ? "s" : ""}`;
  return `${y}y ${m}m`;
}

/**
 * Draws a pie chart using line segments to approximate arcs.
 * Each slice: { value (0-1), color, label }
 */
function drawPieChart(
  pg: PDFPage,
  cx: number,
  cy: number,
  radius: number,
  slices: { value: number; color: ReturnType<typeof rgb>; label: string }[],
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  boldFont: Awaited<ReturnType<PDFDocument["embedFont"]>>,
) {
  const total = slices.reduce((s, sl) => s + sl.value, 0);
  if (total === 0) return;

  let startAngle = -Math.PI / 2; // start from top

  for (const slice of slices) {
    const sweepAngle = (slice.value / total) * 2 * Math.PI;
    if (sweepAngle < 0.01) { startAngle += sweepAngle; continue; }

    // Draw filled sector using many small triangles
    const steps = Math.max(20, Math.ceil(sweepAngle * 30));
    const angleStep = sweepAngle / steps;

    for (let i = 0; i < steps; i++) {
      const a1 = startAngle + i * angleStep;
      const a2 = startAngle + (i + 1) * angleStep;
      const x1 = cx + radius * Math.cos(a1);
      const y1 = cy + radius * Math.sin(a1);
      const x2 = cx + radius * Math.cos(a2);
      const y2 = cy + radius * Math.sin(a2);

      // Draw triangle from center to two arc points
      pg.drawLine({ start: { x: cx, y: cy }, end: { x: x1, y: y1 }, thickness: radius * 0.03, color: slice.color });
      pg.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 1.5, color: slice.color });

      // Fill by drawing radial lines
      const aMid = (a1 + a2) / 2;
      for (let r = 2; r < radius; r += 1.5) {
        const fx = cx + r * Math.cos(aMid);
        const fy = cy + r * Math.sin(aMid);
        pg.drawCircle({ x: fx, y: fy, size: 1.2, color: slice.color });
      }
    }

    // Draw label line
    const midAngle = startAngle + sweepAngle / 2;
    const labelRadius = radius + 14;
    const lx = cx + labelRadius * Math.cos(midAngle);
    const ly = cy + labelRadius * Math.sin(midAngle);

    const pctText = `${Math.round((slice.value / total) * 100)}%`;
    const labelX = lx + (Math.cos(midAngle) >= 0 ? 4 : -font.widthOfTextAtSize(slice.label, 7) - 4);
    const pctX = lx + (Math.cos(midAngle) >= 0 ? 4 : -boldFont.widthOfTextAtSize(pctText, 7.5) - 4);

    pg.drawText(pctText, { x: pctX, y: ly + 2, size: 7.5, font: boldFont, color: slice.color });
    pg.drawText(slice.label, { x: labelX, y: ly - 7, size: 7, font, color: TEXT_SECONDARY });

    startAngle += sweepAngle;
  }

  // White center donut hole
  pg.drawCircle({ x: cx, y: cy, size: radius * 0.45, color: WHITE, borderColor: SAGE_100, borderWidth: 1 });
}

/**
 * Draws the AutiSense leaf logo.
 */
function drawLogo(pg: PDFPage, x: number, y: number, size: number) {
  const s = size;
  // Leaf body (a diamond/ellipse shape made of overlapping circles)
  pg.drawCircle({ x: x, y: y + s * 0.15, size: s * 0.42, color: WHITE });
  pg.drawCircle({ x: x - s * 0.08, y: y + s * 0.22, size: s * 0.35, color: WHITE });
  pg.drawCircle({ x: x + s * 0.08, y: y + s * 0.22, size: s * 0.35, color: WHITE });

  // Stem
  pg.drawLine({
    start: { x: x, y: y - s * 0.1 },
    end: { x: x, y: y + s * 0.5 },
    thickness: 2,
    color: WHITE,
  });

  // Leaf veins
  pg.drawLine({
    start: { x: x, y: y + s * 0.25 },
    end: { x: x - s * 0.2, y: y + s * 0.38 },
    thickness: 1,
    color: rgb(1, 1, 1),
  });
  pg.drawLine({
    start: { x: x, y: y + s * 0.25 },
    end: { x: x + s * 0.2, y: y + s * 0.38 },
    thickness: 1,
    color: rgb(1, 1, 1),
  });
}

// ── Main handler ────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Auth gate
  const { requireApiAuth } = await import("../../../lib/auth/requireApiAuth");
  const authResult = await requireApiAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  let body: PdfRequestBody;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body?.report || !body?.childName || !body?.sessionDate || !body?.scores) {
    return NextResponse.json(
      { error: "Missing required fields: report, childName, sessionDate, scores" },
      { status: 400 },
    );
  }

  const { report, childName, sessionDate, scores, childAge, assessmentDuration } = body;

  try {
    const pdfDoc = await PDFDocument.create();
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const helveticaOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

    const PAGE_WIDTH = 595.28; // A4
    const PAGE_HEIGHT = 841.89;
    const MARGIN = 50;
    const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;

    let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    let y = PAGE_HEIGHT - MARGIN;
    let pageNum = 1;

    function drawFooter() {
      const footerY = 28;
      page.drawLine({
        start: { x: MARGIN, y: footerY + 14 },
        end: { x: PAGE_WIDTH - MARGIN, y: footerY + 14 },
        thickness: 0.5,
        color: SAGE_300,
      });
      page.drawText("AutiSense Developmental Screening Platform", {
        x: MARGIN, y: footerY, size: 7, font: helvetica, color: TEXT_MUTED,
      });
      page.drawText(`Page ${pageNum}`, {
        x: PAGE_WIDTH - MARGIN - 30, y: footerY, size: 7, font: helvetica, color: TEXT_MUTED,
      });
      page.drawText("Confidential", {
        x: PAGE_WIDTH / 2 - 18, y: footerY, size: 7, font: helveticaOblique, color: TEXT_MUTED,
      });
    }

    function addNewPage() {
      drawFooter();
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      pageNum++;
      y = PAGE_HEIGHT - MARGIN;
    }

    function ensureSpace(needed: number) {
      if (y - needed < MARGIN + 50) addNewPage();
    }

    // ═══════════════════════════════════════════════════════════════
    // HEADER with logo
    // ═══════════════════════════════════════════════════════════════
    const headerHeight = 90;
    page.drawRectangle({
      x: 0, y: PAGE_HEIGHT - headerHeight,
      width: PAGE_WIDTH, height: headerHeight,
      color: SAGE_500,
    });
    page.drawRectangle({
      x: 0, y: PAGE_HEIGHT - headerHeight - 4,
      width: PAGE_WIDTH, height: 4,
      color: SAGE_700,
    });

    // Logo
    drawLogo(page, MARGIN + 16, PAGE_HEIGHT - headerHeight / 2 - 8, 20);

    page.drawText("AutiSense", {
      x: MARGIN + 40, y: PAGE_HEIGHT - 38, size: 24, font: helveticaBold, color: WHITE,
    });
    page.drawText("Developmental Screening Report", {
      x: MARGIN + 40, y: PAGE_HEIGHT - 56, size: 11, font: helvetica, color: rgb(0.92, 0.96, 0.93),
    });

    // Right side: date + ref
    page.drawText(`Report Date: ${new Date().toLocaleDateString("en-GB")}`, {
      x: PAGE_WIDTH - MARGIN - 140, y: PAGE_HEIGHT - 35, size: 9, font: helvetica, color: rgb(0.88, 0.93, 0.89),
    });
    page.drawText(`Ref: AS-${Date.now().toString(36).toUpperCase()}`, {
      x: PAGE_WIDTH - MARGIN - 140, y: PAGE_HEIGHT - 50, size: 8, font: helvetica, color: rgb(0.82, 0.88, 0.84),
    });

    y = PAGE_HEIGHT - headerHeight - 28;

    // ═══════════════════════════════════════════════════════════════
    // CHILD INFO
    // ═══════════════════════════════════════════════════════════════
    const infoH = 64;
    page.drawRectangle({ x: MARGIN, y: y - infoH, width: CONTENT_WIDTH, height: infoH, color: SAGE_50, borderColor: SAGE_300, borderWidth: 1 });
    page.drawRectangle({ x: MARGIN, y: y - infoH, width: 4, height: infoH, color: SAGE_500 });

    page.drawText("CHILD INFORMATION", { x: MARGIN + 14, y: y - 15, size: 8, font: helveticaBold, color: SAGE_600 });
    page.drawText(`Name: ${childName}`, { x: MARGIN + 14, y: y - 32, size: 10, font: helvetica, color: TEXT_PRIMARY });
    page.drawText(`Session Date: ${sessionDate}`, { x: MARGIN + CONTENT_WIDTH / 2, y: y - 32, size: 10, font: helvetica, color: TEXT_PRIMARY });
    page.drawText(`Age: ${childAge ? formatAge(childAge) : "Not specified"}`, { x: MARGIN + 14, y: y - 50, size: 10, font: helvetica, color: TEXT_PRIMARY });
    page.drawText(`Duration: ${assessmentDuration ? `${assessmentDuration} min` : "N/A"}`, { x: MARGIN + CONTENT_WIDTH / 2, y: y - 50, size: 10, font: helvetica, color: TEXT_PRIMARY });

    y -= infoH + 22;

    // ═══════════════════════════════════════════════════════════════
    // SCORE CARDS WITH LETTER GRADES
    // ═══════════════════════════════════════════════════════════════
    ensureSpace(200);

    page.drawText("ASSESSMENT SCORES", { x: MARGIN, y, size: 10, font: helveticaBold, color: SAGE_600 });
    y -= 8;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + 140, y }, thickness: 2, color: SAGE_500 });
    y -= 20;

    const scoreItems = [
      { label: "Gaze Tracking", desc: "Social visual engagement", value: scores.gaze },
      { label: "Motor Coordination", desc: "Movement & behavior patterns", value: scores.motor },
      { label: "Vocalization Quality", desc: "Communication response", value: scores.vocal },
    ];

    const BAR_WIDTH = CONTENT_WIDTH - 190;
    const BAR_HEIGHT = 14;

    for (const item of scoreItems) {
      ensureSpace(42);

      const pct = item.value * 100;
      const grade = getLetterGrade(pct);
      const barColor = pct >= 60 ? SAGE_500 : pct >= 35 ? AMBER_400 : PEACH_400;

      // Grade circle
      const gradeCircleX = MARGIN + 16;
      page.drawCircle({ x: gradeCircleX, y: y - 4, size: 14, color: grade.color });
      const gradeTextW = helveticaBold.widthOfTextAtSize(grade.grade, 11);
      page.drawText(grade.grade, { x: gradeCircleX - gradeTextW / 2, y: y - 8, size: 11, font: helveticaBold, color: WHITE });

      // Label + description
      page.drawText(item.label, { x: MARGIN + 38, y: y, size: 9.5, font: helveticaBold, color: TEXT_PRIMARY });
      page.drawText(item.desc, { x: MARGIN + 38, y: y - 12, size: 7.5, font: helvetica, color: TEXT_MUTED });

      // Percentage
      page.drawText(`${pct.toFixed(0)}%`, { x: MARGIN + 155, y: y - 3, size: 10, font: helveticaBold, color: TEXT_PRIMARY });

      // Bar
      const barX = MARGIN + 190;
      page.drawRectangle({ x: barX, y: y - 9, width: BAR_WIDTH, height: BAR_HEIGHT, color: BAR_BG, borderColor: SAGE_300, borderWidth: 0.5 });
      const fillW = Math.max(2, (pct / 100) * BAR_WIDTH);
      page.drawRectangle({ x: barX, y: y - 9, width: fillW, height: BAR_HEIGHT, color: barColor });

      y -= 34;
    }

    // ═══════════════════════════════════════════════════════════════
    // OVERALL SCORE + RISK LEVEL + GRADE
    // ═══════════════════════════════════════════════════════════════
    y -= 8;
    ensureSpace(60);

    const risk = getRiskLevel(scores.overall);
    const overallGrade = getLetterGrade(scores.overall);

    // Overall box
    page.drawRectangle({ x: MARGIN, y: y - 48, width: CONTENT_WIDTH, height: 48, color: risk.bg, borderColor: risk.color, borderWidth: 1.5 });

    // Grade circle
    const overallGradeX = MARGIN + 28;
    page.drawCircle({ x: overallGradeX, y: y - 24, size: 18, color: overallGrade.color });
    const ogW = helveticaBold.widthOfTextAtSize(overallGrade.grade, 14);
    page.drawText(overallGrade.grade, { x: overallGradeX - ogW / 2, y: y - 29, size: 14, font: helveticaBold, color: WHITE });

    page.drawText(`Overall Score: ${scores.overall}/100`, { x: MARGIN + 54, y: y - 20, size: 13, font: helveticaBold, color: TEXT_PRIMARY });
    page.drawText(risk.label, { x: MARGIN + 54, y: y - 36, size: 10, font: helveticaBold, color: risk.color });

    // Risk badge
    const badgeW = helveticaBold.widthOfTextAtSize(risk.label, 10) + 20;
    const badgeX = PAGE_WIDTH - MARGIN - badgeW - 14;
    page.drawRectangle({ x: badgeX, y: y - 38, width: badgeW, height: 22, color: risk.color });
    page.drawText(risk.label, { x: badgeX + 10, y: y - 31, size: 10, font: helveticaBold, color: WHITE });

    y -= 68;

    // ═══════════════════════════════════════════════════════════════
    // SCORE DISTRIBUTION PIE CHART
    // ═══════════════════════════════════════════════════════════════
    ensureSpace(160);

    page.drawText("SCORE DISTRIBUTION", { x: MARGIN, y, size: 10, font: helveticaBold, color: SAGE_600 });
    y -= 8;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + 130, y }, thickness: 2, color: SAGE_500 });
    y -= 10;

    const pieY = y - 60;
    const pieX = MARGIN + 80;

    drawPieChart(page, pieX, pieY, 45, [
      { value: scores.gaze, color: SAGE_500, label: "Gaze" },
      { value: scores.motor, color: SKY_400, label: "Motor" },
      { value: scores.vocal, color: AMBER_400, label: "Vocal" },
    ], helvetica, helveticaBold);

    // Grading scale legend on the right
    const legendX = MARGIN + 220;
    let legendY = y - 10;
    page.drawText("GRADING SCALE", { x: legendX, y: legendY, size: 8, font: helveticaBold, color: SAGE_600 });
    legendY -= 14;

    const grades = [
      { range: "90-100%", grade: "A+", color: SAGE_600 },
      { range: "80-89%", grade: "A", color: SAGE_500 },
      { range: "70-79%", grade: "B", color: SAGE_400 },
      { range: "60-69%", grade: "C", color: AMBER_400 },
      { range: "45-59%", grade: "D", color: PEACH_400 },
      { range: "0-44%", grade: "F", color: rgb(180 / 255, 60 / 255, 60 / 255) },
    ];

    for (const g of grades) {
      page.drawCircle({ x: legendX + 6, y: legendY + 2, size: 5, color: g.color });
      page.drawText(g.grade, { x: legendX + 16, y: legendY - 1, size: 8, font: helveticaBold, color: g.color });
      page.drawText(g.range, { x: legendX + 36, y: legendY - 1, size: 8, font: helvetica, color: TEXT_SECONDARY });
      legendY -= 14;
    }

    y = Math.min(pieY - 60, legendY - 10);

    // ═══════════════════════════════════════════════════════════════
    // METHODOLOGY
    // ═══════════════════════════════════════════════════════════════
    y -= 6;
    ensureSpace(50);
    page.drawText("Methodology", { x: MARGIN, y, size: 8, font: helveticaBold, color: TEXT_MUTED });
    y -= 12;

    const methodLines = wrapText(
      "Scores are derived from computer-assisted behavioral observation during structured screening tasks. " +
      "Gaze tracking uses MediaPipe face mesh analysis, motor coordination uses YOLO pose estimation, " +
      "and vocalization quality is assessed through Web Speech API response analysis. " +
      "All processing occurs locally on the user's device. No video or images are stored.",
      helveticaOblique, 7.5, CONTENT_WIDTH,
    );
    for (const mLine of methodLines) {
      page.drawText(mLine, { x: MARGIN, y, size: 7.5, font: helveticaOblique, color: TEXT_MUTED });
      y -= 10;
    }

    y -= 10;

    // ═══════════════════════════════════════════════════════════════
    // CLINICAL SCREENING REPORT TEXT
    // ═══════════════════════════════════════════════════════════════
    ensureSpace(30);

    page.drawRectangle({ x: MARGIN, y: y - 2, width: 4, height: 18, color: SAGE_500 });
    page.drawText("CLINICAL SCREENING REPORT", { x: MARGIN + 12, y, size: 12, font: helveticaBold, color: TEXT_PRIMARY });
    y -= 22;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 1, color: SAGE_500 });
    y -= 14;

    const wrappedLines = wrapText(report, helvetica, 9, CONTENT_WIDTH - 20);
    const LINE_HEIGHT = 13;

    for (const line of wrappedLines) {
      ensureSpace(LINE_HEIGHT + 5);

      const isSeparatorLine = /^[=\-]{3,}$/.test(line.trim());
      const isMainHeader = /^(CRITERION\s+[AB]|MOTOR\s+DEVELOPMENT|RECOMMENDATION)/i.test(line);
      const isSubHeader = /^(Gaze\s+Tracking|Vocalization|Facial\s+Affect|Social\s+Communication|Motor\s+Pattern|Response\s+Latency|Behavior\s+Classification|Behavior\s+Distribution|Overall\s+Screening|Based\s+on\s+this|Note:)/i.test(line);
      const isFlagLine = /Flag:.*(?:FLAGGED|Within)/i.test(line);
      const isBullet = /^\s*[-•]\s/.test(line) || /^\s*\d+\.\s/.test(line);

      if (isSeparatorLine) {
        y -= 6;
        ensureSpace(12);
        page.drawLine({ start: { x: MARGIN + 30, y }, end: { x: PAGE_WIDTH - MARGIN - 30, y }, thickness: 0.75, color: SAGE_300 });
        y -= 6;
      } else if (isMainHeader) {
        y -= 10;
        ensureSpace(LINE_HEIGHT + 14);
        page.drawRectangle({ x: MARGIN + 4, y: y - 3, width: 3, height: 14, color: SAGE_500 });
        page.drawText(line, { x: MARGIN + 12, y, size: 10, font: helveticaBold, color: SAGE_600 });
      } else if (isSubHeader) {
        y -= 4;
        ensureSpace(LINE_HEIGHT + 6);
        page.drawText(line, { x: MARGIN + 4, y, size: 9, font: helveticaBold, color: TEXT_PRIMARY });
      } else if (isFlagLine) {
        const isFlagged = /FLAGGED/i.test(line);
        page.drawText(line, { x: MARGIN + 4, y, size: 9, font: helveticaBold, color: isFlagged ? PEACH_400 : SAGE_500 });
      } else if (isBullet) {
        page.drawText(line, { x: MARGIN + 16, y, size: 9, font: helvetica, color: TEXT_SECONDARY });
      } else if (line === "") {
        // blank line — spacing only
      } else if (line.startsWith("IMPORTANT")) {
        y -= 4;
        page.drawText(line, { x: MARGIN + 4, y, size: 8.5, font: helveticaBold, color: TEXT_SECONDARY });
      } else {
        page.drawText(line, { x: MARGIN + 4, y, size: 9, font: helvetica, color: TEXT_SECONDARY });
      }

      y -= LINE_HEIGHT;
    }

    // ═══════════════════════════════════════════════════════════════
    // DISCLAIMER
    // ═══════════════════════════════════════════════════════════════
    y -= 14;
    ensureSpace(85);

    page.drawLine({ start: { x: MARGIN + 40, y }, end: { x: PAGE_WIDTH - MARGIN - 40, y }, thickness: 0.5, color: SAGE_300 });
    y -= 16;

    page.drawRectangle({ x: MARGIN, y: y - 70, width: CONTENT_WIDTH, height: 70, color: SAGE_50, borderColor: SAGE_300, borderWidth: 0.5 });

    page.drawText("IMPORTANT NOTICE", { x: MARGIN + 12, y: y - 14, size: 8, font: helveticaBold, color: SAGE_600 });

    const disclaimerLines = wrapText(
      "This report is generated by AutiSense, a computer-assisted developmental screening tool. " +
      "It is NOT a clinical diagnosis. Autism spectrum disorder can only be diagnosed by qualified " +
      "healthcare professionals through comprehensive evaluation using standardized diagnostic " +
      "instruments (e.g., ADOS-2, ADI-R). This screening report is intended to support, not " +
      "replace, clinical judgment. Please share this report with a developmental paediatrician " +
      "or autism specialist for professional interpretation.",
      helvetica, 7.5, CONTENT_WIDTH - 24,
    );

    let dY = y - 28;
    for (const dLine of disclaimerLines) {
      page.drawText(dLine, { x: MARGIN + 12, y: dY, size: 7.5, font: helvetica, color: TEXT_SECONDARY });
      dY -= 10;
    }

    drawFooter();

    // ═══════════════════════════════════════════════════════════════
    // FINALIZE
    // ═══════════════════════════════════════════════════════════════
    const pdfBytes = await pdfDoc.save();

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="AutiSense_Report_${sessionDate.replace(/\//g, "-")}.pdf"`,
        "Content-Length": String(pdfBytes.length),
      },
    });
  } catch (err) {
    log.error("PDF generation failed", { error: err });
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
  }
}
