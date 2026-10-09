import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { normalizeNigerianPhone } from "@/lib/phone";
import { limited } from "@/lib/rate-limit";
import { findOpenSession, getAllProgramLapsWithStatus, getLapForToday } from "@/lib/open-session";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const lapId = url.searchParams.get("lap") || undefined;

    const [session, allLaps] = await Promise.all([
      findOpenSession(new Date(), lapId),
      getAllProgramLapsWithStatus(new Date()),
    ]);

    return NextResponse.json({
      open: true,
      session: session
        ? {
            id: session.id,
            name: session.name,
            dayOfService: session.dayOfService,
            serviceLapName: session.serviceLapName,
            venue: session.venue,
            startsAt: session.startsAt,
            displayTime: session.displayTime,
          }
        : null,
      laps: allLaps,
    });
  } catch {
    const fallbackLap = getLapForToday();
    return NextResponse.json({
      open: true,
      session: {
        id: `fallback_${fallbackLap.id}`,
        name: fallbackLap.name,
        dayOfService: fallbackLap.dayOfService,
        serviceLapName: `${fallbackLap.name} (${fallbackLap.dayOfService})`,
        venue: fallbackLap.venue,
        displayTime: fallbackLap.displayTime,
      },
      laps: [],
    });
  }
}

export async function POST(request: Request) {
  try {
    if (await limited(request, "self-checkin", 60, 5 * 60_000)) {
      return NextResponse.json(
        { error: "Too many check-in attempts. Please wait a few moments." },
        { status: 429 }
      );
    }

    const { identifier, lapId } = z
      .object({
        identifier: z.string().trim().min(2).max(254),
        lapId: z.string().optional(),
      })
      .parse(await request.json());

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
      return NextResponse.json(
        {
          error:
            "We couldn't find a member with that phone number or Member ID. Please check or register as a new member.",
        },
        { status: 404 }
      );
    }

    const now = new Date();
    const session = await findOpenSession(now, lapId);
    if (!session) {
      return NextResponse.json(
        {
          error: "Check-in service is currently refreshing. Please try again.",
        },
        { status: 400 }
      );
    }

    // Check if already checked in to this session
    const existing = await db.attendance.findUnique({
      where: {
        memberId_sessionId: { memberId: member.id, sessionId: session.id },
      },
    });

    const dayOfService = session.dayOfService || "Today";
    const serviceName = session.name || "Fellowship Service";

    if (existing) {
      return NextResponse.json({
        alreadyCheckedIn: true,
        message: `You are already checked in for today's ${serviceName} (${dayOfService} Lap)!`,
        name: `${member.firstName} ${member.lastName}`,
        memberId: member.memberId,
        session: serviceName,
        dayOfService,
        serviceLap: `${serviceName} · ${dayOfService}`,
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
      message: `Check-in successful! Praise God!`,
      name: `${member.firstName} ${member.lastName}`,
      memberId: member.memberId,
      session: serviceName,
      dayOfService,
      serviceLap: `${serviceName} · ${dayOfService} Lap`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Please enter your registered phone number or Member ID." },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Check-in service encountered an issue. Please try again." },
      { status: 500 }
    );
  }
}
