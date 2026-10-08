"use client";
import { useMemo, useState } from "react";
import Link from "next/link";

export type Member = {
  id: string;
  memberId: string;
  firstName: string;
  lastName: string;
  gender: "Male" | "Female";
  email: string | null;
  phone: string;
  placeOfResidence: string | null;
  heardAbout: "Friend" | "WhatsApp" | "Instagram" | "Flier" | "Other" | null;
  heardAboutOther: string | null;
  firstTimer: boolean;
  level: "L100" | "L200" | "L300" | "L400" | "L500" | "L600" | "POSTGRADUATE" | null;
  guest: boolean;
  createdAt: string;
};

export default function MemberTable({ rows, adminEmail }: { rows: Member[]; adminEmail?: string }) {
  const [all, setAll] = useState(rows);
  const [query, setQuery] = useState("");
  const [gender, setGender] = useState("");
  const [level, setLevel] = useState("");
  const [first, setFirst] = useState("");
  const [source, setSource] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [notification, setNotification] = useState<{ text: string; error?: boolean } | null>(null);

  const shown = useMemo(
    () =>
      all.filter(
        (m) =>
          `${m.firstName} ${m.lastName} ${m.phone} ${m.email || ""} ${m.memberId}`.toLowerCase().includes(query.toLowerCase()) &&
          (!gender || m.gender === gender) &&
          (!level || m.level === level) &&
          (!first || (m.firstTimer ? "Yes" : "No") === first) &&
          (!source || m.heardAbout === source) &&
          (!from || m.createdAt >= from) &&
          (!to || m.createdAt.slice(0, 10) <= to)
      ),
    [all, query, gender, level, first, source, from, to]
  );

  async function save(e: React.FormEvent<HTMLFormElement>, m: Member) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const data = Object.fromEntries(fd.entries()) as Record<string, string | boolean | null>;
    data.firstTimer = fd.get("firstTimer") === "on";
    data.level = String(data.level || "") || null;
    data.heardAbout = String(data.heardAbout || "") || null;
    data.heardAboutOther = data.heardAbout === "Other" ? String(data.heardAboutOther || "") : null;

    try {
      const queryParam = adminEmail ? `?admin=${encodeURIComponent(adminEmail)}` : "";
      const r = await fetch(`/api/admin/members/${m.id}${queryParam}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const d = await r.json();
      if (!r.ok) {
        setNotification({ text: d.error || "Update failed", error: true });
        return;
      }
      const clean: Partial<Member> = {
        firstName: String(data.firstName),
        lastName: String(data.lastName),
        gender: data.gender as Member["gender"],
        email: String(data.email || "") || null,
        phone: String(data.phone),
        placeOfResidence: String(data.placeOfResidence || "") || null,
        heardAbout: data.heardAbout as Member["heardAbout"],
        heardAboutOther: data.heardAboutOther as string | null,
        firstTimer: Boolean(data.firstTimer),
        level: data.level as Member["level"],
      };
      setAll((a) => a.map((x) => (x.id === m.id ? { ...x, ...clean } : x)));
      setNotification({ text: `Member ${data.firstName} updated successfully.` });
    } catch {
      setNotification({ text: "Failed to update member. Try again.", error: true });
    }
  }

  async function remove(m: Member) {
    try {
      const queryParam = adminEmail ? `?admin=${encodeURIComponent(adminEmail)}` : "";
      const r = await fetch(`/api/admin/members/${m.id}${queryParam}`, { method: "DELETE" });
      if (r.ok) {
        setAll((a) => a.filter((x) => x.id !== m.id));
        setNotification({ text: `Member ${m.firstName} deleted.` });
      } else {
        const d = await r.json().catch(() => ({}));
        setNotification({ text: d.error || "Could not delete this member.", error: true });
      }
    } catch {
      setNotification({ text: "Deletion failed.", error: true });
    }
  }

  return (
    <>
      {notification && (
        <div className={notification.error ? "error" : "success"} style={{ margin: "14px 0" }} role="status">
          {notification.text}
        </div>
      )}

      <div className="row" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
        <label className="field">
          Search
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, phone, email or ID" />
        </label>
        <label className="field">
          Gender
          <select className="dropdown-animated" value={gender} onChange={(e) => setGender(e.target.value)}>
            <option value="">All</option>
            <option>Male</option>
            <option>Female</option>
          </select>
        </label>
        <label className="field">
          Level
          <select className="dropdown-animated" value={level} onChange={(e) => setLevel(e.target.value)}>
            <option value="">All</option>
            {["L100", "L200", "L300", "L400", "L500", "L600", "POSTGRADUATE"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label className="field">
          First timer
          <select className="dropdown-animated" value={first} onChange={(e) => setFirst(e.target.value)}>
            <option value="">All</option>
            <option>Yes</option>
            <option>No</option>
          </select>
        </label>
        <label className="field">
          Source
          <select className="dropdown-animated" value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">All</option>
            {["Friend", "WhatsApp", "Instagram", "Flier", "Other"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label className="field">
          From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="field">
          To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>

      <p className="muted" style={{ margin: "8px 0 16px" }}>
        Showing {shown.length} of {all.length} records.
      </p>

      <div className="glass" style={{ overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Name / ID</th>
              <th>Gender</th>
              <th>Email / Phone</th>
              <th>Residence</th>
              <th>Level</th>
              <th>Source</th>
              <th>First timer</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((m) => (
              <tr key={m.id}>
                <td>
                  <strong>{m.firstName} {m.lastName}</strong>
                  {m.guest && <span style={{ color: "#f43f5e", fontSize: "0.75rem", marginLeft: 6 }}>Guest</span>}
                  <small style={{ display: "block", color: "#85aed3", fontFamily: "monospace" }}>{m.memberId}</small>
                  <Link href={`/admin/members/${m.id}/attendance${adminEmail ? `?admin=${encodeURIComponent(adminEmail)}` : ""}`} style={{ fontSize: "0.78rem", color: "#3da6f5", textDecoration: "underline" }}>
                    Attendance history
                  </Link>
                </td>
                <td>{m.gender}</td>
                <td>
                  <div>{m.email || "—"}</div>
                  <small style={{ display: "block", color: "#85aed3" }}>{m.phone}</small>
                </td>
                <td>{m.placeOfResidence || "—"}</td>
                <td>{m.level || "—"}</td>
                <td>
                  {m.heardAbout ? `${m.heardAbout}${m.heardAboutOther ? `: ${m.heardAboutOther}` : ""}` : "—"}
                </td>
                <td>
                  <span className={`pill ${m.firstTimer ? "amber" : ""}`} style={{ fontSize: "0.75rem" }}>
                    {m.firstTimer ? "Yes" : "No"}
                  </span>
                </td>
                <td>{new Date(m.createdAt).toLocaleDateString()}</td>
                <td>
                  <details style={{ minWidth: 200 }}>
                    <summary style={{ cursor: "pointer", fontWeight: 700, color: "#3da6f5" }}>Edit / Delete</summary>
                    <form onSubmit={(e) => void save(e, m)} style={{ marginTop: 10, display: "grid", gap: 8 }}>
                      <label className="field" style={{ margin: "4px 0" }}>
                        First name
                        <input name="firstName" defaultValue={m.firstName} required />
                      </label>
                      <label className="field" style={{ margin: "4px 0" }}>
                        Last name
                        <input name="lastName" defaultValue={m.lastName} required />
                      </label>
                      <label className="field" style={{ margin: "4px 0" }}>
                        Gender
                        <select name="gender" defaultValue={m.gender} className="dropdown-animated">
                          <option>Male</option>
                          <option>Female</option>
                        </select>
                      </label>
                      <label className="field" style={{ margin: "4px 0" }}>
                        Email
                        <input name="email" type="email" defaultValue={m.email || ""} />
                      </label>
                      <label className="field" style={{ margin: "4px 0" }}>
                        Phone
                        <input name="phone" defaultValue={m.phone} required />
                      </label>
                      <label className="field" style={{ margin: "4px 0" }}>
                        Residence
                        <input name="placeOfResidence" defaultValue={m.placeOfResidence || ""} />
                      </label>
                      <label className="field" style={{ margin: "4px 0" }}>
                        Level
                        <select name="level" defaultValue={m.level || ""} className="dropdown-animated">
                          <option value="">Not provided</option>
                          {["L100", "L200", "L300", "L400", "L500", "L600", "POSTGRADUATE"].map((x) => (
                            <option key={x}>{x}</option>
                          ))}
                        </select>
                      </label>
                      <label className="field" style={{ margin: "4px 0" }}>
                        How heard
                        <select name="heardAbout" defaultValue={m.heardAbout || ""} className="dropdown-animated">
                          <option value="">Not provided</option>
                          {["Friend", "WhatsApp", "Instagram", "Flier", "Other"].map((x) => (
                            <option key={x}>{x}</option>
                          ))}
                        </select>
                      </label>
                      <label className="field" style={{ margin: "4px 0" }}>
                        Other detail
                        <input name="heardAboutOther" defaultValue={m.heardAboutOther || ""} />
                      </label>
                      <label className="consent" style={{ margin: "6px 0" }}>
                        <input type="checkbox" name="firstTimer" defaultChecked={m.firstTimer} /> First timer
                      </label>
                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <button className="btn" type="submit" style={{ flex: 1, padding: "8px 12px", fontSize: "0.85rem" }}>Save</button>
                        <button
                          type="button"
                          className="btn ghost"
                          style={{ padding: "8px 12px", fontSize: "0.85rem", color: "#f43f5e" }}
                          onClick={() => void remove(m)}
                        >
                          Delete
                        </button>
                      </div>
                    </form>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
