import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { resolveAdminSession } from "@/lib/access";

export async function POST(req: Request) {
  const s = await resolveAdminSession(["SUPER_ADMIN", "ADMIN"], undefined, req);
  if (!s?.user?.adminId || !["SUPER_ADMIN", "ADMIN"].includes(s.user.role || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const d = z.object({
      name: z.string().trim().min(2).max(100),
      startsAt: z.string().datetime(),
      venue: z.string().trim().min(2).max(150),
    }).parse(await req.json());

    const row = await db.session.create({
      data: {
        name: d.name,
        startsAt: new Date(d.startsAt),
        venue: d.venue,
        eventId: null,
        active: true,
      },
    });

    await db.auditLog.create({
      data: {
        adminId: s.user.adminId,
        action: "SESSION_CREATED",
        details: { sessionId: row.id, name: row.name },
      },
    });

    return NextResponse.json({ id: row.id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Enter a valid session name, date and venue." }, { status: 400 });
  }
}
