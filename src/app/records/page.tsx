import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveAdminSession, isEmailAuthorized } from "@/lib/access";
import { db } from "@/lib/db";
import RecordsClient, { type AttendanceItem, type AuthorizedUser } from "./records-client";
import { type Member } from "@/app/admin/members/table";

export const dynamic = "force-dynamic";

export default async function MemberRecordsPage({
  searchParams,
}: {
  searchParams?: Promise<{ admin?: string; login?: string; error?: string; attempted?: string }>;
}) {
  const params = (await searchParams) || {};
  const queryAdmin = params.admin?.trim().toLowerCase();
  const attemptedEmail = params.attempted?.trim();
  const isUnauthorizedError = params.error === "unauthorized";

  // Server action to log in with an authorized email
  async function verifyAndSignIn(formData: FormData) {
    "use server";
    const emailInput = (formData.get("email")?.toString() || "").trim().toLowerCase();

    if (!emailInput) {
      redirect("/records?error=unauthorized&attempted=empty");
    }

    // Check authorization: only nscpeace1@gmail.com and emails he authorized
    const authStatus = await isEmailAuthorized(emailInput);

    if (!authStatus.authorized) {
      // Access Denied!
      redirect(`/records?error=unauthorized&attempted=${encodeURIComponent(emailInput)}`);
    }

    // Email is authorized: provision if primary super admin, ensure status ACTIVE
    let admin = await db.adminUser.findUnique({ where: { email: emailInput } });
    if (!admin && emailInput === "nscpeace1@gmail.com") {
      admin = await db.adminUser.create({
        data: {
          email: emailInput,
          role: "SUPER_ADMIN",
          status: "ACTIVE",
          invitedBy: null,
        },
      });
    } else if (admin && admin.status === "INVITED") {
      await db.adminUser.update({
        where: { email: emailInput },
        data: { status: "ACTIVE" },
      });
    }

    const c = await cookies();
    c.delete("nifes_logged_out");
    c.set("nifes_admin_email", emailInput, {
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      httpOnly: false,
    });

    redirect("/records");
  }

  // Server action to log out
  async function adminSignOut() {
    "use server";
    const c = await cookies();
    c.delete("nifes_admin_email");
    c.set("nifes_logged_out", "1", { path: "/", maxAge: 60 * 60 });
    redirect("/records?login=1");
  }

  // Resolve admin session strictly via verified session/cookie (prevent URL spoofing)
  const session = await resolveAdminSession(["SUPER_ADMIN", "ADMIN"]);

  // If NOT authorized, render the restricted access screen (NO records exposed)
  if (!session) {
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
            maxWidth: 500,
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

          {/* Access Denied Alert if an unauthorized email attempted login */}
          {isUnauthorizedError && attemptedEmail && (
            <div
              className="error"
              role="alert"
              style={{
                marginBottom: 20,
                padding: "14px 16px",
                borderRadius: 12,
                textAlign: "left",
                fontSize: "0.88rem",
              }}
            >
              <strong style={{ display: "block", marginBottom: 4, color: "#fca5a5" }}>
                ⛔ Access Denied
              </strong>
              <span>
                <strong>{attemptedEmail}</strong> has not been authorized by administrator{" "}
                <strong>nscpeace1@gmail.com</strong>.
              </span>
              <p style={{ margin: "6px 0 0", fontSize: "0.8rem", color: "#fecaca" }}>
                Please ask <strong>nscpeace1@gmail.com</strong> to grant your email access from the authorized admin panel.
              </p>
            </div>
          )}

          {/* Verification Form */}
          <form action={verifyAndSignIn} style={{ textAlign: "left", marginBottom: 20 }}>
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
                Enter your authorized email address
              </label>
              <input
                id="admin-email"
                name="email"
                type="email"
                required
                placeholder="nscpeace1@gmail.com or authorized email"
                autoComplete="email"
                style={{ width: "100%", padding: "12px 14px", fontSize: "1rem", borderRadius: 10 }}
              />
              <p style={{ margin: "6px 0 0", fontSize: "0.76rem", color: "#94a3b8" }}>
                The email must be <strong>nscpeace1@gmail.com</strong> or added by him.
              </p>
            </div>

            <button
              className="button button-primary"
              type="submit"
              style={{
                width: "100%",
                padding: "12px",
                fontSize: "0.98rem",
                fontWeight: 700,
                borderRadius: 10,
              }}
            >
              Verify & Access Member Records →
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

          <form action={adminSignOut}>
            <button
              className="btn ghost"
              type="submit"
              style={{ padding: "6px 12px", fontSize: "0.8rem", color: "#fca5a5" }}
            >
              Sign Out
            </button>
          </form>
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
