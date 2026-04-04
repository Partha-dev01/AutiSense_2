"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { getDifficulty, saveDifficulty } from "../../../lib/games/difficultyEngine";
import { addGameActivity } from "../../../lib/db/gameActivity.repository";
import { updateStreak } from "../../../lib/db/streak.repository";
import NavLogo from "../../../components/NavLogo";
import ThemeToggle from "../../../components/ThemeToggle";
import { useTheme } from "../../../hooks/useTheme";

type Screen = "start" | "play" | "result";

interface Choice {
  text: string;
  points: number;
}

interface Scenario {
  situation: string;
  emoji: string;
  choices: Choice[];
}

const ALL_SCENARIOS: Scenario[] = [
  {
    situation: "A friend drops their books. What do you do?",
    emoji: "\uD83D\uDCDA",
    choices: [
      { text: "Help pick them up", points: 3 },
      { text: "Tell the teacher", points: 2 },
      { text: "Laugh", points: 1 },
      { text: "Walk away", points: 0 },
    ],
  },
  {
    situation: "Someone says hello to you. What do you say?",
    emoji: "\uD83D\uDC4B",
    choices: [
      { text: "Say hello back", points: 3 },
      { text: "Smile and wave", points: 2 },
      { text: "Ignore them", points: 1 },
      { text: "Run away", points: 0 },
    ],
  },
  {
    situation: "You want to play with a toy someone else has. What do you do?",
    emoji: "\uD83E\uDDF8",
    choices: [
      { text: "Ask nicely to share", points: 3 },
      { text: "Wait for your turn", points: 2 },
      { text: "Cry about it", points: 1 },
      { text: "Grab it from them", points: 0 },
    ],
  },
  {
    situation: "Your friend looks sad. What do you do?",
    emoji: "\uD83D\uDE22",
    choices: [
      { text: "Ask if they are okay", points: 3 },
      { text: "Sit next to them quietly", points: 2 },
      { text: "Ignore them", points: 1 },
      { text: "Laugh at them", points: 0 },
    ],
  },
  {
    situation: "You bump into someone by accident.",
    emoji: "\uD83E\uDD1D",
    choices: [
      { text: "Say sorry", points: 3 },
      { text: "Check if they are okay", points: 2 },
      { text: "Blame them", points: 1 },
      { text: "Run away", points: 0 },
    ],
  },
  {
    situation: "It's time to share snacks with your friends.",
    emoji: "\uD83C\uDF6A",
    choices: [
      { text: "Share equally", points: 3 },
      { text: "Give some away", points: 2 },
      { text: "Hide the snacks", points: 1 },
      { text: "Keep them all", points: 0 },
    ],
  },
  {
    situation: "A new kid joins your class today.",
    emoji: "\uD83C\uDF1F",
    choices: [
      { text: "Say welcome", points: 3 },
      { text: "Smile at them", points: 2 },
      { text: "Stare at them", points: 1 },
      { text: "Ignore them", points: 0 },
    ],
  },
  {
    situation: "You feel really angry about something.",
    emoji: "\uD83D\uDE24",
    choices: [
      { text: "Take a deep breath", points: 3 },
      { text: "Walk away to calm down", points: 2 },
      { text: "Yell about it", points: 1 },
      { text: "Hit something", points: 0 },
    ],
  },
  {
    situation: "Someone gives you a gift.",
    emoji: "\uD83C\uDF81",
    choices: [
      { text: "Say thank you", points: 3 },
      { text: "Smile and take it", points: 2 },
      { text: "Complain about it", points: 1 },
      { text: "Throw it away", points: 0 },
    ],
  },
  {
    situation: "Your turn is next in line.",
    emoji: "\uD83D\uDEB6",
    choices: [
      { text: "Wait patiently", points: 3 },
      { text: "Count to stay calm", points: 2 },
      { text: "Cry about waiting", points: 1 },
      { text: "Push to the front", points: 0 },
    ],
  },
];

