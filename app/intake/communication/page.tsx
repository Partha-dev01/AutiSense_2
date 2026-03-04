"use client";
import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { addBiomarker } from "../../lib/db/biomarker.repository";
import { getCurrentSessionId } from "../../lib/session/currentSession";
import { getSession } from "../../lib/db/session.repository";
import SkipStageDialog from "../../components/SkipStageDialog";

const STEPS = [
  "Welcome", "Profile", "Device", "Communicate", "Behavior",
  "Prepare", "Motor", "Video", "Summary", "Report",
];
const STEP_IDX = 3;
const MIN_MATCHED = 2; // Criteria gate: at least 2 words matched

interface WordItem { text: string; emoji: string }

type WordState = "idle" | "playing" | "listening" | "matched" | "missed";

export default function CommunicationPage() {
  const router = useRouter();
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // Dynamic word loading
  const [words, setWords] = useState<WordItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Task state
  const [started, setStarted] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [wordState, setWordState] = useState<WordState>("idle");
  const [transcript, setTranscript] = useState("");
  const [results, setResults] = useState<("matched" | "missed")[]>([]);
  const [taskComplete, setTaskComplete] = useState(false);
  const [forceComplete, setForceComplete] = useState(false);

  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const saved = document.documentElement.getAttribute("data-theme") as "light" | "dark" | null;
    if (saved) setTheme(saved);
  }, []);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
  };

  // Load dynamic words from API on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sid = getCurrentSessionId();
        let ageMonths = 36;
        if (sid) {
          const session = await getSession(sid);
          if (session?.ageMonths) ageMonths = session.ageMonths;
        }
        const res = await fetch("/api/chat/generate-words", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ageMonths, count: 6, mode: "words" }),
        });
        if (!cancelled && res.ok) {
          const data = await res.json();
          setWords(data.items);
        } else if (!cancelled) {
          setLoadError(true);
        }
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const stopRecognition = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const advance = useCallback((result: "matched" | "missed") => {
    setResults((prev) => [...prev, result]);
    if (currentIdx >= words.length - 1) {
      setTaskComplete(true);
    } else {
      setCurrentIdx((i) => i + 1);
      setWordState("idle");
      setTranscript("");
    }
  }, [currentIdx, words.length]);

  // TTS: Polly first, browser SpeechSynthesis fallback
  const speakWord = useCallback(async (text: string): Promise<void> => {
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voiceId: "Joanna" }),
      });
      if (!res.ok) throw new Error("TTS failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      return new Promise<void>((resolve) => {
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => { URL.revokeObjectURL(url); audioRef.current = null; resolve(); };
        audio.onerror = () => { URL.revokeObjectURL(url); audioRef.current = null; resolve(); };
        audio.play().catch(() => { URL.revokeObjectURL(url); resolve(); });
      });
    } catch {
      return new Promise<void>((resolve) => {
        if (!("speechSynthesis" in window)) { resolve(); return; }
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.8;
        utterance.pitch = 1.1;
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        window.speechSynthesis.speak(utterance);
      });
    }
  }, []);

  const startListening = useCallback((expectedWord: string) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setWordState("missed");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognitionRef.current = recognition;

    recognition.onresult = (event: any) => {
      const result = Array.from(event.results)
        .map((r: any) => r[0].transcript)
        .join("");
      setTranscript(result);
      if (event.results[0]?.isFinal) {
        stopRecognition();
        const match = result.toLowerCase().includes(expectedWord.toLowerCase());
        if (match) {
          setWordState("matched");
          setTimeout(() => advance("matched"), 1200);
        } else {
          setWordState("missed");
        }
      }
    };

    recognition.onerror = () => {
      stopRecognition();
      setWordState("missed");
    };

    recognition.start();

    timerRef.current = setTimeout(() => {
      stopRecognition();
      setWordState("missed");
    }, 10000);
  }, [advance, stopRecognition]);

  const playAndListen = useCallback(async () => {
    const word = words[currentIdx];
    if (!word) return;
    setWordState("playing");
    await speakWord(word.text);
    setWordState("listening");
    startListening(word.text);
  }, [currentIdx, words, speakWord, startListening]);

  useEffect(() => {
    return () => {
      stopRecognition();
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    };
  }, [stopRecognition]);

  const resetStage = useCallback(() => {
    setCurrentIdx(0);
    setWordState("idle");
    setTranscript("");
    setResults([]);
    setTaskComplete(false);
    setForceComplete(false);
    setStarted(false);
  }, []);

  const handleSkipStage = useCallback(async () => {
    stopRecognition();
    const sid = getCurrentSessionId();
    if (sid) {
      await addBiomarker(sid, "communication_responsiveness", {
        gazeScore: 0.5,
        motorScore: 0.5,
        vocalizationScore: 0.5,
      }).catch(() => {});
    }
    router.push("/intake/behavioral-observation");
  }, [router, stopRecognition]);

  const word = words[currentIdx];
  const matchedCount = results.filter((r) => r === "matched").length;
  const meetsCriteria = matchedCount >= MIN_MATCHED;

  return (
    <div className="page">
      <nav className="nav">
        <Link href="/" className="logo">Auti<em>Sense</em></Link>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={toggleTheme} className="btn btn-outline" style={{ minHeight: 40, padding: "8px 14px", fontSize: "0.88rem" }}>
            {theme === "light" ? "🌙" : "☀️"}
          </button>
          <span style={{ fontSize: "0.88rem", color: "var(--text-muted)", fontWeight: 600 }}>
            Step {STEP_IDX + 1} of 10
          </span>
        </div>
      </nav>

      <div className="progress-wrap">
        <div className="progress-steps">
          {STEPS.map((s, i) => (
            <div key={s} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : "none" }}>
              <div className={`step-dot ${i < STEP_IDX ? "done" : i === STEP_IDX ? "active" : "upcoming"}`} title={s}>
                {i < STEP_IDX ? "✓" : i + 1}
              </div>
              {i < STEPS.length - 1 && <div className={`step-line ${i < STEP_IDX ? "done" : ""}`} />}
            </div>
          ))}
        </div>
      </div>

      <main className="main" style={{ position: "relative" }}>
        <SkipStageDialog onConfirm={handleSkipStage} />
        <div className="fade fade-1" style={{ textAlign: "center", marginBottom: 28 }}>
          <div className="breathe-orb" style={{ margin: "0 auto" }}>
            <div className="breathe-inner">🔊</div>
          </div>
        </div>

        <div className="chip fade fade-1">Step 4 — Word Echo</div>
        <h1 className="page-title fade fade-2">
          Word echo <em>challenge</em>
        </h1>
        <p className="subtitle fade fade-2">
          We'll say a word out loud. Encourage your child to say it back!
          This tests audio processing and speech production.
        </p>

        {/* Loading state */}
        {isLoading && (
          <div className="card fade fade-3" style={{ padding: "32px 28px", textAlign: "center" }}>
            <div style={{
              width: 32, height: 32, border: "3px solid var(--sage-200)",
              borderTopColor: "var(--sage-500)", borderRadius: "50%",
              animation: "spin 0.8s linear infinite", margin: "0 auto 16px",
            }} />
            <p style={{ color: "var(--text-muted)", fontWeight: 600 }}>Generating words...</p>
          </div>
        )}

        {/* Load error */}
        {loadError && !isLoading && words.length === 0 && (
          <div className="card fade fade-3" style={{ padding: "32px 28px", textAlign: "center" }}>
            <p style={{ color: "var(--text-muted)", marginBottom: 16 }}>Failed to load words.</p>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              Retry
            </button>
          </div>
        )}

        {/* Pre-start */}
        {!isLoading && words.length > 0 && !started && (
          <div className="fade fade-3" style={{ textAlign: "center" }}>
            <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: 20 }}>
              Make sure your volume is up! We'll play {words.length} words and listen for echoes.
            </p>
            <button className="btn btn-primary" onClick={() => { setStarted(true); playAndListen(); }}
              style={{ minHeight: 52, padding: "12px 36px" }}>
              🔊 Start Word Echo
            </button>
          </div>
        )}

        {/* Active test */}
        {started && !taskComplete && word && (
          <div className="card fade fade-3" style={{ padding: "32px 28px", textAlign: "center" }}>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: 20, fontWeight: 600 }}>
              Word {currentIdx + 1} of {words.length}
            </p>

            <div style={{ fontSize: "3.5rem", marginBottom: 12 }}>{word.emoji}</div>

            {wordState === "idle" && (
              <button className="btn btn-primary" onClick={playAndListen} style={{ minHeight: 48, padding: "10px 28px" }}>
                🔊 Play Word
              </button>
            )}

            {wordState === "playing" && (
              <div>
                <h2 style={{ fontFamily: "'Fredoka',sans-serif", fontWeight: 600, fontSize: "2rem", color: "var(--sage-600)", marginBottom: 8 }}>
                  &ldquo;{word.text}&rdquo;
                </h2>
                <p style={{ color: "var(--sage-500)", fontWeight: 700, fontSize: "0.9rem" }}>
                  🔊 Playing...
                </p>
              </div>
            )}

            {wordState === "listening" && (
              <div>
                <h2 style={{ fontFamily: "'Fredoka',sans-serif", fontWeight: 600, fontSize: "1.5rem", color: "var(--text-primary)", marginBottom: 12 }}>
                  Now say: &ldquo;{word.text}&rdquo;
                </h2>
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "10px 24px", borderRadius: "var(--r-full)",
                  background: "var(--sage-50)", border: "2px solid var(--sage-300)",
                }}>
                  <div style={{
                    width: 12, height: 12, borderRadius: "50%", background: "var(--sage-500)",
                    animation: "breathe-core 1.5s ease-in-out infinite",
                  }} />
                  <span style={{ fontWeight: 700, color: "var(--sage-600)", fontSize: "0.9rem" }}>
                    Listening...
                  </span>
                </div>
              </div>
            )}

            {wordState === "matched" && (
              <div>
                <p style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--sage-600)" }}>
                  ✓ Great match!
                </p>
              </div>
            )}

            {wordState === "missed" && (
              <div>
                <p style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 16 }}>
                  No match detected — that's okay!
                </p>
                <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                  <button className="btn btn-primary"
                    style={{ minHeight: 44, padding: "8px 20px", fontSize: "0.9rem" }}
                    onClick={() => { setWordState("idle"); setTranscript(""); }}>
                    Replay & Retry
                  </button>
                  <button className="btn btn-secondary"
                    style={{ minHeight: 44, padding: "8px 20px", fontSize: "0.9rem" }}
                    onClick={() => advance("missed")}>
                    Next Word →
                  </button>
                </div>
              </div>
            )}

            {/* Live transcript — visible during listening, matched, missed */}
            {(wordState === "listening" || wordState === "matched" || wordState === "missed") && transcript && (
              <div style={{
                marginTop: 16,
                padding: "12px 20px",
                borderRadius: 12,
                background: "var(--sage-50)",
                border: "2px solid var(--sage-300)",
                animation: wordState === "listening" ? "breathe-core 1.5s ease-in-out infinite" : "none",
              }}>
                <div style={{
                  fontSize: "0.75rem",
                  color: "var(--text-muted)",
                  fontWeight: 700,
                  marginBottom: 4,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}>
                  Heard:
                </div>
                <p style={{
                  fontSize: "1.4rem",
                  fontWeight: 700,
                  color: wordState === "matched" ? "var(--sage-600)" : "var(--text-primary)",
                  fontFamily: "'Fredoka',sans-serif",
                  margin: 0,
                }}>
                  &ldquo;{transcript}&rdquo;
                </p>
              </div>
            )}

            {/* Progress dots */}
            <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 20 }}>
              {words.map((_, i) => (
                <div key={i} style={{
                  width: 10, height: 10, borderRadius: "50%",
                  background: i < results.length
                    ? (results[i] === "matched" ? "var(--sage-500)" : "var(--peach-300)")
                    : i === currentIdx ? "var(--sky-300)" : "var(--bg-elevated)",
                  border: "2px solid var(--border-card)",
                }} />
              ))}
            </div>
          </div>
        )}

        {/* Completion */}
        {taskComplete && (
          <>
            {meetsCriteria || forceComplete ? (
              <div className="card fade fade-3" style={{ padding: "32px 28px", textAlign: "center", background: "var(--sage-50)", borderColor: "var(--sage-300)" }}>
                <div style={{ fontSize: "2.5rem", marginBottom: 14 }}>🎵</div>
                <h2 style={{ fontFamily: "'Fredoka',sans-serif", fontWeight: 600, fontSize: "1.3rem", marginBottom: 14 }}>
                  Word echo complete!
                </h2>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                  {matchedCount} of {words.length} words echoed successfully.
                </p>
              </div>
            ) : (
              <div className="card fade fade-3" style={{ padding: "32px 28px", textAlign: "center", background: "var(--peach-50)", borderColor: "var(--peach-300)" }}>
                <div style={{ fontSize: "2.5rem", marginBottom: 14 }}>🔄</div>
                <h2 style={{ fontFamily: "'Fredoka',sans-serif", fontWeight: 600, fontSize: "1.3rem", marginBottom: 10 }}>
                  Let's try again!
                </h2>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: 20 }}>
                  Only {matchedCount} of {words.length} words echoed. We need at least {MIN_MATCHED} to continue.
                </p>
                <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                  <button className="btn btn-primary" onClick={resetStage}
                    style={{ minHeight: 44, padding: "8px 24px" }}>
                    Try Again
                  </button>
                  <button className="btn btn-outline" onClick={() => setForceComplete(true)}
                    style={{ minHeight: 44, padding: "8px 24px" }}>
                    Skip This Step
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Navigation */}
        <div className="fade fade-4" style={{ display: "flex", gap: 12, marginTop: 28 }}>
          <Link href="/intake/device-check" className="btn btn-outline" style={{ minWidth: 100 }}>
            ← Back
          </Link>
          <button className="btn btn-primary btn-full"
            disabled={!taskComplete || (!meetsCriteria && !forceComplete)}
            onClick={async () => {
              const sid = getCurrentSessionId();
              if (sid) {
                await addBiomarker(sid, "communication_responsiveness", {
                  gazeScore: 0.5,
                  motorScore: 0.5,
                  vocalizationScore: Math.min(1, matchedCount / words.length),
                }).catch(() => {});
              }
              router.push("/intake/behavioral-observation");
            }}>
            Continue →
          </button>
        </div>
      </main>

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
