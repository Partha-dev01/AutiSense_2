/**
 * ENDPOINT: /auth/login
 * Login page — AutiSense-themed with Google OAuth sign-in.
 * For unauthenticated users.
 */
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

/** Error messages mapped from OAuth error codes */
const ERROR_MESSAGES: Record<string, string> = {
  access_denied: "You cancelled the sign-in. No worries — try again when ready.",
  invalid_state: "Session expired. Please try signing in again.",
  missing_params: "Something went wrong with the redirect. Please try again.",
  token_exchange_failed: "Could not complete sign-in with Google. Please try again.",
  profile_fetch_failed: "Could not retrieve your Google profile. Please try again.",
  server_error: "An unexpected error occurred. Please try again in a moment.",
};

function LoginContent() {
  const searchParams = useSearchParams();
  const errorCode = searchParams.get("error");
  const errorMessage = errorCode ? ERROR_MESSAGES[errorCode] || ERROR_MESSAGES.server_error : null;

  return (
    <div className="page">
      {/* Nav */}
      <nav className="nav">
        <Link href="/" className="logo" style={{ textDecoration: "none" }}>
          <img src="/logo.svg" alt="" className="logo-icon" />Auti<em>Sense</em>
        </Link>
      </nav>

      {/* Main */}
      <main
        className="main"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          maxWidth: 480,
          padding: "40px 28px 80px",
        }}
      >
        {/* Breathing orb */}
        <div className="breathe-orb" style={{ margin: "0 auto 36px" }}>
          <div className="breathe-inner">
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--sage-600)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
          </div>
        </div>

        {/* Heading */}
        <h1
          className="page-title fade fade-1"
          style={{
            fontSize: "clamp(1.6rem, 5vw, 2.2rem)",
            marginBottom: 12,
          }}
        >
          Welcome to <em>AutiSense</em>
        </h1>

        <p
          className="subtitle fade fade-2"
          style={{
            maxWidth: 380,
            margin: "0 auto 32px",
            fontSize: "0.95rem",
          }}
        >
          Sign in to access your dashboard, saved screenings, and post-diagnosis therapy games.
        </p>

        {/* Error banner */}
        {errorMessage && (
          <div
            className="fade fade-2"
            style={{
              background: "var(--peach-100)",
              border: "2px solid var(--peach-300)",
              borderRadius: "var(--r-md)",
              padding: "14px 20px",
              marginBottom: 24,
              width: "100%",
              maxWidth: 380,
              fontSize: "0.9rem",
              color: "var(--text-primary)",
              lineHeight: 1.6,
            }}
          >
            {errorMessage}
          </div>
        )}

        {/* Google sign-in button */}
        <a
          href="/api/auth/google"
          className="btn fade fade-3"
          style={{
            width: "100%",
            maxWidth: 380,
            background: "var(--card)",
            color: "var(--text-primary)",
            border: "2.5px solid var(--border)",
            gap: 12,
            marginBottom: 16,
            textDecoration: "none",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Sign in with Google
        </a>

        {/* Continue without account */}
        <Link
          href="/intake/profile"
          className="btn btn-outline fade fade-4"
          style={{
            width: "100%",
            maxWidth: 380,
            fontSize: "0.95rem",
            minHeight: 52,
            textDecoration: "none",
          }}
        >
          Continue without an account
        </Link>

        {/* Privacy note */}
        <div
          className="fade fade-5"
          style={{
            marginTop: 36,
            maxWidth: 380,
          }}
        >
          <div
            className="card"
            style={{
              padding: "20px 22px",
              textAlign: "left",
            }}
          >
            <div
              style={{
                fontFamily: "'Fredoka', sans-serif",
                fontWeight: 600,
                fontSize: "0.92rem",
                marginBottom: 10,
                color: "var(--sage-600)",
              }}
            >
              Your privacy is protected
            </div>
            <ul
              style={{
                fontSize: "0.82rem",
                color: "var(--text-secondary)",
                lineHeight: 1.8,
                paddingLeft: 18,
                margin: 0,
              }}
            >
              <li>All AI analysis runs on your device</li>
              <li>No video or audio is uploaded</li>
              <li>Google login only shares your name and email</li>
              <li>You can use AutiSense without an account</li>
            </ul>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer
        style={{
          borderTop: "2px solid var(--border)",
          padding: "24px 28px",
          textAlign: "center",
          marginTop: "auto",
        }}
      >
        <p
          style={{
            fontSize: "0.78rem",
            color: "var(--text-muted)",
            lineHeight: 1.6,
          }}
        >
          AutiSense provides autism screening summaries — not a confirmed diagnosis.
          <br />
          Always consult a qualified specialist.
        </p>
      </footer>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="page">
          <nav className="nav">
            <span className="logo">
              <img src="/logo.svg" alt="" className="logo-icon" />Auti<em>Sense</em>
            </span>
          </nav>
          <main
            className="main"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <p style={{ color: "var(--text-muted)" }}>Loading...</p>
          </main>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
