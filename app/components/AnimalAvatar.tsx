"use client";

interface AnimalAvatarProps {
  animal: "dog" | "cat" | "rabbit" | "parrot";
  gender: "boy" | "girl";
  state: "idle" | "talking" | "happy" | "thinking";
  size?: number;
}

const ACCENT = { boy: "#5B9BD5", girl: "#F2A7C3" };

const PALETTES = {
  dog:    { body: "#C4956A", detail: "#8B6B4E" },
  cat:    { body: "#B8B8B8", detail: "#D4D4D4" },
  rabbit: { body: "#F5F0EB", detail: "#FFB5B5" },
  parrot: { body: "#7EC87E", detail: "#FF8C42" },
};

/* ---------- individual SVG renderers ---------- */

function DogFace({ body, detail, accent }: { body: string; detail: string; accent: string }) {
  return (
    <>
      {/* ears */}
      <ellipse cx="25" cy="32" rx="12" ry="18" fill={detail} />
      <ellipse cx="75" cy="32" rx="12" ry="18" fill={detail} />
      {/* head */}
      <circle cx="50" cy="50" r="30" fill={body} />
      {/* eyes */}
      <circle cx="40" cy="45" r="3.5" fill="#3A2A1A" />
      <circle cx="60" cy="45" r="3.5" fill="#3A2A1A" />
      <circle cx="41" cy="44" r="1.2" fill="#fff" />
      <circle cx="61" cy="44" r="1.2" fill="#fff" />
      {/* nose */}
      <ellipse cx="50" cy="55" rx="4" ry="3" fill="#3A2A1A" />
      {/* mouth — animated via className */}
      <path className="avatar-mouth" d="M44,60 Q50,66 56,60" fill="none" stroke="#3A2A1A" strokeWidth="1.5" strokeLinecap="round" />
      {/* collar */}
      <rect x="35" y="75" width="30" height="5" rx="2.5" fill={accent} />
    </>
  );
}

function CatFace({ body, detail, accent }: { body: string; detail: string; accent: string }) {
  return (
    <>
      {/* ears */}
      <polygon points="22,18 30,40 14,40" fill={body} />
      <polygon points="78,18 86,40 70,40" fill={body} />
      <polygon points="23,22 29,38 17,38" fill={detail} />
      <polygon points="77,22 83,38 71,38" fill={detail} />
      {/* head */}
      <circle cx="50" cy="52" r="28" fill={body} />
      {/* eyes */}
      <ellipse cx="40" cy="49" rx="4" ry="4.5" fill="#4A6741" />
      <ellipse cx="60" cy="49" rx="4" ry="4.5" fill="#4A6741" />
      <circle cx="40" cy="48" r="1.5" fill="#1A1A1A" />
      <circle cx="60" cy="48" r="1.5" fill="#1A1A1A" />
      {/* nose */}
      <polygon points="50,56 48,59 52,59" fill="#E8A0A0" />
      {/* whiskers */}
      <line x1="28" y1="57" x2="42" y2="58" stroke="#9A9A9A" strokeWidth="0.8" />
      <line x1="28" y1="61" x2="42" y2="60" stroke="#9A9A9A" strokeWidth="0.8" />
      <line x1="72" y1="57" x2="58" y2="58" stroke="#9A9A9A" strokeWidth="0.8" />
      <line x1="72" y1="61" x2="58" y2="60" stroke="#9A9A9A" strokeWidth="0.8" />
      {/* mouth */}
      <path className="avatar-mouth" d="M46,62 Q50,66 54,62" fill="none" stroke="#7A7A7A" strokeWidth="1.2" strokeLinecap="round" />
      {/* bow */}
      <ellipse cx="44" cy="76" rx="5" ry="3" fill={accent} />
      <ellipse cx="56" cy="76" rx="5" ry="3" fill={accent} />
      <circle cx="50" cy="76" r="2" fill={accent} />
    </>
  );
}

function RabbitFace({ body, detail, accent }: { body: string; detail: string; accent: string }) {
  return (
    <>
      {/* ears */}
      <ellipse cx="38" cy="18" rx="8" ry="22" fill={body} />
      <ellipse cx="62" cy="18" rx="8" ry="22" fill={body} />
      <ellipse cx="38" cy="18" rx="5" ry="18" fill={detail} />
      <ellipse cx="62" cy="18" rx="5" ry="18" fill={detail} />
      {/* head */}
      <circle cx="50" cy="54" r="28" fill={body} />
      {/* eyes */}
      <circle cx="40" cy="50" r="3.5" fill="#5A3E2B" />
      <circle cx="60" cy="50" r="3.5" fill="#5A3E2B" />
      <circle cx="41" cy="49" r="1.3" fill="#fff" />
      <circle cx="61" cy="49" r="1.3" fill="#fff" />
      {/* nose */}
      <ellipse cx="50" cy="58" rx="3" ry="2" fill="#FFB5B5" />
      {/* mouth */}
      <path className="avatar-mouth" d="M46,62 L50,66 L54,62" fill="none" stroke="#BFA89E" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      {/* vest */}
      <path d="M36,76 Q50,84 64,76 L62,82 Q50,90 38,82 Z" fill={accent} />
    </>
  );
}

