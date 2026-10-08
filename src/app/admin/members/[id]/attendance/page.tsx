import { requireRole } from "@/lib/access";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function MemberAttendance({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ admin?: string }>;
}) {
  const { admin } = (await searchParams) || {};
  const session = await requireRole(["SUPER_ADMIN", "ADMIN"], admin);
  const { id } = await params;
  const m = await db.member.findUnique({
    where: { id },
    include: {
      attendances: {
        include: { session: true },
        orderBy: { checkedInAt: "desc" },
      },
    },
  });

  if (!m) notFound();

  const currentAdmin = session.user.email;
  const adminParam = `?admin=${encodeURIComponent(currentAdmin)}`;

  return (
    <main className="wrap page">
      <div style={{ marginBottom: 16 }}>
        <Link href={`/admin/members${adminParam}`} className="btn ghost" style={{ fontSize: "0.85rem" }}>
          ← Back to Member Records
        </Link>
      </div>
      <div className="eyebrow">Individual Member History</div>
      <h1 style={{ margin: "4px 0 6px" }}>
        {m.firstName} {m.lastName}
      </h1>
      <p className="muted">
        Member ID: <strong style={{ color: "#3da6f5", fontFamily: "monospace" }}>{m.memberId}</strong> · Attendance History
      </p>

      <div className="glass" style={{ overflowX: "auto", marginTop: 20 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Session</th>
              <th>Venue</th>
              <th>Checked in</th>
              <th>Method</th>
            </tr>
          </thead>
          <tbody>
            {m.attendances.length === 0 ? (
              <tr>
                <td colSpan={4} className="muted" style={{ textAlign: "center", padding: "28px" }}>
                  No attendance records logged yet for this member.
                </td>
              </tr>
            ) : (
              m.attendances.map(
                (a: {
                  id: string;
                  session: { name: string; venue: string };
                  checkedInAt: Date;
                  method: string;
                }) => (
                  <tr key={a.id}>
                    <td><strong>{a.session.name}</strong></td>
                    <td>{a.session.venue}</td>
                    <td>{new Date(a.checkedInAt).toLocaleString()}</td>
                    <td><span className="pill blue" style={{ fontSize: "0.75rem" }}>{a.method}</span></td>
                  </tr>
                )
              )
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
