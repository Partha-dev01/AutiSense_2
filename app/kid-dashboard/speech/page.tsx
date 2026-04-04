"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { getDifficulty, saveDifficulty } from "../../lib/games/difficultyEngine";

interface SpeechRec {
  lang: string;
  interimResults: boolean;
  onresult: ((e: { results: { transcript: string; isFinal?: boolean }[][] }) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}
import { addGameActivity } from "../../lib/db/gameActivity.repository";
import { updateStreak } from "../../lib/db/streak.repository";
import { useAuthGuard } from "../../hooks/useAuthGuard";
import { speakText, checkMicSupport, stopSpeaking } from "../../lib/audio/ttsHelper";
import NavLogo from "../../components/NavLogo";
import UserMenu from "../../components/UserMenu";
import ThemeToggle from "../../components/ThemeToggle";

type Screen = "start" | "play" | "result";

const FALLBACK_WORDS = ["apple", "banana", "cat", "dog", "fish", "happy", "hello", "sun", "tree", "water"];
const FALLBACK_SENTENCES = [
  "The cat sat", "I like to play", "The sun is bright",
  "A big red bus", "I can run fast", "She has a hat",
];

function getSpeechStage(idx: number): number {
  if (idx < 3) return 1;
  if (idx < 6) return 2;
  return 3;
}

const STAGE_LABELS: Record<number, string> = {
  1: "Stage 1: Say the Word",
  2: "Stage 2: Say the Phrase",
  3: "Stage 3: Say the Sentence",
};

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
  const [micError, setMicError] = useState<string | null>(null);
  const [playingAudio, setPlayingAudio] = useState(false);


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
    const needed = Math.max(3, count); // always at least 3 words
    try {
      const res = await fetch("/api/chat/generate-words", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "words", ageMonths: 60, count: needed }),
      });
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      // API returns { items: [{text, emoji}] } not { words: [] }
      const list: string[] = Array.isArray(data.items)
        ? data.items.map((i: { text: string }) => i.text)
        : FALLBACK_WORDS;
      return shuffle(list).slice(0, needed);
    } catch {
      return shuffle([...FALLBACK_WORDS]).slice(0, needed);
    }
  }, []);

  /* ---------- start game ---------- */
  const startGame = useCallback(async () => {
    const childId =
      (typeof window !== "undefined" && localStorage.getItem("autisense-active-child-id")) || "default";
    const config = getDifficulty("speech-practice", childId);
    // Ensure at least 9 items for 3 stages
    const itemCount = Math.max(9, config.itemCount);
    const fetched = await fetchWords(itemCount);

    // Build staged items: words for stages 1-2 (indices 0-5), sentences for stage 3 (indices 6-8)
    const stageWords = fetched.slice(0, 6);
    const sentences = shuffle([...FALLBACK_SENTENCES]).slice(0, 3);
    const allItems = [...stageWords, ...sentences];

    setWords(allItems);
    setWordIdx(0);
    setScore(0);
    setStartTime(Date.now());
    setElapsed(0);
    setFeedback(null);
    setFeedbackOk(false);
    setSaved(false);
    setScreen("play");
  }, [fetchWords]);

  /* ---------- play pronunciation (uses Polly → browser TTS fallback) ---------- */
  const playWord = useCallback(async (word: string) => {
    if (playingAudio) return;
    setPlayingAudio(true);
    try {
      await speakText(word);
    } finally {
      setPlayingAudio(false);
    }
  }, [playingAudio]);

  /* ---------- auto-play word when it changes ---------- */
  useEffect(() => {
    if (screen === "play" && currentWord) {
      // Small delay so UI renders first
      const t = setTimeout(() => playWord(currentWord), 400);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, wordIdx]);

  const advanceWord = useCallback(() => {
    if (wordIdx + 1 < words.length) { setWordIdx((i) => i + 1); setFeedback(null); setFeedbackOk(false); }
    else setScreen("result");
  }, [wordIdx, words.length]);

  /* ---------- speech recognition attempt ---------- */
  const attemptSpeech = useCallback(async () => {
    // Cancel any ongoing TTS to free the audio subsystem for SpeechRecognition
    stopSpeaking();
    setPlayingAudio(false);
    await new Promise(r => setTimeout(r, 300));

    // Check mic permissions first
    const mic = await checkMicSupport();
    if (!mic.supported || !mic.permitted) {
      setMicError(mic.error || "Microphone not available");
      return;
    }
    setMicError(null);

    const SR = (window as unknown as Record<string, unknown>).SpeechRecognition
      || (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
    if (!SR) return;

    setListening(true);
    setFeedback(null);
    const recognition = new (SR as new () => SpeechRec)();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    (recognition as any).continuous = true; // keep listening — don't stop on silence
    (recognition as any).maxAlternatives = 3;

    let settled = false;

    const fuzzyWordMatch = (word: string, target: string): boolean => {
      if (word === target) return true;
      if (word.includes(target) || target.includes(word)) return true;
      if (target.length > 2 && word.length > 2 && Math.abs(word.length - target.length) <= 1) {
        let diff = 0;
        const longer = word.length >= target.length ? word : target;
        const shorter = word.length >= target.length ? target : word;
        let si = 0;
        for (let li = 0; li < longer.length && si < shorter.length; li++) {
          if (longer[li] !== shorter[si]) { diff++; } else { si++; }
        }
        diff += shorter.length - si;
        if (diff <= 1) return true;
      }
      if (target.length >= 3 && word.startsWith(target.substring(0, 3))) return true;
      return false;
    };

    recognition.onresult = (e: { results: { transcript: string; isFinal?: boolean }[][] }) => {
      if (settled) return;
      // Collect all transcripts
      let full = "";
      for (let i = 0; i < e.results.length; i++) {
        full += e.results[i][0].transcript;
      }
      const target = words[wordIdx].toLowerCase();

      // Check ALL results across all alternatives for fuzzy match
      for (let i = 0; i < e.results.length; i++) {
        const alts = e.results[i] as unknown as { transcript: string }[];
        for (let j = 0; j < (alts.length || 1); j++) {
          const alt = (alts[j]?.transcript || "").toLowerCase().trim();
          if (!alt) continue;
          if (alt.includes(target)) { markMatch(); return; }
          for (const w of alt.split(/\s+/)) {
            if (fuzzyWordMatch(w, target)) { markMatch(); return; }
          }
        }
      }

      // Also check full accumulated transcript
      if (full.toLowerCase().includes(target)) { markMatch(); return; }
      for (const w of full.toLowerCase().split(/\s+/)) {
        if (fuzzyWordMatch(w, target)) { markMatch(); return; }
      }

      function markMatch() {
        settled = true;
        try { recognition.stop(); } catch { /* ignore */ }
        setListening(false);
        setScore((s) => s + 1);
        setFeedback("Great job!");
        setFeedbackOk(true);
        setTimeout(advanceWord, 1500);
      }
    };

    recognition.onerror = (err: { error?: string }) => {
      if (settled) return;
      // Only treat "not-allowed" (permission denied) as fatal.
      // All other errors are transient — onend will restart.
      if (err?.error === "not-allowed") {
        settled = true;
        try { recognition.stop(); } catch { /* ignore */ }
        setListening(false);
        setFeedback("Microphone access denied. Check browser settings.");
        setFeedbackOk(false);
      }
    };

    recognition.onend = () => {
      if (settled) return;
      // NEVER mark missed here — only the hard timeout should do that.
      setTimeout(() => {
        if (settled) return;
        try { recognition.start(); } catch {
          try {
            const Fresh = (window as unknown as Record<string, unknown>).SpeechRecognition
              || (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
            if (!Fresh) return; // hard timeout will handle it
            const fresh = new (Fresh as new () => SpeechRec)();
            fresh.lang = "en-US";
            fresh.interimResults = true;
            (fresh as any).continuous = true;
            fresh.onresult = recognition.onresult;
            fresh.onerror = recognition.onerror;
            fresh.onend = recognition.onend;
            fresh.start();
          } catch { /* hard timeout will handle it */ }
        }
      }, 250);
    };

    // Start recognition — retry with increasing delay if needed
    const tryStart = (delay: number, attempt: number) => {
      setTimeout(() => {
        if (settled) return;
        try { recognition.start(); } catch {
          if (attempt < 3) tryStart(delay + 300, attempt + 1);
        }
      }, delay);
    };
    tryStart(500, 0);

    // Hard timeout: 8 seconds
    setTimeout(() => {
      if (!settled) {
        settled = true;
        try { recognition.stop(); } catch { /* ignore */ }
        setListening(false);
        setFeedback("Time\u2019s up! Try again.");
        setFeedbackOk(false);
      }
    }, 8500);
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
        <NavLogo />
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <ThemeToggle theme={theme} onToggle={() => setTheme((t) => (t === "light" ? "dark" : "light"))} />
          <Link
            href="/kid-dashboard"
            className="btn btn-outline"
            style={{ minHeight: 40, padding: "8px 16px", fontSize: "0.9rem" }}
          >
            Home
          </Link>
          <UserMenu />
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
              display: "flex", justifyContent: "space-between", marginBottom: 8,
              fontSize: "0.9rem", color: "var(--text-secondary)", fontWeight: 600,
            }}>
              <span>Item {wordIdx + 1} of {words.length}</span>
              <span>Score: {score}</span>
              <span>{Math.floor(elapsed / 1000)}s</span>
            </div>

            {/* Stage label */}
            <div style={{
              fontSize: "0.82rem", fontWeight: 700, color: "var(--sage-500)",
              marginBottom: 12, textTransform: "uppercase" as const, letterSpacing: "0.05em",
            }}>
              {STAGE_LABELS[getSpeechStage(wordIdx)]}
            </div>

            {/* Stage 2: show 3 words in a phrase with current highlighted */}
            {getSpeechStage(wordIdx) === 2 ? (
              <div style={{
                fontFamily: "'Fredoka',sans-serif", padding: "36px 20px", marginBottom: 20,
                background: "var(--sage-50)", borderRadius: "var(--r-lg)",
                border: "2px solid var(--sage-200)", display: "flex", gap: 16,
                justifyContent: "center", flexWrap: "wrap",
              }}>
                {words.slice(3, 6).map((w, i) => (
                  <span key={i} style={{
                    fontSize: wordIdx === 3 + i ? "2.4rem" : "1.6rem",
                    fontWeight: 700, letterSpacing: "0.04em",
                    color: wordIdx === 3 + i ? "var(--sage-500)" : "var(--text-muted)",
                    opacity: wordIdx === 3 + i ? 1 : 0.5,
                    transition: "all 300ms var(--ease)",
                    textDecoration: i < (wordIdx - 3) ? "line-through" : "none",
                  }}>
                    {w}
                  </span>
                ))}
              </div>
            ) : (
              <div style={{
                fontFamily: "'Fredoka',sans-serif",
                fontSize: getSpeechStage(wordIdx) === 3 ? "2rem" : "3rem",
                fontWeight: 700,
                color: "var(--sage-500)", padding: "36px 20px", marginBottom: 20,
                background: "var(--sage-50)", borderRadius: "var(--r-lg)",
                border: "2px solid var(--sage-200)", letterSpacing: "0.04em",
              }}>
                {currentWord}
              </div>
            )}

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
                  {listening ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 3, height: 20 }}>
                        {[0,1,2,3,4].map((i) => (
                          <span key={i} style={{
                            display: "inline-block", width: 4, borderRadius: 2,
                            background: "white",
                            animation: `vizBar 0.8s ease-in-out ${i * 0.12}s infinite alternate`,
                          }} />
                        ))}
                      </span>
                      Listening...
                    </span>
                  ) : "I said it!"}
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

            {micError && (
              <div style={{
                padding: "10px 16px", borderRadius: "var(--r-md)",
                background: "var(--peach-100, #fff3e0)", border: "1px solid var(--peach-200, #ffe0b2)",
                fontSize: "0.85rem", color: "var(--text-primary)", marginBottom: 12,
              }}>
                {micError}
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

      <style jsx>{`
        @keyframes vizBar {
          0% { height: 4px; }
          100% { height: 18px; }
        }
      `}</style>
    </div>
  );
}
