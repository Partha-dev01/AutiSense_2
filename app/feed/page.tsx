"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { useAuthGuard } from "../hooks/useAuthGuard";
import NavLogo from "../components/NavLogo";
import ThemeToggle from "../components/ThemeToggle";
import UserMenu from "../components/UserMenu";
import { Plus, X, Send, Trash2 } from "lucide-react";
import BottomNav from "../components/BottomNav";

type Category = "all" | "tip" | "milestone" | "question" | "resource";

interface FeedPost {
  id: string;
  postId: string;
  userId: string;
  content: string;
  category: "tip" | "milestone" | "question" | "resource";
  reactions: { heart: number; helpful: number; relate: number };
  reactedBy: Record<string, string[]>;
  createdAt: number;
  anonymous: boolean;
}

const CATEGORIES: { value: Category; label: string; emoji: string }[] = [
  { value: "all", label: "All", emoji: "📋" },
  { value: "tip", label: "Tips", emoji: "💡" },
  { value: "milestone", label: "Milestones", emoji: "🌟" },
  { value: "question", label: "Questions", emoji: "❓" },
  { value: "resource", label: "Resources", emoji: "📚" },
];

const CATEGORY_COLORS: Record<string, string> = {
  tip: "var(--feature-green)",
  milestone: "var(--feature-peach)",
  question: "var(--feature-blue)",
  resource: "var(--feature-lavender)",
};

const REACTION_CONFIG = [
  { type: "heart" as const, emoji: "❤️", label: "Love" },
  { type: "helpful" as const, emoji: "🙏", label: "Helpful" },
  { type: "relate" as const, emoji: "🤝", label: "Relate" },
];

