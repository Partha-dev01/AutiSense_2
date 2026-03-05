"use client";

import Link from "next/link";
import { useState, useEffect, useCallback, useRef } from "react";
import { getDifficulty, saveDifficulty } from "../../lib/games/difficultyEngine";
import { addGameActivity } from "../../lib/db/gameActivity.repository";
import { updateStreak } from "../../lib/db/streak.repository";
import { useAuthGuard } from "../../hooks/useAuthGuard";

type Screen = "start" | "play" | "result";

const FALLBACK_WORDS = ["apple", "banana", "cat", "dog", "fish", "happy", "hello", "sun", "tree", "water"];

const statStyle = {
  fontSize: "1.8rem", fontFamily: "'Fredoka',sans-serif" as const,
  fontWeight: 700 as const, color: "var(--sage-500)",
};
const statLabel = {
  fontSize: "0.82rem", color: "var(--text-secondary)", fontWeight: 600 as const,
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export default function SpeechPracticePage() {
  const { loading: authLoading } = useAuthGuard();

  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [screen, setScreen] = useState<Screen>("start");
  const [words, setWords] = useState<string[]>([]);
  const [wordIdx, setWordIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackOk, setFeedbackOk] = useState(false);
  const [listening, setListening] = useState(false);
  const [saved, setSaved] = useState(false);
  const [hasSpeechApi, setHasSpeechApi] = useState(true);
  const [playingAudio, setPlayingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const s = (typeof window !== "undefined" && localStorage.getItem("autisense-theme")) || "light";
    setTheme(s as "light" | "dark");
    const SR = (window as unknown as Record<string, unknown>).SpeechRecognition
      || (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
    setHasSpeechApi(!!SR);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    if (typeof window !== "undefined") localStorage.setItem("autisense-theme", theme);
  }, [theme]);

  /* ---------- elapsed timer ---------- */
  useEffect(() => {
    if (screen !== "play") return;
    const iv = setInterval(() => setElapsed(Date.now() - startTime), 500);
    return () => clearInterval(iv);
  }, [screen, startTime]);

  /* ---------- fetch words ---------- */
  const fetchWords = useCallback(async (count: number): Promise<string[]> => {
    try {
      const res = await fetch("/api/chat/generate-words", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "words", ageMonths: 60 }),
      });
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      const list: string[] = Array.isArray(data.words) ? data.words : FALLBACK_WORDS;
      return shuffle(list).slice(0, count);
    } catch {
      return shuffle([...FALLBACK_WORDS]).slice(0, count);
    }
  }, []);

  /* ---------- start game ---------- */
  const startGame = useCallback(async () => {
    const childId =
      (typeof window !== "undefined" && localStorage.getItem("autisense-active-child-id")) || "default";
    const config = getDifficulty("speech-practice", childId);
    const fetched = await fetchWords(config.itemCount);

    setWords(fetched);
    setWordIdx(0);
    setScore(0);
    setStartTime(Date.now());
    setElapsed(0);
    setFeedback(null);
    setFeedbackOk(false);
    setSaved(false);
    setScreen("play");
  }, [fetchWords]);

  /* ---------- play pronunciation ---------- */
  const playWord = useCallback(async (word: string) => {
    if (playingAudio) return;
    setPlayingAudio(true);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: word }),
      });
      if (!res.ok) throw new Error("TTS error");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { URL.revokeObjectURL(url); setPlayingAudio(false); };
      audio.onerror = () => { URL.revokeObjectURL(url); setPlayingAudio(false); };
      await audio.play();
    } catch {
      setPlayingAudio(false);
    }
  }, [playingAudio]);

  const advanceWord = useCallback(() => {
    if (wordIdx + 1 < words.length) { setWordIdx((i) => i + 1); setFeedback(null); setFeedbackOk(false); }
    else setScreen("result");
  }, [wordIdx, words.length]);

  /* ---------- speech recognition attempt ---------- */
  const attemptSpeech = useCallback(() => {
    const SR = (window as unknown as Record<string, unknown>).SpeechRecognition
      || (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
    if (!SR) return;

    setListening(true);
    setFeedback(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition = new (SR as any)();
    recognition.lang = "en-US";
    recognition.interimResults = false;

    recognition.onresult = (e: { results: { transcript: string }[][] }) => {
      const transcript = e.results[0][0].transcript.toLowerCase();
      const target = words[wordIdx].toLowerCase();
      setListening(false);

      if (transcript.includes(target)) {
        setScore((s) => s + 1);
        setFeedback("Great job!");
        setFeedbackOk(true);
        setTimeout(advanceWord, 1500);
      } else {
        setFeedback("Good try! Let\u2019s try again.");
        setFeedbackOk(false);
      }
    };

    recognition.onerror = () => {
      setListening(false);
      setFeedback("Good try! Let\u2019s try again.");
      setFeedbackOk(false);
    };

    recognition.onend = () => setListening(false);
    recognition.start();
  }, [words, wordIdx, advanceWord]);

  const fallbackMark = useCallback(() => {
    setScore((s) => s + 1); setFeedback("Great job!"); setFeedbackOk(true); setTimeout(advanceWord, 1500);
  }, [advanceWord]);

  useEffect(() => {
    if (screen !== "result" || saved) return;
    setSaved(true);
    const cid = (typeof window !== "undefined" && localStorage.getItem("autisense-active-child-id")) || "default";
    const fs = words.length > 0 ? Math.round((score / words.length) * 100) : 0;
    const config = getDifficulty("speech-practice", cid);
    saveDifficulty("speech-practice", cid, fs);
    addGameActivity(cid, "speech-practice", fs, Math.floor(elapsed / 1000), config.level);
    updateStreak(cid);
  }, [screen, saved, score, words.length, elapsed]);

  const finalScore = words.length > 0 ? Math.round((score / words.length) * 100) : 0;
  const currentWord = words[wordIdx] || "";

  if (authLoading) return (
    <div className="page"><div className="main" style={{ textAlign: "center", padding: 80 }}>
      <p style={{ color: "var(--text-secondary)", fontSize: "1rem" }}>Loading...</p>
    </div></div>
  );

  return (
    <div className="page">
      <nav className="nav">
        <Link href="/" className="logo">
          Auti<em>Sense</em>
        </Link>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
            className="btn btn-outline"
            style={{ minHeight: 40, padding: "8px 16px", fontSize: "0.9rem" }}
            aria-label="Toggle theme"
          >
            {theme === "light" ? "Dark" : "Light"}
          </button>
          <Link
            href="/kid-dashboard"
            className="btn btn-outline"
            style={{ minHeight: 40, padding: "8px 16px", fontSize: "0.9rem" }}
          >
            Home
          </Link>
        </div>
      </nav>

      <div className="main fade fade-1" style={{ maxWidth: 540, padding: "40px 28px 80px" }}>
        {/* ---------- START ---------- */}
        {screen === "start" && (
          <div className="fade fade-2" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "3.5rem", marginBottom: 20 }}>{"\uD83D\uDDE3\uFE0F"}</div>
            <h1 className="page-title" style={{ fontFamily: "'Fredoka',sans-serif" }}>
              Speech <em>Practice</em>
            </h1>
            <p className="subtitle">
              Listen to words and try saying them out loud. Take your time!
            </p>
            <button onClick={startGame} className="btn btn-primary btn-full" style={{ maxWidth: 340 }}>
              Start Practice
            </button>
          </div>
        )}

        {/* ---------- PLAY ---------- */}
        {screen === "play" && (
          <div className="fade fade-2" style={{ textAlign: "center" }}>
            <div style={{
              display: "flex", justifyContent: "space-between", marginBottom: 12,
              fontSize: "0.9rem", color: "var(--text-secondary)", fontWeight: 600,
            }}>
              <span>Word {wordIdx + 1} of {words.length}</span>
              <span>Score: {score}</span>
              <span>{Math.floor(elapsed / 1000)}s</span>
            </div>

            <div style={{
              fontFamily: "'Fredoka',sans-serif", fontSize: "3rem", fontWeight: 700,
              color: "var(--sage-500)", padding: "36px 20px", marginBottom: 20,
              background: "var(--sage-50)", borderRadius: "var(--r-lg)",
              border: "2px solid var(--sage-200)", letterSpacing: "0.04em",
            }}>
              {currentWord}
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 20 }}>
              <button
                onClick={() => playWord(currentWord)}
                disabled={playingAudio}
                className="btn btn-outline"
                style={{ minHeight: 56, minWidth: 56, padding: "12px 28px", fontSize: "1rem", fontWeight: 600 }}
                aria-label={`Listen to ${currentWord}`}
              >
                {playingAudio ? "Playing..." : "Listen"}
              </button>

              {hasSpeechApi ? (
                <button
                  onClick={attemptSpeech}
                  disabled={listening || feedbackOk}
                  className="btn btn-primary"
                  style={{ minHeight: 56, minWidth: 56, padding: "12px 28px", fontSize: "1rem", fontWeight: 600 }}
                  aria-label="Record your voice"
                >
                  {listening ? "Listening..." : "I said it!"}
                </button>
              ) : (
                <button
                  onClick={fallbackMark}
                  disabled={feedbackOk}
                  className="btn btn-primary"
                  style={{ minHeight: 56, minWidth: 56, padding: "12px 28px", fontSize: "1rem", fontWeight: 600 }}
                  aria-label="Mark as said"
                >
                  Say it!
                </button>
              )}
            </div>

            {feedback && (
              <div style={{
                fontFamily: "'Fredoka',sans-serif", fontSize: "1.4rem", fontWeight: 700, marginBottom: 12,
                color: feedbackOk ? "var(--sage-500)" : "var(--text-secondary)",
                transition: "opacity 300ms var(--ease)",
              }}>
                {feedbackOk && <span style={{ fontSize: "1.6rem", marginRight: 8 }}>{"\u2705"}</span>}
                {feedback}
              </div>
            )}

            {!feedbackOk && feedback && (
              <button
                onClick={() => { setFeedback(null); setFeedbackOk(false); }}
                className="btn btn-outline"
                style={{ minHeight: 56, padding: "12px 24px", fontSize: "0.95rem" }}
              >
                Retry
              </button>
            )}
          </div>
        )}

        {/* ---------- RESULT ---------- */}
        {screen === "result" && (
          <div className="fade fade-2" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "3.5rem", marginBottom: 20 }}>
              {finalScore >= 70 ? "\uD83C\uDFC6" : "\uD83C\uDF1F"}
            </div>
            <h1 className="page-title" style={{ fontFamily: "'Fredoka',sans-serif" }}>
              {finalScore >= 70 ? (<>Great <em>Speaking!</em></>) : (<>Nice <em>Try!</em></>)}
            </h1>

            <div style={{
              display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap", marginBottom: 32,
            }}>
              <div className="card" style={{ padding: "20px 24px", textAlign: "center" }}>
                <div style={statStyle}>{finalScore}%</div>
                <div style={statLabel}>Score</div>
              </div>
              <div className="card" style={{ padding: "20px 24px", textAlign: "center" }}>
                <div style={statStyle}>{score}/{words.length}</div>
                <div style={statLabel}>Words</div>
              </div>
              <div className="card" style={{ padding: "20px 24px", textAlign: "center" }}>
                <div style={statStyle}>{Math.floor(elapsed / 1000)}s</div>
                <div style={statLabel}>Time</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <button onClick={startGame} className="btn btn-primary" style={{ minWidth: 160 }}>
                Practice Again
              </button>
              <Link href="/kid-dashboard" className="btn btn-outline" style={{ minWidth: 160 }}>
                Home
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
