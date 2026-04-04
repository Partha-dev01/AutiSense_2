"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { getDifficulty, saveDifficulty } from "../../lib/games/difficultyEngine";
import { addGameActivity } from "../../lib/db/gameActivity.repository";
import { updateStreak } from "../../lib/db/streak.repository";
import NavLogo from "../../components/NavLogo";
import ThemeToggle from "../../components/ThemeToggle";

type Screen = "start" | "play" | "result";

interface Scenario {
  title: string;
  description: string;
  emoji: string;
  options: { text: string; correct: boolean; feedback: string }[];
  explanation: string;
}

const SCENARIOS: Scenario[] = [
  {
    title: "Greeting a Friend",
    emoji: "👋",
    description:
      "You see your friend at the park. They wave and smile at you. What do you do?",
    explanation:
      "Greeting others back is one of the building blocks of social connection. When we respond to someone's hello, it tells them we notice them and want to be friendly.",
    options: [
      {
        text: "Wave back and say hello",
        correct: true,
        feedback: "Great! Waving and saying hello is a friendly response.",
      },
      {
        text: "Walk away without looking",
        correct: false,
        feedback:
          "When someone waves at you, they feel happy if you wave back.",
      },
      {
        text: "Stare at the ground",
        correct: false,
        feedback:
          "It's okay to feel shy, but a small wave shows your friend you see them.",
      },
    ],
  },
  {
    title: "Sharing Toys",
    emoji: "🧸",
    description:
      "Another child asks if they can play with your toy car. You still want to play with it too. What do you say?",
    explanation:
      "Taking turns is a way to be fair and keep friendships strong. It shows we care about the other person's feelings, even when we want something too.",
    options: [
      {
        text: "You can play with it when I'm done",
        correct: true,
        feedback:
          "Perfect! Taking turns means everyone gets a chance.",
      },
      {
        text: "No, go away!",
        correct: false,
        feedback:
          "It's okay not to want to share right now, but we can say it more kindly.",
      },
      {
        text: "Grab it and run",
        correct: false,
        feedback:
          "Running away can hurt your friend's feelings. Try using words instead.",
      },
    ],
  },
  {
    title: "Waiting in Line",
    emoji: "🧍",
    description:
      "You're waiting in line for the slide at the playground. The line is long and you feel impatient. What do you do?",
    explanation:
      "Waiting shows respect for others. Everyone in line wants their turn, and patience helps everyone feel treated fairly.",
    options: [
      {
        text: "Wait for your turn patiently",
        correct: true,
        feedback:
          "Wonderful! Waiting your turn is fair and everyone appreciates it.",
      },
      {
        text: "Push to the front of the line",
        correct: false,
        feedback:
          "Cutting in line isn't fair to others who have been waiting.",
      },
      {
        text: "Start crying loudly",
        correct: false,
        feedback:
          "It's okay to feel frustrated. Try taking deep breaths while you wait.",
      },
    ],
  },
  {
    title: "Someone is Sad",
    emoji: "😢",
    description:
      "Your classmate drops their ice cream and starts crying. What do you do?",
    explanation:
      "Showing empathy \u2014 noticing and caring about someone else's feelings \u2014 helps build trust and strong relationships.",
    options: [
      {
        text: "Ask if they're okay and offer help",
        correct: true,
        feedback:
          "That's very kind! Asking if someone is okay shows you care.",
      },
      {
        text: "Laugh at them",
        correct: false,
        feedback:
          "Laughing can make someone feel worse when they're already sad.",
      },
      {
        text: "Walk away and ignore them",
        correct: false,
        feedback:
          "When someone is sad, even a small kind word can help them feel better.",
      },
    ],
  },
  {
    title: "Loud Noises",
    emoji: "🔊",
    description:
      "You're in a store and it gets very noisy. The sounds bother you. What can you do?",
    explanation:
      "It's important to know our own limits. Asking for help or a break when something feels overwhelming is a healthy way to manage big feelings.",
    options: [
      {
        text: "Tell a grown-up you need a quiet break",
        correct: true,
        feedback:
          "Great idea! It's always okay to ask for a break when things feel too much.",
      },
      {
        text: "Scream louder than the noise",
        correct: false,
        feedback:
          "Screaming adds more noise. Try covering your ears gently or asking for help.",
      },
      {
        text: "Run out of the store alone",
        correct: false,
        feedback:
          "Running away alone can be unsafe. It's better to ask a grown-up for help.",
      },
    ],
  },
  {
    title: "Saying Thank You",
    emoji: "🎁",
    description:
      "Your grandmother gives you a birthday present. What do you say?",
    explanation:
      "Gratitude makes both the giver and receiver feel good. Even a simple 'thank you' strengthens bonds between people.",
    options: [
      {
        text: "Thank you, grandma!",
        correct: true,
        feedback:
          "Saying thank you makes people feel appreciated and happy.",
      },
      {
        text: "I don't like this",
        correct: false,
        feedback:
          "Even if a gift isn't your favorite, saying thank you is the kind thing to do.",
      },
      {
        text: "Take it and walk away",
        correct: false,
        feedback:
          "When someone gives you something, saying thank you shows you're grateful.",
      },
    ],
  },
  {
    title: "Making New Friends",
    emoji: "🤝",
    description:
      "A new kid joins your class and sits alone at lunch. What can you do?",
    explanation:
      "Including others, especially when they're new or alone, is one of the kindest things we can do. It can make someone's whole day better.",
    options: [
      {
        text: "Invite them to sit with you",
        correct: true,
        feedback:
          "That's very welcoming! Being new can feel lonely, and your invitation means a lot.",
      },
      {
        text: "Stare at them and whisper to your friends",
        correct: false,
        feedback:
          "Whispering about someone can make them feel left out and uncomfortable.",
      },
      {
        text: "Ignore them completely",
        correct: false,
        feedback:
          "Being new is hard. Even a smile can help someone feel welcome.",
      },
    ],
  },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function SocialStoriesPage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [screen, setScreen] = useState<Screen>("start");
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
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
    const config = getDifficulty("social-stories", "default");
    const count = Math.min(config.itemCount, SCENARIOS.length);
    setScenarios(shuffle(SCENARIOS).slice(0, count).map(s => ({ ...s, options: shuffle(s.options) })));
    setCurrentIndex(0);
    setCorrect(0);
    setSelectedOption(null);
    setShowFeedback(false);
    setShowExplanation(false);
    setStartTime(Date.now());
    setScreen("play");
  }, []);

  useEffect(() => {
    if (screen !== "play") return;
    const iv = setInterval(() => setElapsed(Date.now() - startTime), 500);
    return () => clearInterval(iv);
  }, [screen, startTime]);

  const handleSelect = (optionIndex: number) => {
    if (showFeedback) return;
    setSelectedOption(optionIndex);
    setShowFeedback(true);

    const isCorrect = scenarios[currentIndex].options[optionIndex].correct;
    if (isCorrect) setCorrect((c) => c + 1);
  };

  const handleNext = () => {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= scenarios.length) {
      const score = Math.round((correct / scenarios.length) * 100);
      saveDifficulty("social-stories", "default", score);
      setScreen("result");
    } else {
      setCurrentIndex(nextIndex);
      setSelectedOption(null);
      setShowFeedback(false);
      setShowExplanation(false);
    }
  };

  // Save game activity on result
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (screen !== "result" || saved) return;
    setSaved(true);
    const childId =
      (typeof window !== "undefined" && localStorage.getItem("autisense-active-child-id")) || "default";
    const fs = scenarios.length > 0 ? Math.round((correct / scenarios.length) * 100) : 0;
    const config = getDifficulty("social-stories", childId);
    addGameActivity(childId, "social-stories", fs, Math.floor(elapsed / 1000), config.level);
    updateStreak(childId);
  }, [screen, saved, correct, scenarios.length, elapsed]);

  const finalScore =
    scenarios.length > 0 ? Math.round((correct / scenarios.length) * 100) : 0;

  return (
    <div className="page">
      <nav className="nav">
        <NavLogo />
        <ThemeToggle theme={theme} onToggle={() => setTheme((t) => (t === "light" ? "dark" : "light"))} />
      </nav>

      <div className="main fade fade-1" style={{ maxWidth: 620, padding: "40px 28px 80px" }}>
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
            <div style={{ fontSize: "3.5rem", marginBottom: 20 }}>📖</div>
            <h1 className="page-title">
              Social <em>Stories</em>
            </h1>
            <p className="subtitle">
              Read social scenarios and choose the best response. Practice making good decisions in everyday situations.
            </p>
            <button onClick={startGame} className="btn btn-primary btn-full" style={{ maxWidth: 340 }}>
              Start Game
            </button>
          </div>
        )}

        {screen === "play" && scenarios[currentIndex] && (
          <div className="fade fade-2">
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
                {currentIndex + 1} / {scenarios.length}
              </span>
              <span>{Math.floor(elapsed / 1000)}s</span>
            </div>

            <div className="card" style={{ padding: "28px 24px", marginBottom: 24 }}>
              <div style={{ fontSize: "2.5rem", marginBottom: 14, textAlign: "center" }}>
                {scenarios[currentIndex].emoji}
              </div>
              <h2
                style={{
                  fontFamily: "'Fredoka',sans-serif",
                  fontWeight: 600,
                  fontSize: "1.15rem",
                  marginBottom: 12,
                  textAlign: "center",
                  color: "var(--text-primary)",
                }}
              >
                {scenarios[currentIndex].title}
              </h2>
              <p
                style={{
                  fontSize: "0.95rem",
                  color: "var(--text-secondary)",
                  lineHeight: 1.7,
                  textAlign: "center",
                }}
              >
                {scenarios[currentIndex].description}
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {scenarios[currentIndex].options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => handleSelect(i)}
                  disabled={showFeedback}
                  className="card"
                  style={{
                    padding: "18px 22px",
                    textAlign: "left",
                    cursor: showFeedback ? "default" : "pointer",
                    border: "2.5px solid",
                    borderRadius: "var(--r-lg)",
                    borderColor:
                      showFeedback && i === selectedOption
                        ? opt.correct
                          ? "var(--sage-400)"
                          : "var(--peach-300)"
                        : showFeedback && opt.correct
                          ? "var(--sage-400)"
                          : "var(--border)",
                    background:
                      showFeedback && i === selectedOption
                        ? opt.correct
                          ? "var(--sage-50)"
                          : "var(--peach-100)"
                        : showFeedback && opt.correct
                          ? "var(--sage-50)"
                          : "var(--card)",
                    transition: "all 300ms var(--ease)",
                    fontFamily: "'Nunito', sans-serif",
                    fontSize: "0.95rem",
                    color: "var(--text-primary)",
                    fontWeight: 500,
                    lineHeight: 1.5,
                  }}
                >
                  {opt.text}
                  {showFeedback && (i === selectedOption || opt.correct) && (
                    <div
                      style={{
                        marginTop: 8,
                        fontSize: "0.85rem",
                        color: opt.correct ? "var(--sage-600)" : "var(--text-secondary)",
                        fontWeight: 600,
                      }}
                    >
                      {opt.feedback}
                    </div>
                  )}
                </button>
              ))}
            </div>

            {showFeedback && (
              <div style={{ marginTop: 16 }}>
                <button
                  onClick={() => setShowExplanation((v) => !v)}
                  className="btn btn-outline"
                  style={{ minHeight: 40, padding: "8px 20px", fontSize: "0.88rem" }}
                >
                  {showExplanation ? "Hide Why" : "Why?"}
                </button>
                {showExplanation && (
                  <div className="card" style={{
                    marginTop: 12,
                    padding: "16px 20px",
                    background: "var(--sage-50)",
                    borderColor: "var(--sage-300)",
                    textAlign: "left",
                  }}>
                    <p style={{
                      fontSize: "0.88rem",
                      color: "var(--sage-600)",
                      lineHeight: 1.7,
                      fontWeight: 500,
                      margin: 0,
                    }}>
                      {scenarios[currentIndex].explanation}
                    </p>
                  </div>
                )}
              </div>
            )}

            {showFeedback && (
              <button
                onClick={handleNext}
                className="btn btn-primary btn-full"
                style={{ marginTop: 24 }}
              >
                {currentIndex + 1 < scenarios.length ? "Next Story" : "See Results"}
              </button>
            )}
          </div>
        )}

        {screen === "result" && (
          <div className="fade fade-2" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "3.5rem", marginBottom: 20 }}>🌟</div>
            <h1 className="page-title">
              Great <em>Choices!</em>
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
                <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", fontWeight: 600 }}>
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
                  {correct}/{scenarios.length}
                </div>
                <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", fontWeight: 600 }}>
                  Correct
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <button onClick={startGame} className="btn btn-primary" style={{ minWidth: 160 }}>
                Play Again
              </button>
              <Link href="/kid-dashboard/games" className="btn btn-outline" style={{ minWidth: 160 }}>
                All Games
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
