import { cookies } from "next/headers";
import Link from "next/link";
import { resolveAdminSession } from "@/lib/access";
import { db } from "@/lib/db";
import RecordsClient, { type AttendanceItem, type AuthorizedUser } from "./records-client";
import RecordsLoginCard from "./records-login-card";
import RecordsSignOutButton from "./records-signout";
import { type Member } from "@/app/admin/members/table";

export const dynamic = "force-dynamic";

export default async function MemberRecordsPage({
  searchParams,
}: {
  searchParams?: Promise<{ admin?: string; login?: string; error?: string; attempted?: string; logout?: string; t?: string }>;
}) {
  const params = (await searchParams) || {};
  const attemptedEmail = params.attempted?.trim();
  const isUnauthorizedError = params.error === "unauthorized";
  const forceLoggedOut = params.login === "1" || params.logout === "1";

  // If sign-out or explicit login portal is requested, immediately invalidate session & render login card
  if (forceLoggedOut) {
    try {
      const cookieStore = await cookies();
      cookieStore.delete("nifes_admin_email");
      cookieStore.set("nifes_logged_out", "1", {
        path: "/",
        sameSite: "none",
        secure: true,
        maxAge: 60 * 60 * 24 * 7,
      });
    } catch {}
    return (
      <RecordsLoginCard
        initialAttemptedEmail={attemptedEmail}
        initialIsUnauthorized={isUnauthorizedError}
      />
    );
  }

  // Resolve admin session strictly via verified session/cookie (prevent URL spoofing)
  const session = await resolveAdminSession(["SUPER_ADMIN", "ADMIN"]);

  // If NOT authorized, render the interactive restricted access screen
  if (!session) {
    return (
      <RecordsLoginCard
        initialAttemptedEmail={attemptedEmail}
        initialIsUnauthorized={isUnauthorizedError}
      />
    );
  }

  // --- USER IS AUTHENTICATED ---
  const currentAdmin = session.user.email;
  const isSuperAdmin = session.user.role === "SUPER_ADMIN" || currentAdmin === "nscpeace1@gmail.com";

  // Fetch all members
  const rawMembers = await db.member.findMany({
    orderBy: { createdAt: "desc" },
  });

  const members: Member[] = rawMembers.map((m) => ({
    id: m.id,
    memberId: m.memberId,
    firstName: m.firstName,
    lastName: m.lastName,
    gender: m.gender,
    email: m.email ?? null,
    phone: m.phone,
    placeOfResidence: m.placeOfResidence ?? null,
    heardAbout: m.heardAbout ?? null,
    heardAboutOther: m.heardAboutOther ?? null,
    firstTimer: Boolean(m.firstTimer),
    level: m.level ?? null,
    guest: Boolean(m.guest),
    createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : String(m.createdAt || new Date().toISOString()),
  }));

  // Fetch all attendance records with session & member details
  let rawAttendances: any[] = [];
  try {
    rawAttendances = await db.attendance.findMany({
      include: { member: true, session: true },
      orderBy: { checkedInAt: "desc" },
    });
  } catch {
    // Graceful
  }

  // Helper to determine day of service from name or date
  function getDayOfService(sessionName: string, startsAt: any): string {
    const lower = (sessionName || "").toLowerCase();
    if (lower.includes("sunday") || lower.includes("foundation")) return "Sunday";
    if (lower.includes("prayer") || lower.includes("tuesday")) return "Tuesday";
    if (lower.includes("bible") || lower.includes("friday")) return "Friday";
    if (lower.includes("evangelism") || lower.includes("saturday")) return "Last Saturday";
    const date = startsAt instanceof Date ? startsAt : new Date(startsAt || Date.now());
    const dayIndex = date.getDay();
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return days[dayIndex] || "Weekly";
  }

  const attendances: AttendanceItem[] = rawAttendances.map((a) => {
    const sName = a.session?.name || "Fellowship Service";
    const day = a.session?.dayOfService || getDayOfService(sName, a.session?.startsAt || a.checkedInAt);

    return {
      id: a.id,
      memberId: a.member?.memberId || "—",
      memberName: a.member ? `${a.member.firstName} ${a.member.lastName}` : "Unknown Member",
      memberPhone: a.member?.phone || "—",
      memberEmail: a.member?.email ?? null,
      serviceName: sName,
      dayOfService: day,
      venue: a.session?.venue || "FAGCOOP Multipurpose Hall",
      checkedInAt: a.checkedInAt instanceof Date ? a.checkedInAt.toISOString() : String(a.checkedInAt || new Date().toISOString()),
      method: a.method || "SELF",
    };
  });

  // Fetch authorized admins
  let rawAdmins: any[] = [];
  try {
    rawAdmins = await db.adminUser.findMany({
      include: { inviter: true },
      orderBy: { createdAt: "asc" },
    });
  } catch {
    // Graceful
  }

  const authorizedUsers: AuthorizedUser[] = rawAdmins.map((u) => ({
    id: u.id,
    email: u.email,
    role: u.role,
    status: u.status,
    createdAt: u.createdAt instanceof Date ? u.createdAt.toLocaleDateString() : String(u.createdAt || "Seeded"),
    invitedByEmail: u.inviter?.email ?? (u.email === "nscpeace1@gmail.com" ? "Owner" : null),
  }));

  const totalMembers = members.filter((m) => !m.guest).length;
  const firstTimers = members.filter((m) => m.firstTimer).length;

  return (
    <main className="wrap page" style={{ paddingTop: 20, paddingBottom: 50 }}>
      {/* Top Header & Session Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <Link href="/" className="btn ghost" style={{ padding: "8px 14px", fontSize: "0.85rem" }}>
            ← Home
          </Link>
          <Link href="/check-in" className="btn ghost" style={{ padding: "8px 14px", fontSize: "0.85rem" }}>
            Fellowship Check-In Desk
          </Link>
          <Link href="/admin" className="btn ghost" style={{ padding: "8px 14px", fontSize: "0.85rem" }}>
            Admin Console
          </Link>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: "0.85rem",
              background: "rgba(255, 255, 255, 0.05)",
              padding: "6px 12px",
              borderRadius: 20,
              border: "1px solid rgba(255, 255, 255, 0.1)",
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ade80", display: "inline-block" }} />
            <span className="muted">
              Signed in: <strong style={{ color: "#3da6f5" }}>{currentAdmin}</strong>{" "}
              <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>({session.user.role})</span>
            </span>
          </div>

          <RecordsSignOutButton />
        </div>
      </div>

      {/* Page Title & Exports */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          flexWrap: "wrap",
          gap: 16,
          margin: "10px 0 24px",
        }}
      >
        <div>
          <div className="eyebrow" style={{ color: "#3da6f5", fontWeight: 700 }}>
            NIFES UNIBEN Official Database
          </div>
          <h1 style={{ margin: "4px 0 6px", fontSize: "2.1rem", fontWeight: 800 }}>
            Member Records & Program Attendance
          </h1>
          <p className="muted" style={{ margin: 0, fontSize: "0.95rem" }}>
            Authorized portal for member directory, service lap attendance, and team access.
          </p>
        </div>

        <div className="actions" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <a
            className="button button-primary"
            href={`/api/admin/export?type=members&admin=${encodeURIComponent(currentAdmin)}`}
            download
            style={{ fontSize: "0.88rem" }}
          >
            📥 Download Members CSV
          </a>
          <a
            className="button button-secondary"
            href={`/api/admin/export?type=attendance&admin=${encodeURIComponent(currentAdmin)}`}
            download
            style={{ fontSize: "0.88rem" }}
          >
            📊 Download Attendance CSV
          </a>
        </div>
      </div>

      {/* Client Component with 3 Tabs: Members, Attendance by Lap & Day of Service, and Authorized Admins */}
      <RecordsClient
        members={members}
        attendances={attendances}
        authorizedUsers={authorizedUsers}
        currentUserEmail={currentAdmin}
        isSuperAdmin={isSuperAdmin}
        totalMembers={totalMembers}
        firstTimers={firstTimers}
      />
    </main>
  );
}