export default function FeedPage() {
  const { loading: authLoading, isAuthenticated } = useAuthGuard();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [filter, setFilter] = useState<Category>("all");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<FeedPost["category"]>("tip");
  const [posting, setPosting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [showCompose, setShowCompose] = useState(false);
  const [anonymous, setAnonymous] = useState(true);

  useEffect(() => {
    const saved =
      (typeof window !== "undefined" && localStorage.getItem("autisense-theme")) || "light";
    setTheme(saved as "light" | "dark");
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    if (typeof window !== "undefined") localStorage.setItem("autisense-theme", theme);
  }, [theme]);

  // Get current user ID from session
  useEffect(() => {
    if (!isAuthenticated) return;
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => {
        if (data.user?.id) setUserId(data.user.id);
      })
      .catch(() => {});
  }, [isAuthenticated]);

  const loadPosts = useCallback(async () => {
    try {
      const res = await fetch("/api/feed?limit=50");
      const data = await res.json();
      setPosts(data.posts || []);
    } catch {
      // API unavailable
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) loadPosts();
  }, [isAuthenticated, loadPosts]);

  if (authLoading || !isAuthenticated) {
    return (
      <div className="page" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <p style={{ color: "var(--text-secondary)" }}>Checking authentication...</p>
      </div>
    );
  }

  const handlePost = async () => {
    if (!content.trim() || posting) return;
    setPosting(true);
    try {
      await fetch("/api/feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim(), category, anonymous }),
      });
      setContent("");
      setShowCompose(false);
      await loadPosts();
    } catch {
      // Failed to create post
    } finally {
      setPosting(false);
    }
  };

  const handleReaction = async (post: FeedPost, type: "heart" | "helpful" | "relate") => {
    try {
      await fetch("/api/feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "react", postId: post.postId, createdAt: post.createdAt, type }),
      });
      await loadPosts();
    } catch {
      // Failed to toggle reaction
    }
  };

  const handleDelete = async (post: FeedPost) => {
    try {
      await fetch("/api/feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", postId: post.postId, createdAt: post.createdAt }),
      });
      await loadPosts();
    } catch {
      // Failed to delete
    }
  };

  const filtered =
    filter === "all" ? posts : posts.filter((p) => p.category === filter);

  const timeAgo = (ts: number) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const hasReacted = (post: FeedPost, type: string) => {
    if (!userId || !post.reactedBy) return false;
    return (post.reactedBy[type] || []).includes(userId);
  };

  return (
    <div className="page">
      {/* Nav */}
      <nav className="nav">
        <NavLogo />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ThemeToggle theme={theme} onToggle={() => setTheme((t) => (t === "light" ? "dark" : "light"))} />
          <Link
            href="/kid-dashboard"
            className="btn btn-outline"
            style={{ minHeight: 40, padding: "8px 16px", fontSize: "0.9rem" }}
          >
            Dashboard
          </Link>
          <UserMenu />
        </div>
      </nav>

      {/* Main */}
      <div
        className="main fade fade-1"
        style={{ maxWidth: 680, padding: "32px 20px 100px" }}
      >
        {/* Header with title + new post button */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <h1 className="page-title" style={{ margin: 0 }}>
            Community <em>Feed</em>
          </h1>
          <button
            onClick={() => setShowCompose(!showCompose)}
            className="btn btn-primary"
            style={{
              minHeight: 44,
              padding: "8px 18px",
              fontSize: "0.85rem",
              display: "flex",
              alignItems: "center",
              gap: 6,
              borderRadius: "var(--r-full)",
            }}
          >
            {showCompose ? <X size={18} /> : <Plus size={18} />}
            {showCompose ? "Cancel" : "New Post"}
          </button>
        </div>
        <p className="subtitle" style={{ marginBottom: 20 }}>
          Share tips, celebrate milestones, and connect with other families.
        </p>

        {/* Compose Form (collapsible) */}
        {showCompose && (
          <div
            className="card fade fade-1"
            style={{ padding: "22px 20px", marginBottom: 22 }}
          >
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What's on your mind? Share with the community..."
              className="input"
              style={{
                minHeight: 80,
                resize: "vertical",
                marginBottom: 14,
                fontFamily: "'Nunito', sans-serif",
                fontSize: "0.92rem",
              }}
              autoFocus
            />

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
                marginBottom: 14,
              }}
            >
              {CATEGORIES.filter((c) => c.value !== "all").map((c) => (
                <button
                  key={c.value}
                  onClick={() => setCategory(c.value as FeedPost["category"])}
                  style={{
                    cursor: "pointer",
                    background:
                      category === c.value
                        ? "var(--sage-500)"
                        : "var(--sage-100)",
                    color: category === c.value ? "white" : "var(--sage-600)",
                    border: "1.5px solid",
                    borderColor:
                      category === c.value
                        ? "var(--sage-500)"
                        : "var(--sage-200)",
                    borderRadius: "var(--r-full)",
                    padding: "5px 12px",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    fontFamily: "'Fredoka',sans-serif",
                    transition: "all 200ms var(--ease)",
                  }}
                >
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <label style={{
                display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
                fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary)",
              }}>
                <input
                  type="checkbox"
                  checked={anonymous}
                  onChange={(e) => setAnonymous(e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: "var(--sage-500)" }}
                />
                Post Anonymously
              </label>

              <button
                onClick={handlePost}
                disabled={!content.trim() || posting}
                className="btn btn-primary"
                style={{
                  minHeight: 44,
                  padding: "10px 24px",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: "0.88rem",
                }}
              >
                <Send size={16} />
                {posting ? "Posting..." : anonymous ? "Post Anonymously" : "Post as Me"}
              </button>
            </div>
          </div>
        )}

        {/* Category Filter */}
        <div
          className="fade fade-2"
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 20,
          }}
        >
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              onClick={() => setFilter(c.value)}
              style={{
                cursor: "pointer",
                background:
                  filter === c.value ? "var(--sage-500)" : "var(--sage-100)",
                color: filter === c.value ? "white" : "var(--sage-600)",
                border: "1.5px solid",
                borderColor:
                  filter === c.value ? "var(--sage-500)" : "var(--sage-200)",
                borderRadius: "var(--r-full)",
                padding: "6px 14px",
                fontSize: "0.8rem",
                fontWeight: 700,
                fontFamily: "'Fredoka',sans-serif",
                transition: "all 200ms var(--ease)",
              }}
            >
              {c.emoji} {c.label}
            </button>
          ))}
        </div>

        {/* Posts */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
            Loading...
          </div>
        ) : filtered.length === 0 ? (
          <div
            className="card"
            style={{
              padding: "48px 20px",
              textAlign: "center",
              color: "var(--text-muted)",
            }}
          >
            <div style={{ fontSize: "2rem", marginBottom: 12 }}>💬</div>
            <p style={{ fontFamily: "'Fredoka',sans-serif", fontWeight: 600, fontSize: "1rem", marginBottom: 6 }}>
              No posts yet
            </p>
            <p style={{ fontSize: "0.85rem" }}>
              Be the first to share something with the community!
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {filtered.map((post) => (
              <div
                key={post.id}
                className="card fade fade-2"
                style={{ padding: "20px 20px 14px" }}
              >
                {/* Header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 12,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: "50%",
                        background: CATEGORY_COLORS[post.category] || "var(--sage-100)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.85rem",
                      }}
                    >
                      {post.anonymous ? "🙈" : "👤"}
                    </span>
                    <div>
                      <span
                        style={{
                          fontSize: "0.82rem",
                          fontWeight: 700,
                          fontFamily: "'Fredoka',sans-serif",
                          color: "var(--text-primary)",
                        }}
                      >
                        {post.anonymous ? "Anonymous" : "Community Member"}
                      </span>
                      <span
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--text-muted)",
                          marginLeft: 8,
                        }}
                      >
                        {timeAgo(post.createdAt)}
                      </span>
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      fontFamily: "'Fredoka',sans-serif",
                      padding: "3px 10px",
                      borderRadius: "var(--r-full)",
                      background: CATEGORY_COLORS[post.category] || "var(--sage-100)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {post.category}
                  </span>
                </div>

                {/* Content */}
                <p
                  style={{
                    fontSize: "0.92rem",
                    color: "var(--text-primary)",
                    lineHeight: 1.7,
                    marginBottom: 14,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {post.content}
                </p>

                {/* Reactions & Actions */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderTop: "1px solid var(--border)",
                    paddingTop: 10,
                  }}
                >
                  <div style={{ display: "flex", gap: 6 }}>
                    {REACTION_CONFIG.map((r) => {
                      const reacted = hasReacted(post, r.type);
                      return (
                        <button
                          key={r.type}
                          onClick={() => handleReaction(post, r.type)}
                          style={{
                            background: reacted ? "var(--sage-100)" : "none",
                            border: reacted ? "1.5px solid var(--sage-300)" : "1.5px solid transparent",
                            cursor: "pointer",
                            fontSize: "0.82rem",
                            color: reacted ? "var(--sage-700)" : "var(--text-secondary)",
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "4px 10px",
                            borderRadius: "var(--r-full)",
                            fontWeight: reacted ? 700 : 500,
                            transition: "all 200ms var(--ease)",
                          }}
                        >
                          {r.emoji}{" "}
                          <span style={{ fontSize: "0.78rem" }}>
                            {post.reactions[r.type]}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {post.userId === userId && (
                    <button
                      onClick={() => handleDelete(post)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--text-muted)",
                        padding: "4px 8px",
                        borderRadius: "var(--r-sm)",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: "0.75rem",
                        transition: "color 200ms",
                      }}
                      onMouseEnter={(e) =>
                        ((e.currentTarget as HTMLElement).style.color = "var(--peach-300)")
                      }
                      onMouseLeave={(e) =>
                        ((e.currentTarget as HTMLElement).style.color = "var(--text-muted)")
                      }
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating Action Button (mobile) */}
      {!showCompose && (
        <button
          onClick={() => setShowCompose(true)}
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "var(--sage-500)",
            color: "white",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
            transition: "transform 200ms var(--ease), box-shadow 200ms var(--ease)",
            zIndex: 50,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.transform = "scale(1.1)";
            (e.currentTarget as HTMLElement).style.boxShadow = "0 6px 24px rgba(0,0,0,0.2)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.transform = "scale(1)";
            (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 16px rgba(0,0,0,0.15)";
          }}
          aria-label="New Post"
        >
          <Plus size={26} strokeWidth={2.5} />
        </button>
      )}

      <BottomNav />
    </div>
  );
}
