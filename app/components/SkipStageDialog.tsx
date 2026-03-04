"use client";
import { useState } from "react";

interface SkipStageDialogProps {
  onConfirm: () => void;
}

export default function SkipStageDialog({ onConfirm }: SkipStageDialogProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  if (!showConfirm) {
    return (
      <button
        onClick={() => setShowConfirm(true)}
        className="btn btn-outline"
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          minHeight: 36,
          padding: "6px 14px",
          fontSize: "0.8rem",
          color: "var(--text-muted)",
          zIndex: 10,
        }}
      >
        Skip Stage
      </button>
    );
  }

  return (
    <div style={{
      position: "fixed",
      top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.4)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 100,
      padding: 20,
    }}>
      <div className="card" style={{
        padding: "28px 24px",
        maxWidth: 380,
        textAlign: "center",
      }}>
        <h3 style={{
          fontFamily: "'Fredoka',sans-serif",
          fontWeight: 600,
          fontSize: "1.1rem",
          marginBottom: 10,
        }}>
          Skip this stage?
        </h3>
        <p style={{
          fontSize: "0.88rem",
          color: "var(--text-secondary)",
          lineHeight: 1.6,
          marginBottom: 20,
        }}>
          Results won't be collected for this activity.
          The screening will continue with default values.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <button
            className="btn btn-outline"
            onClick={() => setShowConfirm(false)}
            style={{ minHeight: 40, padding: "8px 20px" }}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={onConfirm}
            style={{ minHeight: 40, padding: "8px 20px" }}
          >
            Skip Stage
          </button>
        </div>
      </div>
    </div>
  );
}
