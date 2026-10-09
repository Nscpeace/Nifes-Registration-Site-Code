"use client";

import { useState } from "react";
import Link from "next/link";
import { Lock, Eye, EyeOff, ShieldCheck, Mail, AlertCircle } from "lucide-react";

interface RecordsLoginCardProps {
  initialAttemptedEmail?: string;
  initialIsUnauthorized?: boolean;
}

export default function RecordsLoginCard({
  initialAttemptedEmail = "",
  initialIsUnauthorized = false,
}: RecordsLoginCardProps) {
  const [email, setEmail] = useState(initialAttemptedEmail || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorInfo, setErrorInfo] = useState<{
    type: "unauthorized" | "invalid_password" | "missing_password" | "empty" | "error";
    attempted?: string;
    message: string;
  } | null>(
    initialIsUnauthorized && initialAttemptedEmail
      ? {
          type: "unauthorized",
          attempted: initialAttemptedEmail,
          message: `${initialAttemptedEmail} has not been authorized to access Member Records.`,
        }
      : null
  );
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function handleLogin(e?: React.FormEvent) {
    if (e) e.preventDefault();

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    if (!trimmedEmail) {
      setErrorInfo({
        type: "empty",
        message: "Please enter your email address.",
      });
      return;
    }

    if (!trimmedPassword) {
      setErrorInfo({
        type: "missing_password",
        message: "Password is required to sign in.",
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
        body: JSON.stringify({
          email: trimmedEmail,
          password: trimmedPassword,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.ok) {
        setSuccessMsg(`✓ Access granted for ${data.email || trimmedEmail}. Opening Member Records...`);
        try {
          document.cookie =
            "nifes_logged_out=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=None; Secure";
          document.cookie =
            "nifes_logged_out=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        } catch {}
        // Navigate to records portal
        window.location.href = "/records";
      } else {
        if (data.error === "invalid_password" || data.error === "missing_password") {
          setErrorInfo({
            type: "invalid_password",
            message: data.message || "Incorrect password. Please enter the valid portal password.",
          });
        } else {
          const attempted = data.attempted || trimmedEmail;
          setErrorInfo({
            type: "unauthorized",
            attempted,
            message:
              data.message ||
              `${attempted} has not been authorized to access Member Records.`,
          });
        }
      }
    } catch {
      setErrorInfo({
        type: "error",
        message: "Network error during authentication. Please check your connection and try again.",
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
          maxWidth: 480,
          margin: "0 auto",
          width: "100%",
          padding: "36px 28px",
          textAlign: "center",
          borderRadius: 20,
          border: "1px solid rgba(255, 255, 255, 0.12)",
          background: "linear-gradient(180deg, rgba(30, 41, 59, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%)",
          boxShadow: "0 20px 40px -15px rgba(0, 0, 0, 0.5), 0 0 25px rgba(43, 140, 238, 0.1)",
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
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: "#3da6f5",
            fontWeight: 700,
            fontSize: "0.8rem",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            background: "rgba(61, 166, 245, 0.12)",
            padding: "4px 12px",
            borderRadius: 999,
            marginBottom: 8,
          }}
        >
          <Lock size={13} /> Authorized Access Only
        </div>

        <h1 style={{ fontSize: "1.85rem", margin: "6px 0 8px", fontWeight: 800 }}>
          Member's Records Portal
        </h1>

        <p className="muted" style={{ margin: "0 0 24px", fontSize: "0.9rem", lineHeight: 1.5 }}>
          Please sign in with your email and portal password to view member records.
        </p>

        {/* Error Alert */}
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
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <AlertCircle size={18} style={{ color: "#f87171", flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong style={{ display: "block", marginBottom: 3, color: "#fca5a5" }}>
                  {errorInfo.type === "invalid_password" || errorInfo.type === "missing_password"
                    ? "Password Error"
                    : "Access Denied"}
                </strong>
                <span style={{ color: "#fee2e2" }}>
                  {errorInfo.attempted ? (
                    <>
                      <strong>{errorInfo.attempted}</strong> has not been authorized to access Member Records.
                    </>
                  ) : (
                    errorInfo.message
                  )}
                </span>
              </div>
            </div>
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
              background: "rgba(34, 197, 94, 0.15)",
              border: "1px solid rgba(34, 197, 94, 0.4)",
              color: "#86efac",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <ShieldCheck size={18} />
            {successMsg}
          </div>
        )}

        {/* Authentication Form */}
        <form onSubmit={handleLogin} style={{ textAlign: "left", marginBottom: 20 }}>
          {/* Email input */}
          <div className="field" style={{ marginBottom: 16 }}>
            <label
              htmlFor="admin-email"
              style={{
                fontSize: "0.88rem",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 6,
                color: "#e2e8f0",
              }}
            >
              <Mail size={15} style={{ color: "#38bdf8" }} />
              Email Address <span style={{ color: "#f43f5e" }}>*</span>
            </label>
            <input
              id="admin-email"
              name="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email address"
              autoComplete="off"
              style={{
                width: "100%",
                padding: "12px 14px",
                fontSize: "0.95rem",
                borderRadius: 10,
                background: "rgba(15, 23, 42, 0.7)",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                color: "#fff",
              }}
            />
          </div>

          {/* Password input */}
          <div className="field" style={{ marginBottom: 24 }}>
            <label
              htmlFor="portal-password"
              style={{
                fontSize: "0.88rem",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 6,
                color: "#e2e8f0",
              }}
            >
              <Lock size={15} style={{ color: "#ec4899" }} />
              Password <span style={{ color: "#f43f5e" }}>*</span>
            </label>
            <div style={{ position: "relative" }}>
              <input
                id="portal-password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                autoComplete="current-password"
                style={{
                  width: "100%",
                  padding: "12px 42px 12px 14px",
                  fontSize: "0.95rem",
                  borderRadius: 10,
                  background: "rgba(15, 23, 42, 0.7)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  color: "#fff",
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? "Hide password" : "Show password"}
                style={{
                  position: "absolute",
                  right: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  color: "#94a3b8",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  padding: 4,
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Sign In Button */}
          <button
            type="submit"
            disabled={loading}
            className="button button-primary"
            style={{
              width: "100%",
              padding: "13px",
              fontSize: "1rem",
              fontWeight: 700,
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? (
              "Signing in..."
            ) : (
              <>
                <Lock size={16} /> Sign In
              </>
            )}
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
