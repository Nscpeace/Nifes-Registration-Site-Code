"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "motion/react";

type SessionInfo = {
  id: string;
  name: string;
  venue: string;
  startsAt: string;
};

export default function CheckIn() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [activeSession, setActiveSession] = useState<SessionInfo | null>(null);

  useEffect(() => {
    async function loadSession() {
      try {
        const res = await fetch("/api/check-in");
        if (res.ok) {
          const data = await res.json();
          if (data.session) {
            setActiveSession(data.session);
          }
        }
      } catch {
        // graceful
      }
    }
    loadSession();
  }, []);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const form = e.currentTarget;
    const identifier = new FormData(form).get("identifier")?.toString().trim();

    try {
      const r = await fetch("/api/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier }),
      });
      const d = await r.json();
      setError(!r.ok);
      if (r.ok) {
        setMessage(`${d.message} ${d.name ? `Welcome, ${d.name}!` : ""} (${d.session || "Fellowship Gathering"})`);
        form.reset();
      } else {
        setMessage(d.error || "Check-in could not be completed.");
      }
    } catch {
      setError(true);
      setMessage("Connection error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="wrap page" style={{ minHeight: "90vh", display: "flex", flexDirection: "column", justifyContent: "flex-start", paddingTop: 30 }}>
      {/* Top Banner for Users Looking for Member Records */}
      <div
        style={{
          maxWidth: 580,
          margin: "0 auto 20px",
          width: "100%",
          background: "linear-gradient(90deg, rgba(43, 140, 238, 0.18), rgba(236, 59, 131, 0.15))",
          border: "1px solid rgba(61, 166, 245, 0.35)",
          borderRadius: 14,
          padding: "12px 18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: "1.2rem" }}>📂</span>
          <div>
            <strong style={{ fontSize: "0.9rem", color: "#f8fafc" }}>Looking for Member Records?</strong>
            <p style={{ margin: 0, fontSize: "0.78rem", color: "#94a3b8" }}>
              View full fellowship database, members list & downloads
            </p>
          </div>
        </div>
        <Link
          href="/records"
          className="button button-primary"
          style={{ padding: "6px 14px", fontSize: "0.82rem", textDecoration: "none" }}
        >
          Go to Member Records →
        </Link>
      </div>

      <div style={{ maxWidth: 580, margin: "0 auto", width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Link className="brand" href="/" style={{ display: "inline-flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <img src="/nifes-logo.jpg" alt="NIFES UNIBEN Logo" width="34" height="34" style={{ borderRadius: "50%" }} />
          <span style={{ fontWeight: 700, color: "#f8fafc" }}>← NIFES UNIBEN</span>
        </Link>
        <Link href="/records" style={{ fontSize: "0.85rem", color: "#3da6f5", textDecoration: "underline" }}>
          Member's Records Portal
        </Link>
      </div>

      <div className="formcard" style={{ maxWidth: 580, margin: "0 auto", width: "100%", padding: "32px 28px" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", padding: 2, background: "linear-gradient(135deg, #2b8cee, #ec3b83)", boxShadow: "0 6px 20px rgba(43, 140, 238, 0.3)" }}>
            <img src="/nifes-logo.jpg" alt="NIFES UNIBEN Logo" width="68" height="68" style={{ borderRadius: "50%", display: "block" }} />
          </div>
        </div>

        {/* Live Status indicator */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "4px 14px",
              borderRadius: 20,
              fontSize: "0.8rem",
              fontWeight: 600,
              background: "rgba(34, 197, 94, 0.15)",
              color: "#4ade80",
              border: "1px solid rgba(34, 197, 94, 0.35)",
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ade80", display: "inline-block", boxShadow: "0 0 8px #4ade80" }} />
            Check-In is OPEN: {activeSession?.name || "Fellowship Service"}
          </span>
        </div>

        <div className="eyebrow" style={{ textAlign: "center", display: "block" }}>Welcome to Fellowship</div>
        <h1 style={{ textAlign: "center", fontSize: "1.75rem", margin: "6px 0 8px" }}>Fellowship Check-in</h1>
        <p className="muted" style={{ textAlign: "center", marginBottom: 22, fontSize: "0.9rem" }}>
          {activeSession ? `${activeSession.name} · ${activeSession.venue}` : "FAGCOOP Multipurpose Hall · UNIBEN"}
        </p>

        {message && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className={error ? "error" : "success"}
            role="status"
            style={{ marginBottom: 18, textAlign: "center", padding: "12px 14px" }}
          >
            {message}
          </motion.div>
        )}

        <form onSubmit={submit}>
          <div className="field" style={{ marginBottom: 16 }}>
            <label htmlFor="identifier" style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>
              Registered Phone Number or Member ID
            </label>
            <input
              id="identifier"
              name="identifier"
              required
              placeholder="e.g. 08012345678 or NIFES-2026-0001"
              autoComplete="off"
              style={{ width: "100%", padding: "12px 14px", fontSize: "1rem" }}
            />
            <p style={{ margin: "6px 0 0", fontSize: "0.78rem", color: "#94a3b8" }}>
              Accepted formats: 080..., 070..., 090..., +234..., or Member ID (NIFES-2026-XXXX)
            </p>
          </div>

          <button className="button button-primary" disabled={busy} style={{ width: "100%", padding: "12px", fontSize: "1rem", marginTop: 4 }}>
            {busy ? "Checking you in…" : "Log My Attendance Now"}
          </button>
        </form>

        <div style={{ marginTop: 22, paddingTop: 18, borderTop: "1px solid rgba(255, 255, 255, 0.1)", display: "flex", flexDirection: "column", gap: 10, textAlign: "center" }}>
          <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
            New to NIFES UNIBEN?{" "}
            <Link href="/#register" style={{ color: "#3da6f5", fontWeight: 700, textDecoration: "underline" }}>
              Register here in 30 seconds
            </Link>
          </p>
          <p className="muted" style={{ margin: 0, fontSize: "0.82rem" }}>
            Need admin access?{" "}
            <Link href="/records?admin=nscpeace1@gmail.com" style={{ color: "#ec3b83", fontWeight: 700, textDecoration: "underline" }}>
              Access Member Records as Super Admin
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
