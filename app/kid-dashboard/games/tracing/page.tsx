"use client";

import Link from "next/link";
import { useState, useEffect, useCallback, useRef } from "react";
import { getDifficulty, saveDifficulty } from "../../../lib/games/difficultyEngine";
import { addGameActivity } from "../../../lib/db/gameActivity.repository";
import { updateStreak } from "../../../lib/db/streak.repository";
import NavLogo from "../../../components/NavLogo";
import ThemeToggle from "../../../components/ThemeToggle";

type Screen = "start" | "play" | "result";
interface Point { x: number; y: number }
interface TracingShape { name: string; label: string; points: Point[] }

/* ---------- shape / letter point definitions (normalised 0-1) ---------- */

function arc(cx: number, cy: number, r: number, from: number, to: number, n: number): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i <= n; i++) {
    const a = from + (i / n) * (to - from);
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return pts;
}

const SHAPES: TracingShape[] = [
  { name: "circle", label: "Circle", points: arc(0.5, 0.5, 0.38, -Math.PI / 2, Math.PI * 1.5, 36) },
  { name: "square", label: "Square", points: [
    { x: 0.2, y: 0.2 }, { x: 0.8, y: 0.2 }, { x: 0.8, y: 0.8 }, { x: 0.2, y: 0.8 }, { x: 0.2, y: 0.2 }] },
  { name: "triangle", label: "Triangle", points: [
    { x: 0.5, y: 0.15 }, { x: 0.85, y: 0.82 }, { x: 0.15, y: 0.82 }, { x: 0.5, y: 0.15 }] },
];

const UPPER_LETTERS: TracingShape[] = [
  { name: "A", label: "Letter A", points: [
    { x: 0.15, y: 0.85 }, { x: 0.5, y: 0.12 }, { x: 0.85, y: 0.85 }, { x: 0.68, y: 0.55 }, { x: 0.32, y: 0.55 }] },
  { name: "B", label: "Letter B", points: [
    { x: 0.25, y: 0.85 }, { x: 0.25, y: 0.12 }, { x: 0.6, y: 0.12 }, { x: 0.72, y: 0.22 },
    { x: 0.72, y: 0.38 }, { x: 0.6, y: 0.48 }, { x: 0.25, y: 0.48 }, { x: 0.62, y: 0.48 },
    { x: 0.75, y: 0.58 }, { x: 0.75, y: 0.75 }, { x: 0.62, y: 0.85 }, { x: 0.25, y: 0.85 }] },
  { name: "C", label: "Letter C", points: arc(0.5, 0.5, 0.36, -0.8, Math.PI + 0.8, 20) },
  { name: "D", label: "Letter D", points: [
    { x: 0.25, y: 0.85 }, { x: 0.25, y: 0.12 }, { x: 0.55, y: 0.12 },
    { x: 0.75, y: 0.3 }, { x: 0.75, y: 0.67 }, { x: 0.55, y: 0.85 }, { x: 0.25, y: 0.85 }] },
  { name: "E", label: "Letter E", points: [
    { x: 0.72, y: 0.15 }, { x: 0.28, y: 0.15 }, { x: 0.28, y: 0.5 }, { x: 0.62, y: 0.5 },
    { x: 0.28, y: 0.5 }, { x: 0.28, y: 0.85 }, { x: 0.72, y: 0.85 }] },
];

const LOWER_LETTERS: TracingShape[] = [
  { name: "a", label: "Letter a", points: [
    ...arc(0.45, 0.55, 0.2, 0, Math.PI * 2, 24), { x: 0.65, y: 0.35 }, { x: 0.65, y: 0.85 }] },
  { name: "b", label: "Letter b", points: [
    { x: 0.3, y: 0.12 }, { x: 0.3, y: 0.85 },
    ...arc(0.5, 0.6, 0.2, -Math.PI / 2, Math.PI * 1.5, 20)] },
];

function shuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}

