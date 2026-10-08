import { requireRole } from "@/lib/access";
import { db } from "@/lib/db";
import MemberTable, { type Member } from "./table";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function Members({
  searchParams,
}: {
  searchParams?: Promise<{ admin?: string }>;
}) {
  const { admin } = (await searchParams) || {};
  const session = await requireRole(["SUPER_ADMIN", "ADMIN"], admin);
  const rows = await db.member.findMany({ take: 500, orderBy: { createdAt: "desc" } });
  const members = rows.map((m) => ({
    ...m,
    createdAt: new Date(m.createdAt).toISOString(),
  })) as unknown as Member[];

  const currentAdmin = session.user.email;
  const adminQuery = `?admin=${encodeURIComponent(currentAdmin)}`;

  return (
    <main className="wrap page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Link href={`/admin${adminQuery}`} className="btn ghost" style={{ padding: "8px 14px", fontSize: "0.85rem" }}>
            ← Admin Dashboard
          </Link>
          <Link href="/" className="btn ghost" style={{ padding: "8px 14px", fontSize: "0.85rem" }}>
            Home
          </Link>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="muted" style={{ fontSize: "0.85rem" }}>
            Signed in: <strong style={{ color: "#3da6f5" }}>{currentAdmin}</strong> ({session.user?.role})
          </span>
          <form
            action={async () => {
              "use server";
              const cookieStore = await cookies();
              cookieStore.delete("nifes_admin_email");
              cookieStore.set("nifes_logged_out", "1", { path: "/", sameSite: "none", secure: true });
              redirect("/admin/login");
            }}
          >
            <button className="btn ghost" style={{ padding: "6px 12px", fontSize: "0.78rem" }}>
              Switch account
            </button>
          </form>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 14, margin: "16px 0 24px" }}>
        <div>
          <div className="eyebrow">Database Directory</div>
          <h1 style={{ margin: "4px 0 0" }}>Member Records</h1>
        </div>
        <div className="actions" style={{ display: "flex", gap: 10 }}>
          <a className="button button-primary" href={`/api/admin/export?type=members&admin=${encodeURIComponent(currentAdmin)}`}>
            Download Members CSV
          </a>
          <a className="button button-secondary" href={`/api/admin/export?type=attendance&admin=${encodeURIComponent(currentAdmin)}`}>
            Download Attendance CSV
          </a>
        </div>
      </div>

      <MemberTable rows={members} adminEmail={currentAdmin} />
    </main>
  );
}
