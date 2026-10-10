"use client";
import { useState } from "react";

type U = {
  email: string;
  role: string;
  status: string;
  date: string;
  addedBy: string;
  last: string | null;
};

export default function AccessTable({ rows, adminEmail }: { rows: U[]; adminEmail?: string }) {
  const [all, setAll] = useState(rows);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [pendingRevokeEmail, setPendingRevokeEmail] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const effectiveAdmin = adminEmail || "nscpeace1@gmail.com";

  async function update(email: string, body: Record<string, string>) {
    try {
      const r = await fetch("/api/admin/access", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Email": effectiveAdmin,
        },
        body: JSON.stringify({ email, ...body }),
      });
      const d = await r.json();
      setMessage({
        text: r.ok ? `Access updated for ${email}.` : d.error || "Update failed",
        error: !r.ok,
      });
      if (r.ok) setAll((a) => a.map((u) => (u.email.toLowerCase() === email.toLowerCase() ? { ...u, ...body } : u)));
    } catch {
      setMessage({ text: "Update failed. Please try again.", error: true });
    }
  }

  async function confirmAndRemove(email: string) {
    const norm = email.toLowerCase();
    if (norm === "nscpeace1@gmail.com") {
      setMessage({ text: "Super Admin Owner nscpeace1@gmail.com cannot be removed.", error: true });
      setPendingRevokeEmail(null);
      return;
    }

    setIsProcessing(true);
    try {
      const r = await fetch("/api/admin/access", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Email": effectiveAdmin,
        },
        body: JSON.stringify({ email }),
      });
      const d = await r.json();
      if (r.ok) {
        setMessage({
          text: `Access for ${email} has been revoked successfully. They can no longer access member records or admin tools.`,
          error: false,
        });
        setAll((a) => a.filter((u) => u.email.toLowerCase() !== norm));
      } else {
        setMessage({ text: d.error || "Removal failed", error: true });
      }
    } catch {
      setMessage({ text: "Network error during revocation. Please try again.", error: true });
    } finally {
      setIsProcessing(false);
      setPendingRevokeEmail(null);
    }
  }

  return (
    <>
      <div style={{ margin: "14px 0" }}>
        {message && (
          <div
            className={message.error ? "error" : "success"}
            style={{ margin: 0, padding: "10px 14px", borderRadius: 8, fontSize: "0.88rem" }}
            role="status"
          >
            {message.text}
          </div>
        )}
      </div>
      <div className="glass" style={{ overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Added</th>
              <th>Added by</th>
              <th>Last login</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {all.map((u) => {
              const norm = u.email.toLowerCase();
              const isOwner = norm === "nscpeace1@gmail.com";
              const isPending = pendingRevokeEmail === u.email;

              return (
                <tr key={u.email}>
                  <td>
                    <strong>{u.email}</strong>
                    {isOwner && (
                      <span style={{ marginLeft: 8, fontSize: "0.75rem", color: "#ec3b83", fontWeight: 700 }}>Super Admin Owner</span>
                    )}
                  </td>
                  <td>
                    <select
                      aria-label={`Role for ${u.email}`}
                      className="dropdown-animated"
                      value={u.role}
                      disabled={isOwner}
                      onChange={(e) => void update(u.email, { role: e.target.value })}
                    >
                      <option value="SUPER_ADMIN">Super Admin</option>
                      <option value="ADMIN">Admin</option>
                      <option value="USHER">Usher</option>
                    </select>
                  </td>
                  <td>
                    <select
                      aria-label={`Status for ${u.email}`}
                      className="dropdown-animated"
                      value={u.status}
                      disabled={isOwner}
                      onChange={(e) => void update(u.email, { status: e.target.value })}
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="INVITED">Invited</option>
                      <option value="DISABLED">Disabled</option>
                    </select>
                  </td>
                  <td>{u.date}</td>
                  <td>{u.addedBy}</td>
                  <td>{u.last || "—"}</td>
                  <td>
                    {isOwner ? (
                      <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Protected</span>
                    ) : isPending ? (
                      <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                        <button
                          type="button"
                          disabled={isProcessing}
                          className="button button-primary"
                          style={{ background: "#dc2626", borderColor: "#ef4444", padding: "4px 10px", fontSize: "0.76rem", fontWeight: 700 }}
                          onClick={() => void confirmAndRemove(u.email)}
                        >
                          {isProcessing ? "Revoking..." : "Confirm Revoke"}
                        </button>
                        <button
                          type="button"
                          disabled={isProcessing}
                          className="btn ghost"
                          style={{ padding: "4px 8px", fontSize: "0.76rem" }}
                          onClick={() => setPendingRevokeEmail(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="btn ghost"
                        style={{ color: "#f43f5e", padding: "6px 12px", fontSize: "0.8rem", border: "1px solid rgba(244, 63, 94, 0.3)" }}
                        onClick={() => setPendingRevokeEmail(u.email)}
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
    </>
  );
}
