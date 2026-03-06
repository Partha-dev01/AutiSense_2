"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { getDifficulty, saveDifficulty } from "../../../lib/games/difficultyEngine";
import { addGameActivity } from "../../../lib/db/gameActivity.repository";
import { updateStreak } from "../../../lib/db/streak.repository";
import NavLogo from "../../../components/NavLogo";
import ThemeToggle from "../../../components/ThemeToggle";

type Screen = "start" | "play" | "result";

interface BlankSlot {
  position: number;
  answer: string;
  choices: string[];
  userAnswer: string | null;
  isCorrect: boolean | null;
}

interface Round {
  sequence: string[];
  blanks: BlankSlot[];
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const CVC_WORDS = [
  "CAT", "DOG", "SUN", "HAT", "CUP", "RED", "BIG", "PEN", "BUS", "MOP",
  "RUN", "SIT", "HOP", "FAN", "JAM", "NET", "PIN", "LOG", "DIG", "WET",
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getStage(roundIdx: number): number {
  if (roundIdx < 2) return 1;
  if (roundIdx < 4) return 2;
  return 3;
}

function generateLetterChoices(answer: string, count: number): string[] {
  const distractors: string[] = [];
  const answerIdx = ALPHABET.indexOf(answer);
  const nearby = [answerIdx - 2, answerIdx - 1, answerIdx + 1, answerIdx + 2, answerIdx + 3]
    .filter((i) => i >= 0 && i < 26 && ALPHABET[i] !== answer);
  const shuffledNearby = shuffle(nearby);
  for (const n of shuffledNearby) {
    if (distractors.length < count) distractors.push(ALPHABET[n]);
  }
  while (distractors.length < count) {
    const r = ALPHABET[Math.floor(Math.random() * 26)];
    if (r !== answer && !distractors.includes(r)) distractors.push(r);
  }
  return shuffle([answer, ...distractors]);
}

function generateRound(level: number, stage: number): Round {
  // Stage 3: Word completion (CVC words with 1 missing letter)
  if (stage === 3) {
    const word = CVC_WORDS[Math.floor(Math.random() * CVC_WORDS.length)];
    const sequence = word.split("");
    const blankPos = 1; // Always blank the middle vowel/consonant
    const answer = sequence[blankPos];
    return {
      sequence,
      blanks: [{
        position: blankPos,
        answer,
        choices: generateLetterChoices(answer, 3),
        userAnswer: null,
        isCorrect: null,
      }],
    };
  }

  const blankCount = stage === 1 ? 1 : 2;
  const skip = level <= 2 ? 1 : level <= 3 ? 2 : level === 4 ? 1 : 2;
  const seqLen = stage === 1 ? 5 : level <= 2 ? 6 : level <= 4 ? 7 : 8;

  const maxStart = 26 - seqLen * skip;
  const startIdx = Math.floor(Math.random() * Math.max(1, maxStart));

  const sequence: string[] = [];
  for (let i = 0; i < seqLen; i++) {
    const idx = startIdx + i * skip;
    sequence.push(idx < 26 ? ALPHABET[idx] : ALPHABET[25]);
  }

  const candidates = Array.from({ length: seqLen - 2 }, (_, i) => i + 1);
  const blankPositions = shuffle(candidates).slice(0, Math.min(blankCount, candidates.length)).sort((a, b) => a - b);

  const blanks: BlankSlot[] = blankPositions.map((pos) => {
    const answer = sequence[pos];
    return {
      position: pos,
      answer,
      choices: generateLetterChoices(answer, 3),
      userAnswer: null,
      isCorrect: null,
    };
  });

  return { sequence, blanks };
}

export default function AlphabetPatternPage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [screen, setScreen] = useState<Screen>("start");
  const [rounds, setRounds] = useState<Round[]>([]);
  const [roundIndex, setRoundIndex] = useState(0);
  const [blankIndex, setBlankIndex] = useState(0);
  const [totalBlanks, setTotalBlanks] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [maxRounds, setMaxRounds] = useState(5);
  const [level, setLevel] = useState(1);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [startTime, setStartTime] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const saved =
      (typeof window !== "undefined" && localStorage.getItem("autisense-theme")) || "light";
    setTheme(saved as "light" | "dark");
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    if (typeof window !== "undefined") localStorage.setItem("autisense-theme", theme);
  }, [theme]);

  const startGame = useCallback(() => {
    const childId =
      (typeof window !== "undefined" && localStorage.getItem("autisense-active-child-id")) || "default";
    const config = getDifficulty("alphabet-pattern", childId);
    setLevel(config.level);
    setMaxRounds(config.itemCount);

    const allRounds: Round[] = [];
    let blanksTotal = 0;
    for (let i = 0; i < config.itemCount; i++) {
      const stage = getStage(i);
      const r = generateRound(config.level, stage);
      allRounds.push(r);
      blanksTotal += r.blanks.length;
    }
    setRounds(allRounds);
    setTotalBlanks(blanksTotal);
    setRoundIndex(0);
    setBlankIndex(0);
    setCorrectCount(0);
    setFeedback(null);
    setStartTime(Date.now());
    setScreen("play");
  }, []);

  useEffect(() => {
    if (screen !== "play") return;
    const iv = setInterval(() => setElapsed(Date.now() - startTime), 500);
    return () => clearInterval(iv);
  }, [screen, startTime]);

  const handleChoice = (letter: string) => {
    if (feedback !== null) return;
    const round = rounds[roundIndex];
    const blank = round.blanks[blankIndex];
    const isCorrect = letter === blank.answer;

    // Update round data
    const updated = [...rounds];
    updated[roundIndex].blanks[blankIndex] = {
      ...blank,
      userAnswer: letter,
      isCorrect,
    };
    setRounds(updated);
    setFeedback(isCorrect ? "correct" : "wrong");
    if (isCorrect) setCorrectCount((c) => c + 1);

    setTimeout(() => {
      setFeedback(null);
      const nextBlank = blankIndex + 1;
      if (nextBlank < round.blanks.length) {
        setBlankIndex(nextBlank);
      } else {
        const nextRound = roundIndex + 1;
        if (nextRound < maxRounds) {
          setRoundIndex(nextRound);
          setBlankIndex(0);
        } else {
          finishGame(correctCount + (isCorrect ? 1 : 0));
        }
      }
    }, 800);
  };

  const finishGame = async (finalCorrect: number) => {
    const childId =
      (typeof window !== "undefined" && localStorage.getItem("autisense-active-child-id")) || "default";
    const score = totalBlanks > 0 ? Math.round((finalCorrect / totalBlanks) * 100) : 0;
    const duration = Math.round((Date.now() - startTime) / 1000);

    saveDifficulty("alphabet-pattern", childId, score);
    try {
      await addGameActivity(childId, "alphabet-pattern", score, duration, level);
      await updateStreak(childId);
    } catch {
      // IndexedDB may be unavailable; game still works
    }
    setScreen("result");
  };

  const currentRound = rounds[roundIndex] || null;
  const currentBlank = currentRound ? currentRound.blanks[blankIndex] : null;
  const finalScore = totalBlanks > 0 ? Math.round((correctCount / totalBlanks) * 100) : 0;

  return (
    <div className="page">
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
          style={{
            minHeight: 40,
            padding: "8px 18px",
            fontSize: "0.88rem",
            marginBottom: 28,
            display: "inline-flex",
          }}
        >
          Back to Games
        </Link>

        {/* ---- START SCREEN ---- */}
        {screen === "start" && (
          <div className="fade fade-2" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "3.5rem", marginBottom: 20 }}>🔤</div>
            <h1
              className="page-title"
              style={{ fontFamily: "'Fredoka',sans-serif" }}
            >
              Alphabet <em>Pattern</em>
            </h1>
            <p className="subtitle">
              Fill in the missing letters to complete the alphabet pattern!
            </p>
            <button
              onClick={startGame}
              className="btn btn-primary btn-full"
              style={{ maxWidth: 340, minHeight: 56 }}
            >
              Start Game
            </button>
          </div>
        )}

        {/* ---- PLAY SCREEN ---- */}
        {screen === "play" && currentRound && currentBlank && (
          <div className="fade fade-2" style={{ textAlign: "center" }}>
            {/* Status bar */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 24,
                fontSize: "0.9rem",
                color: "var(--text-secondary)",
                fontWeight: 600,
              }}
            >
              <span>
                Round {roundIndex + 1}/{maxRounds}
              </span>
              <span>Correct: {correctCount}</span>
              <span>{Math.floor(elapsed / 1000)}s</span>
            </div>

            {/* Stage indicator */}
            <div style={{
              fontSize: "0.82rem", fontWeight: 700, color: "var(--sage-500)",
              marginBottom: 8, textTransform: "uppercase" as const, letterSpacing: "0.05em",
            }}>
              {getStage(roundIndex) === 1 ? "Stage 1: Fill the Pattern" :
               getStage(roundIndex) === 2 ? "Stage 2: More Blanks" :
               "Stage 3: Complete the Word"}
            </div>

            {/* Instruction */}
            <p
              style={{
                fontSize: "0.95rem",
                color: "var(--text-secondary)",
                marginBottom: 20,
                fontWeight: 600,
              }}
            >
              {getStage(roundIndex) === 3
                ? "What letter completes this word?"
                : `Fill in blank #${blankIndex + 1} of ${currentRound.blanks.length}`}
            </p>

            {/* Sequence display */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                flexWrap: "wrap",
                gap: 8,
                marginBottom: 32,
              }}
            >
              {currentRound.sequence.map((letter, i) => {
                const blankEntry = currentRound.blanks.find((b) => b.position === i);
                const isBlank = !!blankEntry;
                const isActive = isBlank && blankEntry === currentBlank;
                const isFilled = isBlank && blankEntry.userAnswer !== null;

                let bg = "var(--card)";
                let borderColor = "var(--border)";
                let textColor = "var(--text-primary)";

                if (isActive && feedback === "correct") {
                  bg = "var(--sage-50)";
                  borderColor = "var(--sage-400)";
                  textColor = "var(--sage-600)";
                } else if (isActive && feedback === "wrong") {
                  bg = "var(--peach-100)";
                  borderColor = "var(--peach-300)";
                  textColor = "var(--peach-300)";
                } else if (isActive) {
                  borderColor = "var(--sage-400)";
                  bg = "var(--sage-50)";
                } else if (isFilled && blankEntry.isCorrect) {
                  bg = "var(--sage-50)";
                  borderColor = "var(--sage-300)";
                  textColor = "var(--sage-600)";
                } else if (isFilled && !blankEntry.isCorrect) {
                  bg = "var(--peach-100)";
                  borderColor = "var(--peach-300)";
                  textColor = "var(--peach-300)";
                }

                return (
                  <div
                    key={i}
                    style={{
                      width: 48,
                      height: 56,
                      borderRadius: "var(--r-md)",
                      border: `2.5px solid ${borderColor}`,
                      background: bg,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: "'Fredoka',sans-serif",
                      fontWeight: 700,
                      fontSize: "1.5rem",
                      color: textColor,
                      transition: "all 250ms var(--ease)",
                      animation:
                        isActive && feedback === "wrong"
                          ? "gentle-shake 0.4s ease"
                          : undefined,
                    }}
                  >
                    {isBlank
                      ? isFilled
                        ? blankEntry.isCorrect
                          ? blankEntry.answer
                          : blankEntry.answer
                        : isActive
                          ? "?"
                          : "_"
                      : letter}
                  </div>
                );
              })}
            </div>

            {/* Choices */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 12,
                maxWidth: 340,
                margin: "0 auto",
              }}
            >
              {currentBlank.choices.map((ch) => (
                <button
                  key={ch}
                  onClick={() => handleChoice(ch)}
                  disabled={feedback !== null}
                  className="btn"
                  style={{
                    minHeight: 56,
                    borderRadius: "var(--r-lg)",
                    border: "2.5px solid var(--border)",
                    background: "var(--card)",
                    fontFamily: "'Fredoka',sans-serif",
                    fontWeight: 700,
                    fontSize: "1.4rem",
                    color: "var(--text-primary)",
                    cursor: feedback !== null ? "default" : "pointer",
                    transition: "all 200ms var(--ease)",
                  }}
                >
                  {ch}
                </button>
              ))}
            </div>

            {/* Feedback text */}
            {feedback && (
              <p
                style={{
                  marginTop: 20,
                  fontWeight: 700,
                  fontSize: "1rem",
                  color:
                    feedback === "correct"
                      ? "var(--sage-500)"
                      : "var(--peach-300)",
                  transition: "opacity 200ms var(--ease)",
                }}
              >
                {feedback === "correct"
                  ? "Great job!"
                  : `It was ${currentBlank.answer}`}
              </p>
            )}
          </div>
        )}

        {/* ---- RESULT SCREEN ---- */}
        {screen === "result" && (
          <div className="fade fade-2" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "3.5rem", marginBottom: 20 }}>
              {finalScore >= 60 ? "🌟" : "💪"}
            </div>
            <h1
              className="page-title"
              style={{ fontFamily: "'Fredoka',sans-serif" }}
            >
              {finalScore >= 60 ? (
                <>
                  Amazing <em>Work!</em>
                </>
              ) : (
                <>
                  Keep <em>Trying!</em>
                </>
              )}
            </h1>
            <div
              style={{
                display: "flex",
                gap: 16,
                justifyContent: "center",
                flexWrap: "wrap",
                marginBottom: 32,
              }}
            >
              <div className="card" style={{ padding: "20px 24px", textAlign: "center" }}>
                <div
                  style={{
                    fontSize: "1.8rem",
                    fontFamily: "'Fredoka',sans-serif",
                    fontWeight: 700,
                    color: "var(--sage-500)",
                  }}
                >
                  {finalScore}%
                </div>
                <div
                  style={{
                    fontSize: "0.82rem",
                    color: "var(--text-secondary)",
                    fontWeight: 600,
                  }}
                >
                  Score
                </div>
              </div>
              <div className="card" style={{ padding: "20px 24px", textAlign: "center" }}>
                <div
                  style={{
                    fontSize: "1.8rem",
                    fontFamily: "'Fredoka',sans-serif",
                    fontWeight: 700,
                    color: "var(--sage-500)",
                  }}
                >
                  {correctCount}/{totalBlanks}
                </div>
                <div
                  style={{
                    fontSize: "0.82rem",
                    color: "var(--text-secondary)",
                    fontWeight: 600,
                  }}
                >
                  Correct
                </div>
              </div>
              <div className="card" style={{ padding: "20px 24px", textAlign: "center" }}>
                <div
                  style={{
                    fontSize: "1.8rem",
                    fontFamily: "'Fredoka',sans-serif",
                    fontWeight: 700,
                    color: "var(--sage-500)",
                  }}
                >
                  {Math.floor(elapsed / 1000)}s
                </div>
                <div
                  style={{
                    fontSize: "0.82rem",
                    color: "var(--text-secondary)",
                    fontWeight: 600,
                  }}
                >
                  Time
                </div>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                gap: 12,
                justifyContent: "center",
                flexWrap: "wrap",
              }}
            >
              <button
                onClick={startGame}
                className="btn btn-primary"
                style={{ minWidth: 160, minHeight: 56 }}
              >
                Play Again
              </button>
              <Link
                href="/kid-dashboard/games"
                className="btn btn-outline"
                style={{ minWidth: 160, minHeight: 56 }}
              >
                All Games
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Gentle shake animation for wrong answers */}
      <style>{`
        @keyframes gentle-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-4px); }
          40% { transform: translateX(4px); }
          60% { transform: translateX(-3px); }
          80% { transform: translateX(3px); }
        }
      `}</style>
    </div>
  );
}
