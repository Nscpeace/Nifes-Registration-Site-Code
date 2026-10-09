"use client";

import { useState } from "react";

export default function RecordsSignOutButton() {
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    try {
      // 1. Send records logout request
      await fetch("/api/auth/records-logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    } catch (e) {
      console.error("Sign out error:", e);
    }

    try {
      // 2. Also notify NextAuth signout handler if available
      await fetch("/api/auth/signout", {
        method: "POST",
      }).catch(() => {});
    } catch {}

    // 3. Client-side cookie cleanup as immediate local protection
    try {
      document.cookie =
        "nifes_admin_email=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=None; Secure";
      document.cookie =
        "nifes_admin_email=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      document.cookie =
        "nifes_logged_out=1; path=/; max-age=604800; SameSite=None; Secure";
      document.cookie =
        "nifes_logged_out=1; path=/; max-age=604800";
    } catch {}

    // 4. Force browser navigation to records login screen with timestamp cache-buster
    window.location.href = `/records?login=1&t=${Date.now()}`;
  }

  return (
    <button
      className="btn ghost"
      type="button"
      disabled={loading}
      onClick={handleSignOut}
      style={{
        padding: "6px 14px",
        fontSize: "0.82rem",
        color: "#fca5a5",
        borderColor: "rgba(239, 68, 68, 0.3)",
        background: "rgba(239, 68, 68, 0.08)",
        cursor: loading ? "wait" : "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
      }}
      title="Sign out of Member Records"
    >
      {loading ? (
        <>
          <span
            style={{
              display: "inline-block",
              width: 12,
              height: 12,
              border: "2px solid #fca5a5",
              borderTopColor: "transparent",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
            }}
          />
          Signing out...
        </>
      ) : (
        <>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Sign Out
        </>
      )}
    </button>
  );
}
