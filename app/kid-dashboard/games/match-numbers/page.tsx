"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { getDifficulty, saveDifficulty } from "../../../lib/games/difficultyEngine";
import { addGameActivity } from "../../../lib/db/gameActivity.repository";
import { updateStreak } from "../../../lib/db/streak.repository";
import NavLogo from "../../../components/NavLogo";
import ThemeToggle from "../../../components/ThemeToggle";

type Screen = "start" | "play" | "result";

interface Card { value: number; correct: boolean; status: "idle" | "correct" | "wrong" }
interface Round { prompt: string; answer: number; cards: Card[] }

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateRound(level: number, choiceCount: number): Round {
  let answer: number, prompt: string;
  if (level >= 5) {
    const a = randInt(1, 5), b = randInt(1, 5);
    answer = a + b;
    prompt = `${a} + ${b}`;
  } else {
    const maxN = level <= 2 ? 5 : 10;
    answer = randInt(1, maxN);
    prompt = String(answer);
  }
  const distractors = new Set<number>();
  const maxN = level <= 2 ? 5 : 10;
  while (distractors.size < choiceCount - 1) {
    const d = level >= 5 ? randInt(2, 10) : randInt(1, maxN);
    if (d !== answer) distractors.add(d);
  }
  const cards: Card[] = shuffle([
    { value: answer, correct: true, status: "idle" as const },
    ...[...distractors].map((v) => ({ value: v, correct: false, status: "idle" as const })),
  ]);
  return { prompt, answer, cards };
}

