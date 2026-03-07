"use client";

import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";
import { useAuthGuard } from "../../hooks/useAuthGuard";
import AnimalAvatar from "../../components/AnimalAvatar";
import { db } from "../../lib/db/schema";
import { speakText } from "../../lib/audio/ttsHelper";
import NavLogo from "../../components/NavLogo";
import UserMenu from "../../components/UserMenu";
import ThemeToggle from "../../components/ThemeToggle";

type Animal = "dog" | "cat" | "rabbit" | "parrot";
type Screen = "select" | "chat" | "end";
interface ChatMsg { role: "user" | "assistant"; content: string }

const fredoka = "'Fredoka',sans-serif";

const ANIMALS: { id: Animal; emoji: string; name: string; personality: string }[] = [
  { id: "dog",    emoji: "\uD83D\uDC36", name: "Buddy the Dog",     personality: "enthusiastic" },
  { id: "cat",    emoji: "\uD83D\uDC31", name: "Whiskers the Cat",  personality: "calm" },
  { id: "rabbit", emoji: "\uD83D\uDC30", name: "Clover the Rabbit", personality: "curious" },
  { id: "parrot", emoji: "\uD83E\uDD9C", name: "Polly the Parrot",  personality: "playful" },
];

const bubbleBase = {
  maxWidth: "80%", padding: "14px 18px", borderRadius: "var(--r-lg)",
  fontSize: "1rem", lineHeight: 1.6, fontWeight: 500 as const, color: "var(--text-primary)",
};
const aiBubble = { ...bubbleBase, background: "var(--sage-100)", border: "2px solid var(--sage-200)", borderBottomLeftRadius: "4px" };
const userBubble = { ...bubbleBase, background: "var(--feature-peach, var(--feature-blue, #e0f0ff))", border: "2px solid var(--border)", borderBottomRightRadius: "4px" };

