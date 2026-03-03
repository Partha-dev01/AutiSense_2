"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { createPost, listPosts, addReaction, deletePost } from "../lib/db/feed.repository";
import { getCurrentUserId } from "../lib/identity/identity";
import { useAuthGuard } from "../hooks/useAuthGuard";
import type { FeedPost } from "../types/feedPost";

type Category = "all" | FeedPost["category"];

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

  if (authLoading || !isAuthenticated) {
    return (
      <div className="page" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <p style={{ color: "var(--text-secondary)" }}>Checking authentication...</p>
      </div>
    );
  }

  useEffect(() => {
    const saved =
      (typeof window !== "undefined" && localStorage.getItem("autisense-theme")) || "light";
    setTheme(saved as "light" | "dark");
    if (typeof window !== "undefined") {
      setUserId(getCurrentUserId());
    }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    if (typeof window !== "undefined") localStorage.setItem("autisense-theme", theme);
  }, [theme]);

  const loadPosts = useCallback(async () => {
    try {
      const all = await listPosts(100);
      setPosts(all);
    } catch {
      // IndexedDB may not be available
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const handlePost = async () => {
    if (!content.trim() || posting) return;
    setPosting(true);
    try {
      await createPost(content.trim(), category, true);
      setContent("");
      await loadPosts();
    } catch {
      // Failed to create post
    } finally {
      setPosting(false);
    }
  };

  const handleReaction = async (
    postId: number,
    type: "heart" | "helpful" | "relate",
  ) => {
    try {
      await addReaction(postId, type);
      await loadPosts();
    } catch {
      // Failed to add reaction
    }
  };

  const handleDelete = async (postId: number) => {
    try {
      await deletePost(postId);
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

  return (
    <div className="page">
      {/* Nav */}
      <nav className="nav">
        <Link href="/" className="logo">
          Auti<em>Sense</em>
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
            className="btn btn-outline"
            style={{ minHeight: 40, padding: "8px 16px", fontSize: "0.9rem", gap: 6 }}
            aria-label="Toggle theme"
          >
            {theme === "light" ? "Dark" : "Light"}
          </button>
          <Link
            href="/dashboard"
            className="btn btn-outline"
            style={{ minHeight: 40, padding: "8px 16px", fontSize: "0.9rem" }}
          >
            Dashboard
          </Link>
        </div>
      </nav>

      {/* Main */}
      <div
        className="main fade fade-1"
        style={{ maxWidth: 680, padding: "40px 28px 80px" }}
      >
        <h1 className="page-title">
          Community <em>Feed</em>
        </h1>
        <p className="subtitle">
          Share tips, celebrate milestones, and connect with other families. All posts are anonymous.
        </p>

        {/* New Post Form */}
        <div
          className="card fade fade-2"
          style={{ padding: "24px 22px", marginBottom: 28 }}
        >
          <h3
            style={{
              fontFamily: "'Fredoka',sans-serif",
              fontWeight: 600,
              fontSize: "1rem",
              marginBottom: 14,
              color: "var(--text-primary)",
            }}
          >
            Share Something
          </h3>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your post..."
            className="input"
            style={{
              minHeight: 80,
              resize: "vertical",
              marginBottom: 14,
              fontFamily: "'Nunito', sans-serif",
            }}
          />

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 14,
            }}
          >
            <span
              style={{
                fontSize: "0.85rem",
                fontWeight: 700,
                color: "var(--text-secondary)",
              }}
            >
              Category:
            </span>
            {CATEGORIES.filter((c) => c.value !== "all").map((c) => (
              <button
                key={c.value}
                onClick={() => setCategory(c.value as FeedPost["category"])}
                className="chip"
                style={{
                  marginBottom: 0,
                  cursor: "pointer",
                  background:
                    category === c.value
                      ? "var(--sage-400)"
                      : "var(--sage-100)",
                  color: category === c.value ? "white" : "var(--sage-600)",
                  borderColor:
                    category === c.value
                      ? "var(--sage-400)"
                      : "var(--sage-200)",
                  transition: "all 200ms var(--ease)",
                  border: "1.5px solid",
                  borderRadius: "var(--r-full)",
                  padding: "6px 14px",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                }}
              >
                {c.emoji} {c.label}
              </button>
            ))}
          </div>

          <button
            onClick={handlePost}
            disabled={!content.trim() || posting}
            className="btn btn-primary"
            style={{ minHeight: 48, padding: "10px 28px" }}
          >
            {posting ? "Posting..." : "Post Anonymously"}
          </button>
        </div>

        {/* Category Filter */}
        <div
          className="fade fade-3"
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 24,
          }}
        >
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              onClick={() => setFilter(c.value)}
              className="chip"
              style={{
                marginBottom: 0,
                cursor: "pointer",
                background:
                  filter === c.value ? "var(--sage-400)" : "var(--sage-100)",
                color: filter === c.value ? "white" : "var(--sage-600)",
                borderColor:
                  filter === c.value ? "var(--sage-400)" : "var(--sage-200)",
                transition: "all 200ms var(--ease)",
                border: "1.5px solid",
                borderRadius: "var(--r-full)",
                padding: "6px 14px",
                fontSize: "0.82rem",
                fontWeight: 700,
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
              padding: "40px 20px",
              textAlign: "center",
              color: "var(--text-muted)",
            }}
          >
            No posts yet. Be the first to share!
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {filtered.map((post) => (
              <div
                key={post.id}
                className="card"
                style={{ padding: "22px 22px 16px" }}
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
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        background: CATEGORY_COLORS[post.category] || "var(--sage-100)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.9rem",
                      }}
                    >
                      {post.anonymous ? "🙈" : "👤"}
                    </span>
                    <div>
                      <span
                        style={{
                          fontSize: "0.82rem",
                          fontWeight: 700,
                          color: "var(--text-primary)",
                        }}
                      >
                        {post.anonymous ? "Anonymous" : "User"}
                      </span>
                      <span
                        style={{
                          fontSize: "0.78rem",
                          color: "var(--text-muted)",
                          marginLeft: 8,
                        }}
                      >
                        {timeAgo(post.createdAt)}
                      </span>
                    </div>
                  </div>
                  <span
                    className="chip"
                    style={{
                      marginBottom: 0,
                      fontSize: "0.75rem",
                      padding: "3px 10px",
                      background: CATEGORY_COLORS[post.category] || "var(--sage-100)",
                    }}
                  >
                    {post.category}
                  </span>
                </div>

                {/* Content */}
                <p
                  style={{
                    fontSize: "0.95rem",
                    color: "var(--text-primary)",
                    lineHeight: 1.7,
                    marginBottom: 16,
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
                    borderTop: "1.5px solid var(--border)",
                    paddingTop: 12,
                  }}
                >
                  <div style={{ display: "flex", gap: 12 }}>
                    <button
                      onClick={() => post.id != null && handleReaction(post.id, "heart")}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "0.85rem",
                        color: "var(--text-secondary)",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "4px 8px",
                        borderRadius: "var(--r-sm)",
                        transition: "background 200ms",
                      }}
                      onMouseEnter={(e) =>
                        ((e.currentTarget as HTMLElement).style.background =
                          "var(--sage-50)")
                      }
                      onMouseLeave={(e) =>
                        ((e.currentTarget as HTMLElement).style.background =
                          "none")
                      }
                    >
                      ❤️ {post.reactions.heart}
                    </button>
                    <button
                      onClick={() => post.id != null && handleReaction(post.id, "helpful")}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "0.85rem",
                        color: "var(--text-secondary)",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "4px 8px",
                        borderRadius: "var(--r-sm)",
                        transition: "background 200ms",
                      }}
                      onMouseEnter={(e) =>
                        ((e.currentTarget as HTMLElement).style.background =
                          "var(--sage-50)")
                      }
                      onMouseLeave={(e) =>
                        ((e.currentTarget as HTMLElement).style.background =
                          "none")
                      }
                    >
                      🙏 {post.reactions.helpful}
                    </button>
                    <button
                      onClick={() => post.id != null && handleReaction(post.id, "relate")}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "0.85rem",
                        color: "var(--text-secondary)",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "4px 8px",
                        borderRadius: "var(--r-sm)",
                        transition: "background 200ms",
                      }}
                      onMouseEnter={(e) =>
                        ((e.currentTarget as HTMLElement).style.background =
                          "var(--sage-50)")
                      }
                      onMouseLeave={(e) =>
                        ((e.currentTarget as HTMLElement).style.background =
                          "none")
                      }
                    >
                      🤝 {post.reactions.relate}
                    </button>
                  </div>

                  {post.userId === userId && (
                    <button
                      onClick={() => post.id != null && handleDelete(post.id)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "0.78rem",
                        color: "var(--text-muted)",
                        padding: "4px 8px",
                        borderRadius: "var(--r-sm)",
                        transition: "color 200ms",
                      }}
                      onMouseEnter={(e) =>
                        ((e.currentTarget as HTMLElement).style.color =
                          "var(--peach-300)")
                      }
                      onMouseLeave={(e) =>
                        ((e.currentTarget as HTMLElement).style.color =
                          "var(--text-muted)")
                      }
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
