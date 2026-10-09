"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";

type SessionInfo = {
  id: string;
  name: string;
  dayOfService: string;
  serviceLapName?: string;
  venue: string;
  startsAt?: string;
  displayTime?: string;
};

type ProgramLap = {
  id: string;
  name: string;
  dayOfService: string;
  weekday: number;
  startTime: string;
  displayTime: string;
  venue: string;
  color: "blue" | "amber" | "coral" | "indigo";
  description: string;
  isToday: boolean;
  isDefaultToday?: boolean;
  attendeeCount: number;
};

export default function CheckInPage() {
  const [selectedLapId, setSelectedLapId] = useState<string>("sunday-service");
  const [activeSession, setActiveSession] = useState<SessionInfo | null>(null);
  const [laps, setLaps] = useState<ProgramLap[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    text: string;
    isError: boolean;
    name?: string;
    memberId?: string;
    dayOfService?: string;
    serviceLap?: string;
  } | null>(null);

  // Fetch session & program schedule laps
  useEffect(() => {
    async function loadLaps(lapId?: string) {
      try {
        const query = lapId ? `?lap=${encodeURIComponent(lapId)}` : "";
        const res = await fetch(`/api/check-in${query}`);
        if (res.ok) {
          const data = await res.json();
          if (data.laps && Array.isArray(data.laps)) {
            setLaps(data.laps);
            if (!lapId) {
              const defaultLap = data.laps.find((l: ProgramLap) => l.isDefaultToday) || data.laps[0];
              if (defaultLap) {
                setSelectedLapId(defaultLap.id);
              }
            }
          }
          if (data.session) {
            setActiveSession(data.session);
          }
        }
      } catch {
        // Fallback gracefully
      } finally {
        setLoading(false);
      }
    }

    loadLaps();
  }, []);

  // When user switches lap tab
  async function handleSelectLap(lapId: string) {
    setSelectedLapId(lapId);
    setResult(null);
    try {
      const res = await fetch(`/api/check-in?lap=${encodeURIComponent(lapId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.session) {
          setActiveSession(data.session);
        }
      }
    } catch {
      // Graceful
    }
  }

  async function submitCheckIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setResult(null);

    const form = e.currentTarget;
    const identifier = new FormData(form).get("identifier")?.toString().trim();

    try {
      const res = await fetch("/api/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, lapId: selectedLapId }),
      });
      const data = await res.json();

      if (res.ok) {
        setResult({
          text: data.message || "Check-in successful! Praise God!",
          isError: false,
          name: data.name,
          memberId: data.memberId,
          dayOfService: data.dayOfService,
          serviceLap: data.serviceLap,
        });
        form.reset();

        // Refresh attendee counts
        const refreshRes = await fetch(`/api/check-in?lap=${encodeURIComponent(selectedLapId)}`);
        if (refreshRes.ok) {
          const freshData = await refreshRes.json();
          if (freshData.laps) setLaps(freshData.laps);
        }
      } else {
        setResult({
          text: data.error || "Check-in could not be completed.",
          isError: true,
        });
      }
    } catch {
      setResult({
        text: "Connection error. Please check your internet and try again.",
        isError: true,
      });
    } finally {
      setBusy(false);
    }
  }

  const currentLap = laps.find((l) => l.id === selectedLapId) || {
    id: "sunday-service",
    name: activeSession?.name || "Sunday Service",
    dayOfService: activeSession?.dayOfService || "Sunday",
    displayTime: activeSession?.displayTime || "3:30 PM",
    venue: activeSession?.venue || "FAGCOOP Multipurpose Hall",
    color: "blue" as const,
    description: "Main weekly worship, word and fellowship celebration",
    attendeeCount: 0,
    isToday: false,
  };

  return (
    <main
      className="wrap page"
      style={{
        minHeight: "92vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-start",
        paddingTop: 24,
        paddingBottom: 40,
      }}
    >
      {/* Top Navigation */}
      <div
        style={{
          maxWidth: 680,
          margin: "0 auto 16px",
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <Link
          className="brand"
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            textDecoration: "none",
          }}
        >
          <img
            src="/nifes-logo.jpg"
            alt="NIFES UNIBEN Logo"
            width="36"
            height="36"
            style={{ borderRadius: "50%", border: "2px solid rgba(255,255,255,0.2)" }}
          />
          <div>
            <strong style={{ color: "#f8fafc", display: "block", fontSize: "0.95rem" }}>
              NIFES UNIBEN
            </strong>
            <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
              Fellowship Check-In
            </span>
          </div>
        </Link>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Link
            href="/"
            className="btn ghost"
            style={{ padding: "6px 12px", fontSize: "0.82rem" }}
          >
            ← Home
          </Link>
          <Link
            href="/records"
            className="button button-secondary"
            style={{ padding: "6px 12px", fontSize: "0.82rem", textDecoration: "none" }}
          >
            🔒 Member Records (Admin)
          </Link>
        </div>
      </div>

      {/* Main Check-In Card */}
      <div
        className="formcard"
        style={{
          maxWidth: 680,
          margin: "0 auto",
          width: "100%",
          padding: "28px 24px",
        }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <span
            className="eyebrow"
            style={{
              display: "inline-block",
              background: "rgba(43, 140, 238, 0.15)",
              color: "#3da6f5",
              padding: "4px 12px",
              borderRadius: 20,
              fontSize: "0.78rem",
              fontWeight: 700,
              marginBottom: 8,
              border: "1px solid rgba(61, 166, 245, 0.3)",
            }}
          >
            Weekly Program Schedule Check-in Laps
          </span>
          <h1 style={{ fontSize: "1.85rem", margin: "4px 0 6px", fontWeight: 800 }}>
            Fellowship Check-In Desk
          </h1>
          <p className="muted" style={{ margin: 0, fontSize: "0.92rem" }}>
            Select your day of service lap below to log attendance as scheduled.
          </p>
        </div>

        {/* Program Schedule Laps Selector */}
        <div style={{ marginBottom: 22 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Program Schedule Service Laps
            </span>
            <span style={{ fontSize: "0.78rem", color: "#3da6f5" }}>
              Tap any lap to switch service
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(115px, 1fr))",
              gap: 8,
            }}
          >
            {laps.map((lap) => {
              const isSelected = lap.id === selectedLapId;
              const accentColor =
                lap.color === "blue"
                  ? "#2b8cee"
                  : lap.color === "amber"
                  ? "#f59e0b"
                  : lap.color === "coral"
                  ? "#f43f5e"
                  : "#8b5cf6";

              return (
                <button
                  key={lap.id}
                  type="button"
                  onClick={() => handleSelectLap(lap.id)}
                  style={{
                    background: isSelected
                      ? `linear-gradient(135deg, ${accentColor}25, rgba(15, 23, 42, 0.9))`
                      : "rgba(255, 255, 255, 0.03)",
                    border: isSelected
                      ? `2px solid ${accentColor}`
                      : "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: 12,
                    padding: "10px 8px",
                    textAlign: "center",
                    cursor: "pointer",
                    position: "relative",
                    transition: "all 0.2s ease",
                    boxShadow: isSelected ? `0 4px 16px ${accentColor}33` : "none",
                  }}
                >
                  {lap.isToday && (
                    <span
                      style={{
                        position: "absolute",
                        top: -7,
                        right: 4,
                        background: "#22c55e",
                        color: "#052e16",
                        fontSize: "0.62rem",
                        fontWeight: 800,
                        padding: "1px 6px",
                        borderRadius: 10,
                        textTransform: "uppercase",
                        boxShadow: "0 2px 6px rgba(34, 197, 94, 0.4)",
                      }}
                    >
                      Today
                    </span>
                  )}

                  <div
                    style={{
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      color: isSelected ? accentColor : "#94a3b8",
                      textTransform: "uppercase",
                      letterSpacing: "0.03em",
                      marginBottom: 2,
                    }}
                  >
                    {lap.dayOfService}
                  </div>

                  <strong
                    style={{
                      display: "block",
                      fontSize: "0.82rem",
                      color: isSelected ? "#ffffff" : "#cbd5e1",
                      lineHeight: 1.2,
                      marginBottom: 4,
                    }}
                  >
                    {lap.name}
                  </strong>

                  <div style={{ fontSize: "0.7rem", color: "#64748b" }}>
                    {lap.displayTime}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Lap Banner */}
        <div
          style={{
            background: "linear-gradient(90deg, rgba(43, 140, 238, 0.12), rgba(236, 59, 131, 0.1))",
            border: "1px solid rgba(61, 166, 245, 0.35)",
            borderRadius: 14,
            padding: "14px 16px",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: "#4ade80",
                  display: "inline-block",
                  boxShadow: "0 0 8px #4ade80",
                }}
              />
              <span style={{ fontSize: "0.8rem", color: "#4ade80", fontWeight: 700 }}>
                CHECK-IN OPEN · {currentLap.dayOfService.toUpperCase()} LAP
              </span>
            </div>
            <strong style={{ fontSize: "1.1rem", color: "#f8fafc" }}>
              {currentLap.name}
            </strong>
            <p style={{ margin: "2px 0 0", fontSize: "0.82rem", color: "#94a3b8" }}>
              Day of Service: <strong style={{ color: "#3da6f5" }}>{currentLap.dayOfService}</strong> · {currentLap.displayTime} · {currentLap.venue}
            </p>
          </div>

          <div
            style={{
              background: "rgba(0, 0, 0, 0.3)",
              padding: "6px 14px",
              borderRadius: 10,
              textAlign: "center",
              border: "1px solid rgba(255, 255, 255, 0.08)",
            }}
          >
            <span style={{ fontSize: "0.7rem", color: "#94a3b8", display: "block" }}>
              Logged Attendance
            </span>
            <strong style={{ fontSize: "1.15rem", color: "#4ade80" }}>
              {currentLap.attendeeCount || 0}
            </strong>
          </div>
        </div>

        {/* Feedback Alert */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={result.isError ? "error" : "success"}
              role="status"
              style={{
                marginBottom: 20,
                padding: "14px 16px",
                borderRadius: 12,
                fontSize: "0.92rem",
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: result.name ? 4 : 0 }}>
                {result.isError ? "❌ " : "✅ "}
                {result.text}
              </div>
              {result.name && (
                <div style={{ fontSize: "0.86rem", marginTop: 4, color: "#e2e8f0" }}>
                  <span>Member: <strong>{result.name}</strong></span>
                  {result.memberId && <span> · ID: <strong>{result.memberId}</strong></span>}
                  <div style={{ marginTop: 2, fontSize: "0.82rem", color: "#38bdf8" }}>
                    Service Lap: <strong>{result.serviceLap || `${currentLap.name} (${currentLap.dayOfService})`}</strong>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Check-In Input Form */}
        <form onSubmit={submitCheckIn}>
          <div className="field" style={{ marginBottom: 18 }}>
            <label
              htmlFor="identifier"
              style={{
                display: "block",
                marginBottom: 6,
                fontWeight: 600,
                fontSize: "0.95rem",
              }}
            >
              Registered Phone Number or Member ID
            </label>
            <input
              id="identifier"
              name="identifier"
              required
              placeholder="e.g. 08012345678 or NIFES-2026-0001"
              autoComplete="off"
              style={{
                width: "100%",
                padding: "13px 14px",
                fontSize: "1.05rem",
                borderRadius: 10,
              }}
            />
            <p style={{ margin: "6px 0 0", fontSize: "0.78rem", color: "#94a3b8" }}>
              Accepts 080..., 070..., 090..., +234..., or Member ID (e.g. NIFES-2026-0001)
            </p>
          </div>

          <button
            className="button button-primary"
            disabled={busy}
            type="submit"
            style={{
              width: "100%",
              padding: "13px",
              fontSize: "1rem",
              fontWeight: 700,
              borderRadius: 10,
              boxShadow: "0 6px 20px rgba(43, 140, 238, 0.4)",
            }}
          >
            {busy
              ? "Checking you in…"
              : `Log Attendance for ${currentLap.name} (${currentLap.dayOfService}) →`}
          </button>
        </form>

        {/* Footer info & links */}
        <div
          style={{
            marginTop: 24,
            paddingTop: 18,
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10,
            fontSize: "0.85rem",
          }}
        >
          <span className="muted">
            First time at NIFES UNIBEN?{" "}
            <Link
              href="/#register"
              style={{ color: "#3da6f5", fontWeight: 700, textDecoration: "underline" }}
            >
              Register here in 30s
            </Link>
          </span>

          <Link
            href="/records"
            style={{ color: "#ec3b83", fontWeight: 600, textDecoration: "none" }}
          >
            🔒 Admin Records Portal →
          </Link>
        </div>
      </div>
    </main>
  );
}
