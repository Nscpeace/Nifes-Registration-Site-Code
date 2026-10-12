import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { resolveAdminSession } from "@/lib/access";

const schema = z.object({
  memberId: z.string().min(1),
  sessionId: z.string().min(1),
  action: z.enum(["checkin", "remove"]).default("checkin"),
});

export async function POST(req: Request) {
  const session = await resolveAdminSession(["SUPER_ADMIN", "ADMIN"], undefined, req);
  if (!session?.user?.adminId) {
    return NextResponse.json({ error: "Forbidden: Admin access required." }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { memberId, sessionId, action } = schema.parse(body);

    // Verify member exists
    const member = await db.member.findFirst({
      where: {
        OR: [{ id: memberId }, { memberId: memberId.toUpperCase() }],
      },
    });

    if (!member) {
      return NextResponse.json({ error: "Member not found." }, { status: 404 });
    }

    const serviceSession = await db.session.findUnique({
      where: { id: sessionId },
    });

    if (!serviceSession) {
      return NextResponse.json({ error: "Service session not found." }, { status: 404 });
    }

    if (action === "checkin") {
      const existing = await db.attendance.findUnique({
        where: {
          memberId_sessionId: { memberId: member.id, sessionId: serviceSession.id },
        },
      });

      if (existing) {
        return NextResponse.json({ message: "Member is already marked present.", attendance: existing });
      }

      const created = await db.attendance.create({
        data: {
          memberId: member.id,
          sessionId: serviceSession.id,
          checkedInAt: new Date(),
          method: "ADMIN_MANUAL",
        },
      });

      await db.auditLog.create({
        data: {
          adminId: session.user.adminId,
          action: "MANUAL_CHECKIN",
          details: { memberId: member.memberId, sessionId: serviceSession.id },
        },
      });

      return NextResponse.json({
        message: `Successfully checked in ${member.firstName} ${member.lastName}.`,
        attendance: created,
      });
    } else {
      // Remove attendance
      const existing = await db.attendance.findUnique({
        where: {
          memberId_sessionId: { memberId: member.id, sessionId: serviceSession.id },
        },
      });

      if (existing) {
        await db.attendance.delete({
          where: { id: existing.id },
        });

        await db.auditLog.create({
          data: {
            adminId: session.user.adminId,
            action: "MANUAL_CHECKIN_REMOVED",
            details: { memberId: member.memberId, sessionId: serviceSession.id },
          },
        });
      }

      return NextResponse.json({
        message: `Removed check-in record for ${member.firstName} ${member.lastName}.`,
      });
    }
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
    }
    console.error("Manual attendance update error:", err);
    return NextResponse.json({ error: "Could not update attendance record." }, { status: 500 });
  }
}
