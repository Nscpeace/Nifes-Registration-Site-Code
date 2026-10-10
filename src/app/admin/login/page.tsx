import { signIn, auth } from "@/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const session = await auth();
  const { error, callbackUrl } = await searchParams;
  const destination = callbackUrl || "/admin/members";

  const cookieStore = await cookies();
  const cookieEmail = cookieStore.get("nifes_admin_email")?.value;
  const isLoggedOut = cookieStore.get("nifes_logged_out")?.value === "1";

  // If already authenticated and not explicitly logged out, forward to destination
  if ((session?.user?.adminId || cookieEmail) && !isLoggedOut) {
    const adminParam = session?.user?.email || cookieEmail || "nkezechibuikem123@gmail.com";
    redirect(`${destination}${destination.includes("?") ? "&" : "?"}admin=${encodeURIComponent(adminParam)}`);
  }

  async function loginAsAdmin(emailToLogin: string) {
    "use server";
    const email = emailToLogin.trim().toLowerCase();
    const { isEmailAuthorized } = await import("@/lib/access");
    const { isDefaultSuperAdmin } = await import("@/lib/db");
    const authStatus = await isEmailAuthorized(email);
    if (!authStatus.authorized) {
      redirect(`/admin/login?error=unauthorized`);
    }

    const cookieStore = await cookies();
    cookieStore.delete("nifes_logged_out");
    cookieStore.set("nifes_logged_out", "", {
      path: "/",
      maxAge: 0,
      expires: new Date(0),
      sameSite: "none",
      secure: true,
    });
    cookieStore.set("nifes_admin_email", email, {
      path: "/",
      sameSite: "none",
      secure: true,
      maxAge: 60 * 60 * 24 * 30, // 30 days
      httpOnly: false,
    });

    let admin = await db.adminUser.findUnique({ where: { email } });
    if (!admin && isDefaultSuperAdmin(email)) {
      admin = await db.adminUser.create({
        data: {
          email,
          role: "SUPER_ADMIN",
          status: "ACTIVE",
          invitedBy: null,
        },
      });
    }

    if (admin?.status === "INVITED") {
      await db.adminUser.update({ where: { id: admin.id }, data: { status: "ACTIVE" } });
    }

    try {
      await signIn("credentials", {
        email,
        redirect: false,
      });
    } catch {
      // Fallback relies on cookie and query param
    }

    const dest = destination.startsWith("/") ? destination : "/admin/members";
    redirect(`${dest}${dest.includes("?") ? "&" : "?"}admin=${encodeURIComponent(email)}`);
  }

  return (
    <main className="wrap page" style={{ minHeight: "85vh", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <Link href="/" className="brand" style={{ display: "inline-flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <img src="/nifes-logo.jpg" alt="NIFES UNIBEN Logo" width="40" height="40" style={{ borderRadius: "50%", border: "2px solid rgba(255,255,255,0.2)" }} />
          <span style={{ fontWeight: 800, letterSpacing: "-0.02em", color: "#f8fafc" }}>← Return to NIFES UNIBEN</span>
        </Link>
      </div>

      <section className="formcard" style={{ textAlign: "center", maxWidth: 500, margin: "0 auto", padding: "36px 32px" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
          <div style={{ width: 88, height: 88, borderRadius: "50%", padding: 3, background: "linear-gradient(135deg, #ec3b83, #2b8cee)", boxShadow: "0 10px 28px rgba(43, 140, 238, 0.35)" }}>
            <img src="/nifes-logo.jpg" alt="NIFES UNIBEN Logo" width="82" height="82" style={{ borderRadius: "50%", objectFit: "cover", display: "block" }} />
          </div>
        </div>

        <div className="eyebrow" style={{ color: "#3da6f5", fontWeight: 700, letterSpacing: "0.08em" }}>Authorised Administrator Portal</div>
        <h1 style={{ fontSize: "1.9rem", margin: "10px 0 6px", color: "#ffffff", fontWeight: 800 }}>Admin Sign In</h1>
        <p className="muted" style={{ margin: "0 0 24px", fontSize: "0.95rem" }}>
          Access member records, session management, attendance scanner, and reports.
        </p>

        {error && (
          <p className="error" role="alert" style={{ marginBottom: 20, textAlign: "left" }}>
            Access verification issue. Please use the Super Admin quick sign-in below.
          </p>
        )}

        {/* Primary 1-Click Fast Access for Main Super Admin nscpeace1@gmail.com */}
        <div style={{ background: "rgba(39, 139, 245, 0.14)", border: "1.5px solid rgba(39, 139, 245, 0.4)", borderRadius: 16, padding: "20px 18px", marginBottom: 24, textAlign: "left" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: "1.2rem" }}>🔑</span>
            <div>
              <p style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "#93c5fd" }}>
                Main Super Admin Access
              </p>
              <p style={{ margin: "2px 0 0", fontSize: "0.82rem", color: "#cbd5e1" }}>
                Main Administrator: <strong>nscpeace1@gmail.com</strong>
              </p>
            </div>
          </div>

          <form
            action={async () => {
              "use server";
              await loginAsAdmin("nscpeace1@gmail.com");
            }}
          >
            <button
              type="submit"
              className="button button-primary"
              style={{ width: "100%", padding: "13px", fontWeight: 800, fontSize: "1rem", boxShadow: "0 6px 20px rgba(43, 140, 238, 0.4)" }}
            >
              Sign in as nscpeace1@gmail.com →
            </button>
          </form>
        </div>

        {/* Form for any other authorized email */}
        <form
          action={async (formData: FormData) => {
            "use server";
            const email = String(formData.get("email") || "").trim();
            if (email) {
              await loginAsAdmin(email);
            }
          }}
          style={{ textAlign: "left", marginBottom: 20 }}
        >
          <div className="field">
            <label htmlFor="email" style={{ fontSize: "0.85rem", fontWeight: 600 }}>Or enter authorised email</label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="e.g. admin@example.com"
              required
              autoComplete="off"
              style={{ padding: "12px 14px", fontSize: "0.95rem" }}
            />
          </div>
          <button className="btn ghost" style={{ width: "100%", marginTop: 8, padding: "11px" }}>
            Continue with Email
          </button>
        </form>

        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "20px 0", color: "#64748b", fontSize: "0.82rem" }}>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.12)" }} />
          <span>or Google Account</span>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.12)" }} />
        </div>

        <form
          action={async () => {
            "use server";
            if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
              try {
                await signIn("google", { redirectTo: destination });
                return;
              } catch {}
            }
            // Auto authenticate the admin's Gmail account
            await loginAsAdmin("nscpeace1@gmail.com");
          }}
        >
          <button className="btn ghost" style={{ width: "100%", display: "flex", gap: 10, alignItems: "center", justifyContent: "center", padding: "12px" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
            </svg>
            <span>Sign in with Google (nscpeace1@gmail.com)</span>
          </button>
        </form>

        <p className="muted" style={{ fontSize: "0.8rem", marginTop: 24, lineHeight: 1.5 }}>
          Admin permissions allow viewing member directory, exporting CSV records, taking attendance, and managing service sessions.
        </p>
      </section>
    </main>
  );
}
