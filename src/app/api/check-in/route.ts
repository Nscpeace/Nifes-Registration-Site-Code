import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { normalizeNigerianPhone } from "@/lib/phone";
import { limited } from "@/lib/rate-limit";
import { findOpenSession } from "@/lib/open-session";

export async function GET() {
  try {
    const session = await findOpenSession();
    return NextResponse.json({
      open: Boolean(session),
      session: session ? {
        id: session.id,
        name: session.name,
        venue: session.venue,
        startsAt: session.startsAt,
      } : null,
    });
  } catch (e) {
    return NextResponse.json({ open: true, session: { name: "Fellowship Service", venue: "FAGCOOP Multipurpose Hall" } });
  }
}

export async function POST(request: Request) {
  try {
    if (await limited(request, "self-checkin", 30, 5 * 60_000)) {
      return NextResponse.json({ error: "Too many attempts. Please wait a few minutes." }, { status: 429 });
    }
    const { identifier } = z.object({ identifier: z.string().trim().min(2).max(254) }).parse(await request.json());
    
    // Normalize phone numbers in various formats: 080..., +234..., 80...
    const normalized = normalizeNigerianPhone(identifier);
    const rawClean = identifier.replace(/[\s()-]/g, "");

    const member = await db.member.findFirst({
      where: {
        OR: [
          { memberId: identifier.toUpperCase() },
          ...(normalized ? [{ phone: normalized }] : []),
          { phone: rawClean },
          { email: identifier.toLowerCase() },
        ],
      },
    });

    if (!member) {
      return NextResponse.json({
        error: "We couldn't find a member with that phone number or ID. Please check or register as a member.",
      }, { status: 404 });
    }

    const now = new Date();
    const session = await findOpenSession(now);
    if (!session) {
      return NextResponse.json({
        error: "Check-in session is starting shortly. Please try again or ask an usher for assistance.",
      }, { status: 400 });
    }

    const existing = await db.attendance.findUnique({
      where: { memberId_sessionId: { memberId: member.id, sessionId: session.id } },
    });

    if (existing) {
      return NextResponse.json({
        message: "You are already checked in!",
        session: session.name,
        name: `${member.firstName} ${member.lastName}`,
        memberId: member.memberId,
      });
    }

    await db.attendance.create({
      data: {
        memberId: member.id,
        sessionId: session.id,
        method: "SELF",
      },
    });

    return NextResponse.json({
      message: "Check-in successful! Praise God!",
      session: session.name,
      name: `${member.firstName} ${member.lastName}`,
      memberId: member.memberId,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Enter your registered phone number or member ID." }, { status: 400 });
    }
    return NextResponse.json({ error: "Check-in service encountered an issue. Please try again." }, { status: 500 });
  }
}
