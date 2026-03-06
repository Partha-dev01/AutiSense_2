"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { getDifficulty, saveDifficulty } from "../../lib/games/difficultyEngine";
import { addGameActivity } from "../../lib/db/gameActivity.repository";
import { updateStreak } from "../../lib/db/streak.repository";
import NavLogo from "../../components/NavLogo";
import ThemeToggle from "../../components/ThemeToggle";

const fredoka = "'Fredoka',sans-serif";

interface Scenario {
  text: string;
  correct: string;
  emoji: string;
}

const ALL_SCENARIOS: Scenario[] = [
  { text: "Your best friend shares their favorite toy with you", correct: "Happy", emoji: "🧸" },
  { text: "You can't find your pet anywhere in the house", correct: "Scared", emoji: "🐕" },
  { text: "Someone cuts in front of you in line", correct: "Angry", emoji: "😤" },
  { text: "You get a surprise birthday party!", correct: "Surprised", emoji: "🎉" },
  { text: "Your mom gives you a warm hug before bed", correct: "Happy", emoji: "🤗" },
  { text: "You see a big spider on your desk", correct: "Scared", emoji: "🕷️" },
  { text: "A new kid at school invites you to play", correct: "Happy", emoji: "👋" },
  { text: "Someone breaks your favorite toy on purpose", correct: "Sad", emoji: "💔" },
  { text: "You hear a loud thunder while alone at home", correct: "Scared", emoji: "⛈️" },
  { text: "Your team wins the school sports day", correct: "Happy", emoji: "🏆" },
  { text: "You forgot to bring your lunch to school", correct: "Sad", emoji: "🍱" },
  { text: "Someone keeps poking you even after you said stop", correct: "Angry", emoji: "😠" },
  { text: "You open a gift and find exactly what you wanted", correct: "Surprised", emoji: "🎁" },
  { text: "Your friend moves to a different city", correct: "Sad", emoji: "✈️" },
  { text: "You are about to go on a roller coaster for the first time", correct: "Scared", emoji: "🎢" },
  { text: "Someone takes your seat without asking", correct: "Angry", emoji: "💺" },
  { text: "You find money on the ground", correct: "Surprised", emoji: "💵" },
  { text: "Your ice cream falls on the ground before you eat it", correct: "Sad", emoji: "🍦" },
  { text: "You score the winning goal in a game", correct: "Happy", emoji: "⚽" },
  { text: "Someone says something mean about your drawing", correct: "Sad", emoji: "🎨" },
];

const EMOTIONS = ["Happy", "Sad", "Angry", "Scared", "Surprised"];
const EMOTION_EMOJIS: Record<string, string> = {
  Happy: "😊", Sad: "😢", Angry: "😠", Scared: "😨", Surprised: "😲",
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function playCorrectSound() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(523, ctx.currentTime);
    osc.frequency.setValueAtTime(659, ctx.currentTime + 0.12);
    osc.frequency.setValueAtTime(784, ctx.currentTime + 0.24);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch { /* audio not available */ }
}

function playWrongSound() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "square";
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.setValueAtTime(150, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch { /* audio not available */ }
}

type Screen = "start" | "play" | "result";

