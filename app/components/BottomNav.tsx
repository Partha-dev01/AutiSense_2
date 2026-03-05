"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/kid-dashboard", label: "Home", icon: "🏠" },
  { href: "/kid-dashboard/games", label: "Games", icon: "🎮" },
  { href: "/kid-dashboard/chat", label: "Chat", icon: "💬" },
  { href: "/kid-dashboard/progress", label: "Progress", icon: "📊" },
  { href: "/kid-dashboard/map", label: "Map", icon: "🗺️" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        background: "var(--card)",
        borderTop: "1px solid var(--border)",
        display: "flex",
        justifyContent: "space-around",
        alignItems: "center",
        height: 64,
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        boxShadow: "0 -2px 12px rgba(0,0,0,0.06)",
      }}
    >
      {tabs.map((tab) => {
        const isActive =
          tab.href === "/kid-dashboard"
            ? pathname === "/kid-dashboard"
            : pathname.startsWith(tab.href);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
              textDecoration: "none",
              color: isActive ? "var(--sage-600)" : "var(--text-muted)",
              fontSize: "1.3rem",
              minWidth: 56,
              minHeight: 56,
              justifyContent: "center",
              borderRadius: "var(--r-md)",
              transition: "color 200ms var(--ease)",
            }}
          >
            <span>{tab.icon}</span>
            <span
              style={{
                fontSize: "0.65rem",
                fontWeight: isActive ? 700 : 500,
                fontFamily: "'Fredoka',sans-serif",
                letterSpacing: "0.02em",
              }}
            >
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
