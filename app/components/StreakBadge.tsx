"use client";

interface StreakBadgeProps {
  currentStreak: number;
  longestStreak: number;
}

function getMessage(streak: number): string {
  if (streak === 0) return "Start your streak today!";
  if (streak <= 2) return "Great start! Keep it up!";
  if (streak <= 6) return `You're on fire! ${streak} days!`;
  return `Amazing! ${streak} day streak!`;
}

export default function StreakBadge({ currentStreak, longestStreak }: StreakBadgeProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "16px 22px",
        borderRadius: "var(--r-lg)",
        background: currentStreak > 0
          ? "linear-gradient(135deg, var(--feature-peach), var(--feature-green))"
          : "var(--bg-secondary)",
        border: "1px solid var(--border)",
      }}
    >
      <span
        style={{
          fontSize: "2rem",
          lineHeight: 1,
          animation: currentStreak > 0 ? "streak-pulse 2s ease-in-out infinite" : "none",
        }}
      >
        {currentStreak > 0 ? "🔥" : "⭐"}
      </span>
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontFamily: "'Fredoka',sans-serif",
            fontWeight: 700,
            fontSize: "1.1rem",
            color: "var(--text-primary)",
          }}
        >
          {currentStreak > 0 ? `${currentStreak} Day Streak` : "No Streak Yet"}
        </div>
        <div
          style={{
            fontSize: "0.82rem",
            color: "var(--text-secondary)",
            marginTop: 2,
          }}
        >
          {getMessage(currentStreak)}
        </div>
      </div>
      {longestStreak > 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "6px 12px",
            borderRadius: "var(--r-md)",
            background: "var(--card)",
            border: "1px solid var(--border)",
          }}
        >
          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600 }}>
            BEST
          </div>
          <div
            style={{
              fontFamily: "'Fredoka',sans-serif",
              fontWeight: 700,
              fontSize: "1rem",
              color: "var(--sage-600)",
            }}
          >
            {longestStreak}
          </div>
        </div>
      )}
      <style>{`
        @keyframes streak-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
      `}</style>
    </div>
  );
}
