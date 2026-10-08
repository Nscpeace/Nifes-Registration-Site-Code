"use client";
import { useState } from "react";
import Link from "next/link";

export default function CheckIn() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const identifier = new FormData(e.currentTarget).get("identifier");
    try {
      const r = await fetch("/api/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier }),
      });
      const d = await r.json();
      setError(!r.ok);
      setMessage(r.ok ? `${d.message} ${d.name ? `Welcome, ${d.name}!` : ""} ${d.session ? `· ${d.session}` : ""}` : d.error);
    } catch {
      setError(true);
      setMessage("Check-in failed. Try again when you’re online.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="wrap page">
      <Link className="brand" href="/" style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
        <img src="/nifes-logo.jpg" alt="NIFES UNIBEN Logo" width="34" height="34" style={{ borderRadius: "50%" }} />
        <span>← NIFES UNIBEN</span>
      </Link>
      <form className="formcard" onSubmit={submit} style={{ maxWidth: 520, margin: "30px auto" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
          <img src="/nifes-logo.jpg" alt="NIFES UNIBEN Logo" width="70" height="70" style={{ borderRadius: "50%", boxShadow: "0 6px 20px rgba(43, 140, 238, 0.3)" }} />
        </div>
        <div className="eyebrow" style={{ textAlign: "center", display: "block" }}>Good to see you</div>
        <h1 style={{ textAlign: "center" }}>Fellowship Check-in</h1>
        <p className="muted" style={{ textAlign: "center", marginBottom: 20 }}>
          Enter your registered phone number or member ID to log your attendance.
        </p>
        {message && (
          <p className={error ? "error" : "success"} role="status" style={{ marginBottom: 16 }}>
            {message}
          </p>
        )}
        <div className="field">
          <label htmlFor="identifier">Phone number or member ID</label>
          <input
            id="identifier"
            name="identifier"
            required
            placeholder="080… or NIFES-2026-0001"
            autoComplete="off"
          />
        </div>
        <button className="button button-primary" disabled={busy} style={{ width: "100%", marginTop: 8 }}>
          {busy ? "Checking you in…" : "Check in now"}
        </button>
        <p className="muted" style={{ textAlign: "center", marginTop: 18, fontSize: "0.88rem" }}>
          New here? <Link href="/#register" style={{ color: "#3da6f5", fontWeight: 700, textDecoration: "underline" }}>Register with us</Link>
        </p>
        <p className="muted" style={{ textAlign: "center", fontSize: "0.8rem", color: "#6e8eaf" }}>
          Offline check-in is also supported through our usher scanner desk.
        </p>
      </form>
    </main>
  );
}
