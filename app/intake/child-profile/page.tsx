"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSession } from "../../lib/db/session.repository";
import { setCurrentSessionId } from "../../lib/session/currentSession";

const STEPS = [
  "Welcome", "Profile", "Device", "Communicate", "Behavior",
  "Prepare", "Motor", "Video", "Summary", "Report",
];

const LANGUAGES = [
  "English",
  "Hindi",
  "Bengali",
  "Tamil",
  "Telugu",
  "Marathi",
  "Kannada",
  "Gujarati",
  "Punjabi",
  "Malayalam",
  "Urdu",
  "Odia",
  "Spanish",
  "Portuguese",
  "French",
  "Arabic",
  "Other",
];

type Gender = "boy" | "girl" | "other" | "";

export default function ProfilePage() {
  const router = useRouter();
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const saved = document.documentElement.getAttribute("data-theme") as
      | "light"
      | "dark"
      | null;
    if (saved) setTheme(saved);
  }, []);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
  };

  const [childName, setChildName] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState<Gender>("");
  const [language, setLanguage] = useState("");
  const [parentName, setParentName] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const getAge = () => {
    if (!dob) return null;
    const d = new Date(dob),
      now = new Date();
    const months =
      (now.getFullYear() - d.getFullYear()) * 12 +
      (now.getMonth() - d.getMonth());
    if (months < 0 || months > 216) return null;
    if (months < 24) return `${months} months old`;
    const y = Math.floor(months / 12),
      m = months % 12;
    return m > 0 ? `${y} years and ${m} months old` : `${y} years old`;
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!childName.trim()) e.childName = "Please enter your child's name";
    if (!dob) e.dob = "Please enter a date of birth";
    if (!language) e.language = "Please choose a language";
    if (!parentName.trim()) e.parentName = "Please enter your name";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    try {
      const sessionId = crypto.randomUUID();
      const d = new Date(dob);
      const now = new Date();
      const ageMonths = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
      await createSession({
        id: sessionId,
        childName: childName.trim(),
        ageMonths,
        language,
        gender: gender || "other",
      });
      setCurrentSessionId(sessionId);
    } catch (err) {
      console.error("[child-profile] Session creation error:", err);
    }
    router.push("/intake/device-check");
  };
  const age = getAge();
  const name = childName || "your child";

  const genderOpts: { value: Gender; label: string; emoji: string }[] = [
    { value: "boy", label: "Boy", emoji: "👦" },
    { value: "girl", label: "Girl", emoji: "👧" },
    { value: "other", label: "Other", emoji: "🌟" },
  ];

  return (
    <div className="page">
      <nav className="nav">
        <Link href="/" className="logo">
          <img src="/logo.svg" alt="" className="logo-icon" />Auti<em>Sense</em>
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={toggleTheme}
            className="btn btn-outline"
            style={{ minHeight: 40, padding: "8px 14px", fontSize: "0.88rem" }}
          >
            {theme === "light" ? "🌙" : "☀️"}
          </button>
          <span
            style={{
              fontSize: "0.88rem",
              color: "var(--text-muted)",
              fontWeight: 600,
            }}
          >
            Step 2 of 10
          </span>
        </div>
      </nav>

      <div className="progress-wrap">
        <div className="progress-steps">
          {STEPS.map((s, i) => (
            <div
              key={s}
              style={{
                display: "flex",
                alignItems: "center",
                flex: i < STEPS.length - 1 ? 1 : "none",
              }}
            >
              <div
                className={`step-dot ${i < 1 ? "done" : i === 1 ? "active" : "upcoming"}`}
                title={s}
              >
                {i < 1 ? "✓" : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`step-line ${i < 1 ? "done" : ""}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      <main className="main">
        <div
          className="fade fade-1"
          style={{ textAlign: "center", marginBottom: 28 }}
        >
          <div className="breathe-orb" style={{ margin: "0 auto" }}>
            <div className="breathe-inner">👶</div>
          </div>
        </div>

        <div className="chip fade fade-1">Step 2 — Child Profile</div>
        <h1 className="page-title fade fade-2">
          Tell us about <em>{childName || "your child"}</em>
        </h1>
        <p className="subtitle fade fade-2">
          This helps the autism screening adjust to {name}'s age, language, and
          background.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
          {/* Child name */}
          <div className="fade fade-3">
            <label className="label" htmlFor="childName">
              What is your child's first name?
            </label>
            <input
              id="childName"
              className={`input ${errors.childName ? "error" : ""}`}
              type="text"
              placeholder="e.g. Arjun"
              value={childName}
              onChange={(e) => {
                setChildName(e.target.value);
                setErrors((p) => ({ ...p, childName: "" }));
              }}
            />
            {errors.childName && (
              <p className="error-msg">⚠ {errors.childName}</p>
            )}
          </div>

          {/* Date of birth */}
          <div className="fade fade-3">
            <label className="label" htmlFor="dob">
              When was {name} born?
            </label>
            <input
              id="dob"
              className={`input ${errors.dob ? "error" : ""}`}
              type="date"
              max={new Date().toISOString().split("T")[0]}
              value={dob}
              onChange={(e) => {
                setDob(e.target.value);
                setErrors((p) => ({ ...p, dob: "" }));
              }}
            />
            {age && (
              <p
                style={{
                  color: "var(--sage-500)",
                  fontSize: "0.9rem",
                  marginTop: 8,
                  fontWeight: 700,
                }}
              >
                ✓ {name} is {age}
              </p>
            )}
            {errors.dob && <p className="error-msg">⚠ {errors.dob}</p>}
          </div>

          {/* Gender */}
          <div className="fade fade-3">
            <label className="label">
              Is {name} a boy or a girl?{" "}
              <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>
                (optional)
              </span>
            </label>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {genderOpts.map((opt) => (
                <div
                  key={opt.value}
                  className={`choice-card ${gender === opt.value ? "selected" : ""}`}
                  style={{ flex: "1 1 130px" }}
                  onClick={() =>
                    setGender(gender === opt.value ? "" : opt.value)
                  }
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) =>
                    e.key === "Enter" &&
                    setGender(gender === opt.value ? "" : opt.value)
                  }
                >
                  <span style={{ fontSize: "1.6rem" }}>{opt.emoji}</span>
                  <span style={{ fontWeight: 700, fontSize: "1rem" }}>
                    {opt.label}
                  </span>
                  <div className="radio-dot" style={{ marginLeft: "auto" }}>
                    {gender === opt.value ? "✓" : ""}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Language */}
          <div className="fade fade-4">
            <label className="label" htmlFor="language">
              What language does {name} hear most at home?
            </label>
            <select
              id="language"
              className={`input ${errors.language ? "error" : ""}`}
              value={language}
              onChange={(e) => {
                setLanguage(e.target.value);
                setErrors((p) => ({ ...p, language: "" }));
              }}
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%235a7060' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 16px center",
                paddingRight: 48,
                color: language ? "var(--text-primary)" : "var(--text-muted)",
              }}
            >
              <option value="" disabled>
                Choose a language…
              </option>
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
            {errors.language && (
              <p className="error-msg">⚠ {errors.language}</p>
            )}
          </div>

          {/* Previous autism-related history */}
          <div className="fade fade-4">
            <label className="label" htmlFor="history">
              Has {name} ever been assessed or diagnosed for autism?{" "}
              <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>
                (optional)
              </span>
            </label>
            <input
              id="history"
              className="input"
              type="text"
              placeholder="e.g. Speech delay, previous ADOS assessment — or leave blank"
            />
          </div>

          {/* Parent name */}
          <div className="fade fade-4">
            <label className="label" htmlFor="parentName">
              Your name (parent or caregiver)
            </label>
            <input
              id="parentName"
              className={`input ${errors.parentName ? "error" : ""}`}
              type="text"
              placeholder="e.g. Priya Sharma"
              value={parentName}
              onChange={(e) => {
                setParentName(e.target.value);
                setErrors((p) => ({ ...p, parentName: "" }));
              }}
            />
            {errors.parentName && (
              <p className="error-msg">⚠ {errors.parentName}</p>
            )}
          </div>

          {/* Navigation */}
          <div className="fade fade-5" style={{ display: "flex", gap: 12 }}>
            <Link
              href="/intake/profile"
              className="btn btn-outline"
              style={{ minWidth: 100 }}
            >
              ← Back
            </Link>
            <button className="btn btn-primary btn-full" onClick={submit}>
              Continue →
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