export default function EmotionQuizPage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [screen, setScreen] = useState<Screen>("start");
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [current, setCurrent] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [total, setTotal] = useState(8);
  const [choices, setChoices] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [startTime, setStartTime] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const s = (typeof window !== "undefined" && localStorage.getItem("autisense-theme")) || "light";
    setTheme(s as "light" | "dark");
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

  const buildChoices = useCallback((correctAnswer: string) => {
    const others = shuffle(EMOTIONS.filter((e) => e !== correctAnswer)).slice(0, 3);
    return shuffle([correctAnswer, ...others]);
  }, []);

  const startGame = useCallback(() => {
    const childId = (typeof window !== "undefined" && localStorage.getItem("autisense-active-child-id")) || "default";
    const config = getDifficulty("emotion-match", childId);
    const count = Math.max(5, Math.min(config.itemCount + 3, 10));
    setTotal(count);

    const picked = shuffle(ALL_SCENARIOS).slice(0, count);
    setScenarios(picked);
    setCurrent(0);
    setCorrect(0);
    setFeedback(null);
    setSelectedAnswer(null);
    setChoices(buildChoices(picked[0].correct));
    setStartTime(Date.now());
    setElapsed(0);
    setSaved(false);
    setScreen("play");
  }, [buildChoices]);

  useEffect(() => {
    if (screen !== "result" || saved) return;
    setSaved(true);
    const childId = (typeof window !== "undefined" && localStorage.getItem("autisense-active-child-id")) || "default";
    const finalScore = Math.round((correct / total) * 100);
    const config = getDifficulty("emotion-match", childId);
    saveDifficulty("emotion-match", childId, finalScore);
    addGameActivity(childId, "emotion-match", finalScore, Math.floor(elapsed / 1000), config.level);
    updateStreak(childId);
  }, [screen, saved, correct, total, elapsed]);

  const handleAnswer = (answer: string) => {
    if (feedback) return;
    const isCorrect = answer === scenarios[current].correct;
    setSelectedAnswer(answer);

    if (isCorrect) {
      playCorrectSound();
      setCorrect((c) => c + 1);
      setFeedback("correct");
    } else {
      playWrongSound();
      setFeedback("wrong");
    }

    setTimeout(() => {
      const next = current + 1;
      if (next >= total) {
        setScreen("result");
      } else {
        setCurrent(next);
        setChoices(buildChoices(scenarios[next].correct));
        setFeedback(null);
        setSelectedAnswer(null);
      }
    }, 1200);
  };

  const score = total > 0 ? Math.round((correct / total) * 100) : 0;
  const scenario = scenarios[current];

  return (
    <div className="page">
      <nav className="nav">
        <NavLogo />
        <ThemeToggle theme={theme} onToggle={() => setTheme((t) => (t === "light" ? "dark" : "light"))} />
      </nav>

      <div className="main fade fade-1" style={{ maxWidth: 600, padding: "40px 28px 80px" }}>
        <Link
          href="/games"
          className="btn btn-outline"
          style={{ minHeight: 40, padding: "8px 18px", fontSize: "0.88rem", marginBottom: 28, display: "inline-flex" }}
        >
          Back to Games
        </Link>

        {screen === "start" && (
          <div className="fade fade-2" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "3.5rem", marginBottom: 20 }}>🧠</div>
            <h1 className="page-title">
              Emotion <em>Quiz</em>
            </h1>
            <p className="subtitle">
              Read each situation and pick the emotion you&apos;d feel. How well do you know feelings?
            </p>
            <button onClick={startGame} className="btn btn-primary btn-full" style={{ maxWidth: 340 }}>
              Start Quiz
            </button>
          </div>
        )}

        {screen === "play" && scenario && (
          <div className="fade fade-2">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 600 }}>
              <span>Question {current + 1} / {total}</span>
              <span>{correct} correct</span>
              <span>{Math.floor(elapsed / 1000)}s</span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: "var(--sage-100)", marginBottom: 28, overflow: "hidden" }}>
              <div style={{ width: `${(current / total) * 100}%`, height: "100%", borderRadius: 3, background: "var(--sage-500)", transition: "width 400ms ease" }} />
            </div>

            <div className="card" style={{ padding: "28px 24px", textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontSize: "2.5rem", marginBottom: 16 }}>{scenario.emoji}</div>
              <p style={{ fontFamily: fredoka, fontWeight: 500, fontSize: "1.1rem", color: "var(--text-primary)", lineHeight: 1.6, margin: 0 }}>
                {scenario.text}
              </p>
            </div>

            <p style={{ textAlign: "center", fontFamily: fredoka, fontWeight: 600, fontSize: "0.95rem", color: "var(--text-secondary)", marginBottom: 16 }}>
              How would you feel?
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {choices.map((emotion) => {
                const isSelected = selectedAnswer === emotion;
                const isCorrectAnswer = emotion === scenario.correct;
                let bg = "var(--card)";
                let borderColor = "var(--border)";
                let color = "var(--text-primary)";

                if (feedback) {
                  if (isCorrectAnswer) {
                    bg = "var(--sage-100)";
                    borderColor = "var(--sage-500)";
                    color = "var(--sage-700)";
                  } else if (isSelected && !isCorrectAnswer) {
                    bg = "var(--feature-peach, #ffe0d0)";
                    borderColor = "#e74c3c";
                    color = "#c0392b";
                  }
                }

                return (
                  <button
                    key={emotion}
                    onClick={() => handleAnswer(emotion)}
                    disabled={!!feedback}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      padding: "18px 12px", borderRadius: "var(--r-lg)",
                      border: `2.5px solid ${borderColor}`, background: bg,
                      cursor: feedback ? "default" : "pointer",
                      fontFamily: fredoka, fontWeight: 600, fontSize: "1rem", color,
                      transition: "all 250ms ease",
                    }}
                  >
                    <span style={{ fontSize: "1.3rem" }}>{EMOTION_EMOJIS[emotion]}</span>
                    {emotion}
                  </button>
                );
              })}
            </div>

            {feedback && (
              <div style={{
                textAlign: "center", marginTop: 18, fontFamily: fredoka, fontWeight: 600, fontSize: "1rem",
                color: feedback === "correct" ? "var(--sage-600)" : "#e74c3c",
              }}>
                {feedback === "correct" ? "That\u2019s right! \uD83C\uDF89" : `The answer is ${scenario.correct} ${EMOTION_EMOJIS[scenario.correct]}`}
              </div>
            )}
          </div>
        )}

        {screen === "result" && (
          <div className="fade fade-2" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "3.5rem", marginBottom: 20 }}>
              {score >= 80 ? "\uD83C\uDFC6" : score >= 50 ? "\uD83C\uDF1F" : "\uD83D\uDCAA"}
            </div>
            <h1 className="page-title">
              {score >= 80 ? (<>Amazing <em>Job!</em></>) : score >= 50 ? (<>Good <em>Try!</em></>) : (<>Keep <em>Practicing!</em></>)}
            </h1>
            <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap", marginBottom: 32 }}>
              <div className="card" style={{ padding: "20px 24px", textAlign: "center" }}>
                <div style={{ fontSize: "1.8rem", fontFamily: fredoka, fontWeight: 700, color: "var(--sage-500)" }}>{score}%</div>
                <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", fontWeight: 600 }}>Score</div>
              </div>
              <div className="card" style={{ padding: "20px 24px", textAlign: "center" }}>
                <div style={{ fontSize: "1.8rem", fontFamily: fredoka, fontWeight: 700, color: "var(--sage-500)" }}>{correct}/{total}</div>
                <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", fontWeight: 600 }}>Correct</div>
              </div>
              <div className="card" style={{ padding: "20px 24px", textAlign: "center" }}>
                <div style={{ fontSize: "1.8rem", fontFamily: fredoka, fontWeight: 700, color: "var(--sage-500)" }}>{Math.floor(elapsed / 1000)}s</div>
                <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", fontWeight: 600 }}>Time</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <button onClick={startGame} className="btn btn-primary" style={{ minWidth: 160 }}>Play Again</button>
              <Link href="/games" className="btn btn-outline" style={{ minWidth: 160 }}>All Games</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
