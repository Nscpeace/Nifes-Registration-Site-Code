"use client";

import { useState } from "react";
import Link from "next/link";

interface RecordsLoginCardProps {
  initialAttemptedEmail?: string;
  initialIsUnauthorized?: boolean;
}

export default function RecordsLoginCard({
  initialAttemptedEmail = "",
  initialIsUnauthorized = false,
}: RecordsLoginCardProps) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorInfo, setErrorInfo] = useState<{
    type: "unauthorized" | "empty" | "error";
    attempted: string;
    message: string;
  } | null>(
    initialIsUnauthorized && initialAttemptedEmail
      ? {
          type: "unauthorized",
          attempted: initialAttemptedEmail,
          message: `${initialAttemptedEmail} has not been authorized by administrator nscpeace1@gmail.com.`,
        }
      : null
  );
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function handleVerify(targetEmail: string) {
    const trimmed = targetEmail.trim().toLowerCase();
    if (!trimmed) {
      setErrorInfo({
        type: "empty",
        attempted: "",
        message: "Please enter an email address to verify access.",
      });
      return;
    }

    setLoading(true);
    setErrorInfo(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/auth/records-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.ok) {
        setSuccessMsg(`✓ Access granted for ${trimmed}. Opening Member Records...`);
        try {
          document.cookie = "nifes_logged_out=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=None; Secure";
          document.cookie = "nifes_logged_out=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        } catch {}
        // Navigate cleanly to records
        window.location.href = "/records";
      } else {
        const attempted = data.attempted || trimmed;
        setErrorInfo({
          type: "unauthorized",
          attempted,
          message:
            data.message ||
            `${attempted} has not been authorized by administrator nscpeace1@gmail.com.`,
        });
      }
    } catch {
      setErrorInfo({
        type: "error",
        attempted: trimmed,
        message: "Network error during verification. Please check your connection and try again.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      className="wrap page"
      style={{
        minHeight: "88vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "30px 16px",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <Link
          href="/"
          className="brand"
          style={{ display: "inline-flex", alignItems: "center", gap: 10, textDecoration: "none" }}
        >
          <img
            src="/nifes-logo.jpg"
            alt="NIFES UNIBEN Logo"
            width="44"
            height="44"
            style={{ borderRadius: "50%", border: "2px solid rgba(255,255,255,0.2)" }}
          />
          <span style={{ fontWeight: 800, color: "#f8fafc", fontSize: "1.1rem" }}>
            ← NIFES UNIBEN
          </span>
        </Link>
      </div>

      <section
        className="formcard"
        style={{
          maxWidth: 520,
          margin: "0 auto",
          width: "100%",
          padding: "36px 28px",
          textAlign: "center",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <div
            style={{
              width: 76,
              height: 76,
              borderRadius: "50%",
              padding: 3,
              background: "linear-gradient(135deg, #2b8cee, #ec3b83)",
              boxShadow: "0 8px 24px rgba(43, 140, 238, 0.35)",
            }}
          >
            <img
              src="/nifes-logo.jpg"
              alt="NIFES UNIBEN Logo"
              width="70"
              height="70"
              style={{ borderRadius: "50%", display: "block" }}
            />
          </div>
        </div>

        <div
          className="eyebrow"
          style={{
            color: "#3da6f5",
            fontWeight: 700,
            fontSize: "0.8rem",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Authorized Access Only
        </div>
        <h1 style={{ fontSize: "1.85rem", margin: "6px 0 8px", fontWeight: 800 }}>
          Member's Records Portal
        </h1>
        <p className="muted" style={{ margin: "0 0 20px", fontSize: "0.9rem", lineHeight: 1.5 }}>
          Access to member records is strictly restricted to administrator{" "}
          <strong style={{ color: "#3da6f5" }}>nscpeace1@gmail.com</strong> and emails he authorizes.
        </p>

        {/* Quick Administrator Access Card */}
        <div
          style={{
            background: "rgba(43, 140, 238, 0.12)",
            border: "1.5px solid rgba(43, 140, 238, 0.35)",
            borderRadius: 14,
            padding: "16px 18px",
            marginBottom: 20,
            textAlign: "left",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: "1.3rem" }}>👑</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#93c5fd" }}>
                Primary Administrator
              </div>
              <div style={{ fontSize: "0.82rem", color: "#cbd5e1" }}>
                Official Admin: <strong>nscpeace1@gmail.com</strong>
              </div>
            </div>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={() => handleVerify("nscpeace1@gmail.com")}
            className="button button-primary"
            style={{
              width: "100%",
              padding: "11px",
              fontSize: "0.94rem",
              fontWeight: 700,
              borderRadius: 10,
              marginTop: 4,
            }}
          >
            {loading ? "Verifying..." : "🔐 Sign In as Admin (nscpeace1@gmail.com)"}
          </button>
        </div>

        {/* Access Denied Alert if unauthorized */}
        {errorInfo && (
          <div
            className="error"
            role="alert"
            style={{
              marginBottom: 20,
              padding: "14px 16px",
              borderRadius: 12,
              textAlign: "left",
              fontSize: "0.88rem",
              background: "rgba(239, 68, 68, 0.15)",
              border: "1px solid rgba(239, 68, 68, 0.4)",
            }}
          >
            <strong style={{ display: "block", marginBottom: 4, color: "#fca5a5" }}>
              ⛔ Access Denied
            </strong>
            <span style={{ color: "#fee2e2" }}>
              {errorInfo.attempted ? (
                <>
                  <strong>{errorInfo.attempted}</strong> has not been authorized by administrator{" "}
                  <strong>nscpeace1@gmail.com</strong>.
                </>
              ) : (
                errorInfo.message
              )}
            </span>
            <p style={{ margin: "8px 0 0", fontSize: "0.8rem", color: "#fca5a5" }}>
              Only <strong>nscpeace1@gmail.com</strong> and emails he explicitly authorizes can view
              Member Records. If you need access, ask the admin to grant your email permission.
            </p>
          </div>
        )}

        {/* Success Alert */}
        {successMsg && (
          <div
            className="success"
            role="status"
            style={{
              marginBottom: 20,
              padding: "14px 16px",
              borderRadius: 12,
              textAlign: "left",
              fontSize: "0.88rem",
            }}
          >
            {successMsg}
          </div>
        )}

        {/* Email verification input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleVerify(email);
          }}
          style={{ textAlign: "left", marginBottom: 20 }}
        >
          <div className="field" style={{ marginBottom: 14 }}>
            <label
              htmlFor="admin-email"
              style={{
                fontSize: "0.88rem",
                fontWeight: 600,
                display: "block",
                marginBottom: 6,
              }}
            >
              Or enter your authorized email address:
            </label>
            <input
              id="admin-email"
              name="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. nscpeace1@gmail.com or authorized email"
              autoComplete="email"
              style={{
                width: "100%",
                padding: "12px 14px",
                fontSize: "1rem",
                borderRadius: 10,
              }}
            />
            <p style={{ margin: "6px 0 0", fontSize: "0.76rem", color: "#94a3b8" }}>
              Must be <strong>nscpeace1@gmail.com</strong> or an email authorized by him.
            </p>
          </div>

          <button
            className="btn ghost"
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px",
              fontSize: "0.95rem",
              fontWeight: 700,
              borderRadius: 10,
              border: "1px solid rgba(255, 255, 255, 0.2)",
            }}
          >
            {loading ? "Checking Authorization..." : "Verify & Access Member Records →"}
          </button>
        </form>

        <div
          style={{
            borderTop: "1px solid rgba(255, 255, 255, 0.1)",
            paddingTop: 16,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: "0.82rem",
          }}
        >
          <Link href="/check-in" style={{ color: "#3da6f5", textDecoration: "underline" }}>
            ← Fellowship Check-in
          </Link>
          <Link href="/#register" style={{ color: "#ec3b83", textDecoration: "underline" }}>
            Register as Member →
          </Link>
        </div>
      </section>
    </main>
  );
}
