import { NextResponse } from "next/server";
import { z } from "zod";
import { db, isDefaultSuperAdmin, DEFAULT_SUPER_ADMIN_EMAILS } from "@/lib/db";
import { resolveAdminSession } from "@/lib/access";

export async function POST(req: Request) {
  const session = await resolveAdminSession(["SUPER_ADMIN", "ADMIN"], undefined, req);
  if (!session?.user?.adminId) {
    return NextResponse.json({ error: "Forbidden: Admin access required." }, { status: 403 });
  }

  try {
    const body = await req.json();

    const { email, role } = z.object({
      email: z.string().email(),
      role: z.enum(["SUPER_ADMIN", "ADMIN", "USHER"]).default("ADMIN"),
    }).parse(body);

    const normalized = email.trim().toLowerCase();
    if (isDefaultSuperAdmin(normalized)) {
      return NextResponse.json({ error: `${normalized} is already a permanent Super Admin Owner.` }, { status: 409 });
    }

    const user = await db.adminUser.upsert({
      where: { email: normalized },
      update: { role, status: "ACTIVE" },
      create: { email: normalized, role, status: "ACTIVE", invitedBy: session.user.adminId },
    });

    await db.auditLog.create({
      data: {
        adminId: session.user.adminId,
        action: "ACCESS_INVITED",
        details: { email: normalized, role },
      },
    });

    return NextResponse.json({ id: user.id, ok: true }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Enter a valid email and role." }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  const s = await resolveAdminSession(["SUPER_ADMIN", "ADMIN"], undefined, req);
  if (!s?.user?.adminId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const d = z.object({
      email: z.string().email(),
      role: z.enum(["ADMIN", "USHER", "SUPER_ADMIN"]).optional(),
      status: z.enum(["INVITED", "ACTIVE", "DISABLED"]).optional(),
    }).parse(await req.json());

    const email = d.email.trim().toLowerCase();
    if (isDefaultSuperAdmin(email) && (d.status === "DISABLED" || (d.role && d.role !== "SUPER_ADMIN"))) {
      return NextResponse.json({ error: "Default Super Admin cannot be disabled or downgraded." }, { status: 409 });
    }

    const old = await db.adminUser.findUnique({ where: { email } });
    if (!old) return NextResponse.json({ error: "Authorised email not found." }, { status: 404 });

    const user = await db.adminUser.update({
      where: { email },
      data: { ...(d.role ? { role: d.role } : {}), ...(d.status ? { status: d.status } : {}) },
    });

    await db.auditLog.create({
      data: { adminId: s.user.adminId, action: "ACCESS_UPDATED", details: { email, role: user.role, status: user.status } },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not update access." }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const s = await resolveAdminSession(["SUPER_ADMIN", "ADMIN"], undefined, req);
  if (!s?.user?.adminId) {
    return NextResponse.json({ error: "Forbidden: Admin access required." }, { status: 403 });
  }

  try {
    const body = await req.json();

    if (body.clearAll === true) {
      return NextResponse.json({ error: "Bulk clearance is disabled to protect authorized emails. Revoke individual access instead." }, { status: 400 });
    }

    const { email } = z.object({ email: z.string().email() }).parse(body);
    const normalized = email.trim().toLowerCase();

    if (isDefaultSuperAdmin(normalized)) {
      return NextResponse.json({ error: "Main Super Admin nscpeace1@gmail.com cannot be removed." }, { status: 409 });
    }

    const user = await db.adminUser.findUnique({ where: { email: normalized } });
    if (user) {
      await db.auditLog.create({
        data: { adminId: s.user.adminId, action: "ACCESS_REMOVED", details: { email: normalized, role: user.role } },
      });
    }
    await db.adminUser.deleteMany({ where: { email: normalized } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not remove access." }, { status: 400 });
  }
}
