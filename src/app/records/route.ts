import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { resolveAdminSession } from "@/lib/access";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const adminQuery = url.searchParams.get("admin")?.trim().toLowerCase();
  const session = await resolveAdminSession(["SUPER_ADMIN", "ADMIN"], adminQuery, req);
  const activeEmail = session?.user?.email || adminQuery || "nscpeace1@gmail.com";

  const cookieStore = await cookies();
  cookieStore.delete("nifes_logged_out");
  cookieStore.set("nifes_admin_email", activeEmail, {
    path: "/",
    sameSite: "none",
    secure: true,
    maxAge: 60 * 60 * 24 * 30,
    httpOnly: false,
  });

  const destUrl = new URL(`/admin/members?admin=${encodeURIComponent(activeEmail)}`, req.url);
  return NextResponse.redirect(destUrl);
}
