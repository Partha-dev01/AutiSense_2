"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useAuthGuard } from "../../hooks/useAuthGuard";
import AnimalAvatar from "../../components/AnimalAvatar";
import { db } from "../../lib/db/schema";
import NavLogo from "../../components/NavLogo";

type Animal = "dog" | "cat" | "rabbit" | "parrot";
type Gender = "boy" | "girl";
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
  const [gender, setGender] = useState<Gender>("boy");
  const [avatarState, setAvatarState] = useState<"idle" | "talking" | "happy" | "thinking">("idle");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [turnNumber, setTurnNumber] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
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
  const animalInfo = animal ? ANIMALS.find((a) => a.id === animal)! : null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ---- TTS playback ---- */
  const playTTS = (text: string): Promise<void> => new Promise((resolve) => {
    fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) })
      .then((res) => (res.ok ? res.blob() : Promise.reject()))
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        if (audioRef.current) { audioRef.current.pause(); URL.revokeObjectURL(audioRef.current.src); }
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => resolve(); audio.onerror = () => resolve();
        audio.play().catch(() => resolve());
      })
      .catch(() => resolve());
  });

  /* ---- fetch AI turn ---- */
  const fetchAIResponse = async (history: ChatMsg[], turn: number): Promise<{ text: string; shouldEnd: boolean }> => {
    try {
      const res = await fetch("/api/chat/conversation", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, childName, ageMonths, turnNumber: turn, animalPersonality: animal }),
      });
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      return { text: data.text || "That was fun! Let's talk again soon!", shouldEnd: data.metadata?.shouldEnd === true };
    } catch {
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
    if (shouldEnd || nextTurn + 1 >= 7) { setAvatarState("happy"); endConversation(allMsgs); return; }
    setAvatarState("idle");
  };

  const endConversation = (msgs: ChatMsg[]) => {
    saveConversation(msgs);
    setTimeout(() => setScreen("end"), 1800);
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
        <NavLogo />
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

            {/* Gender toggle */}
            <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 28 }}>
              {(["boy", "girl"] as Gender[]).map((g) => (
                <button
                  key={g}
                  onClick={() => setGender(g)}
                  className="btn"
                  style={{
                    minWidth: 100, minHeight: 56, padding: "10px 24px",
                    fontFamily: fredoka, fontWeight: 600, fontSize: "1rem",
                    borderRadius: "var(--r-lg)",
                    background: gender === g ? "var(--sage-100)" : "var(--card)",
                    border: gender === g ? "3px solid var(--sage-400)" : "2px solid var(--border)",
                    color: "var(--text-primary)", cursor: "pointer",
                    transition: "all 200ms var(--ease)",
                  }}
                >
                  {g === "boy" ? "Boy" : "Girl"}
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
          <div className="fade fade-2" style={{ display: "flex", flexDirection: "column", minHeight: "60vh" }}>
            {/* Avatar header */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 16 }}>
              <AnimalAvatar animal={animal} gender={gender} state={avatarState} size={120} />
              <h2 style={{
                fontFamily: fredoka, fontWeight: 600, fontSize: "1.1rem",
                color: "var(--text-primary)", margin: "12px 0 2px",
              }}>
                {animalInfo.name}
              </h2>
              <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", margin: 0, fontStyle: "italic" }}>
                {animalInfo.personality}
              </p>
            </div>

            {/* Messages container */}
            <div style={{
              flex: 1, overflowY: "auto", display: "flex", flexDirection: "column",
              gap: 12, padding: "12px 0", marginBottom: 16, maxHeight: "40vh",
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

            {/* Input bar */}
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
                  position: "relative",
                }}
              >
                {isListening ? (
                  <span style={{
                    display: "inline-block", width: 14, height: 14,
                    borderRadius: "var(--r-full)", background: "#e74c3c",
                    animation: "pulse 1s ease-in-out infinite",
                  }} />
                ) : "\uD83C\uDFA4"}
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
                textAlign: "center", fontSize: "0.85rem", color: "#e74c3c",
                fontWeight: 600, marginTop: 8, fontFamily: fredoka,
              }}>
                Listening... speak now!
              </p>
            )}
          </div>
        )}

        {/* ---- END SCREEN ---- */}
        {screen === "end" && animal && animalInfo && (
          <div className="fade fade-2" style={{ textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
              <AnimalAvatar animal={animal} gender={gender} state="happy" size={120} />
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
