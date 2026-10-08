import { requireRole } from "@/lib/access";
import { db } from "@/lib/db";
import MemberTable, { type Member } from "./table";
import Link from "next/link";

export default async function Members() {
  const session = await requireRole(["SUPER_ADMIN", "ADMIN"]);
  const rows = await db.member.findMany({ take: 500, orderBy: { createdAt: "desc" } });
  const members = rows.map((m) => ({
    ...m,
    createdAt: new Date(m.createdAt).toISOString(),
  })) as unknown as Member[];

  return (
    <main className="wrap page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <Link href="/admin" className="btn ghost" style={{ padding: "8px 14px", fontSize: "0.85rem" }}>
            ← Admin Dashboard
          </Link>
          <Link href="/" className="btn ghost" style={{ padding: "8px 14px", fontSize: "0.85rem" }}>
            Home
          </Link>
        </div>
        <span className="muted" style={{ fontSize: "0.85rem" }}>
          Signed in as: <strong style={{ color: "#3da6f5" }}>{session.user?.email}</strong> ({session.user?.role})
        </span>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 14, margin: "16px 0 24px" }}>
        <div>
          <div className="eyebrow">Database Directory</div>
          <h1 style={{ margin: "4px 0 0" }}>Member Records</h1>
        </div>
        <div className="actions" style={{ display: "flex", gap: 10 }}>
          <a className="button button-primary" href="/api/admin/export?type=members">
            Download Members CSV
          </a>
          <a className="button button-secondary" href="/api/admin/export?type=attendance">
            Download Attendance CSV
          </a>
        </div>
      </div>

      <MemberTable rows={members} />
    </main>
  );
}
