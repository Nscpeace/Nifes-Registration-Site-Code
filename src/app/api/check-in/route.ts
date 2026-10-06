import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { normalizeNigerianPhone } from "@/lib/phone";
import { limited } from "@/lib/rate-limit";
import { findOpenSession } from "@/lib/open-session";
export async function POST(request: Request) {
  try {
    if (await limited(request, "self-checkin", 12, 5 * 60_000)) return NextResponse.json({ error: "Too many attempts. Please wait a few minutes." }, { status: 429 });
    const { identifier } = z.object({ identifier: z.string().trim().min(3).max(254) }).parse(await request.json());
    const member = await db.member.findFirst({ where: { OR: [{ memberId: identifier.toUpperCase() }, ...(normalizeNigerianPhone(identifier) ? [{ phone: normalizeNigerianPhone(identifier)! }] : [])] } });
    if (!member) return NextResponse.json({ error: "We couldn't find that member. Check your number or ID." }, { status: 404 });
    const now = new Date();
    const session = await findOpenSession(now);
    if (!session) return NextResponse.json({ error: "Check-in is currently closed. Please ask an usher for help." }, { status: 400 });
    const existing = await db.attendance.findUnique({ where: { memberId_sessionId: { memberId: member.id, sessionId: session.id } } });
    if (existing) return NextResponse.json({ message: "Already checked in", session: session.name, name: member.firstName });
    await db.attendance.create({ data: { memberId: member.id, sessionId: session.id, method: "SELF" } });
    return NextResponse.json({ message: "You're checked in!", session: session.name, name: member.firstName });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Enter your phone number or member ID." }, { status: 400 });
    return NextResponse.json({ error: "Check-in failed. Please try again." }, { status: 500 });
  }
}
