import Link from "next/link";

export default function Privacy() {
  return (
    <main className="wrap page">
      <Link className="brand" href="/" style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
        <img src="/nifes-logo.jpg" alt="NIFES UNIBEN Logo" width="34" height="34" style={{ borderRadius: "50%" }} />
        <span>← NIFES UNIBEN</span>
      </Link>
      <article className="formcard" style={{ maxWidth: 680, margin: "28px auto" }}>
        <div className="eyebrow">Your privacy matters</div>
        <h1>Privacy notice</h1>
        <p>When you register with NIFES UNIBEN, we collect your name, gender, email address, phone number, place of residence, university level, how you heard about us, first-timer status, and your consent timestamp.</p>
        <h2 style={{ fontSize: "1.3rem", marginTop: 22, color: "#ffffff" }}>Why we use your information</h2>
        <p>We use these details to keep fellowship records, manage membership, take attendance, communicate programme information, and support follow-up and integration. Attendance records include the session, time and check-in method.</p>
        <h2 style={{ fontSize: "1.3rem", marginTop: 22, color: "#ffffff" }}>Access and retention</h2>
        <p>Member records are available only to authorised NIFES administrators (e.g. leadership and approved team members) and are protected by role-based access controls. We retain information while needed for fellowship administration.</p>
        <h2 style={{ fontSize: "1.3rem", marginTop: 22, color: "#ffffff" }}>Your choice</h2>
        <p>Registration requires your consent to store your details for fellowship records. You may request access, correction or deletion by contacting the fellowship leadership at <a href="mailto:nifesuniben@example.com" style={{ color: "#3da6f5", textDecoration: "underline" }}>nifesuniben@example.com</a>.</p>
      </article>
    </main>
  );
}
