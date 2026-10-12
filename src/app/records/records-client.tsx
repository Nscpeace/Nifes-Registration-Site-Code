"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import MemberTable, { type Member } from "@/app/admin/members/table";

export type ServiceSessionItem = {
  id: string;
  eventId: string;
  name: string;
  dayOfService: string;
  startsAt: string;
  endsAt?: string | null;
  venue: string;
  active: boolean;
};

export type AttendanceItem = {
  id: string;
  memberId: string;
  memberDbId?: string;
  sessionId?: string;
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
  sessions,
  attendances: initialAttendances,
  authorizedUsers,
  currentUserEmail,
  isSuperAdmin,
  totalMembers,
  firstTimers,
}: {
  members: Member[];
  sessions: ServiceSessionItem[];
  attendances: AttendanceItem[];
  authorizedUsers: AuthorizedUser[];
  currentUserEmail: string;
  isSuperAdmin: boolean;
  totalMembers: number;
  firstTimers: number;
}) {
  const [activeTab, setActiveTab] = useState<"members" | "attendance" | "access">("attendance");
  const [attendances, setAttendances] = useState<AttendanceItem[]>(initialAttendances);
  const [usersList, setUsersList] = useState<AuthorizedUser[]>(authorizedUsers);
  const [accessMessage, setAccessMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [addingEmail, setAddingEmail] = useState(false);
  const [pendingRevokeEmail, setPendingRevokeEmail] = useState<string | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  // Attendance & Absent Tracking State
  const defaultSessionId = sessions[0]?.id || "ed785e90-592d-4a6c-950d-c4dd61e6d00c";
  const [selectedSessionId, setSelectedSessionId] = useState<string>(defaultSessionId);
  const [selectedDayCategory, setSelectedDayCategory] = useState<string>("ALL");
  const [attendanceSubView, setAttendanceSubView] = useState<"absent" | "present" | "matrix">("absent");
  const [absentSearchQuery, setAbsentSearchQuery] = useState("");
  const [absentFilterType, setAbsentFilterType] = useState<"ALL" | "FIRST_TIMERS" | "L100" | "L200" | "L300" | "L400" | "L500" | "RESIDENCE">("ALL");
  const [selectedResidenceFilter, setSelectedResidenceFilter] = useState<string>("ALL");
  const [actionNotice, setActionNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  const [copiedPhones, setCopiedPhones] = useState(false);

  // Filter available sessions by Day category
  const filteredSessions = useMemo(() => {
    if (selectedDayCategory === "ALL") return sessions;
    return sessions.filter((s) => s.dayOfService.toLowerCase().includes(selectedDayCategory.toLowerCase()));
  }, [sessions, selectedDayCategory]);

  // Current active session
  const currentSession = useMemo(() => {
    return sessions.find((s) => s.id === selectedSessionId) || sessions[0] || null;
  }, [sessions, selectedSessionId]);

  // Set of member IDs (or memberDbIds) who attended the current selected session
  const attendedMemberKeys = useMemo(() => {
    if (!currentSession) return new Set<string>();
    const keys = new Set<string>();
    attendances.forEach((a) => {
      if (a.sessionId === currentSession.id || a.serviceName.toLowerCase() === currentSession.name.toLowerCase()) {
        if (a.memberDbId) keys.add(a.memberDbId);
        if (a.memberId) keys.add(a.memberId.toUpperCase());
      }
    });
    return keys;
  }, [attendances, currentSession]);

  // Present members for the active session
  const presentMembers = useMemo(() => {
    if (!currentSession) return [];
    return members.filter((m) => !m.guest && (attendedMemberKeys.has(m.id) || attendedMemberKeys.has(m.memberId.toUpperCase())));
  }, [members, currentSession, attendedMemberKeys]);

  // Absent members for the active session (The Core Compilation Feature)
  const allAbsentMembers = useMemo(() => {
    if (!currentSession) return [];
    return members.filter((m) => !m.guest && !attendedMemberKeys.has(m.id) && !attendedMemberKeys.has(m.memberId.toUpperCase()));
  }, [members, currentSession, attendedMemberKeys]);

  // Filtered absent members based on user search & filter selection
  const filteredAbsentMembers = useMemo(() => {
    return allAbsentMembers.filter((m) => {
      // Search text match
      const q = absentSearchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        `${m.firstName} ${m.lastName}`.toLowerCase().includes(q) ||
        m.phone.toLowerCase().includes(q) ||
        (m.email || "").toLowerCase().includes(q) ||
        m.memberId.toLowerCase().includes(q) ||
        (m.placeOfResidence || "").toLowerCase().includes(q) ||
        (m.level || "").toLowerCase().includes(q);

      if (!matchQuery) return false;

      // Filter by type
      if (absentFilterType === "FIRST_TIMERS") return m.firstTimer;
      if (absentFilterType === "L100") return m.level === "L100";
      if (absentFilterType === "L200") return m.level === "L200";
      if (absentFilterType === "L300") return m.level === "L300";
      if (absentFilterType === "L400") return m.level === "L400";
      if (absentFilterType === "L500") return m.level === "L500";
      if (absentFilterType === "RESIDENCE" && selectedResidenceFilter !== "ALL") {
        return (m.placeOfResidence || "").toLowerCase() === selectedResidenceFilter.toLowerCase();
      }

      return true;
    });
  }, [allAbsentMembers, absentSearchQuery, absentFilterType, selectedResidenceFilter]);

  // Statistics for the active session
  const activeSessionStats = useMemo(() => {
    const totalEligible = members.filter((m) => !m.guest).length || 1;
    const presentCount = presentMembers.length;
    const absentCount = allAbsentMembers.length;
    const turnoutRate = Math.round((presentCount / totalEligible) * 100);
    const absenteeRate = Math.round((absentCount / totalEligible) * 100);
    const firstTimersAbsent = allAbsentMembers.filter((m) => m.firstTimer).length;
    const firstTimersPresent = presentMembers.filter((m) => m.firstTimer).length;

    return {
      totalEligible,
      presentCount,
      absentCount,
      turnoutRate,
      absenteeRate,
      firstTimersAbsent,
      firstTimersPresent,
    };
  }, [members, presentMembers, allAbsentMembers]);

  // Cross-Service Consistency Matrix Data
  const crossServiceMatrix = useMemo(() => {
    const registered = members.filter((m) => !m.guest);
    return registered.map((member) => {
      let attendedCount = 0;
      const statusPerSession: Record<string, boolean> = {};

      sessions.forEach((s) => {
        const didAttend = attendances.some(
          (a) =>
            (a.sessionId === s.id || a.serviceName.toLowerCase() === s.name.toLowerCase()) &&
            (a.memberDbId === member.id || a.memberId.toUpperCase() === member.memberId.toUpperCase())
        );
        statusPerSession[s.id] = didAttend;
        if (didAttend) attendedCount++;
      });

      const totalCount = sessions.length || 1;
      const attendancePercent = Math.round((attendedCount / totalCount) * 100);

      return {
        member,
        attendedCount,
        totalCount,
        attendancePercent,
        statusPerSession,
      };
    });
  }, [members, sessions, attendances]);

  // Manual Check-in or Removal
  async function handleToggleAttendance(memberId: string, memberName: string, action: "checkin" | "remove") {
    if (!currentSession) return;
    setUpdatingMemberId(memberId);
    setActionNotice(null);

    try {
      const res = await fetch("/api/admin/attendance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Email": currentUserEmail,
        },
        body: JSON.stringify({
          memberId,
          sessionId: currentSession.id,
          action,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        if (action === "checkin") {
          const targetMember = members.find((m) => m.id === memberId || m.memberId.toUpperCase() === memberId.toUpperCase());
          const newAtt: AttendanceItem = {
            id: data.attendance?.id || `att_manual_${Date.now()}`,
            memberId: targetMember?.memberId || memberId,
            memberDbId: targetMember?.id || memberId,
            sessionId: currentSession.id,
            memberName: targetMember ? `${targetMember.firstName} ${targetMember.lastName}` : memberName,
            memberPhone: targetMember?.phone || "—",
            memberEmail: targetMember?.email ?? null,
            serviceName: currentSession.name,
            dayOfService: currentSession.dayOfService,
            venue: currentSession.venue,
            checkedInAt: new Date().toISOString(),
            method: "ADMIN_MANUAL",
          };
          setAttendances((prev) => [newAtt, ...prev.filter((a) => !(a.sessionId === currentSession.id && (a.memberDbId === memberId || a.memberId === memberId)))]);
          setActionNotice({ text: `✓ ${memberName} successfully marked as present for ${currentSession.name}!`, error: false });
        } else {
          setAttendances((prev) => prev.filter((a) => !(a.sessionId === currentSession.id && (a.memberDbId === memberId || a.memberId === memberId))));
          setActionNotice({ text: `Removed attendance record for ${memberName}.`, error: false });
        }
      } else {
        setActionNotice({ text: data.error || "Failed to update attendance.", error: true });
      }
    } catch {
      setActionNotice({ text: "Network error updating attendance.", error: true });
    } finally {
      setUpdatingMemberId(null);
    }
  }

  // Copy all absent phone numbers for group messaging
  function handleCopyAbsentPhones() {
    const phones = filteredAbsentMembers.map((m) => m.phone).filter(Boolean);
    if (!phones.length) return;
    const phoneString = phones.join(", ");
    navigator.clipboard.writeText(phoneString);
    setCopiedPhones(true);
    setTimeout(() => setCopiedPhones(false), 3000);
  }

  // Pre-filled WhatsApp message helper
  function getWhatsAppOutreachUrl(phone: string, firstName: string, serviceName: string, dayOfService: string) {
    const cleanPhone = phone.replace(/[^\d]/g, "");
    const greeting = `Hello ${firstName}! We missed having you with us at NIFES UNIBEN ${serviceName} (${dayOfService}). Hope you're doing well and having a blessed week! Feel free to reach out if you need anything. God bless you! 🙏`;
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(greeting)}`;
  }

  // Access Management: Authorize Email
  async function handleAddAuthorizedEmail(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAddingEmail(true);
    setAccessMessage(null);

    const form = e.currentTarget;
    const formData = new FormData(form);
    const email = formData.get("email")?.toString().trim().toLowerCase();
    const role = formData.get("role")?.toString() || "ADMIN";

    if (!isSuperAdmin) {
      setAccessMessage({ text: "Permission denied: Only the Super Admin can authorize accounts or grant access.", error: true });
      setAddingEmail(false);
      return;
    }

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
          text: `Success! ${email} is now authorized to access Member Records as ${role}. Access will remain active permanently until revoked.`,
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
        setAccessMessage({ text: data.error || "Could not authorize this email.", error: true });
      }
    } catch {
      setAccessMessage({ text: "Failed to connect. Please try again.", error: true });
    } finally {
      setAddingEmail(false);
    }
  }

  // Access Management: Revoke Email
  async function handleRemoveAccess(email: string) {
    if (!isSuperAdmin) {
      setAccessMessage({ text: "Permission denied: Only the Super Admin can revoke access.", error: true });
      setPendingRevokeEmail(null);
      return;
    }

    const norm = email.toLowerCase();
    if (norm === "nscpeace1@gmail.com") {
      setAccessMessage({ text: "Super Admin Owner nscpeace1@gmail.com cannot be removed.", error: true });
      setPendingRevokeEmail(null);
      return;
    }

    setIsRevoking(true);
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
    } finally {
      setIsRevoking(false);
      setPendingRevokeEmail(null);
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
            First Timers Registered
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
          <span>🗓️</span> Day of Service Attendance & Absentee Tracker ({attendances.length})
        </button>

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

      {/* TAB 2: DAY OF SERVICE ATTENDANCE & ABSENTEE TRACKING (THE MAIN FEATURE) */}
      {activeTab === "attendance" && (
        <section>
          {/* Day Category Quick Bar */}
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
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: "0.82rem", color: "#94a3b8", fontWeight: 600 }}>Filter by Day:</span>
              <button
                type="button"
                onClick={() => setSelectedDayCategory("ALL")}
                className={`btn ${selectedDayCategory === "ALL" ? "btn-primary" : "ghost"}`}
                style={{ padding: "5px 12px", fontSize: "0.8rem" }}
              >
                All Days ({sessions.length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedDayCategory("Sunday")}
                className={`btn ${selectedDayCategory === "Sunday" ? "btn-primary" : "ghost"}`}
                style={{ padding: "5px 12px", fontSize: "0.8rem" }}
              >
                🔵 Sunday Services
              </button>
              <button
                type="button"
                onClick={() => setSelectedDayCategory("Tuesday")}
                className={`btn ${selectedDayCategory === "Tuesday" ? "btn-primary" : "ghost"}`}
                style={{ padding: "5px 12px", fontSize: "0.8rem" }}
              >
                🟡 Tuesday Prayer
              </button>
              <button
                type="button"
                onClick={() => setSelectedDayCategory("Friday")}
                className={`btn ${selectedDayCategory === "Friday" ? "btn-primary" : "ghost"}`}
                style={{ padding: "5px 12px", fontSize: "0.8rem" }}
              >
                🔴 Friday Bible Study
              </button>
              <button
                type="button"
                onClick={() => setSelectedDayCategory("Saturday")}
                className={`btn ${selectedDayCategory === "Saturday" ? "btn-primary" : "ghost"}`}
                style={{ padding: "5px 12px", fontSize: "0.8rem" }}
              >
                🟣 Saturday Evangelism
              </button>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              {currentSession && (
                <a
                  className="button button-primary"
                  href={`/api/admin/export?type=absent&sessionId=${currentSession.id}&admin=${encodeURIComponent(currentUserEmail)}`}
                  download
                  style={{ fontSize: "0.82rem", padding: "6px 14px", background: "#f43f5e", borderColor: "#f43f5e" }}
                >
                  📥 Export Absent List (CSV)
                </a>
              )}
              <a
                className="button button-secondary"
                href={`/api/admin/export?type=attendance&admin=${encodeURIComponent(currentUserEmail)}`}
                download
                style={{ fontSize: "0.82rem", padding: "6px 14px" }}
              >
                📊 Export All Attendance CSV
              </a>
            </div>
          </div>

          {/* Service Session Cards Selector */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 10,
              marginBottom: 20,
            }}
          >
            {filteredSessions.map((s) => {
              const isSelected = currentSession?.id === s.id;
              // Calculate counts for this session card
              const attendeesForThisSession = attendances.filter(
                (a) => a.sessionId === s.id || a.serviceName.toLowerCase() === s.name.toLowerCase()
              ).length;
              const absentForThisSession = Math.max(0, totalMembers - attendeesForThisSession);
              const rate = Math.round((attendeesForThisSession / (totalMembers || 1)) * 100);

              const isSun = s.dayOfService.toLowerCase().includes("sun");
              const isTue = s.dayOfService.toLowerCase().includes("tue");
              const isFri = s.dayOfService.toLowerCase().includes("fri");
              const accentColor = isSun ? "#38bdf8" : isTue ? "#f59e0b" : isFri ? "#f43f5e" : "#a855f7";

              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedSessionId(s.id)}
                  style={{
                    padding: "14px 16px",
                    borderRadius: 12,
                    textAlign: "left",
                    cursor: "pointer",
                    background: isSelected ? "rgba(43, 140, 238, 0.18)" : "rgba(255, 255, 255, 0.03)",
                    border: isSelected ? `2px solid ${accentColor}` : "1px solid rgba(255, 255, 255, 0.08)",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span
                      style={{
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        color: accentColor,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      {s.dayOfService} Lap
                    </span>
                    <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                      {new Date(s.startsAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                    </span>
                  </div>

                  <strong style={{ display: "block", fontSize: "1rem", color: "#f8fafc", marginBottom: 6 }}>
                    {s.name}
                  </strong>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.78rem" }}>
                    <span style={{ color: "#4ade80", fontWeight: 600 }}>
                      ✓ {attendeesForThisSession} Present ({rate}%)
                    </span>
                    <span style={{ color: "#f87171", fontWeight: 600 }}>
                      ✗ {absentForThisSession} Absent
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Session Detailed Analytics Banner */}
          {currentSession && (
            <div
              style={{
                background: "linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.85))",
                border: "1px solid rgba(56, 189, 248, 0.25)",
                borderRadius: 14,
                padding: "20px 22px",
                marginBottom: 20,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14, marginBottom: 16 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: "0.78rem", fontWeight: 700, padding: "2px 8px", borderRadius: 8, background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8" }}>
                      {currentSession.dayOfService} Lap
                    </span>
                    <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>
                      Date: <strong>{new Date(currentSession.startsAt).toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</strong>
                    </span>
                    <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>· Venue: {currentSession.venue}</span>
                  </div>
                  <h2 style={{ margin: 0, fontSize: "1.45rem", fontWeight: 800, color: "#f8fafc" }}>
                    {currentSession.name} — Service Attendance & Absence Analysis
                  </h2>
                </div>

                {/* Sub-view switcher */}
                <div style={{ display: "flex", gap: 6, background: "rgba(0,0,0,0.3)", padding: 4, borderRadius: 10 }}>
                  <button
                    type="button"
                    onClick={() => setAttendanceSubView("absent")}
                    className={`btn ${attendanceSubView === "absent" ? "btn-primary" : "ghost"}`}
                    style={{
                      padding: "6px 14px",
                      fontSize: "0.82rem",
                      background: attendanceSubView === "absent" ? "#f43f5e" : "transparent",
                      borderColor: attendanceSubView === "absent" ? "#f43f5e" : "transparent",
                    }}
                  >
                    📋 Compiled Absent Members ({activeSessionStats.absentCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAttendanceSubView("present")}
                    className={`btn ${attendanceSubView === "present" ? "btn-primary" : "ghost"}`}
                    style={{ padding: "6px 14px", fontSize: "0.82rem" }}
                  >
                    ✓ Present Attendees ({activeSessionStats.presentCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAttendanceSubView("matrix")}
                    className={`btn ${attendanceSubView === "matrix" ? "btn-primary" : "ghost"}`}
                    style={{ padding: "6px 14px", fontSize: "0.82rem" }}
                  >
                    📊 Multi-Service Matrix
                  </button>
                </div>
              </div>

              {/* 4 Metric Counters for this Service */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                  gap: 12,
                }}
              >
                <div style={{ background: "rgba(255, 255, 255, 0.04)", padding: "12px 14px", borderRadius: 10 }}>
                  <small style={{ color: "#94a3b8", display: "block", fontSize: "0.72rem", textTransform: "uppercase" }}>
                    Eligible Fellowship Members
                  </small>
                  <strong style={{ fontSize: "1.5rem", color: "#f8fafc" }}>{activeSessionStats.totalEligible}</strong>
                  <span style={{ display: "block", fontSize: "0.75rem", color: "#64748b" }}>Registered Roster</span>
                </div>

                <div style={{ background: "rgba(34, 197, 94, 0.1)", border: "1px solid rgba(34, 197, 94, 0.25)", padding: "12px 14px", borderRadius: 10 }}>
                  <small style={{ color: "#4ade80", display: "block", fontSize: "0.72rem", textTransform: "uppercase" }}>
                    Present Turnout
                  </small>
                  <strong style={{ fontSize: "1.5rem", color: "#4ade80" }}>{activeSessionStats.presentCount}</strong>
                  <span style={{ display: "block", fontSize: "0.75rem", color: "#86efac" }}>{activeSessionStats.turnoutRate}% Attendance Rate</span>
                </div>

                <div style={{ background: "rgba(244, 63, 94, 0.1)", border: "1px solid rgba(244, 63, 94, 0.25)", padding: "12px 14px", borderRadius: 10 }}>
                  <small style={{ color: "#f87171", display: "block", fontSize: "0.72rem", textTransform: "uppercase" }}>
                    Absent (Did Not Attend)
                  </small>
                  <strong style={{ fontSize: "1.5rem", color: "#f87171" }}>{activeSessionStats.absentCount}</strong>
                  <span style={{ display: "block", fontSize: "0.75rem", color: "#fca5a5" }}>{activeSessionStats.absenteeRate}% Need Follow-up</span>
                </div>

                <div style={{ background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.25)", padding: "12px 14px", borderRadius: 10 }}>
                  <small style={{ color: "#fbbf24", display: "block", fontSize: "0.72rem", textTransform: "uppercase" }}>
                    First Timers Status
                  </small>
                  <strong style={{ fontSize: "1.5rem", color: "#fbbf24" }}>
                    {activeSessionStats.firstTimersAbsent} Absent
                  </strong>
                  <span style={{ display: "block", fontSize: "0.75rem", color: "#fde68a" }}>
                    ({activeSessionStats.firstTimersPresent} present out of {firstTimers})
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Action Notification Toast */}
          {actionNotice && (
            <div
              className={actionNotice.error ? "error" : "success"}
              role="status"
              style={{ marginBottom: 16, padding: "10px 16px", borderRadius: 8, fontSize: "0.88rem" }}
            >
              {actionNotice.text}
            </div>
          )}

          {/* SUB-VIEW 1: COMPILED ABSENT MEMBERS SECTION (The User Request) */}
          {attendanceSubView === "absent" && currentSession && (
            <div
              style={{
                background: "rgba(244, 63, 94, 0.03)",
                border: "1px solid rgba(244, 63, 94, 0.2)",
                borderRadius: 14,
                padding: "20px",
                marginBottom: 24,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14, marginBottom: 14 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: "1.2rem" }}>📋</span>
                    <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700, color: "#f8fafc" }}>
                      Compiled Roster: Members Who Did Not Attend {currentSession.name}
                    </h3>
                  </div>
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "#94a3b8" }}>
                    Compiled list of <strong>{allAbsentMembers.length} members</strong> who did not check in for this service. Follow up with warm welfare outreach, WhatsApp messages, or mark manual check-ins.
                  </p>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={handleCopyAbsentPhones}
                    className="button button-secondary"
                    style={{ fontSize: "0.82rem", padding: "6px 12px" }}
                  >
                    {copiedPhones ? "✓ Copied Phone Numbers!" : "📋 Copy All Absent Phones"}
                  </button>

                  <a
                    className="button button-primary"
                    href={`/api/admin/export?type=absent&sessionId=${currentSession.id}&admin=${encodeURIComponent(currentUserEmail)}`}
                    download
                    style={{ fontSize: "0.82rem", padding: "6px 12px", background: "#f43f5e", borderColor: "#f43f5e" }}
                  >
                    📥 Download Absent List CSV
                  </a>
                </div>
              </div>

              {/* Absent Filter & Search Bar */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 10,
                  marginBottom: 16,
                  background: "rgba(0, 0, 0, 0.2)",
                  padding: "10px 14px",
                  borderRadius: 10,
                }}
              >
                <div style={{ flex: 1, minWidth: 240 }}>
                  <input
                    type="text"
                    placeholder="Search absent members by name, phone, residence, or level..."
                    value={absentSearchQuery}
                    onChange={(e) => setAbsentSearchQuery(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", fontSize: "0.85rem", borderRadius: 8 }}
                  />
                </div>

                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  <button
                    type="button"
                    onClick={() => setAbsentFilterType("ALL")}
                    className={`btn ${absentFilterType === "ALL" ? "btn-primary" : "ghost"}`}
                    style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                  >
                    All Absent ({allAbsentMembers.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setAbsentFilterType("FIRST_TIMERS")}
                    className={`btn ${absentFilterType === "FIRST_TIMERS" ? "btn-primary" : "ghost"}`}
                    style={{
                      padding: "4px 10px",
                      fontSize: "0.75rem",
                      color: absentFilterType === "FIRST_TIMERS" ? "#fff" : "#fbbf24",
                      background: absentFilterType === "FIRST_TIMERS" ? "#f59e0b" : "transparent",
                    }}
                  >
                    ⚠️ First Timers Absent ({allAbsentMembers.filter((m) => m.firstTimer).length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setAbsentFilterType("L100")}
                    className={`btn ${absentFilterType === "L100" ? "btn-primary" : "ghost"}`}
                    style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                  >
                    L100
                  </button>
                  <button
                    type="button"
                    onClick={() => setAbsentFilterType("L200")}
                    className={`btn ${absentFilterType === "L200" ? "btn-primary" : "ghost"}`}
                    style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                  >
                    L200
                  </button>
                  <button
                    type="button"
                    onClick={() => setAbsentFilterType("L300")}
                    className={`btn ${absentFilterType === "L300" ? "btn-primary" : "ghost"}`}
                    style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                  >
                    L300
                  </button>
                  <button
                    type="button"
                    onClick={() => setAbsentFilterType("L400")}
                    className={`btn ${absentFilterType === "L400" ? "btn-primary" : "ghost"}`}
                    style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                  >
                    L400
                  </button>
                  <button
                    type="button"
                    onClick={() => setAbsentFilterType("L500")}
                    className={`btn ${absentFilterType === "L500" ? "btn-primary" : "ghost"}`}
                    style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                  >
                    L500
                  </button>
                </div>
              </div>

              {/* Absent Members Table */}
              <div className="glass" style={{ overflowX: "auto", borderRadius: 12 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Member Name & ID</th>
                      <th>Level & Category</th>
                      <th>Residence</th>
                      <th>Phone & Email</th>
                      <th>First Timer Care</th>
                      <th style={{ textAlign: "right" }}>Follow-Up & Check-In Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAbsentMembers.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: "center", padding: "35px", color: "#94a3b8" }}>
                          {allAbsentMembers.length === 0
                            ? "🎉 Perfect Attendance! Every registered member attended this service."
                            : "No absent members match your search criteria."}
                        </td>
                      </tr>
                    ) : (
                      filteredAbsentMembers.map((member) => {
                        const isUpdating = updatingMemberId === member.id;
                        const whatsAppUrl = getWhatsAppOutreachUrl(
                          member.phone,
                          member.firstName,
                          currentSession.name,
                          currentSession.dayOfService
                        );

                        return (
                          <tr key={member.id}>
                            <td>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f43f5e", display: "inline-block" }} />
                                <div>
                                  <strong style={{ fontSize: "0.95rem" }}>
                                    {member.firstName} {member.lastName}
                                  </strong>
                                  <small style={{ display: "block", color: "#38bdf8", fontFamily: "monospace" }}>
                                    {member.memberId}
                                  </small>
                                </div>
                              </div>
                            </td>

                            <td>
                              <div>
                                <span className="pill blue" style={{ fontSize: "0.72rem" }}>
                                  {member.level || "Student"}
                                </span>
                                <small style={{ display: "block", color: "#94a3b8" }}>{member.gender}</small>
                              </div>
                            </td>

                            <td>
                              <span style={{ fontSize: "0.85rem", color: "#f8fafc" }}>
                                {member.placeOfResidence || "Campus Area"}
                              </span>
                            </td>

                            <td>
                              <div>
                                <a
                                  href={`tel:${member.phone}`}
                                  style={{ color: "#38bdf8", textDecoration: "none", fontWeight: 600, fontSize: "0.85rem" }}
                                >
                                  {member.phone}
                                </a>
                                {member.email && (
                                  <small style={{ display: "block", color: "#94a3b8", fontSize: "0.72rem" }}>
                                    {member.email}
                                  </small>
                                )}
                              </div>
                            </td>

                            <td>
                              {member.firstTimer ? (
                                <span
                                  style={{
                                    display: "inline-block",
                                    padding: "3px 8px",
                                    borderRadius: 12,
                                    fontSize: "0.72rem",
                                    fontWeight: 700,
                                    background: "rgba(244, 63, 94, 0.15)",
                                    color: "#f43f5e",
                                    border: "1px solid rgba(244, 63, 94, 0.4)",
                                  }}
                                >
                                  ⭐ First Timer (Priority)
                                </span>
                              ) : (
                                <span style={{ fontSize: "0.78rem", color: "#94a3b8" }}>Regular Member</span>
                              )}
                            </td>

                            <td style={{ textAlign: "right" }}>
                              <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                                <a
                                  href={whatsAppUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="button button-secondary"
                                  style={{
                                    padding: "4px 8px",
                                    fontSize: "0.75rem",
                                    background: "#166534",
                                    borderColor: "#22c55e",
                                    color: "#f0fdf4",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                    textDecoration: "none",
                                  }}
                                  title="Send warm encouragement message on WhatsApp"
                                >
                                  <span>💬</span> WhatsApp
                                </a>

                                <button
                                  type="button"
                                  disabled={isUpdating}
                                  onClick={() => handleToggleAttendance(member.id, `${member.firstName} ${member.lastName}`, "checkin")}
                                  className="button button-primary"
                                  style={{
                                    padding: "4px 10px",
                                    fontSize: "0.75rem",
                                    fontWeight: 600,
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {isUpdating ? "Saving..." : "✓ Mark Check-In"}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SUB-VIEW 2: PRESENT ATTENDEES ROSTER */}
          {attendanceSubView === "present" && currentSession && (
            <div
              style={{
                background: "rgba(34, 197, 94, 0.03)",
                border: "1px solid rgba(34, 197, 94, 0.2)",
                borderRadius: 14,
                padding: "20px",
                marginBottom: 24,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700, color: "#f8fafc" }}>
                    ✓ Present Attendees for {currentSession.name} ({presentMembers.length})
                  </h3>
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "#94a3b8" }}>
                    Members who checked in for this service session.
                  </p>
                </div>
              </div>

              <div className="glass" style={{ overflowX: "auto", borderRadius: 12 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Member Name & ID</th>
                      <th>Contact Phone</th>
                      <th>Residence</th>
                      <th>Level</th>
                      <th>Check-In Time</th>
                      <th>Method</th>
                      <th style={{ textAlign: "right" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {presentMembers.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: "center", padding: "30px", color: "#94a3b8" }}>
                          No attendees checked in yet for this session.
                        </td>
                      </tr>
                    ) : (
                      presentMembers.map((member) => {
                        const attRecord = attendances.find(
                          (a) =>
                            (a.sessionId === currentSession.id || a.serviceName.toLowerCase() === currentSession.name.toLowerCase()) &&
                            (a.memberDbId === member.id || a.memberId.toUpperCase() === member.memberId.toUpperCase())
                        );

                        return (
                          <tr key={member.id}>
                            <td>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
                                <div>
                                  <strong>{member.firstName} {member.lastName}</strong>
                                  <small style={{ display: "block", color: "#38bdf8", fontFamily: "monospace" }}>
                                    {member.memberId}
                                  </small>
                                </div>
                              </div>
                            </td>
                            <td>{member.phone}</td>
                            <td>{member.placeOfResidence || "Campus"}</td>
                            <td>
                              <span className="pill blue" style={{ fontSize: "0.72rem" }}>
                                {member.level || "Student"}
                              </span>
                            </td>
                            <td>
                              {attRecord ? (
                                <div>
                                  <span>{new Date(attRecord.checkedInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                                  <small style={{ display: "block", color: "#94a3b8", fontSize: "0.72rem" }}>
                                    {new Date(attRecord.checkedInAt).toLocaleDateString()}
                                  </small>
                                </div>
                              ) : (
                                "Checked In"
                              )}
                            </td>
                            <td>
                              <span className="pill" style={{ fontSize: "0.72rem" }}>
                                {attRecord?.method || "QR"}
                              </span>
                            </td>
                            <td style={{ textAlign: "right" }}>
                              <button
                                type="button"
                                disabled={updatingMemberId === member.id}
                                onClick={() => handleToggleAttendance(member.id, `${member.firstName} ${member.lastName}`, "remove")}
                                className="btn ghost"
                                style={{ padding: "3px 8px", fontSize: "0.72rem", color: "#f87171" }}
                              >
                                Undo Check-In
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SUB-VIEW 3: CROSS-SERVICE CONSISTENCY MATRIX */}
          {attendanceSubView === "matrix" && (
            <div
              style={{
                background: "rgba(15, 23, 42, 0.6)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: 14,
                padding: "20px",
                marginBottom: 24,
              }}
            >
              <div style={{ marginBottom: 14 }}>
                <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700, color: "#f8fafc" }}>
                  📊 Cross-Service Consistency Matrix (All Days of Service)
                </h3>
                <p style={{ margin: "2px 0 0", fontSize: "0.85rem", color: "#94a3b8" }}>
                  Tracking member presence and absence across all {sessions.length} recorded fellowship services.
                </p>
              </div>

              <div className="glass" style={{ overflowX: "auto", borderRadius: 12 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Member Name / ID</th>
                      <th>Level</th>
                      <th>Residence</th>
                      {sessions.map((s) => (
                        <th key={s.id} style={{ textAlign: "center", minWidth: 110 }}>
                          <div>{s.name}</div>
                          <small style={{ color: "#94a3b8", fontSize: "0.7rem" }}>
                            {s.dayOfService} ({new Date(s.startsAt).toLocaleDateString([], { month: "numeric", day: "numeric" })})
                          </small>
                        </th>
                      ))}
                      <th style={{ textAlign: "right" }}>Overall Attendance Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {crossServiceMatrix.map(({ member, attendedCount, totalCount, attendancePercent, statusPerSession }) => {
                      const isHigh = attendancePercent >= 75;
                      const isMedium = attendancePercent >= 50 && attendancePercent < 75;

                      return (
                        <tr key={member.id}>
                          <td>
                            <strong>{member.firstName} {member.lastName}</strong>
                            <small style={{ display: "block", color: "#38bdf8", fontFamily: "monospace" }}>
                              {member.memberId}
                            </small>
                          </td>
                          <td>
                            <span className="pill blue" style={{ fontSize: "0.72rem" }}>
                              {member.level || "Student"}
                            </span>
                          </td>
                          <td>
                            <small style={{ color: "#94a3b8" }}>{member.placeOfResidence || "Campus"}</small>
                          </td>
                          {sessions.map((s) => {
                            const didAttend = statusPerSession[s.id];
                            return (
                              <td key={s.id} style={{ textAlign: "center" }}>
                                {didAttend ? (
                                  <span style={{ color: "#4ade80", fontWeight: 800, fontSize: "1rem" }} title="Attended">
                                    ✓
                                  </span>
                                ) : (
                                  <span style={{ color: "#f87171", fontWeight: 700, fontSize: "0.85rem" }} title="Absent">
                                    ✗
                                  </span>
                                )}
                              </td>
                            );
                          })}
                          <td style={{ textAlign: "right" }}>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                              <span
                                style={{
                                  fontSize: "0.82rem",
                                  fontWeight: 700,
                                  color: isHigh ? "#4ade80" : isMedium ? "#f59e0b" : "#f43f5e",
                                }}
                              >
                                {attendedCount}/{totalCount} ({attendancePercent}%)
                              </span>
                              <span
                                style={{
                                  display: "inline-block",
                                  padding: "2px 6px",
                                  borderRadius: 8,
                                  fontSize: "0.68rem",
                                  fontWeight: 700,
                                  background: isHigh
                                    ? "rgba(34, 197, 94, 0.15)"
                                    : isMedium
                                    ? "rgba(245, 158, 11, 0.15)"
                                    : "rgba(244, 63, 94, 0.15)",
                                  color: isHigh ? "#4ade80" : isMedium ? "#fbbf24" : "#f87171",
                                }}
                              >
                                {isHigh ? "Faithful" : isMedium ? "Regular" : "Needs Care"}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {/* TAB 3: AUTHORIZED ADMIN EMAILS MANAGEMENT (SUPER ADMIN ONLY FOR GRANT/REVOKE) */}
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

            {/* Authorize New Email Form - Super Admin Only */}
            {isSuperAdmin ? (
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
            ) : (
              <div
                style={{
                  marginTop: 16,
                  padding: "12px 16px",
                  borderTop: "1px solid rgba(255, 255, 255, 0.1)",
                  background: "rgba(255, 255, 255, 0.03)",
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontSize: "0.85rem",
                  color: "#94a3b8",
                }}
              >
                <span>🔒</span>
                <span>
                  Only the <strong>Super Admin</strong> can grant or revoke member records access.
                </span>
              </div>
            )}

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
                        ) : !isSuperAdmin ? (
                          <span style={{ fontSize: "0.78rem", color: "#64748b" }}>Super Admin only</span>
                        ) : pendingRevokeEmail === user.email ? (
                          <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                            <button
                              type="button"
                              disabled={isRevoking}
                              onClick={() => handleRemoveAccess(user.email)}
                              className="button button-primary"
                              style={{ background: "#dc2626", borderColor: "#ef4444", padding: "4px 8px", fontSize: "0.72rem", fontWeight: 700 }}
                            >
                              {isRevoking ? "Revoking..." : "Confirm Revoke"}
                            </button>
                            <button
                              type="button"
                              disabled={isRevoking}
                              onClick={() => setPendingRevokeEmail(null)}
                              className="btn ghost"
                              style={{ padding: "4px 6px", fontSize: "0.72rem" }}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setPendingRevokeEmail(user.email)}
                            className="btn ghost"
                            style={{ padding: "4px 10px", fontSize: "0.75rem", color: "#f43f5e", border: "1px solid rgba(244, 63, 94, 0.3)" }}
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
