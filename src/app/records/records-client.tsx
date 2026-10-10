"use client";

import { useState } from "react";
import Link from "next/link";
import MemberTable, { type Member } from "@/app/admin/members/table";

export type AttendanceItem = {
  id: string;
  memberId: string;
  memberName: string;
  memberPhone: string;
  memberEmail: string | null;
  serviceName: string;
  dayOfService: string;
  venue: string;
  checkedInAt: string;
  method: string;
};

export type AuthorizedUser = {
  id: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  invitedByEmail?: string | null;
};

export default function RecordsClient({
  members,
  attendances,
  authorizedUsers,
  currentUserEmail,
  isSuperAdmin,
  totalMembers,
  firstTimers,
}: {
  members: Member[];
  attendances: AttendanceItem[];
  authorizedUsers: AuthorizedUser[];
  currentUserEmail: string;
  isSuperAdmin: boolean;
  totalMembers: number;
  firstTimers: number;
}) {
  const [activeTab, setActiveTab] = useState<"members" | "attendance" | "access">("members");
  const [selectedDayFilter, setSelectedDayFilter] = useState<string>("ALL");
  const [usersList, setUsersList] = useState<AuthorizedUser[]>(authorizedUsers);
  const [accessMessage, setAccessMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [addingEmail, setAddingEmail] = useState(false);
  const [clearingList, setClearingList] = useState(false);

  // Filter attendance records by Day of Service lap
  const filteredAttendance = attendances.filter((att) => {
    if (selectedDayFilter === "ALL") return true;
    return att.dayOfService.toLowerCase() === selectedDayFilter.toLowerCase();
  });

  // Calculate attendance per program lap
  const lapCounts = {
    Sunday: attendances.filter((a) => a.dayOfService.toLowerCase().includes("sunday")).length,
    Tuesday: attendances.filter((a) => a.dayOfService.toLowerCase().includes("tuesday")).length,
    Friday: attendances.filter((a) => a.dayOfService.toLowerCase().includes("friday")).length,
    Saturday: attendances.filter((a) => a.dayOfService.toLowerCase().includes("sat")).length,
  };

  async function handleAddAuthorizedEmail(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAddingEmail(true);
    setAccessMessage(null);

    const form = e.currentTarget;
    const formData = new FormData(form);
    const email = formData.get("email")?.toString().trim().toLowerCase();
    const role = formData.get("role")?.toString() || "ADMIN";

    if (!email) {
      setAccessMessage({ text: "Please provide a valid email.", error: true });
      setAddingEmail(false);
      return;
    }

    try {
      const res = await fetch("/api/admin/access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Email": currentUserEmail,
        },
        body: JSON.stringify({ email, role }),
      });
      const data = await res.json();

      if (res.ok) {
        setAccessMessage({
          text: `Success! ${email} is now authorized to access Member Records as ${role}. Access will remain active permanently until you revoke it.`,
          error: false,
        });
        setUsersList((prev) => [
          ...prev.filter((u) => u.email.toLowerCase() !== email.toLowerCase()),
          {
            id: data.id || `admin_${Date.now()}`,
            email,
            role,
            status: "ACTIVE",
            createdAt: new Date().toLocaleDateString(),
            invitedByEmail: currentUserEmail,
          },
        ]);
        form.reset();
      } else {
        setAccessMessage({
          text: data.error || "Could not authorize this email.",
          error: true,
        });
      }
    } catch {
      setAccessMessage({ text: "Failed to connect. Please try again.", error: true });
    } finally {
      setAddingEmail(false);
    }
  }

  async function handleRemoveAccess(email: string) {
    const norm = email.toLowerCase();
    if (norm === "nscpeace1@gmail.com") {
      alert("Main Super Admin nscpeace1@gmail.com cannot be removed.");
      return;
    }

    if (!confirm(`Are you sure you want to revoke access for ${email}?`)) {
      return;
    }

    try {
      const res = await fetch("/api/admin/access", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Email": currentUserEmail,
        },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        setUsersList((prev) => prev.filter((u) => u.email.toLowerCase() !== norm));
        setAccessMessage({ text: `Access for ${email} has been revoked successfully.`, error: false });
      } else {
        const data = await res.json().catch(() => ({}));
        setAccessMessage({ text: data.error || "Could not remove access.", error: true });
      }
    } catch {
      setAccessMessage({ text: "Network error removing access.", error: true });
    }
  }

  return (
    <div>
      {/* KPI Metric Badges */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <div className="glass" style={{ padding: "16px 18px", borderRadius: 14 }}>
          <small className="muted" style={{ display: "block", textTransform: "uppercase", fontSize: "0.72rem", letterSpacing: "0.05em" }}>
            Total Registered Members
          </small>
          <strong style={{ fontSize: "1.75rem", color: "#f8fafc" }}>{totalMembers}</strong>
        </div>

        <div className="glass" style={{ padding: "16px 18px", borderRadius: 14 }}>
          <small className="muted" style={{ display: "block", textTransform: "uppercase", fontSize: "0.72rem", letterSpacing: "0.05em" }}>
            First Timers
          </small>
          <strong style={{ fontSize: "1.75rem", color: "#ec3b83" }}>{firstTimers}</strong>
        </div>

        <div className="glass" style={{ padding: "16px 18px", borderRadius: 14 }}>
          <small className="muted" style={{ display: "block", textTransform: "uppercase", fontSize: "0.72rem", letterSpacing: "0.05em" }}>
            Total Check-ins Logged
          </small>
          <strong style={{ fontSize: "1.75rem", color: "#4ade80" }}>{attendances.length}</strong>
        </div>

        <div className="glass" style={{ padding: "16px 18px", borderRadius: 14 }}>
          <small className="muted" style={{ display: "block", textTransform: "uppercase", fontSize: "0.72rem", letterSpacing: "0.05em" }}>
            Authorized Admins
          </small>
          <strong style={{ fontSize: "1.75rem", color: "#3da6f5" }}>{usersList.length}</strong>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid rgba(255, 255, 255, 0.12)",
          marginBottom: 20,
          gap: 6,
          overflowX: "auto",
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab("members")}
          style={{
            padding: "12px 18px",
            background: "transparent",
            border: "none",
            borderBottom: activeTab === "members" ? "3px solid #3da6f5" : "3px solid transparent",
            color: activeTab === "members" ? "#ffffff" : "#94a3b8",
            fontWeight: activeTab === "members" ? 700 : 500,
            fontSize: "0.95rem",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span>👥</span> Member Directory ({members.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("attendance")}
          style={{
            padding: "12px 18px",
            background: "transparent",
            border: "none",
            borderBottom: activeTab === "attendance" ? "3px solid #3da6f5" : "3px solid transparent",
            color: activeTab === "attendance" ? "#ffffff" : "#94a3b8",
            fontWeight: activeTab === "attendance" ? 700 : 500,
            fontSize: "0.95rem",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span>🗓️</span> Check-In Laps & Day of Service ({attendances.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("access")}
          style={{
            padding: "12px 18px",
            background: "transparent",
            border: "none",
            borderBottom: activeTab === "access" ? "3px solid #3da6f5" : "3px solid transparent",
            color: activeTab === "access" ? "#ffffff" : "#94a3b8",
            fontWeight: activeTab === "access" ? 700 : 500,
            fontSize: "0.95rem",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span>🛡️</span> Authorized Admin Emails ({usersList.length})
        </button>
      </div>

      {/* TAB 1: MEMBERS DIRECTORY */}
      {activeTab === "members" && (
        <section>
          <MemberTable rows={members} adminEmail={currentUserEmail} />
        </section>
      )}

      {/* TAB 2: ATTENDANCE LAPS BY DAY OF SERVICE */}
      {activeTab === "attendance" && (
        <section>
          {/* Day of Service Lap Quick Filters */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setSelectedDayFilter("ALL")}
                className={`btn ${selectedDayFilter === "ALL" ? "btn-primary" : "ghost"}`}
                style={{ padding: "6px 14px", fontSize: "0.82rem" }}
              >
                All Days ({attendances.length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedDayFilter("Sunday")}
                className={`btn ${selectedDayFilter === "Sunday" ? "btn-primary" : "ghost"}`}
                style={{ padding: "6px 14px", fontSize: "0.82rem" }}
              >
                🔵 Sunday Laps ({lapCounts.Sunday})
              </button>
              <button
                type="button"
                onClick={() => setSelectedDayFilter("Tuesday")}
                className={`btn ${selectedDayFilter === "Tuesday" ? "btn-primary" : "ghost"}`}
                style={{ padding: "6px 14px", fontSize: "0.82rem" }}
              >
                🟡 Tuesday Prayer ({lapCounts.Tuesday})
              </button>
              <button
                type="button"
                onClick={() => setSelectedDayFilter("Friday")}
                className={`btn ${selectedDayFilter === "Friday" ? "btn-primary" : "ghost"}`}
                style={{ padding: "6px 14px", fontSize: "0.82rem" }}
              >
                🔴 Friday Bible Study ({lapCounts.Friday})
              </button>
              <button
                type="button"
                onClick={() => setSelectedDayFilter("Saturday")}
                className={`btn ${selectedDayFilter === "Saturday" ? "btn-primary" : "ghost"}`}
                style={{ padding: "6px 14px", fontSize: "0.82rem" }}
              >
                🟣 Saturday Evangelism ({lapCounts.Saturday})
              </button>
            </div>

            <a
              className="button button-secondary"
              href={`/api/admin/export?type=attendance&admin=${encodeURIComponent(currentUserEmail)}`}
              download
              style={{ fontSize: "0.82rem", padding: "6px 14px" }}
            >
              📊 Export Attendance CSV
            </a>
          </div>

          <div className="glass" style={{ overflowX: "auto", borderRadius: 14 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Member Name / ID</th>
                  <th>Contact</th>
                  <th>Service Lap (Program Schedule)</th>
                  <th>Day of Service</th>
                  <th>Venue</th>
                  <th>Checked In At</th>
                  <th>Method</th>
                </tr>
              </thead>
              <tbody>
                {filteredAttendance.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "30px", color: "#94a3b8" }}>
                      No check-in records found for this program lap.
                    </td>
                  </tr>
                ) : (
                  filteredAttendance.map((att) => {
                    const isSunday = att.dayOfService.toLowerCase().includes("sun");
                    const isTuesday = att.dayOfService.toLowerCase().includes("tue");
                    const isFriday = att.dayOfService.toLowerCase().includes("fri");
                    const badgeColor = isSunday
                      ? "#2b8cee"
                      : isTuesday
                      ? "#f59e0b"
                      : isFriday
                      ? "#f43f5e"
                      : "#8b5cf6";

                    return (
                      <tr key={att.id}>
                        <td>
                          <strong>{att.memberName}</strong>
                          <small style={{ display: "block", color: "#85aed3", fontFamily: "monospace" }}>
                            {att.memberId}
                          </small>
                        </td>
                        <td>
                          <div>{att.memberPhone}</div>
                          {att.memberEmail && (
                            <small style={{ color: "#94a3b8" }}>{att.memberEmail}</small>
                          )}
                        </td>
                        <td>
                          <strong style={{ color: "#f8fafc" }}>{att.serviceName}</strong>
                        </td>
                        <td>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "2px 8px",
                              borderRadius: 12,
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              background: `${badgeColor}22`,
                              color: badgeColor,
                              border: `1px solid ${badgeColor}44`,
                            }}
                          >
                            {att.dayOfService} Lap
                          </span>
                        </td>
                        <td>
                          <small style={{ color: "#94a3b8" }}>{att.venue}</small>
                        </td>
                        <td>
                          <div>{new Date(att.checkedInAt).toLocaleDateString()}</div>
                          <small style={{ color: "#94a3b8" }}>
                            {new Date(att.checkedInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </small>
                        </td>
                        <td>
                          <span className="pill" style={{ fontSize: "0.72rem" }}>
                            {att.method}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 3: AUTHORIZED ADMIN EMAILS MANAGEMENT */}
      {activeTab === "access" && (
        <section>
          <div
            style={{
              background: "rgba(43, 140, 238, 0.08)",
              border: "1px solid rgba(61, 166, 245, 0.25)",
              borderRadius: 14,
              padding: "20px",
              marginBottom: 24,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14, marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, maxWidth: 640 }}>
                <span style={{ fontSize: "1.3rem" }}>🛡️</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700, color: "#f8fafc" }}>
                    Authorized Member Records Access
                  </h3>
                  <p style={{ margin: "2px 0 0", fontSize: "0.85rem", color: "#94a3b8" }}>
                    Only verified administrators have access to the member records database. Every email authorized below stays permanently authorized until explicitly revoked.
                  </p>
                </div>
              </div>
            </div>

            {/* Authorize New Email Form */}
            <form
              onSubmit={handleAddAuthorizedEmail}
              style={{
                marginTop: 18,
                paddingTop: 16,
                borderTop: "1px solid rgba(255, 255, 255, 0.1)",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr)) 160px",
                gap: 12,
                alignItems: "flex-end",
              }}
            >
              <div className="field">
                <label htmlFor="new-admin-email" style={{ fontSize: "0.82rem", fontWeight: 600 }}>
                  Email to Authorize
                </label>
                <input
                  id="new-admin-email"
                  name="email"
                  type="email"
                  required
                  placeholder="e.g. colleague@gmail.com"
                  style={{ width: "100%", padding: "10px 12px" }}
                />
              </div>

              <div className="field">
                <label htmlFor="admin-role" style={{ fontSize: "0.82rem", fontWeight: 600 }}>
                  Role Permission
                </label>
                <select id="admin-role" name="role" className="dropdown-animated" defaultValue="ADMIN">
                  <option value="ADMIN">Admin (Full Records Access)</option>
                  <option value="SUPER_ADMIN">Super Admin (All Permissions)</option>
                  <option value="USHER">Usher (Check-in Scanner)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={addingEmail}
                className="button button-primary"
                style={{ padding: "11px 16px", fontSize: "0.88rem", fontWeight: 700, whiteSpace: "nowrap" }}
              >
                {addingEmail ? "Authorizing…" : "+ Authorize Email"}
              </button>
            </form>

            {accessMessage && (
              <div
                className={accessMessage.error ? "error" : "success"}
                role="status"
                style={{ marginTop: 14, padding: "10px 14px", borderRadius: 8, fontSize: "0.85rem" }}
              >
                {accessMessage.text}
              </div>
            )}
          </div>

          {/* Authorized Users Table */}
          <div className="glass" style={{ overflowX: "auto", borderRadius: 14 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Authorized Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Authorized By</th>
                  <th>Date Added</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {usersList.map((user) => {
                  const norm = user.email.toLowerCase();
                  const isOwner = norm === "nscpeace1@gmail.com";
                  return (
                    <tr key={user.id || user.email}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {isOwner ? "👑" : "🛡️"}
                          <strong>{user.email}</strong>
                          {isOwner && (
                            <span
                              style={{
                                fontSize: "0.7rem",
                                background: "#f59e0b",
                                color: "#000",
                                padding: "2px 6px",
                                borderRadius: 10,
                                fontWeight: 800,
                              }}
                            >
                              SUPER ADMIN OWNER
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className={`pill ${isOwner ? "blue" : ""}`} style={{ fontSize: "0.75rem" }}>
                          {user.role}
                        </span>
                      </td>
                      <td>
                        <span style={{ color: "#4ade80", fontSize: "0.8rem", fontWeight: 600 }}>
                          ● {user.status}
                        </span>
                      </td>
                      <td>
                        <small style={{ color: "#94a3b8" }}>
                          {isOwner ? "Primary Super Admin" : user.invitedByEmail || "Super Admin"}
                        </small>
                      </td>
                      <td>
                        <small style={{ color: "#94a3b8" }}>{user.createdAt}</small>
                      </td>
                      <td>
                        {isOwner ? (
                          <span style={{ fontSize: "0.78rem", color: "#64748b" }}>Protected</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleRemoveAccess(user.email)}
                            className="btn ghost"
                            style={{ padding: "4px 10px", fontSize: "0.75rem", color: "#f43f5e" }}
                          >
                            Revoke Access
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