function getShapesForLevel(level: number, count: number): TracingShape[] {
  const pool = level <= 1 ? SHAPES : level <= 3 ? [...SHAPES, ...UPPER_LETTERS] : [...SHAPES, ...UPPER_LETTERS, ...LOWER_LETTERS];
  return shuffle(pool).slice(0, count);
}

function interpolate(pts: Point[], every: number): Point[] {
  const out: Point[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i - 1].x, dy = pts[i].y - pts[i - 1].y;
    const steps = Math.max(1, Math.round(Math.sqrt(dx * dx + dy * dy) / every));
    for (let s = 1; s <= steps; s++) out.push({ x: pts[i - 1].x + (dx * s) / steps, y: pts[i - 1].y + (dy * s) / steps });
  }
  return out;
}

const statStyle = { fontSize: "1.8rem", fontFamily: "'Fredoka',sans-serif" as const, fontWeight: 700, color: "var(--sage-500)" };
const statLabel = { fontSize: "0.82rem", color: "var(--text-secondary)", fontWeight: 600 };

/* ---------- component ---------- */

export default function TracingGamePage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [screen, setScreen] = useState<Screen>("start");
  const [shapes, setShapes] = useState<TracingShape[]>([]);
  const [shapeIdx, setShapeIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [scores, setScores] = useState<number[]>([]);
  const [startTime, setStartTime] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [childId, setChildId] = useState("default");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const traceRef = useRef<Point[]>([]);
  const cpRef = useRef<Point[]>([]);
  const hitRef = useRef<boolean[]>([]);
  const sizeRef = useRef(0);

  useEffect(() => {
    const saved = (typeof window !== "undefined" && localStorage.getItem("autisense-theme")) || "light";
    setTheme(saved as "light" | "dark");
    const cid = (typeof window !== "undefined" && localStorage.getItem("autisense-active-child-id")) || "default";
    setChildId(cid);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    if (typeof window !== "undefined") localStorage.setItem("autisense-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (screen !== "play") return;
    const iv = setInterval(() => setElapsed(Date.now() - startTime), 500);
    return () => clearInterval(iv);
  }, [screen, startTime]);

  /* --- draw dotted guide path on canvas --- */
  const drawGuide = useCallback((shape: TracingShape, size: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = size; canvas.height = size; sizeRef.current = size;
    ctx.clearRect(0, 0, size, size);
    const pts = shape.points;
    const guideColor = getComputedStyle(document.documentElement).getPropertyValue("--sage-300").trim() || "#c1cfc0";
    ctx.setLineDash([10, 10]); ctx.strokeStyle = guideColor;
    ctx.lineWidth = 6; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(pts[0].x * size, pts[0].y * size);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x * size, pts[i].y * size);
    ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = guideColor;
    [pts[0], pts[pts.length - 1]].forEach(p => { ctx.beginPath(); ctx.arc(p.x * size, p.y * size, 8, 0, Math.PI * 2); ctx.fill(); });
    cpRef.current = interpolate(pts, 0.04);
    hitRef.current = new Array(cpRef.current.length).fill(false);
    traceRef.current = [];
  }, []);

  const loadShape = useCallback((list: TracingShape[], idx: number) => {
    setFeedback(null);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = Math.min(canvas.parentElement ? canvas.parentElement.clientWidth : 400, 400);
    drawGuide(list[idx], w);
  }, [drawGuide]);

  const startGame = useCallback(() => {
    const config = getDifficulty("tracing", childId);
    const picked = getShapesForLevel(config.level, config.itemCount);
    setShapes(picked); setShapeIdx(0); setScores([]); setScore(0);
    setStartTime(Date.now()); setScreen("play");
    setTimeout(() => loadShape(picked, 0), 50);
  }, [childId, loadShape]);

  /* --- pointer / touch helpers --- */
  const getPos = useCallback((e: React.MouseEvent | React.TouchEvent): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const [cx, cy] = "touches" in e
      ? (e.touches.length ? [e.touches[0].clientX, e.touches[0].clientY] : [0, 0])
      : [e.clientX, e.clientY];
    if ("touches" in e && !e.touches.length) return null;
    const s = sizeRef.current;
    return { x: (cx - rect.left) * (s / rect.width), y: (cy - rect.top) * (s / rect.height) };
  }, []);

  const drawTrace = useCallback((pos: Point) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const path = traceRef.current;
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--sage-600").trim() || "#5a7a58";
    ctx.lineWidth = 8; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.setLineDash([]);
    if (path.length > 0) { ctx.beginPath(); ctx.moveTo(path[path.length - 1].x, path[path.length - 1].y); ctx.lineTo(pos.x, pos.y); ctx.stroke(); }
    path.push(pos);
    const s = sizeRef.current, tol = 30;
    cpRef.current.forEach((cp, i) => { if (!hitRef.current[i]) { const dx = pos.x - cp.x * s, dy = pos.y - cp.y * s; if (dx * dx + dy * dy <= tol * tol) hitRef.current[i] = true; } });
  }, []);

  const handleDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault(); drawingRef.current = true;
    const pos = getPos(e); if (pos) { traceRef.current = []; drawTrace(pos); }
  }, [getPos, drawTrace]);

  const handleMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault(); if (!drawingRef.current) return;
    const pos = getPos(e); if (pos) drawTrace(pos);
  }, [getPos, drawTrace]);

  const PASS_THRESHOLD = 65;

  const finishShape = useCallback(() => {
    drawingRef.current = false;
    const total = hitRef.current.length; if (total === 0) return;
    const pct = Math.round((hitRef.current.filter(Boolean).length / total) * 100);

    if (pct < PASS_THRESHOLD) {
      setFeedback(`Try Again (${pct}%)`);
      return; // stay on same shape — user clicks "Try Again" button
    }

    const updated = [...scores, pct]; setScores(updated);
    if (shapeIdx + 1 < shapes.length) {
      setFeedback(`Great! (${pct}%)`);
      setTimeout(() => { const next = shapeIdx + 1; setShapeIdx(next); loadShape(shapes, next); }, 900);
    } else {
      const avg = Math.round(updated.reduce((a, b) => a + b, 0) / updated.length);
      setScore(avg);
      const dur = Math.round((Date.now() - startTime) / 1000);
      const config = getDifficulty("tracing", childId);
      saveDifficulty("tracing", childId, avg);
      addGameActivity(childId, "tracing", avg, dur, config.level);
      updateStreak(childId);
      setScreen("result");
    }
  }, [scores, shapeIdx, shapes, loadShape, startTime, childId]);

  const handleUp = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault(); if (drawingRef.current) finishShape();
  }, [finishShape]);

  return (
    <div className="page">
      <nav className="nav">
        <NavLogo />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ThemeToggle theme={theme} onToggle={() => setTheme(t => (t === "light" ? "dark" : "light"))} />
          <Link href="/kid-dashboard/games" className="btn btn-outline" style={{ minHeight: 40, padding: "8px 14px", fontSize: "0.85rem" }}>
            ← Games
          </Link>
        </div>
      </nav>

      <div className="main fade fade-1" style={{ maxWidth: 500, padding: "40px 28px 80px" }}>
        <Link href="/kid-dashboard/games" className="btn btn-outline"
          style={{ minHeight: 40, padding: "8px 18px", fontSize: "0.88rem", marginBottom: 28, display: "inline-flex" }}>
          Back to Games
        </Link>

        {/* ---------- START ---------- */}
        {screen === "start" && (
          <div className="fade fade-2" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "3.5rem", marginBottom: 20 }}>{"✏️"}</div>
            <h1 className="page-title" style={{ fontFamily: "'Fredoka',sans-serif" }}>
              Basic <em>Tracing</em>
            </h1>
            <p className="subtitle">
              Trace the dotted shapes and letters with your finger or mouse. Follow the dots carefully!
            </p>
            <button onClick={startGame} className="btn btn-primary btn-full" style={{ maxWidth: 340 }}>
              Start Tracing
            </button>
          </div>
        )}

        {/* ---------- PLAY ---------- */}
        {screen === "play" && (
          <div className="fade fade-2" style={{ textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, fontSize: "0.9rem", color: "var(--text-secondary)", fontWeight: 600 }}>
              <span>Shape {shapeIdx + 1} of {shapes.length}</span>
              <span>{Math.floor(elapsed / 1000)}s</span>
            </div>

            <div style={{ fontFamily: "'Fredoka',sans-serif", fontWeight: 600, fontSize: "1.3rem", color: "var(--text-primary)", marginBottom: 14 }}>
              {shapes[shapeIdx]?.label}
            </div>

            <div style={{
              width: "100%", maxWidth: 400, aspectRatio: "1 / 1", margin: "0 auto 20px",
              borderRadius: "var(--r-lg, 16px)", border: "2px solid var(--border)",
              background: "var(--card)", overflow: "hidden", touchAction: "none",
              cursor: "crosshair", transition: "border-color 300ms var(--ease)",
            }}>
              <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }}
                onMouseDown={handleDown} onMouseMove={handleMove} onMouseUp={handleUp} onMouseLeave={handleUp}
                onTouchStart={handleDown} onTouchMove={handleMove} onTouchEnd={handleUp} />
            </div>

            {feedback && (
              <div style={{
                fontFamily: "'Fredoka',sans-serif", fontSize: "1.4rem", fontWeight: 700, marginBottom: 8,
                color: feedback.startsWith("Try") ? "var(--peach-300)" : "var(--sage-500)",
                transition: "opacity 300ms var(--ease)",
              }}>
                {feedback}
              </div>
            )}
            {feedback?.startsWith("Try") && (
              <button
                onClick={() => loadShape(shapes, shapeIdx)}
                className="btn btn-primary"
                style={{ marginTop: 8, minHeight: 44, padding: "8px 24px", fontSize: "0.95rem" }}
              >
                Try Again
              </button>
            )}
            {!feedback && (
              <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: 4 }}>
                Trace the shape, then lift to submit
              </p>
            )}
          </div>
        )}

        {/* ---------- RESULT ---------- */}
        {screen === "result" && (
          <div className="fade fade-2" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "3.5rem", marginBottom: 20 }}>{"🌟"}</div>
            <h1 className="page-title" style={{ fontFamily: "'Fredoka',sans-serif" }}>
              Well <em>Done!</em>
            </h1>

            <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap", marginBottom: 32 }}>
              {[
                { value: `${score}%`, label: "Accuracy" },
                { value: `${shapes.length}`, label: "Shapes" },
                { value: `${Math.floor(elapsed / 1000)}s`, label: "Time" },
              ].map(s => (
                <div key={s.label} className="card" style={{ padding: "20px 24px", textAlign: "center" }}>
                  <div style={statStyle}>{s.value}</div>
                  <div style={statLabel}>{s.label}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginBottom: 28 }}>
              {shapes.map((s, i) => (
                <span key={i} style={{
                  fontSize: "0.78rem", padding: "4px 12px", borderRadius: 12, fontWeight: 600,
                  background: (scores[i] ?? 0) >= 60 ? "var(--sage-50)" : "var(--peach-100, #fde8e0)",
                  color: (scores[i] ?? 0) >= 60 ? "var(--sage-600)" : "var(--peach-300, #e88a6f)",
                }}>{s.label}: {scores[i] ?? 0}%</span>
              ))}
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <button onClick={startGame} className="btn btn-primary" style={{ minWidth: 160 }}>Play Again</button>
              <Link href="/kid-dashboard/games" className="btn btn-outline" style={{ minWidth: 160 }}>All Games</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
