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
const MIN_MATCHED = 2;

interface WordItem { text: string; emoji: string }

type WordState = "idle" | "playing" | "listening" | "matched" | "missed";

/* ── Mic Visualizer — receives an existing stream, no getUserMedia call ── */
function MicVisualizer({ stream }: { stream: MediaStream | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<{ audioCtx: AudioContext; analyser: AnalyserNode; raf: number } | null>(null);

  useEffect(() => {
    if (!stream) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;

    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.6;
    source.connect(analyser);

    const bufLen = analyser.frequencyBinCount;
    const data = new Uint8Array(bufLen);

    const BAR_COUNT = 5;
    const BAR_WIDTH = 8;
    const GAP = 6;
    const W = BAR_COUNT * BAR_WIDTH + (BAR_COUNT - 1) * GAP;
    const H = 48;
    canvas.width = W * 2; // 2x for retina
    canvas.height = H * 2;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx2d.scale(2, 2);

    const color = getComputedStyle(document.documentElement).getPropertyValue("--sage-500").trim() || "#4d8058";

    const draw = () => {
      analyser.getByteFrequencyData(data);
      ctx2d.clearRect(0, 0, W, H);

      for (let i = 0; i < BAR_COUNT; i++) {
        // Sample spread across low-mid frequencies where voice lives
        const bin = Math.min(Math.floor(((i + 1) / (BAR_COUNT + 1)) * bufLen * 0.5), bufLen - 1);
        const val = data[bin] / 255;
        const minH = 6;
        const barH = minH + val * (H - minH - 4);
        const x = i * (BAR_WIDTH + GAP);
        const y = (H - barH) / 2;

        ctx2d.fillStyle = color;
        ctx2d.beginPath();
        // roundRect fallback for older browsers
        const r = 3;
        ctx2d.moveTo(x + r, y);
        ctx2d.lineTo(x + BAR_WIDTH - r, y);
        ctx2d.quadraticCurveTo(x + BAR_WIDTH, y, x + BAR_WIDTH, y + r);
        ctx2d.lineTo(x + BAR_WIDTH, y + barH - r);
        ctx2d.quadraticCurveTo(x + BAR_WIDTH, y + barH, x + BAR_WIDTH - r, y + barH);
        ctx2d.lineTo(x + r, y + barH);
        ctx2d.quadraticCurveTo(x, y + barH, x, y + barH - r);
        ctx2d.lineTo(x, y + r);
        ctx2d.quadraticCurveTo(x, y, x + r, y);
        ctx2d.fill();
      }

      const raf = requestAnimationFrame(draw);
      if (ctxRef.current) ctxRef.current.raf = raf;
    };

    const raf = requestAnimationFrame(draw);
    ctxRef.current = { audioCtx, analyser, raf };

    return () => {
      if (ctxRef.current) {
        cancelAnimationFrame(ctxRef.current.raf);
        ctxRef.current.audioCtx.close().catch(() => {});
        ctxRef.current = null;
      }
    };
  }, [stream]);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
      <canvas ref={canvasRef} />
    </div>
  );
}

