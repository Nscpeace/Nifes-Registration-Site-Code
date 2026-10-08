import { signIn, auth } from "@/auth";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string; callbackUrl?: string }> }) {
  const session = await auth();
  const { error, callbackUrl } = await searchParams;
  const destination = callbackUrl || "/admin/members";

  if (session?.user?.adminId) {
    redirect(destination);
  }

  return (
    <main className="wrap page">
      <Link href="/" className="brand" style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
        <img src="/nifes-logo.jpg" alt="NIFES UNIBEN Logo" width="34" height="34" style={{ borderRadius: "50%" }} />
        <span>← NIFES UNIBEN</span>
      </Link>

      <section className="formcard" style={{ textAlign: "center", maxWidth: 480, margin: "32px auto" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <div style={{ width: 84, height: 84, borderRadius: "50%", padding: 3, background: "linear-gradient(135deg, #ec3b83, #2b8cee)", boxShadow: "0 8px 24px rgba(43, 140, 238, 0.3)" }}>
            <img src="/nifes-logo.jpg" alt="NIFES UNIBEN Logo" width="78" height="78" style={{ borderRadius: "50%", objectFit: "cover", display: "block" }} />
          </div>
        </div>

        <div className="eyebrow">Authorised Team Members</div>
        <h1 style={{ fontSize: "1.85rem", margin: "10px 0 6px" }}>Admin Sign In</h1>
        <p className="muted" style={{ margin: "0 0 24px", fontSize: "0.95rem" }}>
          Access member records, session management, attendance scanner, and reports.
        </p>

        {error && (
          <p className="error" role="alert" style={{ marginBottom: 18 }}>
            Access denied. Please ensure your email is on the authorised administrator list.
          </p>
        )}

        {/* Primary 1-Click Fast Access for nscpeace1@gmail.com */}
        <div style={{ background: "rgba(39, 139, 245, 0.12)", border: "1px solid rgba(39, 139, 245, 0.3)", borderRadius: 14, padding: "18px 16px", marginBottom: 20 }}>
          <p style={{ margin: "0 0 10px", fontSize: "0.85rem", fontWeight: 700, color: "#82c0ff" }}>
            Super Admin Quick Access
          </p>
          <form
            action={async () => {
              "use server";
              await signIn("credentials", {
                email: "nscpeace1@gmail.com",
                redirectTo: destination,
              });
            }}
          >
            <button className="button button-primary" style={{ width: "100%", padding: "13px", fontWeight: 800 }}>
              Sign in as nscpeace1@gmail.com
            </button>
          </form>
        </div>

        {/* Form for any other authorized email */}
        <form
          action={async (formData: FormData) => {
            "use server";
            const email = String(formData.get("email") || "").trim();
            await signIn("credentials", {
              email,
              redirectTo: destination,
            });
          }}
          style={{ textAlign: "left", marginBottom: 18 }}
        >
          <div className="field">
            <label htmlFor="email" style={{ fontSize: "0.85rem" }}>Or enter another authorised email</label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="e.g. admin@nifesuniben.org"
              required
              autoComplete="email"
            />
          </div>
          <button className="btn ghost" style={{ width: "100%", marginTop: 8 }}>
            Continue with Email
          </button>
        </form>

        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0", color: "#6e8eaf", fontSize: "0.8rem" }}>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.12)" }} />
          <span>or Google</span>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.12)" }} />
        </div>

        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: destination });
          }}
        >
          <button className="btn ghost" style={{ width: "100%", display: "flex", gap: 8, alignItems: "center", justifyContent: "center" }}>
            <span>Sign in with Google Account</span>
          </button>
        </form>

        <p className="muted" style={{ fontSize: "0.78rem", marginTop: 22 }}>
          Only authorised accounts have permission to inspect member records and export data.
        </p>
      </section>
    </main>
  );
}
