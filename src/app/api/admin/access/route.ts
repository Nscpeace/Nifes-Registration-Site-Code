import { NextResponse } from "next/server";
import { z } from "zod";
import { db, clearAllAuthorizedExceptSuperAdmin, PRIMARY_ADMIN_EMAIL } from "@/lib/db";
import { resolveAdminSession } from "@/lib/access";

export async function POST(req: Request) {
  const session = await resolveAdminSession(["SUPER_ADMIN"], undefined, req);
  if (!session?.user?.adminId || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden: Super Admin access required." }, { status: 403 });
  }

  try {
    const body = await req.json();

    // Check if clearAll action requested via POST
    if (body.action === "CLEAR_ALL" || body.clearAll) {
      const result = await clearAllAuthorizedExceptSuperAdmin();
      await db.auditLog.create({
        data: {
          adminId: session.user.adminId,
          action: "ACCESS_ALL_CLEARED",
          details: { retained: PRIMARY_ADMIN_EMAIL, clearedCount: result.deletedCount },
        },
      });
      return NextResponse.json({ ok: true, cleared: result.deletedCount });
    }

    const { email, role } = z.object({
      email: z.string().email(),
      role: z.enum(["ADMIN", "USHER"]),
    }).parse(body);

    const normalized = email.trim().toLowerCase();
    if (normalized === PRIMARY_ADMIN_EMAIL) {
      return NextResponse.json({ error: "Primary Admin nscpeace1@gmail.com is already configured." }, { status: 409 });
    }

    const existing = await db.adminUser.findUnique({ where: { email: normalized } });
    if (existing?.role === "SUPER_ADMIN") {
      return NextResponse.json({ error: "Super Admin access cannot be changed here." }, { status: 409 });
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

    return NextResponse.json({ id: user.id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Enter a valid email and role." }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  const s = await resolveAdminSession(["SUPER_ADMIN"], undefined, req);
  if (!s?.user?.adminId || s.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const d = z.object({
      email: z.string().email(),
      role: z.enum(["ADMIN", "USHER", "SUPER_ADMIN"]).optional(),
      status: z.enum(["INVITED", "ACTIVE", "DISABLED"]).optional(),
    }).parse(await req.json());

    const email = d.email.trim().toLowerCase();
    if (email === PRIMARY_ADMIN_EMAIL && (d.status === "DISABLED" || (d.role && d.role !== "SUPER_ADMIN"))) {
      return NextResponse.json({ error: "Primary Admin nscpeace1@gmail.com cannot be disabled or downgraded." }, { status: 409 });
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
  const s = await resolveAdminSession(["SUPER_ADMIN"], undefined, req);
  if (!s?.user?.adminId || s.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden: Super Admin access required." }, { status: 403 });
  }

  try {
    const body = await req.json();

    // Check if clearing all authorized emails except primary owner
    if (body.clearAll === true) {
      const result = await clearAllAuthorizedExceptSuperAdmin();
      await db.auditLog.create({
        data: {
          adminId: s.user.adminId,
          action: "ACCESS_ALL_CLEARED",
          details: { retained: PRIMARY_ADMIN_EMAIL, clearedCount: result.deletedCount },
        },
      });
      return NextResponse.json({ ok: true, cleared: result.deletedCount });
    }

    const { email } = z.object({ email: z.string().email() }).parse(body);
    const normalized = email.trim().toLowerCase();

    if (normalized === PRIMARY_ADMIN_EMAIL) {
      return NextResponse.json({ error: "Primary Super Admin nscpeace1@gmail.com cannot be removed." }, { status: 409 });
    }

    const user = await db.adminUser.findUnique({ where: { email: normalized } });
    if (!user) return NextResponse.json({ error: "Authorised email not found." }, { status: 404 });

    await db.auditLog.create({
      data: { adminId: s.user.adminId, action: "ACCESS_REMOVED", details: { email: normalized, role: user.role } },
    });
    await db.adminUser.delete({ where: { email: normalized } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not remove access." }, { status: 400 });
  }
}
