"use client";
import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { addBiomarker } from "../../lib/db/biomarker.repository";
import { getCurrentSessionId } from "../../lib/session/currentSession";
import { getSession } from "../../lib/db/session.repository";

const STEPS = [
  "Welcome", "Profile", "Device", "Communicate", "Visual", "Behavior",
  "Prepare", "Motor", "Audio", "Video", "Summary", "Report",
];
const STEP_IDX = 8;
const MIN_RESPONDED = 2; // Criteria gate: at least 2 of 7

interface ContentItem { text: string; emoji: string }
type ItemState = "idle" | "playing" | "listening" | "matched" | "missed";
type Part = "A" | "B";

/** Word-overlap scoring for sentence matching. */
function sentenceMatchScore(expected: string, transcript: string): number {
  const expectedWords = new Set(
    expected.toLowerCase().split(/\s+/).filter((w) => w.length > 2),
  );
  const transcriptWords = new Set(transcript.toLowerCase().split(/\s+/));
  let matches = 0;
  for (const w of expectedWords) {
    if (transcriptWords.has(w)) matches++;
  }
  return expectedWords.size > 0 ? matches / expectedWords.size : 0;
}

export default function AudioAssessmentPage() {
  const router = useRouter();
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // Dynamic content
  const [sentences, setSentences] = useState<ContentItem[]>([]);
  const [instructions, setInstructions] = useState<ContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Task state
  const [started, setStarted] = useState(false);
  const [part, setPart] = useState<Part>("A");
  const [currentIdx, setCurrentIdx] = useState(0);
  const [itemState, setItemState] = useState<ItemState>("idle");
  const [transcript, setTranscript] = useState("");
  const [partAResults, setPartAResults] = useState<("matched" | "missed")[]>([]);
  const [partBResults, setPartBResults] = useState<("responded" | "missed")[]>([]);
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

  // Load dynamic content
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
        const [sentRes, instrRes] = await Promise.all([
          fetch("/api/chat/generate-words", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ageMonths, count: 4, mode: "sentences" }),
          }),
          fetch("/api/chat/generate-words", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ageMonths, count: 3, mode: "instructions" }),
          }),
        ]);

        if (!cancelled) {
          if (sentRes.ok) {
            const d = await sentRes.json();
            setSentences(d.items);
          }
          if (instrRes.ok) {
            const d = await instrRes.json();
            setInstructions(d.items);
          }
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

  const items = part === "A" ? sentences : instructions;
  const totalItems = sentences.length + instructions.length;

  const advanceItem = useCallback((result: "matched" | "missed" | "responded") => {
    if (part === "A") {
      setPartAResults((prev) => [...prev, result as "matched" | "missed"]);
      if (currentIdx >= sentences.length - 1) {
        // Switch to Part B
        setPart("B");
        setCurrentIdx(0);
        setItemState("idle");
        setTranscript("");
      } else {
        setCurrentIdx((i) => i + 1);
        setItemState("idle");
        setTranscript("");
      }
    } else {
      setPartBResults((prev) => [...prev, result as "responded" | "missed"]);
      if (currentIdx >= instructions.length - 1) {
        setTaskComplete(true);
      } else {
        setCurrentIdx((i) => i + 1);
        setItemState("idle");
        setTranscript("");
      }
    }
  }, [part, currentIdx, sentences.length, instructions.length]);

  // TTS
  const speakText = useCallback(async (text: string): Promise<void> => {
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

  const startListening = useCallback((expectedText: string, isPart: Part) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setItemState("missed");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;       // keep listening — don't stop on silence
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognitionRef.current = recognition;

    let settled = false;

    recognition.onresult = (event: any) => {
      // Collect all transcripts across all results
      let full = "";
      for (let i = 0; i < event.results.length; i++) {
        full += event.results[i][0].transcript;
      }
      setTranscript(full);

      // Check the latest final result
      const latest = event.results[event.results.length - 1];
      if (latest?.isFinal && !settled) {
        if (isPart === "A") {
          const score = sentenceMatchScore(expectedText, full);
          if (score >= 0.4) {
            settled = true;
            stopRecognition();
            setItemState("matched");
            setTimeout(() => advanceItem("matched"), 1200);
          }
          // If not matched, keep listening until timeout
        } else {
          // Part B: any response = engaged
          if (full.trim().length > 0) {
            settled = true;
            stopRecognition();
            setItemState("matched");
            setTimeout(() => advanceItem("responded"), 1200);
          }
        }
      }
    };

    recognition.onerror = (e: any) => {
      if (settled) return;
      if (e.error === "no-speech" || e.error === "aborted") return;
      settled = true; stopRecognition(); setItemState("missed");
    };

    recognition.onend = () => {
      if (!settled) { settled = true; setItemState("missed"); }
    };

    // Small delay for desktop hardware
    setTimeout(() => {
      try { recognition.start(); } catch { setItemState("missed"); }
    }, 400);

    // Hard timeout
    timerRef.current = setTimeout(() => {
      if (!settled) { settled = true; stopRecognition(); setItemState("missed"); }
    }, 10000);
  }, [advanceItem, stopRecognition]);

  const playAndListen = useCallback(async () => {
    const item = items[currentIdx];
    if (!item) return;
    setItemState("playing");
    await speakText(item.text);
    setItemState("listening");
    startListening(item.text, part);
  }, [currentIdx, items, speakText, startListening, part]);

  useEffect(() => {
    return () => {
      stopRecognition();
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    };
  }, [stopRecognition]);

  const resetStage = useCallback(() => {
    setCurrentIdx(0);
    setPart("A");
    setItemState("idle");
    setTranscript("");
    setPartAResults([]);
    setPartBResults([]);
    setTaskComplete(false);
    setForceComplete(false);
    setStarted(false);
  }, []);

  const item = items[currentIdx];
  const partAMatched = partAResults.filter((r) => r === "matched").length;
  const partBResponded = partBResults.filter((r) => r === "responded").length;
  const totalResponded = partAMatched + partBResponded;
  const meetsCriteria = totalResponded >= MIN_RESPONDED;

  const overallIdx = part === "A" ? currentIdx : sentences.length + currentIdx;

  return (
    <div className="page">
      <nav className="nav">
        <Link href="/" className="logo">Auti<em>Sense</em></Link>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={toggleTheme} className="btn btn-outline" style={{ minHeight: 40, padding: "8px 14px", fontSize: "0.88rem" }}>
            {theme === "light" ? "🌙" : "☀️"}
          </button>
          <span style={{ fontSize: "0.88rem", color: "var(--text-muted)", fontWeight: 600 }}>
            Step {STEP_IDX + 1} of 12
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

      <main className="main">
        <div className="fade fade-1" style={{ textAlign: "center", marginBottom: 28 }}>
          <div className="breathe-orb" style={{ margin: "0 auto" }}>
            <div className="breathe-inner">🗣️</div>
          </div>
        </div>

        <div className="chip fade fade-1">Step 9 — Speech & Comprehension</div>
        <h1 className="page-title fade fade-2">
          Listen and say it <em>back!</em>
        </h1>
        <p className="subtitle fade fade-2">
          First some sentences to repeat, then some fun instructions to follow.
          This tests speech production and audio comprehension.
        </p>

        {/* Loading */}
        {isLoading && (
          <div className="card fade fade-3" style={{ padding: "32px 28px", textAlign: "center" }}>
            <div style={{
              width: 32, height: 32, border: "3px solid var(--sage-200)",
              borderTopColor: "var(--sage-500)", borderRadius: "50%",
              animation: "spin 0.8s linear infinite", margin: "0 auto 16px",
            }} />
            <p style={{ color: "var(--text-muted)", fontWeight: 600 }}>Generating content...</p>
          </div>
        )}

        {/* Load error */}
        {loadError && !isLoading && sentences.length === 0 && (
          <div className="card fade fade-3" style={{ padding: "32px 28px", textAlign: "center" }}>
            <p style={{ color: "var(--text-muted)", marginBottom: 16 }}>Failed to load content.</p>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>Retry</button>
          </div>
        )}

        {/* Pre-start */}
        {!isLoading && sentences.length > 0 && !started && (
          <div className="fade fade-3" style={{ textAlign: "center" }}>
            <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: 20 }}>
              Make sure your volume is up! Part A: {sentences.length} sentences to repeat. Part B: {instructions.length} instructions to follow.
            </p>
            <button className="btn btn-primary" onClick={() => { setStarted(true); playAndListen(); }}
              style={{ minHeight: 52, padding: "12px 36px" }}>
              🔊 Start Speech Test
            </button>
          </div>
        )}

        {/* Active test */}
        {started && !taskComplete && item && (
          <div className="card fade fade-3" style={{ padding: "32px 28px", textAlign: "center" }}>
            {/* Part header */}
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "6px 16px", borderRadius: "var(--r-full)",
              background: part === "A" ? "var(--sky-100)" : "var(--sage-50)",
              border: `2px solid ${part === "A" ? "var(--sky-300)" : "var(--sage-300)"}`,
              marginBottom: 16,
            }}>
              <span style={{ fontWeight: 700, fontSize: "0.85rem", color: part === "A" ? "var(--sky-400)" : "var(--sage-600)" }}>
                Part {part}: {part === "A" ? "Repeat the sentence" : "Follow the instruction"}
              </span>
            </div>

            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: 16, fontWeight: 600 }}>
              Item {overallIdx + 1} of {totalItems}
            </p>

            <div style={{ fontSize: "3rem", marginBottom: 12 }}>{item.emoji}</div>

            {itemState === "idle" && (
              <button className="btn btn-primary" onClick={playAndListen} style={{ minHeight: 48, padding: "10px 28px" }}>
                🔊 Play
              </button>
            )}

            {itemState === "playing" && (
              <div>
                <h2 style={{ fontFamily: "'Fredoka',sans-serif", fontWeight: 600, fontSize: "1.3rem", color: "var(--sage-600)", marginBottom: 8, lineHeight: 1.5 }}>
                  &ldquo;{item.text}&rdquo;
                </h2>
                <p style={{ color: "var(--sage-500)", fontWeight: 700, fontSize: "0.9rem" }}>
                  🔊 Playing...
                </p>
              </div>
            )}

            {itemState === "listening" && (
              <div>
                <h2 style={{ fontFamily: "'Fredoka',sans-serif", fontWeight: 600, fontSize: "1.1rem", color: "var(--text-primary)", marginBottom: 12, lineHeight: 1.5 }}>
                  {part === "A" ? `Now say: "${item.text}"` : `Follow: "${item.text}"`}
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
                {transcript && (
                  <p style={{ marginTop: 12, fontSize: "1rem", fontWeight: 600, color: "var(--sage-500)" }}>
                    &ldquo;{transcript}&rdquo;
                  </p>
                )}
              </div>
            )}

            {itemState === "matched" && (
              <p style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--sage-600)" }}>
                ✓ {part === "A" ? "Great match!" : "Nice response!"}
              </p>
            )}

            {itemState === "missed" && (
              <div>
                <p style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 16 }}>
                  {part === "A" ? "No match detected — that's okay!" : "No response detected — that's okay!"}
                </p>
                <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                  <button className="btn btn-primary"
                    style={{ minHeight: 44, padding: "8px 20px", fontSize: "0.9rem" }}
                    onClick={() => { setItemState("idle"); setTranscript(""); }}>
                    Replay & Retry
                  </button>
                  <button className="btn btn-secondary"
                    style={{ minHeight: 44, padding: "8px 20px", fontSize: "0.9rem" }}
                    onClick={() => advanceItem("missed")}>
                    Next →
                  </button>
                </div>
              </div>
            )}

            {/* Progress dots */}
            <div style={{ display: "flex", gap: 5, justifyContent: "center", marginTop: 20, flexWrap: "wrap" }}>
              {sentences.map((_, i) => (
                <div key={`a${i}`} style={{
                  width: 10, height: 10, borderRadius: "50%",
                  background: i < partAResults.length
                    ? (partAResults[i] === "matched" ? "var(--sage-500)" : "var(--peach-300)")
                    : (part === "A" && i === currentIdx) ? "var(--sky-300)" : "var(--bg-elevated)",
                  border: "2px solid var(--border-card)",
                }} />
              ))}
              <div style={{ width: 1, height: 14, background: "var(--border-card)", margin: "0 4px" }} />
              {instructions.map((_, i) => (
                <div key={`b${i}`} style={{
                  width: 10, height: 10, borderRadius: "50%",
                  background: i < partBResults.length
                    ? (partBResults[i] === "responded" ? "var(--sage-500)" : "var(--peach-300)")
                    : (part === "B" && i === currentIdx) ? "var(--sky-300)" : "var(--bg-elevated)",
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
                  Speech test complete!
                </h2>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: 8 }}>
                  Part A: {partAMatched} of {sentences.length} sentences matched.
                </p>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                  Part B: {partBResponded} of {instructions.length} instructions responded.
                </p>
              </div>
            ) : (
              <div className="card fade fade-3" style={{ padding: "32px 28px", textAlign: "center", background: "var(--peach-50)", borderColor: "var(--peach-300)" }}>
                <div style={{ fontSize: "2.5rem", marginBottom: 14 }}>🔄</div>
                <h2 style={{ fontFamily: "'Fredoka',sans-serif", fontWeight: 600, fontSize: "1.3rem", marginBottom: 10 }}>
                  Let's try again!
                </h2>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: 20 }}>
                  Only {totalResponded} of {totalItems} items responded. We need at least {MIN_RESPONDED}.
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
          <Link href="/intake/motor" className="btn btn-outline" style={{ minWidth: 100 }}>
            ← Back
          </Link>
          <button className="btn btn-primary btn-full"
            disabled={!taskComplete || (!meetsCriteria && !forceComplete)}
            onClick={async () => {
              const sid = getCurrentSessionId();
              if (sid) {
                await addBiomarker(sid, "audio_assessment", {
                  gazeScore: 0.5,
                  motorScore: 0.5,
                  vocalizationScore: totalItems > 0 ? Math.min(1, totalResponded / totalItems) : 0.5,
                }).catch(() => {});
              }
              router.push("/intake/video-capture");
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
