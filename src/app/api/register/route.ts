import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { normalizeNigerianPhone } from "@/lib/phone";
import QRCode from "qrcode";
import { limited } from "@/lib/rate-limit";

const schema = z.object({ firstName: z.string().trim().min(1).max(80), lastName: z.string().trim().min(1).max(80), gender: z.enum(["Male", "Female"]), email: z.string().trim().email().max(254), placeOfResidence: z.string().trim().min(1).max(150), heardAbout: z.enum(["Friend", "WhatsApp", "Instagram", "Flier", "Other"]), heardAboutOther: z.string().trim().max(200).optional(), firstTimer: z.enum(["Yes", "No"]), phone: z.string().min(1), level: z.enum(["L100", "L200", "L300", "L400", "L500", "L600", "POSTGRADUATE", "NON_STUDENT"]), consent: z.literal(true) });
export async function POST(request: Request) {
  try {
    if (await limited(request, "register", 5, 60 * 60_000)) return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
    const data = schema.parse(await request.json());
    if (data.heardAbout === "Other" && !data.heardAboutOther?.trim()) return NextResponse.json({ error: "Please tell us how you heard about NIFES." }, { status: 400 });
    const phone = normalizeNigerianPhone(data.phone);
    if (!phone) return NextResponse.json({ error: "Enter a valid Nigerian mobile number." }, { status: 400 });
    if (await db.member.findFirst({ where: { OR: [{ phone }, { email: data.email.toLowerCase() }] } })) return NextResponse.json({ error: "You're already registered. Use Check In instead." }, { status: 409 });
    const year = new Date().getFullYear();
    const sequence = await db.memberSequence.upsert({ where: { year }, create: { year, nextValue: 2 }, update: { nextValue: { increment: 1 } } });
    const memberId = `NIFES-${year}-${String(sequence.nextValue - 1).padStart(4, "0")}`;
    const member = await db.member.create({ data: { memberId, firstName: data.firstName, lastName: data.lastName, gender: data.gender, email: data.email.toLowerCase(), placeOfResidence: data.placeOfResidence, heardAbout: data.heardAbout, heardAboutOther: data.heardAbout === "Other" ? data.heardAboutOther : null, firstTimer: data.firstTimer === "Yes", phone, level: data.level, consentGivenAt: new Date() }, select: { memberId: true, firstName: true, email: true } });
    let emailSent = false;
    if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM) {
      try {
        const qr = await QRCode.toBuffer(member.memberId, { width: 320 });
        const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [member.email], subject: "Welcome to NIFES UNIBEN", text: `Welcome, ${member.firstName}! Your NIFES UNIBEN member ID is ${member.memberId}. Keep the attached QR code for check-in.`, attachments: [{ filename: `${member.memberId}.png`, content: qr.toString("base64") }] }) });
        emailSent = response.ok;
      } catch (mailError) { console.error("Welcome email delivery failed", mailError); }
    }
    return NextResponse.json({ memberId: member.memberId, name: member.firstName, emailSent }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || "Please check your details." }, { status: 400 });
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") return NextResponse.json({ error: "You're already registered. Use Check In instead." }, { status: 409 });
    console.error("Registration failed", error);
    return NextResponse.json({ error: "We couldn't complete your registration. Please try again." }, { status: 500 });
  }
}
