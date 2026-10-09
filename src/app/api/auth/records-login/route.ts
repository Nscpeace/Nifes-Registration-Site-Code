import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, PRIMARY_ADMIN_EMAIL } from "@/lib/db";
import { isEmailAuthorized } from "@/lib/access";

const RECORDS_PORTAL_PASSWORD = "NIFES#2026";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawEmail = typeof body.email === "string" ? body.email : "";
    const rawPassword = typeof body.password === "string" ? body.password : "";

    const email = rawEmail.trim().toLowerCase();
    const password = rawPassword.trim();

    if (!email) {
      return NextResponse.json(
        {
          ok: false,
          error: "missing_email",
          message: "Email address is required.",
        },
        { status: 200 }
      );
    }

    // 1. Strict Password Verification
    if (!password) {
      return NextResponse.json(
        {
          ok: false,
          error: "missing_password",
          message: "Access password is required.",
        },
        { status: 200 }
      );
    }

    if (password !== RECORDS_PORTAL_PASSWORD) {
      return NextResponse.json(
        {
          ok: false,
          error: "invalid_password",
          message: "Incorrect password. Please enter the valid portal password.",
        },
        { status: 200 }
      );
    }

    // 2. Strict authorization check: must be nscpeace1@gmail.com or an authorized email
    const authStatus = await isEmailAuthorized(email);

    if (!authStatus.authorized) {
      return NextResponse.json(
        {
          ok: false,
          error: "unauthorized",
          attempted: email,
          message: `Access Denied: ${email} has not been authorized to access Member Records.`,
        },
        { status: 200 }
      );
    }

    // 3. Provision or activate primary admin if needed
    let admin = await db.adminUser.findUnique({ where: { email } });
    if (!admin && email === PRIMARY_ADMIN_EMAIL) {
      admin = await db.adminUser.create({
        data: {
          email,
          role: "SUPER_ADMIN",
          status: "ACTIVE",
          invitedBy: null,
        },
      });
    } else if (admin && admin.status === "INVITED") {
      await db.adminUser.update({
        where: { email },
        data: { status: "ACTIVE" },
      });
    }

    const host = req.headers.get("host") || "";
    const proto = req.headers.get("x-forwarded-proto") || "";
    const isSecure = proto === "https" || (!host.includes("localhost") && !host.includes("127.0.0.1"));

    // 4. Set authentication cookies
    const cookieStore = await cookies();
    cookieStore.delete("nifes_logged_out");
    cookieStore.set("nifes_logged_out", "", {
      path: "/",
      maxAge: 0,
      expires: new Date(0),
      sameSite: isSecure ? "none" : "lax",
      secure: isSecure,
    });
    cookieStore.set("nifes_admin_email", email, {
      path: "/",
      sameSite: isSecure ? "none" : "lax",
      secure: isSecure,
      maxAge: 60 * 60 * 24 * 30, // 30 days
      httpOnly: false,
    });

    const res = NextResponse.json({
      ok: true,
      email,
      role: authStatus.role || "ADMIN",
    });

    res.cookies.set("nifes_logged_out", "", {
      path: "/",
      maxAge: 0,
      expires: new Date(0),
      sameSite: isSecure ? "none" : "lax",
      secure: isSecure,
    });
    res.cookies.set("nifes_admin_email", email, {
      path: "/",
      sameSite: isSecure ? "none" : "lax",
      secure: isSecure,
      maxAge: 60 * 60 * 24 * 30,
      httpOnly: false,
    });
    return res;
  } catch (error) {
    console.error("records-login error:", error);
    return NextResponse.json(
      { ok: false, error: "server_error", message: "An unexpected error occurred during verification." },
      { status: 500 }
    );
  }
}
