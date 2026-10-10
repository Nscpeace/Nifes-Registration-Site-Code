"use client";
import { useState } from "react";

export default function AccessForm({ adminEmail }: { adminEmail?: string }) {
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setMessage("");
    const formElement = e.currentTarget;
    const form = new FormData(formElement);
    const email = form.get("email")?.toString().trim().toLowerCase();
    const role = form.get("role")?.toString() || "ADMIN";

    try {
      const r = await fetch("/api/admin/access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(adminEmail ? { "X-Admin-Email": adminEmail } : {}),
        },
        body: JSON.stringify({ email, role }),
      });
      const d = await r.json();
      if (r.ok) {
        setIsError(false);
        setMessage(`Success! ${email} is now authorized as ${role}. Access is permanent until revoked.`);
        formElement.reset();
        window.location.reload();
      } else {
        setIsError(true);
        setMessage(d.error || "Could not add authorized email.");
      }
    } catch {
      setIsError(true);
      setMessage("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="glass" style={{ margin: "20px 0", padding: "20px" }} onSubmit={submit}>
      <h2 style={{ margin: "0 0 12px", fontSize: "1.2rem" }}>Authorize Administrator Email</h2>
      <p className="muted" style={{ fontSize: "0.85rem", margin: "0 0 16px" }}>
        Every authorized email stays permanently authorized until explicitly revoked.
      </p>
      <div className="row" style={{ display: "grid", gridTemplateColumns: "1fr 180px", gap: 12 }}>
        <div className="field">
          <label htmlFor="email">Email Address</label>
          <input id="email" name="email" type="email" placeholder="e.g. colleague@gmail.com" required />
        </div>
        <div className="field">
          <label htmlFor="role">Role Permission</label>
          <select id="role" name="role" defaultValue="ADMIN" className="dropdown-animated">
            <option value="ADMIN">Admin (Full Records Access)</option>
            <option value="SUPER_ADMIN">Super Admin (All Permissions)</option>
            <option value="USHER">Usher (Check-in Scanner)</option>
          </select>
        </div>
      </div>
      <button className="btn btn-primary" style={{ marginTop: 14 }} disabled={submitting}>
        {submitting ? "Authorizing..." : "+ Authorize Email"}
      </button>
      {message && (
        <p className={isError ? "error" : "success"} role="status" style={{ marginTop: 12, padding: "8px 12px", borderRadius: 8 }}>
          {message}
        </p>
      )}
    </form>
  );
}
