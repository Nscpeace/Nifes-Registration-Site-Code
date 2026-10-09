import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  const cookieStore = await cookies();

  // 1. Clear known session cookies from cookie store
  const cookieNamesToDelete = [
    "nifes_admin_email",
    "authjs.session-token",
    "__Secure-authjs.session-token",
    "next-auth.session-token",
    "__Secure-next-auth.session-token",
    "authjs.csrf-token",
    "authjs.callback-url",
  ];

  for (const name of cookieNamesToDelete) {
    try {
      cookieStore.delete(name);
      cookieStore.set(name, "", {
        path: "/",
        maxAge: 0,
        expires: new Date(0),
        sameSite: "none",
        secure: true,
      });
      cookieStore.set(name, "", {
        path: "/",
        maxAge: 0,
        expires: new Date(0),
        sameSite: "lax",
        secure: false,
      });
    } catch {}
  }

  // 2. Set persistent logged-out flag
  cookieStore.set("nifes_logged_out", "1", {
    path: "/",
    sameSite: "none",
    secure: true,
    maxAge: 60 * 60 * 24 * 7, // 7 days
    httpOnly: false,
  });

  const res = NextResponse.json({ ok: true, loggedOut: true });

  // 3. Set explicit Set-Cookie header directives in the response object
  res.cookies.set("nifes_logged_out", "1", {
    path: "/",
    sameSite: "none",
    secure: true,
    maxAge: 60 * 60 * 24 * 7,
    httpOnly: false,
  });

  for (const name of cookieNamesToDelete) {
    res.cookies.set(name, "", {
      path: "/",
      maxAge: 0,
      expires: new Date(0),
      sameSite: "none",
      secure: true,
    });
  }

  return res;
}
