"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { getDifficulty, saveDifficulty } from "../../lib/games/difficultyEngine";
import NavLogo from "../../components/NavLogo";
import ThemeToggle from "../../components/ThemeToggle";

type Screen = "start" | "play" | "result";
type Category = "animals" | "vehicles" | "food" | "toys";

interface SortItem {
  name: string;
  emoji: string;
  category: Category;
}

const ITEMS_BY_CATEGORY: Record<Category, SortItem[]> = {
  animals: [
    { name: "Dog", emoji: "\u{1F415}", category: "animals" },
    { name: "Cat", emoji: "\u{1F431}", category: "animals" },
    { name: "Rabbit", emoji: "\u{1F430}", category: "animals" },
    { name: "Bird", emoji: "\u{1F426}", category: "animals" },
    { name: "Fish", emoji: "\u{1F41F}", category: "animals" },
    { name: "Bear", emoji: "\u{1F43B}", category: "animals" },
  ],
  vehicles: [
    { name: "Car", emoji: "\u{1F697}", category: "vehicles" },
    { name: "Bus", emoji: "\u{1F68C}", category: "vehicles" },
    { name: "Train", emoji: "\u{1F682}", category: "vehicles" },
    { name: "Plane", emoji: "\u{2708}\u{FE0F}", category: "vehicles" },
    { name: "Boat", emoji: "\u{26F5}", category: "vehicles" },
    { name: "Bike", emoji: "\u{1F6B2}", category: "vehicles" },
  ],
  food: [
    { name: "Apple", emoji: "\u{1F34E}", category: "food" },
    { name: "Pizza", emoji: "\u{1F355}", category: "food" },
    { name: "Banana", emoji: "\u{1F34C}", category: "food" },
    { name: "Cookie", emoji: "\u{1F36A}", category: "food" },
    { name: "Carrot", emoji: "\u{1F955}", category: "food" },
    { name: "Ice Cream", emoji: "\u{1F366}", category: "food" },
  ],
  toys: [
    { name: "Ball", emoji: "\u{26BD}", category: "toys" },
    { name: "Teddy", emoji: "\u{1F9F8}", category: "toys" },
    { name: "Blocks", emoji: "\u{1F9F1}", category: "toys" },
    { name: "Kite", emoji: "\u{1FA81}", category: "toys" },
    { name: "Drum", emoji: "\u{1FA98}", category: "toys" },
    { name: "Puzzle", emoji: "\u{1F9E9}", category: "toys" },
  ],
};

const CATEGORY_META: Record<Category, { emoji: string; label: string; border: string }> = {
  animals: { emoji: "\u{1F43E}", label: "Animals", border: "var(--sage-300)" },
  vehicles: { emoji: "\u{1F697}", label: "Vehicles", border: "var(--sky-300)" },
  food: { emoji: "\u{1F34E}", label: "Food", border: "#ff8a65" },
  toys: { emoji: "\u{1F9F8}", label: "Toys", border: "#b39ddb" },
};