const statStyle = {
  fontSize: "1.8rem",
  fontFamily: "'Fredoka',sans-serif" as const,
  fontWeight: 700 as const,
  color: "var(--sage-500)",
};
const statLabel = {
  fontSize: "0.82rem",
  color: "var(--text-secondary)",
  fontWeight: 600 as const,
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function SocialStoriesV2Page() {
  const { theme, toggle: toggleTheme } = useTheme();
  const [screen, setScreen] = useState<Screen>("start");
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);
  const [maxPoints, setMaxPoints] = useState(0);
  const [chosen, setChosen] = useState<Choice | null>(null);
  const [startTime, setStartTime] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [saved, setSaved] = useState(false);

  const startGame = useCallback(() => {
    const childId =
      (typeof window !== "undefined" && localStorage.getItem("autisense-active-child-id")) ||
      "default";
    const config = getDifficulty("social-stories-v2", childId);
    const count = config.itemCount; // 3-7

    const picked = shuffle(ALL_SCENARIOS).slice(0, count).map((s) => ({
      ...s,
      choices: shuffle(s.choices),
    }));

    setScenarios(picked);
    setCurrentIdx(0);
    setTotalPoints(0);
    setMaxPoints(count * 3);
    setChosen(null);
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
    const childId =
      (typeof window !== "undefined" && localStorage.getItem("autisense-active-child-id")) ||
      "default";
    const fs = maxPoints > 0 ? Math.round((totalPoints / maxPoints) * 100) : 0;
    const config = getDifficulty("social-stories-v2", childId);
    saveDifficulty("social-stories-v2", childId, fs);
    addGameActivity(childId, "social-stories-v2", fs, Math.floor(elapsed / 1000), config.level);
    updateStreak(childId);
  }, [screen, saved, totalPoints, maxPoints, elapsed]);

  const handleChoice = (choice: Choice) => {
    if (chosen) return;
    setChosen(choice);
    setTotalPoints((p) => p + choice.points);
  };

  const handleNext = () => {
    const next = currentIdx + 1;
    if (next >= scenarios.length) {
      setScreen("result");
    } else {
      setCurrentIdx(next);
      setChosen(null);
    }
  };

  const current = scenarios[currentIdx];
  const bestChoice = current ? [...current.choices].sort((a, b) => b.points - a.points)[0] : null;
  const finalScore = maxPoints > 0 ? Math.round((totalPoints / maxPoints) * 100) : 0;

  return (
    <div className="page">
      <nav className="nav">
        <NavLogo />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <Link href="/kid-dashboard/games" className="btn btn-outline" style={{ minHeight: 40, padding: "8px 14px", fontSize: "0.85rem" }}>
            ← Games
          </Link>
        </div>
      </nav>

      <div className="main fade fade-1" style={{ maxWidth: 560, padding: "40px 28px 80px" }}>
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

        {screen === "start" && (
          <div className="fade fade-2" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "3.5rem", marginBottom: 20 }}>{"\uD83D\uDCD6"}</div>
            <h1 className="page-title">
              Social <em>Stories</em>
            </h1>
            <p className="subtitle">
              Read each story and pick the best response. Learn how to handle everyday
              social situations!
            </p>
            <button
              onClick={startGame}
              className="btn btn-primary btn-full"
              style={{ maxWidth: 340 }}
            >
              Start Game
            </button>
          </div>
        )}

        {screen === "play" && current && (
          <div className="fade fade-2">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 12,
                fontSize: "0.9rem",
                color: "var(--text-secondary)",
                fontWeight: 600,
              }}
            >
              <span>
                Story {currentIdx + 1} / {scenarios.length}
              </span>
              <span>Points: {totalPoints}</span>
              <span>{Math.floor(elapsed / 1000)}s</span>
            </div>

            <div
              className="card"
              style={{
                padding: "28px 24px",
                textAlign: "center",
                marginBottom: 20,
                border: "2px solid var(--sage-200)",
              }}
            >
              <div style={{ fontSize: "3rem", marginBottom: 14 }}>{current.emoji}</div>
              <p
                style={{
                  fontFamily: "'Fredoka',sans-serif",
                  fontSize: "1.2rem",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  lineHeight: 1.5,
                  margin: 0,
                }}
              >
                {current.situation}
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
              {current.choices.map((choice, i) => {
                const isChosen = chosen?.text === choice.text;
                const isBest = chosen && choice.points === 3;
                let bg = "var(--card)";
                let border = "2px solid var(--border)";
                if (chosen) {
                  if (isChosen && choice.points === 3) {
                    bg = "var(--sage-100)";
                    border = "2px solid var(--sage-400)";
                  } else if (isChosen && choice.points < 3) {
                    bg = "var(--peach-50)";
                    border = "2px solid var(--peach-200)";
                  } else if (isBest) {
                    bg = "var(--sage-50)";
                    border = "2px dashed var(--sage-300)";
                  }
                }
                return (
                  <button
                    key={i}
                    onClick={() => handleChoice(choice)}
                    disabled={!!chosen}
                    style={{
                      minHeight: 56,
                      padding: "14px 20px",
                      fontSize: "1.05rem",
                      fontWeight: 600,
                      fontFamily: "'Fredoka',sans-serif",
                      background: bg,
                      border,
                      borderRadius: "var(--r-lg)",
                      cursor: chosen ? "default" : "pointer",
                      color: "var(--text-primary)",
                      textAlign: "left",
                      transition: "all 200ms var(--ease)",
                      opacity: chosen && !isChosen && !isBest ? 0.55 : 1,
                    }}
                    aria-label={choice.text}
                  >
                    {choice.text}
                    {chosen && isBest && !isChosen && (
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: "0.85rem",
                          color: "var(--sage-500)",
                        }}
                      >
                        (best)
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {chosen && (
              <div
                className="fade fade-1"
                style={{
                  textAlign: "center",
                  padding: "16px 20px",
                  borderRadius: "var(--r-lg)",
                  marginBottom: 16,
                  background: chosen.points === 3 ? "var(--sage-50)" : "var(--peach-50)",
                  border:
                    chosen.points === 3
                      ? "2px solid var(--sage-200)"
                      : "2px solid var(--peach-200)",
                }}
              >
                <p
                  style={{
                    fontFamily: "'Fredoka',sans-serif",
                    fontSize: "1.1rem",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    margin: 0,
                  }}
                >
                  {chosen.points === 3
                    ? "Great choice! That's the best response!"
                    : `Good try! The best choice was: "${bestChoice?.text}"`}
                </p>
                <p
                  style={{
                    fontSize: "0.88rem",
                    color: "var(--text-secondary)",
                    margin: "6px 0 0",
                  }}
                >
                  +{chosen.points} point{chosen.points !== 1 ? "s" : ""}
                </p>
              </div>
            )}

            {chosen && (
              <div style={{ textAlign: "center" }}>
                <button
                  onClick={handleNext}
                  className="btn btn-primary"
                  style={{ minWidth: 200, minHeight: 56 }}
                >
                  {currentIdx + 1 >= scenarios.length ? "See Results" : "Next Story"}
                </button>
              </div>
            )}
          </div>
        )}

        {screen === "result" && (
          <div className="fade fade-2" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "3.5rem", marginBottom: 20 }}>
              {finalScore >= 70 ? "\uD83C\uDFC6" : "\uD83C\uDF1F"}
            </div>
            <h1 className="page-title">
              {finalScore >= 70 ? (
                <>
                  Amazing <em>Job!</em>
                </>
              ) : (
                <>
                  Good <em>Try!</em>
                </>
              )}
            </h1>
            <p
              className="subtitle"
              style={{ maxWidth: 360, margin: "0 auto 28px" }}
            >
              {finalScore >= 70
                ? "You really know how to handle social situations!"
                : "Keep practising and you will get even better!"}
            </p>
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
                <div style={statStyle}>{finalScore}%</div>
                <div style={statLabel}>Score</div>
              </div>
              <div className="card" style={{ padding: "20px 24px", textAlign: "center" }}>
                <div style={statStyle}>
                  {totalPoints}/{maxPoints}
                </div>
                <div style={statLabel}>Points</div>
              </div>
              <div className="card" style={{ padding: "20px 24px", textAlign: "center" }}>
                <div style={statStyle}>{Math.floor(elapsed / 1000)}s</div>
                <div style={statLabel}>Time</div>
              </div>
            </div>
            <div
              style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}
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
    </div>
  );
}