function DotGrid({ count }: { count: number }) {
  const cols = count <= 3 ? count : count <= 6 ? 3 : 4;
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 14px)`, gap: 6, justifyContent: "center", alignContent: "center" }}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} style={{ width: 14, height: 14, borderRadius: "50%", background: "var(--sage-400)", transition: "background 250ms var(--ease)" }} />
      ))}
    </div>
  );
}

const statStyle = { fontSize: "1.8rem", fontFamily: "'Fredoka',sans-serif", fontWeight: 700 as const, color: "var(--sage-500)" };
const statLabel = { fontSize: "0.82rem", color: "var(--text-secondary)", fontWeight: 600 as const };

export default function MatchNumbersPage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [screen, setScreen] = useState<Screen>("start");
  const [rounds, setRounds] = useState<Round[]>([]);
  const [roundIndex, setRoundIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [totalRounds, setTotalRounds] = useState(5);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [startTime, setStartTime] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [saved, setSaved] = useState(false);
  const [level, setLevel] = useState(1);

  useEffect(() => {
    const s = (typeof window !== "undefined" && localStorage.getItem("autisense-theme")) || "light";
    setTheme(s as "light" | "dark");
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    if (typeof window !== "undefined") localStorage.setItem("autisense-theme", theme);
  }, [theme]);

  const startGame = useCallback(() => {
    const childId = (typeof window !== "undefined" && localStorage.getItem("autisense-active-child-id")) || "default";
    const config = getDifficulty("match-numbers", childId);
    const choiceCount = config.level <= 2 ? 3 : 4;
    const allRounds: Round[] = [];
    for (let i = 0; i < config.itemCount; i++) allRounds.push(generateRound(config.level, choiceCount));
    setRounds(allRounds);
    setTotalRounds(config.itemCount);
    setLevel(config.level);
    setRoundIndex(0);
    setCorrectCount(0);
    setFeedback(null);
    setStartTime(Date.now());
    setElapsed(0);
    setSaved(false);
    setScreen("play");
  }, []);

  useEffect(() => {
    if (screen !== "play") return;
    const iv = setInterval(() => setElapsed(Date.now() - startTime), 500);
    return () => clearInterval(iv);
  }, [screen, startTime]);

  useEffect(() => {
    if (screen !== "result" || saved) return;
    setSaved(true);
    const childId = (typeof window !== "undefined" && localStorage.getItem("autisense-active-child-id")) || "default";
    const score = totalRounds > 0 ? Math.round((correctCount / totalRounds) * 100) : 0;
    saveDifficulty("match-numbers", childId, score);
    addGameActivity(childId, "match-numbers", score, Math.floor(elapsed / 1000), level).catch(() => {});
    updateStreak(childId).catch(() => {});
  }, [screen, saved, correctCount, totalRounds, elapsed, level]);

  const handleCardTap = (cardIndex: number) => {
    if (feedback !== null) return;
    const round = rounds[roundIndex];
    const card = round.cards[cardIndex];
    const updated = [...rounds];
    updated[roundIndex] = {
      ...round,
      cards: round.cards.map((c, i) =>
        i === cardIndex ? { ...c, status: c.correct ? "correct" : "wrong" } : c
      ),
    };
    setRounds(updated);
    if (card.correct) { setCorrectCount((c) => c + 1); setFeedback("correct"); }
    else { setFeedback("wrong"); }
    setTimeout(() => {
      setFeedback(null);
      const next = roundIndex + 1;
      if (next < totalRounds) setRoundIndex(next);
      else setScreen("result");
    }, 900);
  };

  const currentRound = rounds[roundIndex] || null;
  const finalScore = totalRounds > 0 ? Math.round((correctCount / totalRounds) * 100) : 0;

  return (
    <div className="page">
      <style>{`
        @keyframes gentle-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-5px); }
          40% { transform: translateX(5px); }
          60% { transform: translateX(-3px); }
          80% { transform: translateX(3px); }
        }
        @keyframes pop-in {
          0% { transform: scale(0.8); opacity: 0; }
          60% { transform: scale(1.05); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes cheerful-bounce {
          0%, 100% { transform: scale(1); }
          40% { transform: scale(1.12); }
          60% { transform: scale(0.95); }
        }
      `}</style>

      <nav className="nav">
        <NavLogo />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ThemeToggle theme={theme} onToggle={() => setTheme((t) => (t === "light" ? "dark" : "light"))} />
          <Link href="/kid-dashboard/games" className="btn btn-outline" style={{ minHeight: 40, padding: "8px 14px", fontSize: "0.85rem" }}>
            ← Games
          </Link>
        </div>
      </nav>

      <div className="main fade fade-1" style={{ maxWidth: 540, padding: "40px 28px 80px" }}>
        <Link
          href="/kid-dashboard/games"
          className="btn btn-outline"
          style={{ minHeight: 40, padding: "8px 18px", fontSize: "0.88rem", marginBottom: 28, display: "inline-flex" }}
        >
          Back to Games
        </Link>

        {/* ---- START ---- */}
        {screen === "start" && (
          <div className="fade fade-2" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "3.5rem", marginBottom: 20 }}>{"🔢"}</div>
            <h1 className="page-title" style={{ fontFamily: "'Fredoka',sans-serif" }}>
              Match <em>Numbers</em>
            </h1>
            <p className="subtitle">See the number, then tap the card with the right amount of dots!</p>
            <button onClick={startGame} className="btn btn-primary btn-full" style={{ maxWidth: 340, minHeight: 56 }}>
              Start Game
            </button>
          </div>
        )}

        {/* ---- PLAY ---- */}
        {screen === "play" && currentRound && (
          <div className="fade fade-2" style={{ textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20, fontSize: "0.9rem", color: "var(--text-secondary)", fontWeight: 600 }}>
              <span>Round {roundIndex + 1}/{totalRounds}</span>
              <span>Correct: {correctCount}</span>
              <span>{Math.floor(elapsed / 1000)}s</span>
            </div>

            {/* Numeral prompt */}
            <div style={{
              fontFamily: "'Fredoka',sans-serif", fontSize: "3rem", fontWeight: 700, color: "var(--sage-500)",
              marginBottom: 8, padding: "18px 24px", background: "var(--sage-50)", borderRadius: "var(--r-lg)",
              border: "2.5px solid var(--sage-200)", display: "inline-block", minWidth: 100, animation: "pop-in 0.35s ease-out",
            }}>
              {currentRound.prompt}
            </div>
            <p style={{ fontSize: "0.95rem", color: "var(--text-secondary)", fontWeight: 600, marginTop: 8, marginBottom: 24 }}>
              {level >= 5 ? "Tap the card with the answer!" : "Tap the card with this many dots!"}
            </p>

            {/* Choice cards with dot grids */}
            <div style={{
              display: "grid",
              gridTemplateColumns: currentRound.cards.length <= 3 ? "repeat(3, 1fr)" : "repeat(2, 1fr)",
              gap: 14, maxWidth: 380, margin: "0 auto",
            }}>
              {currentRound.cards.map((card, i) => {
                let bg = "var(--card)", borderColor = "var(--border)", anim = "";
                if (card.status === "correct") { bg = "var(--sage-50)"; borderColor = "var(--sage-400)"; anim = "cheerful-bounce 0.5s ease"; }
                else if (card.status === "wrong") { bg = "var(--peach-100)"; borderColor = "var(--peach-300)"; anim = "gentle-shake 0.5s ease"; }
                return (
                  <button
                    key={i}
                    onClick={() => handleCardTap(i)}
                    disabled={feedback !== null}
                    aria-label={`Card with ${card.value} dots`}
                    style={{
                      minHeight: 100, borderRadius: "var(--r-lg)", border: `2.5px solid ${borderColor}`,
                      background: bg, cursor: feedback !== null ? "default" : "pointer",
                      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                      gap: 8, padding: 14, transition: "all 200ms var(--ease)", animation: anim || undefined,
                    }}
                  >
                    <DotGrid count={card.value} />
                    <span style={{ fontFamily: "'Fredoka',sans-serif", fontWeight: 600, fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                      {card.value}
                    </span>
                  </button>
                );
              })}
            </div>

            {feedback && (
              <p style={{
                marginTop: 20, fontWeight: 700, fontSize: "1.05rem",
                color: feedback === "correct" ? "var(--sage-500)" : "var(--peach-300)",
                transition: "opacity 200ms var(--ease)",
              }}>
                {feedback === "correct" ? "Great job!" : `The answer is ${currentRound.answer}`}
              </p>
            )}
          </div>
        )}

        {/* ---- RESULT ---- */}
        {screen === "result" && (
          <div className="fade fade-2" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "3.5rem", marginBottom: 20 }}>
              {finalScore >= 70 ? "\uD83C\uDFC6" : "\uD83C\uDF1F"}
            </div>
            <h1 className="page-title" style={{ fontFamily: "'Fredoka',sans-serif" }}>
              {finalScore >= 70 ? (<>Great <em>Counting!</em></>) : (<>Nice <em>Try!</em></>)}
            </h1>
            <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap", marginBottom: 32 }}>
              <div className="card" style={{ padding: "20px 24px", textAlign: "center" }}>
                <div style={statStyle}>{finalScore}%</div>
                <div style={statLabel}>Score</div>
              </div>
              <div className="card" style={{ padding: "20px 24px", textAlign: "center" }}>
                <div style={statStyle}>{correctCount}/{totalRounds}</div>
                <div style={statLabel}>Correct</div>
              </div>
              <div className="card" style={{ padding: "20px 24px", textAlign: "center" }}>
                <div style={statStyle}>{Math.floor(elapsed / 1000)}s</div>
                <div style={statLabel}>Time</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <button onClick={startGame} className="btn btn-primary" style={{ minWidth: 160, minHeight: 56 }}>
                Play Again
              </button>
              <Link href="/kid-dashboard/games" className="btn btn-outline" style={{ minWidth: 160, minHeight: 56 }}>
                All Games
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
