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
const STEP_IDX = 6;
const MAX_TURNS = 8;
const LISTEN_TIMEOUT_MS = 10_000;

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ConversationMessage {
  role: "assistant" | "user";
  content: string;
}

interface TurnMetadata {
  turnType: string;
  expectsResponse: boolean;
  responseRelevance: number;
  shouldEnd: boolean;
  domain: string;
}

interface TurnBiomarker {
  turnNumber: number;
  domain: string;
  responseLatencyMs: number | null;
  didRespond: boolean;
  responseRelevance: number;
}

type Phase =
  | "pre_start"
  | "loading"
  | "speaking"
  | "listening"
  | "processing"
  | "complete"
  | "error";

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function PreparationPage() {
  const router = useRouter();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [phase, setPhase] = useState<Phase>("pre_start");
  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([]);
  const [turnData, setTurnData] = useState<TurnBiomarker[]>([]);
  const [currentAgentText, setCurrentAgentText] = useState("");
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [turnNumber, setTurnNumber] = useState(0);
  const [childName, setChildName] = useState("friend");
  const [ageMonths, setAgeMonths] = useState(36);
  const [error, setError] = useState<string | null>(null);
  const [hasSpeechApi, setHasSpeechApi] = useState(true);

  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef(false);
  const ttsEndTimeRef = useRef<number>(0);

  // Load theme
  useEffect(() => {
    const saved = document.documentElement.getAttribute("data-theme") as "light" | "dark" | null;
    if (saved) setTheme(saved);
  }, []);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
  };

  // Load session data on mount
  useEffect(() => {
    const sid = getCurrentSessionId();
    if (sid) {
      getSession(sid).then((session) => {
        if (session) {
          setChildName(session.childName || "friend");
          setAgeMonths(session.ageMonths || 36);
        }
      });
    }
    // Check for Web Speech API support
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) setHasSpeechApi(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current = true;
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch { /* ignore */ }
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  /* ---------------------------------------------------------------- */
  /*  TTS — Polly with browser fallback                                */
  /* ---------------------------------------------------------------- */

  const speakWithPolly = useCallback(async (text: string): Promise<void> => {
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voiceId: "Joanna" }),
      });
      if (!res.ok) throw new Error("TTS response not ok");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      return new Promise<void>((resolve) => {
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => {
          URL.revokeObjectURL(url);
          audioRef.current = null;
          ttsEndTimeRef.current = Date.now();
          resolve();
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          audioRef.current = null;
          ttsEndTimeRef.current = Date.now();
          resolve();
        };
        audio.play().catch(() => {
          URL.revokeObjectURL(url);
          ttsEndTimeRef.current = Date.now();
          resolve();
        });
      });
    } catch {
      // Fallback to browser SpeechSynthesis
      return new Promise<void>((resolve) => {
        if (!("speechSynthesis" in window)) {
          ttsEndTimeRef.current = Date.now();
          resolve();
          return;
        }
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.85;
        utterance.pitch = 1.1;
        utterance.onend = () => { ttsEndTimeRef.current = Date.now(); resolve(); };
        utterance.onerror = () => { ttsEndTimeRef.current = Date.now(); resolve(); };
        window.speechSynthesis.speak(utterance);
      });
    }
  }, []);

  /* ---------------------------------------------------------------- */
  /*  STT — Web Speech API                                             */
  /* ---------------------------------------------------------------- */

  const listenForResponse = useCallback((): Promise<{ transcript: string; latencyMs: number | null }> => {
    return new Promise((resolve) => {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        resolve({ transcript: "", latencyMs: null });
        return;
      }

      const startTime = Date.now();
      let firstSpeechTime: number | null = null;
      let finalTranscript = "";
      let resolved = false;

      const done = () => {
        if (resolved) return;
        resolved = true;
        try { recognition.stop(); } catch { /* ignore */ }
        recognitionRef.current = null;
        clearTimeout(timer);
        resolve({
          transcript: finalTranscript,
          latencyMs: firstSpeechTime ? firstSpeechTime - startTime : null,
        });
      };

      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      recognitionRef.current = recognition;

      const timer = setTimeout(done, LISTEN_TIMEOUT_MS);

      recognition.onresult = (event: any) => {
        if (!firstSpeechTime) firstSpeechTime = Date.now();
        finalTranscript = Array.from(event.results)
          .map((r: any) => r[0].transcript)
          .join("");
        setCurrentTranscript(finalTranscript);
        if (event.results[0]?.isFinal) done();
      };

      recognition.onerror = () => done();
      recognition.onend = () => done();

      recognition.start();
    });
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Conversation API call                                            */
  /* ---------------------------------------------------------------- */

  const fetchNextTurn = useCallback(async (
    history: ConversationMessage[],
    turn: number,
  ): Promise<{ text: string; metadata: TurnMetadata; fallback: boolean }> => {
    try {
      const res = await fetch("/api/chat/conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history,
          childName,
          ageMonths,
          turnNumber: turn,
        }),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      return await res.json();
    } catch {
      return {
        text: turn === 0
          ? `Hi ${childName}! I'm so happy to talk with you today!`
          : `You're doing great, ${childName}! Thank you for talking with me!`,
        metadata: {
          turnType: turn === 0 ? "greeting" : "farewell",
          expectsResponse: turn === 0,
          responseRelevance: 0.5,
          shouldEnd: turn > 0,
          domain: "general",
        },
        fallback: true,
      };
    }
  }, [childName, ageMonths]);

  /* ---------------------------------------------------------------- */
  /*  Main conversation loop                                           */
  /* ---------------------------------------------------------------- */

  const runConversation = useCallback(async () => {
    abortRef.current = false;
    let history: ConversationMessage[] = [];
    let turns: TurnBiomarker[] = [];
    let turn = 0;

    while (turn < MAX_TURNS && !abortRef.current) {
      // 1. Fetch next agent response
      setPhase("loading");
      const agentResponse = await fetchNextTurn(history, turn);
      if (abortRef.current) break;

      // 2. Show + speak agent text
      setCurrentAgentText(agentResponse.text);
      setCurrentTranscript("");
      setPhase("speaking");

      history = [...history, { role: "assistant", content: agentResponse.text }];
      setConversationHistory([...history]);

      await speakWithPolly(agentResponse.text);
      if (abortRef.current) break;

      // 3. Check if conversation should end
      if (agentResponse.metadata.shouldEnd || !agentResponse.metadata.expectsResponse) {
        turns = [...turns, {
          turnNumber: turn,
          domain: agentResponse.metadata.domain,
          responseLatencyMs: null,
          didRespond: false,
          responseRelevance: agentResponse.metadata.responseRelevance,
        }];
        setTurnData([...turns]);
        break;
      }

      // 4. Listen for child's response
      setPhase("listening");
      let transcript = "";
      let latencyMs: number | null = null;

      if (hasSpeechApi) {
        const result = await listenForResponse();
        if (abortRef.current) break;
        transcript = result.transcript;
        latencyMs = result.latencyMs;
      }

      // 5. Record turn data
      const childMessage = transcript || "[no response]";
      history = [...history, { role: "user", content: childMessage }];
      setConversationHistory([...history]);

      turns = [...turns, {
        turnNumber: turn,
        domain: agentResponse.metadata.domain,
        responseLatencyMs: latencyMs,
        didRespond: transcript.trim().length > 0,
        responseRelevance: agentResponse.metadata.responseRelevance,
      }];
      setTurnData([...turns]);

      setPhase("processing");
      await new Promise((r) => setTimeout(r, 500));

      turn++;
      setTurnNumber(turn);
    }

    if (!abortRef.current) {
      setPhase("complete");
    }
  }, [fetchNextTurn, speakWithPolly, listenForResponse, hasSpeechApi]);

  /* ---------------------------------------------------------------- */
  /*  Manual response buttons (fallback when no speech API)            */
  /* ---------------------------------------------------------------- */

  const handleManualResponse = useCallback((responded: boolean) => {
    setCurrentTranscript(responded ? "(parent confirmed response)" : "[no response]");
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
    }
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Early stop                                                       */
  /* ---------------------------------------------------------------- */

  const stopEarly = useCallback(() => {
    abortRef.current = true;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setPhase("complete");
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Computed metrics                                                 */
  /* ---------------------------------------------------------------- */

  const respondedTurns = turnData.filter((t) => t.didRespond);
  const responseRate = turnData.length > 0 ? respondedTurns.length / turnData.length : 0;
  const avgLatency = respondedTurns.length > 0
    ? Math.round(respondedTurns.reduce((s, t) => s + (t.responseLatencyMs ?? 0), 0) / respondedTurns.length)
    : null;
  const avgRelevance = respondedTurns.length > 0
    ? respondedTurns.reduce((s, t) => s + t.responseRelevance, 0) / respondedTurns.length
    : 0;

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

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
        {/* Pre-start */}
        {phase === "pre_start" && (
          <>
            <div className="fade fade-1" style={{ textAlign: "center", marginBottom: 28 }}>
              <div className="breathe-orb" style={{ margin: "0 auto" }}>
                <div className="breathe-inner">🎙️</div>
              </div>
            </div>

            <div className="chip fade fade-1">Step 7 — Voice Conversation</div>
            <h1 className="page-title fade fade-2">
              Let&apos;s have a <em>chat</em>
            </h1>
            <p className="subtitle fade fade-2">
              Our friendly voice assistant will have a short conversation with your child.
              It will ask simple, fun questions and adapt to their responses.
              <strong> Nothing is recorded or stored — only scores are saved.</strong>
            </p>

            <div className="card fade fade-3" style={{ padding: "20px 24px", marginBottom: 24, background: "var(--sage-50)", borderColor: "var(--sage-300)" }}>
              <p style={{ fontSize: "0.9rem", color: "var(--sage-600)", fontWeight: 600, lineHeight: 1.7 }}>
                🔊 Make sure your device volume is up so your child can hear the voice.
                The conversation will last about 1-2 minutes.
              </p>
            </div>

            {!hasSpeechApi && (
              <div className="card fade fade-3" style={{ padding: "16px 20px", marginBottom: 16, background: "var(--peach-100)", borderColor: "var(--peach-300)" }}>
                <p style={{ fontSize: "0.85rem", color: "var(--peach-300)", fontWeight: 600 }}>
                  Speech recognition is not available in this browser. You can still proceed
                   — you&apos;ll tap buttons to indicate if your child responded.
                </p>
              </div>
            )}

            <div className="fade fade-4" style={{ display: "flex", gap: 12 }}>
              <Link href="/intake/behavioral-observation" className="btn btn-outline" style={{ minWidth: 100 }}>
                ← Back
              </Link>
              <button className="btn btn-primary btn-full" onClick={() => {
                setPhase("loading");
                runConversation().catch((err) => {
                  console.error("[Conversation]", err);
                  setError("Something went wrong. Please try again.");
                  setPhase("error");
                });
              }} style={{ minHeight: 52, padding: "12px 36px" }}>
                🎙️ Start Conversation
              </button>
            </div>
          </>
        )}

        {/* Loading */}
        {phase === "loading" && (
          <div className="fade fade-1" style={{ textAlign: "center" }}>
            <div className="breathe-orb" style={{ margin: "0 auto", marginBottom: 20 }}>
              <div className="breathe-inner">💭</div>
            </div>
            <p style={{ color: "var(--text-muted)", fontWeight: 600, fontSize: "0.9rem" }}>
              Thinking...
            </p>
            <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginTop: 8 }}>
              Turn {turnNumber + 1}
            </p>
          </div>
        )}

        {/* Speaking */}
        {phase === "speaking" && (
          <div className="card fade fade-1" style={{ padding: "32px 28px", textAlign: "center" }}>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: 16, fontWeight: 600 }}>
              Turn {turnNumber + 1}
            </p>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 10,
              padding: "12px 24px", borderRadius: "var(--r-full)",
              background: "var(--sky-100)", border: "2px solid var(--sky-300)",
              marginBottom: 20,
            }}>
              <div style={{
                width: 14, height: 14, borderRadius: "50%",
                background: "var(--sky-400)",
                animation: "breathe-core 1s ease-in-out infinite",
              }} />
              <span style={{ fontWeight: 700, color: "var(--sky-400)", fontSize: "0.9rem" }}>
                Speaking...
              </span>
            </div>

            <p style={{
              fontSize: "1.2rem", fontWeight: 600, lineHeight: 1.6,
              color: "var(--text-primary)", fontFamily: "'Fredoka',sans-serif",
              padding: "0 8px",
            }}>
              &ldquo;{currentAgentText}&rdquo;
            </p>
          </div>
        )}

        {/* Listening */}
        {phase === "listening" && (
          <div className="card fade fade-1" style={{ padding: "32px 28px", textAlign: "center" }}>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: 16, fontWeight: 600 }}>
              Turn {turnNumber + 1} — Your child&apos;s turn
            </p>

            <div style={{ marginBottom: 20 }}>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 10,
                padding: "12px 24px", borderRadius: "var(--r-full)",
                background: "var(--sage-50)", border: "2px solid var(--sage-300)",
              }}>
                <div style={{
                  width: 14, height: 14, borderRadius: "50%",
                  background: "var(--sage-500)",
                  animation: "breathe-core 1.5s ease-in-out infinite",
                }} />
                <span style={{ fontWeight: 700, color: "var(--sage-600)", fontSize: "0.9rem" }}>
                  Listening...
                </span>
              </div>
            </div>

            <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", marginBottom: 16, fontStyle: "italic" }}>
              &ldquo;{currentAgentText}&rdquo;
            </p>

            {currentTranscript && (
              <p style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--sage-500)", marginBottom: 16 }}>
                &ldquo;{currentTranscript}&rdquo;
              </p>
            )}

            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: 8 }}>
              {!hasSpeechApi && (
                <>
                  <button className="btn btn-primary" style={{ minHeight: 44, padding: "8px 20px", fontSize: "0.85rem" }}
                    onClick={() => handleManualResponse(true)}>
                    ✓ They responded
                  </button>
                  <button className="btn btn-outline" style={{ minHeight: 44, padding: "8px 20px", fontSize: "0.85rem" }}
                    onClick={() => handleManualResponse(false)}>
                    No response
                  </button>
                </>
              )}
              <button className="btn btn-outline" style={{ minHeight: 40, padding: "6px 16px", fontSize: "0.8rem", color: "var(--text-muted)" }}
                onClick={stopEarly}>
                End Early
              </button>
            </div>
          </div>
        )}

        {/* Processing */}
        {phase === "processing" && (
          <div className="fade fade-1" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", marginBottom: 12 }}>✓</div>
            <p style={{ color: "var(--sage-500)", fontWeight: 600, fontSize: "0.9rem" }}>
              Got it!
            </p>
          </div>
        )}

        {/* Error */}
        {phase === "error" && (
          <div className="card fade fade-1" style={{ padding: "32px 28px", textAlign: "center", background: "var(--peach-100)", borderColor: "var(--peach-300)" }}>
            <div style={{ fontSize: "2rem", marginBottom: 12 }}>⚠️</div>
            <p style={{ color: "var(--peach-300)", fontWeight: 600, marginBottom: 20 }}>
              {error || "Something went wrong."}
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button className="btn btn-primary" onClick={() => {
                setError(null);
                setPhase("loading");
                setConversationHistory([]);
                setTurnData([]);
                setTurnNumber(0);
                runConversation().catch(() => {
                  setError("Still having trouble. You can skip this step.");
                  setPhase("error");
                });
              }}>
                Try Again
              </button>
              <button className="btn btn-outline" onClick={() => setPhase("complete")}>
                Skip Step
              </button>
            </div>
          </div>
        )}

        {/* Complete */}
        {phase === "complete" && (
          <>
            <div className="card fade fade-3" style={{ padding: "32px 28px", textAlign: "center", background: "var(--sage-50)", borderColor: "var(--sage-300)" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: 14 }}>✅</div>
              <h2 style={{ fontFamily: "'Fredoka',sans-serif", fontWeight: 600, fontSize: "1.3rem", marginBottom: 14 }}>
                Conversation complete!
              </h2>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: 20, lineHeight: 1.7 }}>
                {turnData.length > 0 ? (
                  <>
                    Your child completed {turnData.length} conversation turns.
                    {respondedTurns.length > 0 && (
                      <> They responded to {respondedTurns.length} of {turnData.length} questions.</>
                    )}
                  </>
                ) : (
                  "The conversation ended early. Scores will be adjusted accordingly."
                )}
              </p>

              {turnData.length > 0 && (
                <div style={{ display: "flex", gap: 24, justifyContent: "center", flexWrap: "wrap" }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "1.6rem", fontWeight: 700, fontFamily: "'Fredoka',sans-serif", color: "var(--sage-600)" }}>
                      {Math.round(responseRate * 100)}%
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Response Rate</div>
                  </div>
                  {avgLatency !== null && (
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "1.6rem", fontWeight: 700, fontFamily: "'Fredoka',sans-serif", color: "var(--sky-300)" }}>
                        {avgLatency < 1000 ? `${avgLatency}ms` : `${(avgLatency / 1000).toFixed(1)}s`}
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Avg Response Time</div>
                    </div>
                  )}
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "1.6rem", fontWeight: 700, fontFamily: "'Fredoka',sans-serif", color: "var(--sage-500)" }}>
                      {turnData.length}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Turns</div>
                  </div>
                </div>
              )}
            </div>

            <div className="fade fade-4" style={{ display: "flex", gap: 12, marginTop: 28 }}>
              <Link href="/intake/behavioral-observation" className="btn btn-outline" style={{ minWidth: 100 }}>
                ← Back
              </Link>
              <button className="btn btn-primary btn-full"
                onClick={async () => {
                  const sid = getCurrentSessionId();
                  if (sid && turnData.length > 0) {
                    const motorTurns = turnData.filter((t) => t.domain === "motor");
                    const motorResponded = motorTurns.filter((t) => t.didRespond).length;
                    const motorScore = motorTurns.length > 0 ? motorResponded / motorTurns.length : 0.5;

                    await addBiomarker(sid, "preparation_interactive", {
                      gazeScore: Math.max(0, Math.min(1, avgRelevance)),
                      motorScore: Math.max(0, Math.min(1, motorScore)),
                      vocalizationScore: Math.max(0, Math.min(1, responseRate)),
                      responseLatencyMs: avgLatency,
                    }).catch(() => {});
                  }
                  router.push("/intake/motor");
                }}>
                Continue →
              </button>
            </div>
          </>
        )}

        {/* End early button for active phases */}
        {(phase === "loading" || phase === "speaking" || phase === "processing") && (
          <div style={{ textAlign: "center", marginTop: 24 }}>
            <button className="btn btn-outline" onClick={stopEarly}
              style={{ minHeight: 40, padding: "8px 20px", fontSize: "0.85rem", color: "var(--text-muted)" }}>
              End Conversation Early
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
