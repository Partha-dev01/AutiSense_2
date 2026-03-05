"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useAuthGuard } from "../../hooks/useAuthGuard";

interface ChatMessage { role: "user" | "assistant"; content: string }
type Screen = "start" | "chat" | "result";

const fredoka = "'Fredoka',sans-serif";
const bubbleBase = {
  maxWidth: "80%", padding: "14px 18px", borderRadius: "var(--r-lg)",
  fontSize: "1rem", lineHeight: 1.6, fontWeight: 500 as const, color: "var(--text-primary)",
};
const aiBubble = { ...bubbleBase, background: "var(--sage-100)", border: "2px solid var(--sage-200)", borderBottomLeftRadius: "4px" };
const userBubble = { ...bubbleBase, background: "var(--feature-peach, var(--feature-blue, #e0f0ff))", border: "2px solid var(--border)", borderBottomRightRadius: "4px" };

export default function TalkingPage() {
  const { loading: authLoading, isAuthenticated } = useAuthGuard();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [screen, setScreen] = useState<Screen>("start");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [turnNumber, setTurnNumber] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [totalTurns, setTotalTurns] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ---- TTS playback ---- */
  const playTTS = async (text: string) => {
    try {
      const res = await fetch("/api/tts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (audioRef.current) { audioRef.current.pause(); URL.revokeObjectURL(audioRef.current.src); }
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.play().catch(() => {});
    } catch { /* TTS is optional */ }
  };

  /* ---- fetch AI turn ---- */
  const fetchAIResponse = async (
    history: ChatMessage[], turn: number,
  ): Promise<{ text: string; shouldEnd: boolean }> => {
    try {
      const res = await fetch("/api/chat/conversation", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, childName, ageMonths, turnNumber: turn }),
      });
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      return {
        text: data.text || "I had fun talking! Let's play again sometime!",
        shouldEnd: data.metadata?.shouldEnd === true,
      };
    } catch {
      return { text: "I had fun talking! Let's play again sometime!", shouldEnd: true };
    }
  };

  /* ---- start conversation ---- */
  const startConversation = async () => {
    setScreen("chat");
    setMessages([]); setTurnNumber(0); setTotalTurns(0); setInput("");
    setIsLoading(true);

    const { text, shouldEnd } = await fetchAIResponse([], 0);
    const aiMsg: ChatMessage = { role: "assistant", content: text };
    setMessages([aiMsg]);
    setTurnNumber(1); setTotalTurns(1); setIsLoading(false);
    playTTS(text);
    if (shouldEnd) setTimeout(() => setScreen("result"), 2500);
  };

  /* ---- send user message ---- */
  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: ChatMessage = { role: "user", content: text.trim() };
    const updated = [...messages, userMsg];
    setMessages(updated); setInput(""); setIsLoading(true);

    const nextTurn = turnNumber;
    const { text: aiText, shouldEnd } = await fetchAIResponse(updated, nextTurn);
    const aiMsg: ChatMessage = { role: "assistant", content: aiText };
    setMessages([...updated, aiMsg]);
    setTurnNumber(nextTurn + 1); setTotalTurns((t) => t + 1); setIsLoading(false);
    playTTS(aiText);
    if (shouldEnd || nextTurn + 1 >= 7) setTimeout(() => setScreen("result"), 2500);
  };

  /* ---- voice input ---- */
  const toggleListening = () => {
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }

    const SR =
      (window as unknown as Record<string, unknown>).SpeechRecognition ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
    if (!SR) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition = new (SR as any)();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) sendMessage(transcript);
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

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
        <Link href="/" className="logo">Auti<em>Sense</em></Link>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
            className="btn btn-outline"
            style={{ minHeight: 40, padding: "8px 14px", fontSize: "0.85rem" }}
          >
            {theme === "light" ? "Dark" : "Light"}
          </button>
          <Link href="/kid-dashboard" className="btn btn-outline" style={{ minHeight: 40, padding: "8px 14px", fontSize: "0.85rem" }}>
            Home
          </Link>
        </div>
      </nav>

      <div className="main fade fade-1" style={{ maxWidth: 600, padding: "32px 24px 80px" }}>

        {/* ---- START SCREEN ---- */}
        {screen === "start" && (
          <div className="fade fade-2" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "3.5rem", marginBottom: 20 }}>{"💬"}</div>
            <h1 className="page-title">Let&apos;s <em>Talk!</em></h1>
            <p className="subtitle" style={{ maxWidth: 380, margin: "0 auto 32px" }}>
              Have a fun, friendly conversation with your AI buddy. You can type or use your voice!
            </p>
            <button
              onClick={startConversation}
              className="btn btn-primary btn-full"
              style={{ maxWidth: 340, minHeight: 56, fontSize: "1.1rem", fontFamily: fredoka }}
            >
              Let&apos;s Talk!
            </button>
          </div>
        )}

        {/* ---- CHAT SCREEN ---- */}
        {screen === "chat" && (
          <div className="fade fade-2" style={{ display: "flex", flexDirection: "column", minHeight: "60vh" }}>
            <h2 style={{
              fontFamily: fredoka, fontWeight: 600, fontSize: "1.1rem",
              color: "var(--text-primary)", textAlign: "center", marginBottom: 16,
            }}>
              Talking with {childName}
            </h2>

            {/* messages container */}
            <div style={{
              flex: 1, overflowY: "auto", display: "flex", flexDirection: "column",
              gap: 12, padding: "12px 0", marginBottom: 16, maxHeight: "50vh",
            }}>
              {messages.map((msg, i) => (
                <div key={i} style={{ display: "flex", justifyContent: msg.role === "assistant" ? "flex-start" : "flex-end" }}>
                  <div style={msg.role === "assistant" ? aiBubble : userBubble}>
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
                    Thinking...
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* input bar */}
            <div style={{
              display: "flex", gap: 10, alignItems: "center",
              padding: "12px 0 0", borderTop: "2px solid var(--border)",
            }}>
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
                  flex: 1, minHeight: 56, padding: "12px 18px", fontSize: "1rem",
                  borderRadius: "var(--r-lg)", border: "2px solid var(--border)",
                  background: "var(--card)", color: "var(--text-primary)",
                  outline: "none", fontFamily: "inherit",
                  transition: "border-color 200ms var(--ease)",
                }}
              />
              <button
                onClick={toggleListening}
                disabled={isLoading}
                className="btn btn-outline"
                aria-label={isListening ? "Stop listening" : "Speak"}
                title={isListening ? "Stop listening" : "Speak"}
                style={{
                  minWidth: 56, minHeight: 56, padding: 0, fontSize: "1.3rem",
                  borderRadius: "var(--r-lg)",
                  background: isListening ? "var(--sage-100)" : "var(--card)",
                  border: isListening ? "2px solid var(--sage-400)" : "2px solid var(--border)",
                }}
              >
                {isListening ? (
                  <span style={{
                    display: "inline-block", width: 14, height: 14,
                    borderRadius: "var(--r-full)", background: "var(--sage-500)",
                    animation: "pulse 1s ease-in-out infinite",
                  }} />
                ) : "🎤"}
              </button>
              <button
                onClick={() => sendMessage(input)}
                disabled={isLoading || !input.trim()}
                className="btn btn-primary"
                aria-label="Send message"
                style={{
                  minWidth: 56, minHeight: 56, padding: 0, fontSize: "1.1rem",
                  borderRadius: "var(--r-lg)", fontFamily: fredoka, fontWeight: 600,
                }}
              >
                Send
              </button>
            </div>

            {isListening && (
              <p style={{
                textAlign: "center", fontSize: "0.85rem", color: "var(--sage-500)",
                fontWeight: 600, marginTop: 8, fontFamily: fredoka,
              }}>
                Listening... speak now!
              </p>
            )}
          </div>
        )}

        {/* ---- RESULT SCREEN ---- */}
        {screen === "result" && (
          <div className="fade fade-2" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "3.5rem", marginBottom: 20 }}>{"🌟"}</div>
            <h1 className="page-title">Great <em>Conversation!</em></h1>
            <p className="subtitle" style={{ maxWidth: 380, margin: "0 auto 28px" }}>
              You did an awesome job talking today, {childName}!
            </p>
            <div className="card" style={{ padding: "24px 32px", textAlign: "center", marginBottom: 32, display: "inline-block" }}>
              <div style={{ fontSize: "2rem", fontFamily: fredoka, fontWeight: 700, color: "var(--sage-500)" }}>
                {totalTurns}
              </div>
              <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 600 }}>
                Conversation Turns
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <button
                onClick={startConversation}
                className="btn btn-primary"
                style={{ minWidth: 160, minHeight: 56, fontFamily: fredoka }}
              >
                Talk Again
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

      {/* pulse animation for mic indicator */}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
}
