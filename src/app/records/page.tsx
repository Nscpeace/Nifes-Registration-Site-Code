import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveAdminSession } from "@/lib/access";
import { db } from "@/lib/db";
import MemberTable, { type Member } from "@/app/admin/members/table";

export const dynamic = "force-dynamic";

export default async function MemberRecordsPage({
  searchParams,
}: {
  searchParams?: Promise<{ admin?: string; login?: string; error?: string }>;
}) {
  const params = (await searchParams) || {};
  const queryAdmin = params.admin?.trim().toLowerCase();

  const cookieStore = await cookies();
  const isExplicitLogout = cookieStore.get("nifes_logged_out")?.value === "1";

  // Server action to log in as admin
  async function adminQuickLogin(formData: FormData) {
    "use server";
    const emailToSet = (formData.get("email")?.toString() || "nscpeace1@gmail.com").trim().toLowerCase();
    const c = await cookies();
    c.delete("nifes_logged_out");
    c.set("nifes_admin_email", emailToSet, {
      path: "/",
      sameSite: "none",
      secure: true,
      maxAge: 60 * 60 * 24 * 30,
      httpOnly: false,
    });

    let admin = await db.adminUser.findUnique({ where: { email: emailToSet } });
    if (!admin && (emailToSet === "nscpeace1@gmail.com" || emailToSet === (process.env.SUPER_ADMIN_EMAIL || "").toLowerCase())) {
      await db.adminUser.create({
        data: {
          email: emailToSet,
          role: "SUPER_ADMIN",
          status: "ACTIVE",
          invitedBy: null,
        },
      });
    }

    redirect(`/records?admin=${encodeURIComponent(emailToSet)}`);
  }

  // Server action to log out
  async function adminLogout() {
    "use server";
    const c = await cookies();
    c.delete("nifes_admin_email");
    c.set("nifes_logged_out", "1", { path: "/", maxAge: 60 * 60 });
    redirect("/records?login=1");
  }

  // Try to resolve admin session
  let session = await resolveAdminSession(["SUPER_ADMIN", "ADMIN"], queryAdmin);

  // If user requested login screen explicitly or is logged out and no admin query provided
  const showLoginPrompt = isExplicitLogout && !queryAdmin && !session;

  // Auto-authenticate nscpeace1@gmail.com if not explicit logout or if query provided
  if (!session && !showLoginPrompt) {
    session = await resolveAdminSession(["SUPER_ADMIN", "ADMIN"], "nscpeace1@gmail.com");
  }

  const currentAdmin = session?.user?.email || "nscpeace1@gmail.com";

  // If user is not authenticated and needs to sign in:
  if (!session && showLoginPrompt) {
    return (
      <main className="wrap page" style={{ minHeight: "85vh", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <Link href="/" className="brand" style={{ display: "inline-flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <img src="/nifes-logo.jpg" alt="NIFES UNIBEN Logo" width="40" height="40" style={{ borderRadius: "50%", border: "2px solid rgba(255,255,255,0.2)" }} />
            <span style={{ fontWeight: 800, color: "#f8fafc" }}>← NIFES UNIBEN Home</span>
          </Link>
        </div>

        <section className="formcard" style={{ maxWidth: 520, margin: "0 auto", padding: "36px 30px", textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
            <div style={{ width: 80, height: 80, borderRadius: "50%", padding: 3, background: "linear-gradient(135deg, #2b8cee, #ec3b83)", boxShadow: "0 8px 24px rgba(43, 140, 238, 0.35)" }}>
              <img src="/nifes-logo.jpg" alt="NIFES UNIBEN Logo" width="74" height="74" style={{ borderRadius: "50%", display: "block" }} />
            </div>
          </div>

          <div className="eyebrow" style={{ color: "#3da6f5", fontWeight: 700 }}>Admin & Member Directory</div>
          <h1 style={{ fontSize: "1.85rem", margin: "8px 0 6px", fontWeight: 800 }}>Member's Records</h1>
          <p className="muted" style={{ margin: "0 0 24px", fontSize: "0.92rem" }}>
            Sign in as an administrator to manage fellowship database, view attendance, and export records.
          </p>

          {/* Instant 1-Click Super Admin Access for nscpeace1@gmail.com */}
          <div style={{ background: "rgba(39, 139, 245, 0.12)", border: "1.5px solid rgba(39, 139, 245, 0.4)", borderRadius: 14, padding: "20px 18px", marginBottom: 20, textAlign: "left" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: "1.2rem" }}>👑</span>
              <div>
                <strong style={{ fontSize: "0.95rem", color: "#f8fafc" }}>Super Admin One-Click Access</strong>
                <p style={{ margin: 0, fontSize: "0.8rem", color: "#94a3b8" }}>
                  Authorized administrator: <strong>nscpeace1@gmail.com</strong>
                </p>
              </div>
            </div>
            <form action={adminQuickLogin}>
              <input type="hidden" name="email" value="nscpeace1@gmail.com" />
              <button
                type="submit"
                className="button button-primary"
                style={{ width: "100%", padding: "12px", fontSize: "0.95rem", fontWeight: 700, marginTop: 8 }}
              >
                Access Records as nscpeace1@gmail.com →
              </button>
            </form>
          </div>

          {/* Manual Admin Email Entry */}
          <form action={adminQuickLogin} style={{ textAlign: "left", marginBottom: 16 }}>
            <div className="field">
              <label htmlFor="custom-email" style={{ fontSize: "0.85rem", fontWeight: 600 }}>Or enter authorized admin email</label>
              <input
                id="custom-email"
                name="email"
                type="email"
                placeholder="nscpeace1@gmail.com"
                defaultValue="nscpeace1@gmail.com"
                style={{ width: "100%", padding: "10px 12px" }}
              />
            </div>
            <button className="button button-secondary" type="submit" style={{ width: "100%", marginTop: 8 }}>
              Continue with Email
            </button>
          </form>

          <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 16, marginTop: 16, display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }}>
            <Link href="/check-in" style={{ color: "#3da6f5", textDecoration: "underline" }}>
              ← Fellowship Check-in
            </Link>
            <Link href="/#register" style={{ color: "#ec3b83", textDecoration: "underline" }}>
              Register New Member →
            </Link>
          </div>
        </section>
      </main>
    );
  }

  // Fetch all members for directory
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

  const totalMembers = members.filter((m) => !m.guest).length;
  const firstTimers = members.filter((m) => m.firstTimer).length;

  return (
    <main className="wrap page">
      {/* Top Header & Navigation */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <Link href="/" className="btn ghost" style={{ padding: "8px 14px", fontSize: "0.85rem" }}>
            ← Home
          </Link>
          <Link href={`/admin?admin=${encodeURIComponent(currentAdmin)}`} className="btn ghost" style={{ padding: "8px 14px", fontSize: "0.85rem" }}>
            Admin Dashboard
          </Link>
          <Link href="/check-in" className="btn ghost" style={{ padding: "8px 14px", fontSize: "0.85rem" }}>
            Fellowship Check-in Desk
          </Link>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.85rem" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ade80" }} />
            <span className="muted">
              Signed in: <strong style={{ color: "#3da6f5" }}>{currentAdmin}</strong> (SUPER_ADMIN)
            </span>
          </div>
          <form action={adminLogout}>
            <button className="btn ghost" style={{ padding: "6px 12px", fontSize: "0.78rem" }}>
              Switch account
            </button>
          </form>
        </div>
      </div>

      {/* Page Title & Stats */}
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
          <div className="eyebrow" style={{ color: "#3da6f5" }}>NIFES UNIBEN Database</div>
          <h1 style={{ margin: "4px 0 6px", fontSize: "2rem", fontWeight: 800 }}>Member Records & Directory</h1>
          <p className="muted" style={{ margin: 0, fontSize: "0.95rem" }}>
            Complete database of fellowship members, contact details, residences, and attendance history.
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

      {/* Summary KPI Badges */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 14,
          marginBottom: 24,
        }}
      >
        <div className="glass" style={{ padding: "16px 20px" }}>
          <small className="muted" style={{ display: "block", textTransform: "uppercase", fontSize: "0.75rem", letterSpacing: "0.05em" }}>
            Total Registered Members
          </small>
          <strong style={{ fontSize: "1.8rem", color: "#f8fafc" }}>{totalMembers}</strong>
        </div>
        <div className="glass" style={{ padding: "16px 20px" }}>
          <small className="muted" style={{ display: "block", textTransform: "uppercase", fontSize: "0.75rem", letterSpacing: "0.05em" }}>
            First Timers
          </small>
          <strong style={{ fontSize: "1.8rem", color: "#ec3b83" }}>{firstTimers}</strong>
        </div>
        <div className="glass" style={{ padding: "16px 20px" }}>
          <small className="muted" style={{ display: "block", textTransform: "uppercase", fontSize: "0.75rem", letterSpacing: "0.05em" }}>
            Active Database
          </small>
          <strong style={{ fontSize: "1.8rem", color: "#3da6f5" }}>UNIBEN Chapter</strong>
        </div>
      </div>

      {/* Members Directory Table */}
      <MemberTable rows={members} adminEmail={currentAdmin} />
    </main>
  );
}