// Level 1-2: 2 categories, Level 3: 3 categories, Level 4+: 4 categories
function getCategoriesForLevel(level: number): Category[] {
  if (level <= 2) return ["animals", "vehicles"];
  if (level === 3) return ["animals", "vehicles", "food"];
  return ["animals", "vehicles", "food", "toys"];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function SortingGamePage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [screen, setScreen] = useState<Screen>("start");
  const [items, setItems] = useState<SortItem[]>([]);
  const [activeCategories, setActiveCategories] = useState<Category[]>(["animals", "vehicles"]);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [total, setTotal] = useState(0);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [startTime, setStartTime] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const saved =
      (typeof window !== "undefined" && localStorage.getItem("autisense-theme")) || "light";
    setTheme(saved as "light" | "dark");
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    if (typeof window !== "undefined") localStorage.setItem("autisense-theme", theme);
  }, [theme]);

  const startGame = useCallback(() => {
    const config = getDifficulty("sorting", "default");
    const cats = getCategoriesForLevel(config.level);
    setActiveCategories(cats);

    // Pick items from active categories
    const perCategory = Math.max(2, Math.floor(config.itemCount / cats.length));
    const allItems: SortItem[] = [];
    for (const cat of cats) {
      allItems.push(...shuffle(ITEMS_BY_CATEGORY[cat]).slice(0, perCategory));
    }
    const shuffled = shuffle(allItems);

    // Count items per category
    const counts: Record<string, number> = {};
    for (const item of shuffled) {
      counts[item.category] = (counts[item.category] || 0) + 1;
    }
    setCategoryCounts(counts);

    setItems(shuffled);
    setCurrentIndex(0);
    setCorrect(0);
    setTotal(shuffled.length);
    setFeedback(null);
    setStartTime(Date.now());
    setScreen("play");
  }, []);

  useEffect(() => {
    if (screen !== "play") return;
    const iv = setInterval(() => setElapsed(Date.now() - startTime), 500);
    return () => clearInterval(iv);
  }, [screen, startTime]);

  const handleSort = (category: Category) => {
    if (currentIndex >= items.length) return;

    const isCorrect = items[currentIndex].category === category;
    setFeedback(isCorrect ? "correct" : "wrong");
    if (isCorrect) setCorrect((c) => c + 1);

    setTimeout(() => {
      setFeedback(null);
      const nextIndex = currentIndex + 1;
      if (nextIndex >= items.length) {
        const score = Math.round(((correct + (isCorrect ? 1 : 0)) / total) * 100);
        saveDifficulty("sorting", "default", score);
        setScreen("result");
      } else {
        setCurrentIndex(nextIndex);
      }
    }, 600);
  };

  const score =
    total > 0 ? Math.round((correct / total) * 100) : 0;

  return (
    <div className="page">
      <nav className="nav">
        <NavLogo />
        <ThemeToggle theme={theme} onToggle={() => setTheme((t) => (t === "light" ? "dark" : "light"))} />
      </nav>

      <div className="main fade fade-1" style={{ maxWidth: 600, padding: "40px 28px 80px" }}>
        <Link
          href="/games"
          className="btn btn-outline"
          style={{
            minHeight: 40,
            padding: "8px 18px",
            fontSize: "0.88rem",
            marginBottom: 28,
            display: "inline-flex",
          }}
        >
          Back to Games
        </Link>

        {screen === "start" && (
          <div className="fade fade-2" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "3.5rem", marginBottom: 20 }}>{"\u{1F5C2}\u{FE0F}"}</div>
            <h1 className="page-title">
              Category <em>Sorting</em>
            </h1>
            <p className="subtitle">
              Sort each item into the correct category. Categories increase as you level up!
            </p>
            <button onClick={startGame} className="btn btn-primary btn-full" style={{ maxWidth: 340 }}>
              Start Game
            </button>
          </div>
        )}

        {screen === "play" && items[currentIndex] && (
          <div className="fade fade-2" style={{ textAlign: "center" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 16,
                fontSize: "0.9rem",
                color: "var(--text-secondary)",
                fontWeight: 600,
              }}
            >
              <span>
                {currentIndex + 1} / {total}
              </span>
              <span>Correct: {correct}</span>
              <span>{Math.floor(elapsed / 1000)}s</span>
            </div>

            {/* Category counts */}
            <div
              style={{
                display: "flex",
                gap: 8,
                justifyContent: "center",
                flexWrap: "wrap",
                marginBottom: 20,
              }}
            >
              {activeCategories.map((cat) => (
                <span
                  key={cat}
                  style={{
                    fontSize: "0.78rem",
                    padding: "4px 10px",
                    borderRadius: 12,
                    background: "var(--sage-50)",
                    color: "var(--text-secondary)",
                    fontWeight: 600,
                  }}
                >
                  {CATEGORY_META[cat].emoji} {categoryCounts[cat] || 0}
                </span>
              ))}
            </div>

            {/* Current Item */}
            <div
              className="card"
              style={{
                padding: "40px 24px",
                marginBottom: 32,
                textAlign: "center",
                borderColor: feedback === "correct"
                  ? "var(--sage-400)"
                  : feedback === "wrong"
                    ? "var(--peach-300)"
                    : "var(--border)",
                background: feedback === "correct"
                  ? "var(--sage-50)"
                  : feedback === "wrong"
                    ? "var(--peach-100)"
                    : "var(--card)",
                transition: "all 300ms var(--ease)",
              }}
            >
              <div style={{ fontSize: "4rem", marginBottom: 12 }}>
                {items[currentIndex].emoji}
              </div>
              <div
                style={{
                  fontFamily: "'Fredoka',sans-serif",
                  fontWeight: 600,
                  fontSize: "1.3rem",
                  color: "var(--text-primary)",
                }}
              >
                {items[currentIndex].name}
              </div>
              {feedback && (
                <div
                  style={{
                    marginTop: 12,
                    fontSize: "0.95rem",
                    fontWeight: 700,
                    color: feedback === "correct" ? "var(--sage-500)" : "var(--peach-300)",
                  }}
                >
                  {feedback === "correct" ? "Correct!" : "Try again next time!"}
                </div>
              )}
            </div>

            {/* Sort Buttons */}
            <div style={{
              display: "grid",
              gridTemplateColumns: `repeat(${Math.min(activeCategories.length, 2)}, 1fr)`,
              gap: 12,
            }}>
              {activeCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => handleSort(cat)}
                  className="btn btn-outline btn-full"
                  style={{
                    fontSize: "1rem",
                    borderColor: CATEGORY_META[cat].border,
                    minHeight: 58,
                  }}
                  disabled={feedback !== null}
                >
                  {CATEGORY_META[cat].emoji} {CATEGORY_META[cat].label}
                </button>
              ))}
            </div>
          </div>
        )}

        {screen === "result" && (
          <div className="fade fade-2" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "3.5rem", marginBottom: 20 }}>{"\u{1F3C6}"}</div>
            <h1 className="page-title">
              Well <em>Done!</em>
            </h1>
            <div
              style={{
                display: "flex",
                gap: 16,
                justifyContent: "center",
                flexWrap: "wrap",
                marginBottom: 32,
              }}
            >
              <div className="card" style={{ padding: "20px 24px", textAlign: "center" }}>
                <div
                  style={{
                    fontSize: "1.8rem",
                    fontFamily: "'Fredoka',sans-serif",
                    fontWeight: 700,
                    color: "var(--sage-500)",
                  }}
                >
                  {score}%
                </div>
                <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", fontWeight: 600 }}>
                  Score
                </div>
              </div>
              <div className="card" style={{ padding: "20px 24px", textAlign: "center" }}>
                <div
                  style={{
                    fontSize: "1.8rem",
                    fontFamily: "'Fredoka',sans-serif",
                    fontWeight: 700,
                    color: "var(--sage-500)",
                  }}
                >
                  {correct}/{total}
                </div>
                <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", fontWeight: 600 }}>
                  Correct
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <button onClick={startGame} className="btn btn-primary" style={{ minWidth: 160 }}>
                Play Again
              </button>
              <Link href="/games" className="btn btn-outline" style={{ minWidth: 160 }}>
                All Games
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