export default function ChatPage() {
  const { loading: authLoading, isAuthenticated } = useAuthGuard();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [screen, setScreen] = useState<Screen>("select");
  const [animal, setAnimal] = useState<Animal | null>(null);
  const [avatarState, setAvatarState] = useState<"idle" | "talking" | "happy" | "thinking">("idle");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [turnNumber, setTurnNumber] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [fallbackMode, setFallbackMode] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Voice refs — copied from working communication page pattern
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendMessageRef = useRef<(text: string) => Promise<void>>(null!);

  /* ---- theme ---- */
  useEffect(() => {
    const saved = (typeof window !== "undefined" && localStorage.getItem("autisense-theme")) || "light";
    setTheme(saved as "light" | "dark");
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    if (typeof window !== "undefined") localStorage.setItem("autisense-theme", theme);
  }, [theme]);

  /* ---- helpers ---- */
  const childName =
    (typeof window !== "undefined" && localStorage.getItem("autisense-child-name")) || "Friend";
  const ageMonths = parseInt(
    (typeof window !== "undefined" && localStorage.getItem("autisense-child-age-months")) || "60", 10,
  );
  const animalInfo = animal ? ANIMALS.find((a) => a.id === animal)! : null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ---- TTS playback (Polly -> browser fallback) ---- */
  const playTTS = (text: string): Promise<void> => speakText(text);

  /* ---- fetch AI turn ---- */
  const fetchAIResponse = async (history: ChatMsg[], turn: number): Promise<{ text: string; shouldEnd: boolean }> => {
    try {
      const res = await fetch("/api/chat/conversation", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, childName, ageMonths, turnNumber: turn, animalPersonality: animal }),
      });
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      setFallbackMode(!!data.fallback);
      return { text: data.text || "That was fun! Let's talk again soon!", shouldEnd: data.metadata?.shouldEnd === true };
    } catch {
      setFallbackMode(true);
      return { text: "That was fun! Let's talk again soon!", shouldEnd: true };
    }
  };

  /* ---- save to IndexedDB ---- */
  const saveConversation = async (msgs: ChatMsg[]) => {
    try {
      const childId = (typeof window !== "undefined" && localStorage.getItem("autisense-active-child-id")) || "default";
      await db.chatHistory.add({ childId, messages: msgs.map((m) => ({ role: m.role, text: m.content, timestamp: Date.now() })), createdAt: Date.now(), animalAvatar: animal || "dog" });
    } catch { /* IndexedDB save is optional */ }
  };

  /* ---- start conversation ---- */
  const startConversation = async () => {
    setScreen("chat");
    setMessages([]); setTurnNumber(0); setInput("");
    setAvatarState("thinking"); setIsLoading(true);

    const { text, shouldEnd } = await fetchAIResponse([], 0);
    const aiMsg: ChatMsg = { role: "assistant", content: text };
    setMessages([aiMsg]); setTurnNumber(1); setIsLoading(false);
    setAvatarState("talking");
    await playTTS(text);
    if (shouldEnd) { setAvatarState("happy"); endConversation([aiMsg]); return; }
    setAvatarState("idle");
  };

  /* ---- send user message ---- */
  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: ChatMsg = { role: "user", content: text.trim() };
    const updated = [...messages, userMsg];
    setMessages(updated); setInput(""); setIsLoading(true);
    setAvatarState("thinking");

    const nextTurn = turnNumber;
    const { text: aiText, shouldEnd } = await fetchAIResponse(updated, nextTurn);
    const aiMsg: ChatMsg = { role: "assistant", content: aiText };
    const allMsgs = [...updated, aiMsg];
    setMessages(allMsgs); setTurnNumber(nextTurn + 1); setIsLoading(false);
    setAvatarState("talking");
    await playTTS(aiText);
    if (shouldEnd || nextTurn + 1 >= 15) { setAvatarState("happy"); endConversation(allMsgs); return; }
    setAvatarState("idle");
  };

  // Keep ref current so mic closure always has fresh sendMessage
  sendMessageRef.current = sendMessage;

  const endConversation = (msgs: ChatMsg[]) => {
    saveConversation(msgs);
    setTimeout(() => setScreen("end"), 1800);
  };

  /* ---- voice input — exact copy of communication page's working pattern ---- */

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

  // Cleanup on unmount
  useEffect(() => {
    return () => { stopRecognition(); };
  }, [stopRecognition]);

  const startListening = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMicError("Speech recognition is not supported in this browser. Try Chrome.");
      return;
    }

    // Clean up any previous instance first
    stopRecognition();

    const recognition = new SpeechRecognition();
    // continuous:false — one utterance per mic press, no duplicate concatenation,
    // no restart loop, no race conditions with start/stop
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    let settled = false;

    const finish = (text: string) => {
      if (settled) return;
      settled = true;
      stopRecognition();
      setIsListening(false);
      if (text.trim()) {
        sendMessageRef.current(text.trim());
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      if (settled) return;
      // With continuous:false there's only one result set.
      // Use the last result's best transcript.
      const last = event.results[event.results.length - 1];
      const text = last[0].transcript;
      setTranscript(text);

      if (last.isFinal) {
        finish(text);
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (e: any) => {
      if (settled) return;
      if (e.error === "not-allowed" || e.error === "audio-capture") {
        settled = true;
        stopRecognition();
        setIsListening(false);
        setMicError("Microphone access denied. Please allow microphone in browser settings.");
      }
      // "no-speech" — recognition ended without hearing anything, just let onend handle it
    };

    recognition.onend = () => {
      if (settled) return;
      // With continuous:false, onend fires after the utterance.
      // If we got no result at all, just stop listening.
      settled = true;
      recognitionRef.current = null;
      setIsListening(false);
    };

    // Hard timeout: 15 seconds
    timerRef.current = setTimeout(() => {
      if (!settled) {
        settled = true;
        stopRecognition();
        setIsListening(false);
      }
    }, 15000);

    // Start with small delay
    setTimeout(() => {
      if (settled) return;
      try {
        recognition.start();
      } catch {
        settled = true;
        setIsListening(false);
      }
    }, 200);
  }, [stopRecognition]);

  const toggleListening = useCallback(async () => {
    if (isListening) {
      stopRecognition();
      setIsListening(false);
      setTranscript("");
      return;
    }

    // Check mic support
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setMicError("Speech recognition is not supported in this browser. Try Chrome.");
      return;
    }

    // Check mic permission via Permissions API (no getUserMedia race condition)
    try {
      if (navigator.permissions) {
        const status = await navigator.permissions.query({ name: "microphone" as PermissionName });
        if (status.state === "denied") {
          setMicError("Microphone access denied. Please allow microphone in browser settings.");
          return;
        }
      }
    } catch { /* ignore — let SpeechRecognition handle it */ }

    setMicError(null);
    setTranscript("");
    setIsListening(true);
    startListening();
  }, [isListening, stopRecognition, startListening]);

  /* ---- auth guard ---- */
  if (authLoading || !isAuthenticated) {
    return (
      <div className="page" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <p style={{ color: "var(--text-secondary)" }}>Loading...</p>
      </div>
    );
  }

  return (
    <div className="page">
      <nav className="nav">
        <NavLogo />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ThemeToggle theme={theme} onToggle={() => setTheme((t) => (t === "light" ? "dark" : "light"))} />
          <Link href="/kid-dashboard" className="btn btn-outline" style={{ minHeight: 36, padding: "6px 12px", fontSize: "0.82rem" }}>
            Home
          </Link>
          <UserMenu />
        </div>
      </nav>

      <div className="main fade fade-1" style={{ maxWidth: 600, padding: "16px 16px 8px", display: "flex", flexDirection: "column", flex: 1 }}>

        {/* ---- AVATAR SELECTION SCREEN ---- */}
        {screen === "select" && (
          <div className="fade fade-2" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "3rem", marginBottom: 12 }}>{"\uD83D\uDC3E"}</div>
            <h1 className="page-title" style={{ fontFamily: fredoka }}>
              Choose Your <em>Friend</em>
            </h1>
            <p className="subtitle" style={{ maxWidth: 380, margin: "0 auto 28px" }}>
              Pick an animal buddy to chat with!
            </p>

            <div style={{
              display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14, marginBottom: 24,
            }}>
              {ANIMALS.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setAnimal(a.id)}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                    padding: "22px 12px", borderRadius: "var(--r-lg)",
                    background: animal === a.id ? "var(--sage-100)" : "var(--card)",
                    border: animal === a.id ? "3px solid var(--sage-400)" : "2px solid var(--border)",
                    cursor: "pointer", transition: "all 200ms var(--ease)",
                    minHeight: 56, fontFamily: "inherit",
                  }}
                >
                  <span style={{ fontSize: "2.2rem" }}>{a.emoji}</span>
                  <span style={{
                    fontFamily: fredoka, fontWeight: 600, fontSize: "0.95rem",
                    color: "var(--text-primary)",
                  }}>
                    {a.name.split(" ")[0]}
                  </span>
                </button>
              ))}
            </div>

            <button
              onClick={startConversation}
              disabled={!animal}
              className="btn btn-primary btn-full"
              style={{
                maxWidth: 340, minHeight: 56, fontSize: "1.1rem", fontFamily: fredoka,
                opacity: animal ? 1 : 0.5, cursor: animal ? "pointer" : "not-allowed",
              }}
            >
              Start Chatting!
            </button>
          </div>
        )}

        {/* ---- CHAT SCREEN ---- */}
        {screen === "chat" && animalInfo && animal && (
          <div className="fade fade-2" style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
            {/* Avatar header */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 8 }}>
              <AnimalAvatar animal={animal} gender="boy" state={avatarState} size={72} />
              <h2 style={{
                fontFamily: fredoka, fontWeight: 600, fontSize: "1rem",
                color: "var(--text-primary)", margin: "6px 0 1px",
              }}>
                {animalInfo.name}
              </h2>
              <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", margin: 0, fontStyle: "italic" }}>
                {animalInfo.personality}
              </p>
              {fallbackMode && (
                <span style={{
                  display: "inline-block", marginTop: 6, padding: "3px 10px",
                  borderRadius: "var(--r-md)", background: "var(--sage-50)",
                  border: "1px solid var(--sage-200)", fontSize: "0.72rem",
                  color: "var(--text-secondary)", fontWeight: 600,
                }}>
                  Offline mode — practice conversations
                </span>
              )}
            </div>

            {/* Messages container */}
            <div style={{
              flex: 1, overflowY: "auto", display: "flex", flexDirection: "column",
              gap: 12, padding: "12px 0", marginBottom: 8, minHeight: 0,
            }}>
              {messages.map((msg, i) => (
                <div key={i} style={{ display: "flex", justifyContent: msg.role === "assistant" ? "flex-start" : "flex-end" }}>
                  <div style={msg.role === "assistant" ? aiBubble : userBubble}>
                    {msg.role === "assistant" && (
                      <span style={{ marginRight: 6 }}>{animalInfo.emoji}</span>
                    )}
                    {msg.content}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div style={{ display: "flex", justifyContent: "flex-start" }}>
                  <div style={{
                    ...aiBubble, background: "var(--sage-50)",
                    color: "var(--text-secondary)", fontSize: "0.95rem",
                  }}>
                    {animalInfo.emoji} Thinking...
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input bar — mic is primary, text is secondary */}
            <div style={{
              display: "flex", gap: 8, alignItems: "center",
              padding: "10px 0 4px", borderTop: "2px solid var(--border)",
              overflow: "hidden",
            }}>
              <button
                onClick={toggleListening}
                disabled={isLoading}
                className={isListening ? "btn btn-outline" : "btn btn-primary"}
                aria-label={isListening ? "Stop listening" : "Speak"}
                title={isListening ? "Stop listening" : "Speak"}
                style={{
                  minWidth: 48, minHeight: 48, padding: 0, fontSize: "1.3rem",
                  borderRadius: "var(--r-lg)", flexShrink: 0,
                  background: isListening ? "#e74c3c" : undefined,
                  borderColor: isListening ? "#e74c3c" : undefined,
                  color: isListening ? "white" : undefined,
                }}
              >
                {isListening ? (
                  <span style={{
                    display: "inline-block", width: 14, height: 14,
                    borderRadius: "var(--r-full)", background: "white",
                    animation: "pulse 1s ease-in-out infinite",
                  }} />
                ) : "\uD83C\uDFA4"}
              </button>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
                }}
                placeholder="Type a message..."
                disabled={isLoading}
                aria-label="Type your message"
                style={{
                  flex: 1, minWidth: 0, minHeight: 48, padding: "10px 14px", fontSize: "1rem",
                  borderRadius: "var(--r-lg)", border: "2px solid var(--border)",
                  background: "var(--card)", color: "var(--text-primary)",
                  outline: "none", fontFamily: "inherit",
                  transition: "border-color 200ms var(--ease)",
                }}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={isLoading || !input.trim()}
                className="btn btn-outline"
                aria-label="Send message"
                style={{
                  minWidth: 44, minHeight: 48, padding: "0 10px", fontSize: "0.95rem",
                  borderRadius: "var(--r-lg)", fontFamily: fredoka, fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                Send
              </button>
            </div>

            {/* Live listening indicator + transcript (copied from communication page) */}
            {isListening && (
              <div style={{ textAlign: "center", marginTop: 8 }}>
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "8px 20px", borderRadius: "var(--r-full)",
                  background: "var(--sage-50)", border: "2px solid var(--sage-300)",
                  marginBottom: 8,
                }}>
                  <div style={{
                    width: 10, height: 10, borderRadius: "50%", background: "#e53e3e",
                    animation: "pulse-dot 1s ease-in-out infinite",
                  }} />
                  <span style={{ fontWeight: 700, color: "var(--sage-600)", fontSize: "0.85rem" }}>
                    Listening... speak now!
                  </span>
                </div>

                {/* Show live transcript */}
                {transcript && (
                  <div style={{
                    padding: "10px 16px", borderRadius: 12,
                    background: "var(--sage-50)", border: "2px solid var(--sage-300)",
                  }}>
                    <div style={{
                      fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 700,
                      marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em",
                    }}>
                      Heard:
                    </div>
                    <p style={{
                      fontSize: "1.2rem", fontWeight: 700,
                      color: "var(--sage-600)",
                      fontFamily: fredoka, margin: 0,
                    }}>
                      {"\u201C"}{transcript}{"\u201D"}
                    </p>
                  </div>
                )}
              </div>
            )}

            {micError && (
              <div style={{
                padding: "10px 16px", borderRadius: "var(--r-md)", marginTop: 8,
                background: "var(--peach-100, #fff3e0)", border: "1px solid var(--peach-200, #ffe0b2)",
                fontSize: "0.85rem", color: "var(--text-primary)",
              }}>
                {micError}
              </div>
            )}
          </div>
        )}

        {/* ---- END SCREEN ---- */}
        {screen === "end" && animal && animalInfo && (
          <div className="fade fade-2" style={{ textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
              <AnimalAvatar animal={animal} gender="boy" state="happy" size={100} />
            </div>
            <h1 className="page-title" style={{ fontFamily: fredoka }}>
              That was <em>fun!</em>
            </h1>
            <p className="subtitle" style={{ maxWidth: 380, margin: "0 auto 28px" }}>
              You and {animalInfo.name} had a great conversation!
            </p>
            <div className="card" style={{ padding: "24px 32px", textAlign: "center", marginBottom: 32, display: "inline-block" }}>
              <div style={{ fontSize: "2rem", fontFamily: fredoka, fontWeight: 700, color: "var(--sage-500)" }}>
                {turnNumber}
              </div>
              <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 600 }}>
                Conversation Turns
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <button
                onClick={() => { setScreen("select"); setAnimal(null); setMessages([]); setTurnNumber(0); setAvatarState("idle"); }}
                className="btn btn-primary"
                style={{ minWidth: 160, minHeight: 56, fontFamily: fredoka }}
              >
                Chat Again
              </button>
              <Link
                href="/kid-dashboard"
                className="btn btn-outline"
                style={{ minWidth: 160, minHeight: 56, fontFamily: fredoka }}
              >
                Home
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* animations */}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.3); }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.8); }
        }
      `}</style>
    </div>
  );
}
