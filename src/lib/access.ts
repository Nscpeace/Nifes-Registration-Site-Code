import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { db } from "@/lib/db";

export type AdminSession = {
  user: {
    id: string;
    adminId: string;
    email: string;
    role: string;
    name: string;
  };
};

export async function resolveAdminSession(
  roles: string[] = ["SUPER_ADMIN", "ADMIN"],
  queryAdminEmail?: string,
  req?: Request
): Promise<AdminSession | null> {
  // 1. Try NextAuth session
  try {
    const session = await auth();
    if (session?.user?.adminId && session.user.role && roles.includes(session.user.role)) {
      return {
        user: {
          id: session.user.adminId,
          adminId: session.user.adminId,
          email: session.user.email || "nscpeace1@gmail.com",
          role: session.user.role,
          name: (session.user.email || "admin").split("@")[0],
        },
      };
    }
  } catch {
    // Proceed to fallback checks
  }

  // 2. Cookie or query or header verification
  let cookieEmail: string | undefined;
  let isLoggedOut = false;

  try {
    const cookieStore = await cookies();
    cookieEmail = cookieStore.get("nifes_admin_email")?.value?.trim().toLowerCase();
    isLoggedOut = cookieStore.get("nifes_logged_out")?.value === "1";
  } catch {
    // In contexts where cookies() is not directly available, check req header
    if (req) {
      const cookieHeader = req.headers.get("cookie") || "";
      const match = cookieHeader.match(/nifes_admin_email=([^;]+)/);
      if (match) cookieEmail = decodeURIComponent(match[1]).trim().toLowerCase();
      isLoggedOut = cookieHeader.includes("nifes_logged_out=1");
    }
  }

  let refererEmail: string | undefined;
  try {
    const h = await headers();
    const referer = h.get("referer");
    if (referer) {
      const refUrl = new URL(referer);
      refererEmail =
        refUrl.searchParams.get("admin")?.trim().toLowerCase() ||
        refUrl.searchParams.get("email")?.trim().toLowerCase();
    }
  } catch {}

  let reqUrlEmail: string | undefined;
  if (req) {
    try {
      const parsedUrl = new URL(req.url);
      reqUrlEmail =
        parsedUrl.searchParams.get("admin")?.trim().toLowerCase() ||
        parsedUrl.searchParams.get("email")?.trim().toLowerCase();
    } catch {}
  }

  // Priority order for candidate email
  let candidateEmail =
    queryAdminEmail?.trim().toLowerCase() ||
    reqUrlEmail ||
    cookieEmail ||
    refererEmail;

  // If user explicitly logged out and did not specify an email, do not auto-login
  if (!candidateEmail && isLoggedOut) {
    return null;
  }

  // Default to the owner super admin email: nscpeace1@gmail.com
  if (!candidateEmail) {
    candidateEmail = "nscpeace1@gmail.com";
  }

  let admin = await db.adminUser.findUnique({ where: { email: candidateEmail } });

  // Auto-provision Super Admin if needed
  if (
    !admin &&
    (candidateEmail === "nscpeace1@gmail.com" ||
      candidateEmail === (process.env.SUPER_ADMIN_EMAIL || "").toLowerCase())
  ) {
    admin = await db.adminUser.create({
      data: {
        email: candidateEmail,
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        invitedBy: null,
      },
    });
  }

  if (admin && admin.status === "ACTIVE" && roles.includes(admin.role)) {
    return {
      user: {
        id: admin.id,
        adminId: admin.id,
        email: admin.email,
        role: admin.role,
        name: admin.email.split("@")[0],
      },
    };
  }

  return null;
}

export async function requireRole(
  roles: string[] = ["SUPER_ADMIN", "ADMIN"],
  queryAdminEmail?: string
): Promise<AdminSession> {
  const session = await resolveAdminSession(roles, queryAdminEmail);

  if (session) {
    return session;
  }

  redirect("/admin/login?callbackUrl=/admin/members");
}