function ParrotFace({ body, detail, accent }: { body: string; detail: string; accent: string }) {
  return (
    <>
      {/* head */}
      <circle cx="50" cy="48" r="28" fill={body} />
      {/* head feathers */}
      <ellipse cx="50" cy="20" rx="6" ry="10" fill="#5AB85A" />
      <ellipse cx="44" cy="22" rx="4" ry="8" fill="#4CAF50" transform="rotate(-15 44 22)" />
      <ellipse cx="56" cy="22" rx="4" ry="8" fill="#4CAF50" transform="rotate(15 56 22)" />
      {/* eye circles */}
      <circle cx="38" cy="44" r="7" fill="#fff" />
      <circle cx="62" cy="44" r="7" fill="#fff" />
      <circle cx="38" cy="44" r="3.5" fill="#1A1A1A" />
      <circle cx="62" cy="44" r="3.5" fill="#1A1A1A" />
      <circle cx="39" cy="43" r="1.2" fill="#fff" />
      <circle cx="63" cy="43" r="1.2" fill="#fff" />
      {/* beak */}
      <path d="M44,54 Q50,64 56,54 Q50,58 44,54" fill={detail} />
      {/* mouth placeholder for animation */}
      <path className="avatar-mouth" d="M47,57 Q50,60 53,57" fill="none" stroke="#E07030" strokeWidth="1" strokeLinecap="round" />
      {/* hat */}
      <rect x="38" y="18" width="24" height="5" rx="2.5" fill={accent} />
      <rect x="43" y="10" width="14" height="10" rx="3" fill={accent} />
    </>
  );
}

/* ---------- thinking dots ---------- */

function ThinkingDots() {
  return (
    <g className="thinking-dots">
      <circle className="dot dot-1" cx="40" cy="88" r="2.5" fill="#999" />
      <circle className="dot dot-2" cx="50" cy="88" r="2.5" fill="#999" />
      <circle className="dot dot-3" cx="60" cy="88" r="2.5" fill="#999" />
    </g>
  );
}

/* ---------- keyframe styles ---------- */

const KEYFRAMES = `
@keyframes avatarBounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}
@keyframes avatarTalk {
  0%, 100% { transform: scaleY(1); }
  50% { transform: scaleY(1.6); }
}
@keyframes avatarWiggle {
  0%, 100% { transform: rotate(-5deg); }
  50% { transform: rotate(5deg); }
}
@keyframes dotFade {
  0%, 20% { opacity: 0.2; }
  40%, 60% { opacity: 1; }
  80%, 100% { opacity: 0.2; }
}
`;

const STATE_CLASS: Record<AnimalAvatarProps["state"], string> = {
  idle: "avatar-idle",
  talking: "avatar-talking",
  happy: "avatar-happy",
  thinking: "avatar-thinking",
};

const STATE_STYLES = `
.avatar-idle { animation: avatarBounce 2s ease-in-out infinite; }
.avatar-happy { animation: avatarWiggle 0.5s ease-in-out infinite; }
.avatar-talking .avatar-mouth { transform-origin: center; animation: avatarTalk 0.3s ease-in-out alternate infinite; }
.avatar-thinking .thinking-dots .dot-1 { animation: dotFade 1.2s ease-in-out infinite; }
.avatar-thinking .thinking-dots .dot-2 { animation: dotFade 1.2s ease-in-out 0.2s infinite; }
.avatar-thinking .thinking-dots .dot-3 { animation: dotFade 1.2s ease-in-out 0.4s infinite; }
`;

/* ---------- component ---------- */

const FACE_MAP = { dog: DogFace, cat: CatFace, rabbit: RabbitFace, parrot: ParrotFace };

export default function AnimalAvatar({
  animal,
  gender,
  state,
  size = 120,
}: AnimalAvatarProps) {
  const palette = PALETTES[animal];
  const accent = ACCENT[gender];
  const Face = FACE_MAP[animal];

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "var(--sage-50)",
        border: "3px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      <style>{KEYFRAMES}{STATE_STYLES}</style>
      <svg
        className={STATE_CLASS[state]}
        viewBox="0 0 100 100"
        width={size * 0.8}
        height={size * 0.8}
        xmlns="http://www.w3.org/2000/svg"
      >
        <Face body={palette.body} detail={palette.detail} accent={accent} />
        {state === "thinking" && <ThinkingDots />}
      </svg>
    </div>
  );
}
