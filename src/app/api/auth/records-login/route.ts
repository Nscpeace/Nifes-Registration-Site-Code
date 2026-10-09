import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, PRIMARY_ADMIN_EMAIL } from "@/lib/db";
import { isEmailAuthorized } from "@/lib/access";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawEmail = typeof body.email === "string" ? body.email : "";
    const email = rawEmail.trim().toLowerCase();

    if (!email) {
      return NextResponse.json(
        { ok: false, error: "empty", message: "Please enter your email address." },
        { status: 200 }
      );
    }

    // Strict authorization check: only nscpeace1@gmail.com and emails he authorized
    const authStatus = await isEmailAuthorized(email);

    if (!authStatus.authorized) {
      return NextResponse.json(
        {
          ok: false,
          error: "unauthorized",
          attempted: email,
          message: `Access Denied: ${email} has not been authorized by administrator ${PRIMARY_ADMIN_EMAIL}.`,
        },
        { status: 200 }
      );
    }

    // Provision or activate primary admin if needed
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

    // Set authentication cookies
    const cookieStore = await cookies();
    cookieStore.delete("nifes_logged_out");
    cookieStore.set("nifes_logged_out", "", {
      path: "/",
      maxAge: 0,
      expires: new Date(0),
      sameSite: "none",
      secure: true,
    });
    cookieStore.set("nifes_admin_email", email, {
      path: "/",
      sameSite: "none",
      secure: true,
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
      sameSite: "none",
      secure: true,
    });
    res.cookies.set("nifes_logged_out", "", {
      path: "/",
      maxAge: 0,
      expires: new Date(0),
      sameSite: "lax",
      secure: false,
    });
    res.cookies.set("nifes_admin_email", email, {
      path: "/",
      sameSite: "none",
      secure: true,
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
