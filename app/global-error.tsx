"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          fontFamily: "system-ui, sans-serif",
          background: "#f5f7f5",
          color: "#2d3a30",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>
          Something went wrong
        </h1>
        <p style={{ color: "#6b7c6e", marginBottom: "1.5rem", maxWidth: "400px" }}>
          An unexpected error occurred. Your data is safe — please try again.
        </p>
        {error.digest && (
          <p style={{ fontSize: "0.75rem", color: "#999", marginBottom: "1rem" }}>
            Error ID: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          style={{
            padding: "0.75rem 2rem",
            background: "#4d8058",
            color: "white",
            border: "none",
            borderRadius: "12px",
            fontSize: "1rem",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