export default function CommunicationPage() {
  const router = useRouter();
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const [words, setWords] = useState<WordItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [started, setStarted] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [wordState, setWordState] = useState<WordState>("idle");
  const [transcript, setTranscript] = useState("");
  const [results, setResults] = useState<("matched" | "missed")[]>([]);
  const [taskComplete, setTaskComplete] = useState(false);
  const [forceComplete, setForceComplete] = useState(false);
  const [micAvailable, setMicAvailable] = useState(true);

  // Shared mic stream — acquired once on start, used by visualizer + kept alive
  const [micStream, setMicStream] = useState<MediaStream | null>(null);

  // Debug log for SpeechRecognition events (temporary diagnostic)
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const addDebug = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setDebugLog((prev) => [`[${ts}] ${msg}`, ...prev].slice(0, 30));
  }, []);

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

  // Load dynamic words
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
          body: JSON.stringify({ ageMonths, count: 4, mode: "words" }),
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

  // Check mic support on mount
  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) setMicAvailable(false);
  }, []);

  // Cleanup mic stream on unmount
  useEffect(() => {
    return () => {
      if (micStream) micStream.getTracks().forEach((t) => t.stop());
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Acquire mic stream for visualizer — SpeechRecognition uses its own internal mic
  const acquireMic = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicStream(stream);
      addDebug("getUserMedia: mic acquired OK");
    } catch (err) {
      addDebug(`getUserMedia FAILED: ${err instanceof Error ? err.message : String(err)}`);
      setMicAvailable(false);
    }
  }, [addDebug]);

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
      // Release mic stream when test is done
      if (micStream) { micStream.getTracks().forEach((t) => t.stop()); setMicStream(null); }
    } else {
      setCurrentIdx((i) => i + 1);
      setWordState("idle");
      setTranscript("");
    }
  }, [currentIdx, words.length, micStream]);

  // TTS: Polly first, browser fallback
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
        audio.onended = () => {
          URL.revokeObjectURL(url);
          audio.src = "";
          audioRef.current = null;
          resolve();
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          audio.src = "";
          audioRef.current = null;
          resolve();
        };
        audio.play().catch(() => {
          URL.revokeObjectURL(url);
          audio.src = "";
          audioRef.current = null;
          resolve();
        });
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
      addDebug("SpeechRecognition API not available");
      setWordState("missed");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 3;
    recognitionRef.current = recognition;

    let settled = false;
    const expected = expectedWord.toLowerCase().trim();
    addDebug(`Recognition created — expecting "${expected}"`);

    // Fuzzy match: check if any word in transcript is close enough
    const isMatch = (text: string): boolean => {
      const t = text.toLowerCase().trim();
      if (!t) return false;
      // Exact substring
      if (t.includes(expected)) return true;
      // Check individual words
      const words = t.split(/\s+/);
      for (const w of words) {
        if (w === expected) return true;
        // Allow off-by-one character (simple edit distance 1)
        if (expected.length > 2 && w.length > 2) {
          if (Math.abs(w.length - expected.length) <= 1) {
            let diff = 0;
            const longer = w.length >= expected.length ? w : expected;
            const shorter = w.length >= expected.length ? expected : w;
            let si = 0;
            for (let li = 0; li < longer.length && si < shorter.length; li++) {
              if (longer[li] !== shorter[si]) { diff++; } else { si++; }
            }
            diff += shorter.length - si;
            if (diff <= 1) return true;
          }
        }
        // Starts-with for short words
        if (expected.length >= 3 && w.startsWith(expected.substring(0, 3))) return true;
      }
      return false;
    };

    recognition.onresult = (event: any) => {
      let full = "";
      for (let i = 0; i < event.results.length; i++) {
        full += event.results[i][0].transcript;
      }
      setTranscript(full);

      const latest = event.results[event.results.length - 1];
      const isFinal = latest?.isFinal;
      addDebug(`onresult: "${full.trim()}" (final=${isFinal})`);

      if (settled) return;

      // Check ALL results, both interim and final, across all alternatives
      for (let i = 0; i < event.results.length; i++) {
        for (let j = 0; j < event.results[i].length; j++) {
          const alt = event.results[i][j].transcript;
          if (isMatch(alt)) {
            addDebug(`MATCH via alt[${i}][${j}]: "${alt}"`);
            settled = true;
            stopRecognition();
            setWordState("matched");
            setTimeout(() => advance("matched"), 1200);
            return;
          }
        }
      }
      // Also check full accumulated transcript
      if (isMatch(full)) {
        addDebug(`MATCH via full transcript: "${full}"`);
        settled = true;
        stopRecognition();
        setWordState("matched");
        setTimeout(() => advance("matched"), 1200);
      }
    };

    recognition.onerror = (e: any) => {
      addDebug(`onerror: ${e.error} (settled=${settled})`);
      if (settled) return;
      if (e.error === "not-allowed") {
        settled = true; stopRecognition(); setWordState("missed");
      }
    };

    recognition.onend = () => {
      addDebug(`onend fired (settled=${settled})`);
      if (settled) return;
      setTimeout(() => {
        if (settled) return;
        try {
          recognition.start();
          addDebug("restarted recognition (same instance)");
        } catch {
          try {
            const Fresh = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (!Fresh) return;
            const fresh = new Fresh();
            fresh.continuous = true;
            fresh.interimResults = true;
            fresh.lang = "en-US";
            fresh.maxAlternatives = 3;
            fresh.onresult = recognition.onresult;
            fresh.onerror = recognition.onerror;
            fresh.onend = recognition.onend;
            recognitionRef.current = fresh;
            fresh.start();
            addDebug("restarted recognition (fresh instance)");
          } catch (err) {
            addDebug(`restart FAILED: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      }, 250);
    };

    recognition.onstart = () => {
      addDebug("onstart: recognition active");
    };

    recognition.onaudiostart = () => {
      addDebug("onaudiostart: mic audio flowing");
    };

    recognition.onsoundstart = () => {
      addDebug("onsoundstart: sound detected");
    };

    recognition.onspeechstart = () => {
      addDebug("onspeechstart: speech detected");
    };

    // Start recognition
    const tryStart = (delay: number, attempt: number) => {
      setTimeout(() => {
        if (settled) return;
        try {
          recognition.start();
          addDebug(`start() OK (attempt ${attempt}, delay ${delay}ms)`);
        } catch (err) {
          addDebug(`start() FAILED attempt ${attempt}: ${err instanceof Error ? err.message : String(err)}`);
          if (attempt < 3) tryStart(delay + 300, attempt + 1);
        }
      }, delay);
    };
    tryStart(300, 0);

    // Hard timeout: ONLY way to mark missed — 10 seconds
    timerRef.current = setTimeout(() => {
      if (!settled) {
        addDebug("HARD TIMEOUT (10s) — marking missed");
        settled = true; stopRecognition(); setWordState("missed");
      }
    }, 10000);
  }, [advance, stopRecognition, addDebug]);

  const playAndListen = useCallback(async () => {
    const word = words[currentIdx];
    if (!word) return;
    setWordState("playing");
    setTranscript("");
    setDebugLog([]);
    addDebug(`Playing word: "${word.text}"`);
    await speakWord(word.text);
    // Acquire mic for visualizer (SpeechRecognition uses its own internal mic)
    if (!micStream) await acquireMic();
    await new Promise((r) => setTimeout(r, 300));
    setWordState("listening");
    startListening(word.text);
  }, [currentIdx, words, speakWord, startListening, micStream, acquireMic, addDebug]);

  // Start the test
  const beginTest = useCallback(async () => {
    setStarted(true);
    playAndListen();
  }, [playAndListen]);

  useEffect(() => {
    return () => {
      stopRecognition();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
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
    if (micStream) { micStream.getTracks().forEach((t) => t.stop()); setMicStream(null); }
    const sid = getCurrentSessionId();
    if (sid) {
      await addBiomarker(sid, "communication_responsiveness", {
        gazeScore: 0.5,
        motorScore: 0.5,
        vocalizationScore: 0.5,
      }).catch(() => {});
    }
    router.push("/intake/behavioral-observation");
  }, [router, stopRecognition, micStream]);

  const word = words[currentIdx];
  const matchedCount = results.filter((r) => r === "matched").length;
  const meetsCriteria = matchedCount >= MIN_MATCHED;

  return (
    <div className="page">
      <nav className="nav">
        <Link href="/" className="logo">Auti<em>Sense</em></Link>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={toggleTheme} className="btn btn-outline" style={{ minHeight: 40, padding: "8px 14px", fontSize: "0.88rem" }}>
            {theme === "light" ? "\u{1F319}" : "\u{2600}\u{FE0F}"}
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
                {i < STEP_IDX ? "\u2713" : i + 1}
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
            <div className="breathe-inner">{"\u{1F50A}"}</div>
          </div>
        </div>

        <div className="chip fade fade-1">Step 4 &mdash; Word Echo</div>
        <h1 className="page-title fade fade-2">
          Word echo <em>challenge</em>
        </h1>
        <p className="subtitle fade fade-2">
          We&apos;ll say a word out loud. Encourage your child to say it back!
          This tests audio processing and speech production.
        </p>

        {/* Loading */}
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
              Make sure your volume is up! We&apos;ll play {words.length} words and listen for echoes.
            </p>
            {!micAvailable && (
              <div style={{
                padding: "12px 20px", borderRadius: 12, background: "var(--peach-100)",
                border: "2px solid var(--peach-300)", marginBottom: 16,
                fontSize: "0.85rem", color: "var(--text-secondary)",
              }}>
                Speech recognition is not available in this browser. Try Chrome on desktop.
              </div>
            )}
            <button className="btn btn-primary" onClick={beginTest}
              style={{ minHeight: 52, padding: "12px 36px" }}>
              {"\u{1F50A}"} Start Word Echo
            </button>
          </div>
        )}

        {/* Active test */}
        {started && !taskComplete && word && (
          <div className="card fade fade-3" style={{ padding: "32px 28px", textAlign: "center" }}>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: 16, fontWeight: 600 }}>
              Word {currentIdx + 1} of {words.length}
            </p>

            {/* Always show the word prominently */}
            <div style={{ fontSize: "3.5rem", marginBottom: 8 }}>{word.emoji}</div>
            <h2 style={{
              fontFamily: "'Fredoka',sans-serif", fontWeight: 700,
              fontSize: "2.2rem", color: "var(--sage-600)", marginBottom: 16,
              letterSpacing: "0.5px",
            }}>
              {"\u201C"}{word.text}{"\u201D"}
            </h2>

            {wordState === "idle" && (
              <button className="btn btn-primary" onClick={playAndListen} style={{ minHeight: 48, padding: "10px 28px" }}>
                {"\u{1F50A}"} Play Word
              </button>
            )}

            {wordState === "playing" && (
              <div>
                {/* Speaker wave animation */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, height: 48, marginBottom: 12 }}>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      style={{
                        width: 8,
                        borderRadius: 4,
                        background: "var(--sage-400)",
                        animation: `vizBar 0.6s ease-in-out ${i * 0.1}s infinite alternate`,
                      }}
                    />
                  ))}
                </div>
                <p style={{ color: "var(--sage-500)", fontWeight: 700, fontSize: "0.95rem" }}>
                  {"\u{1F50A}"} Speaking...
                </p>
              </div>
            )}

            {wordState === "listening" && (
              <div>
                <p style={{
                  fontWeight: 600, fontSize: "1rem", color: "var(--text-secondary)", marginBottom: 12,
                }}>
                  Your turn! Say &ldquo;{word.text}&rdquo;
                </p>

                {/* Real mic visualizer using getUserMedia + AnalyserNode */}
                <MicVisualizer stream={micStream} />

                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "8px 20px", borderRadius: "var(--r-full)",
                  background: "var(--sage-50)", border: "2px solid var(--sage-300)",
                }}>
                  <div style={{
                    width: 10, height: 10, borderRadius: "50%", background: "#e53e3e",
                    animation: "pulse-dot 1s ease-in-out infinite",
                  }} />
                  <span style={{ fontWeight: 700, color: "var(--sage-600)", fontSize: "0.85rem" }}>
                    Listening...
                  </span>
                </div>
              </div>
            )}

            {wordState === "matched" && (
              <div>
                <div style={{
                  width: 48, height: 48, borderRadius: "50%", background: "var(--sage-500)",
                  color: "white", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "1.4rem", fontWeight: 700, margin: "0 auto 12px",
                }}>
                  {"\u2713"}
                </div>
                <p style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--sage-600)" }}>
                  Great match!
                </p>
              </div>
            )}

            {wordState === "missed" && (
              <div>
                <p style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 16 }}>
                  No match detected &mdash; that&apos;s okay!
                </p>
                <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                  <button className="btn btn-primary"
                    style={{ minHeight: 44, padding: "8px 20px", fontSize: "0.9rem" }}
                    onClick={() => { setWordState("idle"); setTranscript(""); playAndListen(); }}>
                    Replay &amp; Retry
                  </button>
                  <button className="btn btn-secondary"
                    style={{ minHeight: 44, padding: "8px 20px", fontSize: "0.9rem" }}
                    onClick={() => advance("missed")}>
                    Next Word {"\u2192"}
                  </button>
                </div>
              </div>
            )}

            {/* Live transcript */}
            {(wordState === "listening" || wordState === "matched" || wordState === "missed") && transcript && (
              <div style={{
                marginTop: 16, padding: "12px 20px", borderRadius: 12,
                background: "var(--sage-50)", border: "2px solid var(--sage-300)",
              }}>
                <div style={{
                  fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 700,
                  marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em",
                }}>
                  Heard:
                </div>
                <p style={{
                  fontSize: "1.4rem", fontWeight: 700,
                  color: wordState === "matched" ? "var(--sage-600)" : "var(--text-primary)",
                  fontFamily: "'Fredoka',sans-serif", margin: 0,
                }}>
                  {"\u201C"}{transcript}{"\u201D"}
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
                    : i === currentIdx ? "var(--sky-300)" : "var(--sage-100)",
                  transition: "background 300ms ease",
                }} />
              ))}
            </div>

            {/* DEBUG PANEL — temporary diagnostic */}
            {debugLog.length > 0 && (
              <div style={{
                marginTop: 16, padding: "10px 14px", borderRadius: 10,
                background: "#1a1a2e", color: "#00ff88", fontSize: "0.7rem",
                fontFamily: "monospace", maxHeight: 200, overflowY: "auto",
                textAlign: "left", border: "2px solid #333",
              }}>
                <div style={{ fontWeight: 700, color: "#ffaa00", marginBottom: 6, fontSize: "0.75rem" }}>
                  DEBUG — SpeechRecognition Events
                </div>
                {debugLog.map((line, i) => (
                  <div key={i} style={{ padding: "1px 0", opacity: i === 0 ? 1 : 0.7 }}>{line}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Completion */}
        {taskComplete && (
          <>
            {meetsCriteria || forceComplete ? (
              <div className="card fade fade-3" style={{ padding: "32px 28px", textAlign: "center", background: "var(--sage-50)", borderColor: "var(--sage-300)" }}>
                <div style={{ fontSize: "2.5rem", marginBottom: 14 }}>{"\u{1F3B5}"}</div>
                <h2 style={{ fontFamily: "'Fredoka',sans-serif", fontWeight: 600, fontSize: "1.3rem", marginBottom: 14 }}>
                  Word echo complete!
                </h2>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                  {matchedCount} of {words.length} words echoed successfully.
                </p>
              </div>
            ) : (
              <div className="card fade fade-3" style={{ padding: "32px 28px", textAlign: "center" }}>
                <div style={{ fontSize: "2.5rem", marginBottom: 14 }}>{"\u{1F504}"}</div>
                <h2 style={{ fontFamily: "'Fredoka',sans-serif", fontWeight: 600, fontSize: "1.3rem", marginBottom: 10 }}>
                  Let&apos;s try again!
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
            {"\u2190"} Back
          </Link>
          <button className="btn btn-primary btn-full"
            disabled={!taskComplete || (!meetsCriteria && !forceComplete)}
            onClick={async () => {
              if (micStream) { micStream.getTracks().forEach((t) => t.stop()); setMicStream(null); }
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
            Continue {"\u2192"}
          </button>
        </div>
      </main>

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes vizBar {
          0% { height: 6px; }
          100% { height: 40px; }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.8); }
        }
      `}</style>
    </div>
  );
}
