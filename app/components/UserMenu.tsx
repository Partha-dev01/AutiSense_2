"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { useAuth } from "../hooks/useAuth";

export default function UserMenu() {
  const { user, isAuthenticated, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (!isAuthenticated || !user) return null;

  return (
    <div ref={menuRef} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="User menu"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 10px",
          borderRadius: "var(--r-full, 50px)",
          border: "2px solid var(--border)",
          background: "var(--card)",
          cursor: "pointer",
          minHeight: 40,
          fontFamily: "inherit",
        }}
      >
        {user.picture ? (
          <Image
            src={user.picture}
            alt=""
            width={28}
            height={28}
            referrerPolicy="no-referrer"
            style={{ borderRadius: "50%" }}
          />
        ) : (
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "var(--sage-200)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.75rem",
              fontWeight: 700,
              color: "var(--sage-600)",
            }}
          >
            {user.name?.[0]?.toUpperCase() || "?"}
          </span>
        )}
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color: "var(--text-muted)" }}>
          <path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            minWidth: 180,
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg, 16px)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            zIndex: 200,
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
            <div
              style={{
                fontWeight: 600,
                fontSize: "0.88rem",
                color: "var(--text-primary)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {user.name}
            </div>
            <div
              style={{
                fontSize: "0.75rem",
                color: "var(--text-muted)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {user.email}
            </div>
          </div>
          <button
            onClick={() => {
              setOpen(false);
              logout();
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              padding: "12px 16px",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontSize: "0.88rem",
              fontWeight: 600,
              color: "#e74c3c",
              fontFamily: "inherit",
              textAlign: "left",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "var(--sage-50, #f5f5f5)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
