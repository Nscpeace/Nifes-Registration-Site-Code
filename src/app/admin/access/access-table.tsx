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

export default function AccessTable({ rows }: { rows: U[] }) {
  const [all, setAll] = useState(rows);
  const [message, setMessage] = useState("");

  async function update(email: string, body: Record<string, string>) {
    try {
      const r = await fetch("/api/admin/access", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, ...body }),
      });
      const d = await r.json();
      setMessage(r.ok ? "Access updated." : d.error || "Update failed");
      if (r.ok) setAll((a) => a.map((u) => (u.email === email ? { ...u, ...body } : u)));
    } catch {
      setMessage("Update failed. Try again.");
    }
  }

  async function remove(email: string) {
    try {
      const r = await fetch("/api/admin/access", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const d = await r.json();
      setMessage(r.ok ? `Removed ${email} from authorised users.` : d.error || "Removal failed");
      if (r.ok) setAll((a) => a.filter((u) => u.email !== email));
    } catch {
      setMessage("Removal failed. Try again.");
    }
  }

  async function clearAll() {
    if (!confirm("Are you sure you want to clear all authorized emails? Only primary admin nscpeace1@gmail.com will retain access.")) return;
    try {
      const r = await fetch("/api/admin/access", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearAll: true }),
      });
      const d = await r.json();
      if (r.ok) {
        setAll((a) => a.filter((u) => u.email.toLowerCase() === "nscpeace1@gmail.com"));
        setMessage("Authorization list cleared. Only nscpeace1@gmail.com is authorized now.");
      } else {
        setMessage(d.error || "Clear failed");
      }
    } catch {
      setMessage("Clear failed. Try again.");
    }
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "14px 0", flexWrap: "wrap", gap: 10 }}>
        {message ? <p className="success" style={{ margin: 0 }} role="status">{message}</p> : <div />}
        <button
          type="button"
          onClick={() => void clearAll()}
          className="btn ghost"
          style={{ color: "#f87171", fontSize: "0.8rem", padding: "6px 12px" }}
        >
          🗑️ Clear Authorization List
        </button>
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
              const isOwner = u.email.toLowerCase() === "nscpeace1@gmail.com";
              return (
                <tr key={u.email}>
                  <td>
                    <strong>{u.email}</strong>
                    {isOwner && (
                      <span style={{ marginLeft: 8, fontSize: "0.75rem", color: "#ec3b83", fontWeight: 700 }}>Primary Admin</span>
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
                      <option value="INVITED">Invited</option>
                      <option value="ACTIVE">Active</option>
                      <option value="DISABLED">Disabled</option>
                    </select>
                  </td>
                  <td>{u.date}</td>
                  <td>{u.addedBy}</td>
                  <td>{u.last || "—"}</td>
                  <td>
                    {isOwner ? (
                      <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Protected</span>
                    ) : (
                      <button className="btn ghost" style={{ color: "#f43f5e", padding: "6px 12px", fontSize: "0.8rem" }} onClick={() => void remove(u.email)}>
                        Remove
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
