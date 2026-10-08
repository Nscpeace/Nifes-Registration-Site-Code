import Link from "next/link";

export default function Forbidden() {
  return (
    <main className="wrap page">
      <Link href="/" className="brand" style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
        <img src="/nifes-logo.jpg" alt="NIFES UNIBEN Logo" width="34" height="34" style={{ borderRadius: "50%" }} />
        <span>← NIFES UNIBEN</span>
      </Link>
      <section className="formcard" style={{ maxWidth: 500, margin: "36px auto", textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
          <img src="/nifes-logo.jpg" alt="NIFES UNIBEN Logo" width="68" height="68" style={{ borderRadius: "50%" }} />
        </div>
        <div className="eyebrow" style={{ color: "#f43f5e" }}>Access Restricted</div>
        <h1 style={{ fontSize: "1.8rem", margin: "10px 0" }}>Authorisation Required</h1>
        <p className="muted" style={{ marginBottom: 24 }}>
          Your current session does not have permission to view this section of the administration portal.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <Link className="button button-primary" href="/admin/login">
            Sign In with Authorised Admin
          </Link>
          <Link className="button button-secondary" href="/">
            Return home
          </Link>
        </div>
      </section>
    </main>
  );
}
