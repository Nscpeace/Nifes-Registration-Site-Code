import { requireRole } from "@/lib/access";
import { db } from "@/lib/db";
import AccessForm from "./form";
import AccessTable from "./access-table";

export default async function Access({
  searchParams,
}: {
  searchParams?: Promise<{ admin?: string }>;
}) {
  const { admin } = (await searchParams) || {};
  const session = await requireRole(["SUPER_ADMIN"], admin);
  const users = await db.adminUser.findMany({
    include: { inviter: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <main className="wrap page">
      <a href={`/admin?admin=${encodeURIComponent(session.user.email)}`}>← Dashboard</a>
      <h1>Manage access</h1>
      <p className="muted">
        Only verified accounts on this list can sign in. Every authorized email remains authorized until revoked. Changes are recorded in the audit log.
      </p>
      <AccessForm adminEmail={session.user.email} />
      <AccessTable
        adminEmail={session.user.email}
        rows={users.map((u) => ({
          email: u.email,
          role: u.role,
          status: u.status,
          date: u.createdAt instanceof Date ? u.createdAt.toLocaleDateString() : String(u.createdAt || "Seeded"),
          addedBy: u.inviter?.email ?? "Seeded",
          last: u.lastLoginAt?.toLocaleDateString() ?? null,
        }))}
      />
    </main>
  );
}
