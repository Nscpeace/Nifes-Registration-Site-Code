import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { db, isDefaultSuperAdmin, DEFAULT_SUPER_ADMIN_EMAILS, clearAllAuthorizedExceptSuperAdmin } from "@/lib/db";

export type AdminSession = {
  user: {
    id: string;
    adminId: string;
    email: string;
    role: string;
    name: string;
  };
};

export async function isEmailAuthorized(
  email: string
): Promise<{ authorized: boolean; role?: string; status?: string }> {
  if (!email || typeof email !== "string") {
    return { authorized: false };
  }
  const normalized = email.trim().toLowerCase();

  // 1. Any default Super Admin is permanently authorized
  if (isDefaultSuperAdmin(normalized)) {
    return { authorized: true, role: "SUPER_ADMIN", status: "ACTIVE" };
  }

  // 2. Query database for authorized admin email
  const admin = await db.adminUser.findUnique({ where: { email: normalized } });
  if (
    admin &&
    (admin.role === "SUPER_ADMIN" || admin.role === "ADMIN" || admin.role === "USHER") &&
    admin.status !== "DISABLED"
  ) {
    return { authorized: true, role: admin.role, status: admin.status || "ACTIVE" };
  }

  return { authorized: false };
}

export async function resolveAdminSession(
  roles: string[] = ["SUPER_ADMIN", "ADMIN"],
  queryAdminEmail?: string,
  req?: Request
): Promise<AdminSession | null> {
  // 1. Extract email from headers, cookies, query
  let cookieEmail: string | undefined;
  let isLoggedOut = false;
  let headerEmail: string | undefined;

  if (req) {
    const rawHeader = req.headers.get("x-admin-email") || req.headers.get("x-authorized-email");
    if (rawHeader) headerEmail = rawHeader.trim().toLowerCase();
    const cookieHeader = req.headers.get("cookie") || "";
    const match = cookieHeader.match(/nifes_admin_email=([^;]+)/);
    if (match) cookieEmail = decodeURIComponent(match[1]).trim().toLowerCase();
    isLoggedOut = cookieHeader.includes("nifes_logged_out=1");
  }

  try {
    const cookieStore = await cookies();
    const storedEmail = cookieStore.get("nifes_admin_email")?.value?.trim().toLowerCase();
    if (storedEmail) cookieEmail = storedEmail;
    if (cookieStore.get("nifes_logged_out")?.value === "1") isLoggedOut = true;
  } catch {}

  // If user explicitly signed out and did not supply an explicit header/query:
  if (isLoggedOut && !queryAdminEmail && !headerEmail) {
    return null;
  }

  // 2. Try NextAuth session
  try {
    const session = await auth();
    if (session?.user?.email) {
      const authEmail = session.user.email.trim().toLowerCase();
      const authInfo = await isEmailAuthorized(authEmail);
      if (authInfo.authorized && authInfo.role && (roles.length === 0 || roles.includes(authInfo.role))) {
        return {
          user: {
            id: session.user.adminId || `admin_${authEmail}`,
            adminId: session.user.adminId || `admin_${authEmail}`,
            email: authEmail,
            role: authInfo.role,
            name: session.user.name || authEmail.split("@")[0],
          },
        };
      }
    }
  } catch {}

  // 3. Candidate email from header, cookie, or query parameter
  const candidateEmail = headerEmail || cookieEmail || queryAdminEmail?.trim().toLowerCase();
  if (!candidateEmail) {
    return null;
  }

  const authInfo = await isEmailAuthorized(candidateEmail);
  if (!authInfo.authorized || !authInfo.role || (roles.length > 0 && !roles.includes(authInfo.role))) {
    return null;
  }

  let admin = await db.adminUser.findUnique({ where: { email: candidateEmail } });

  // Auto-provision default super admin if needed
  if (!admin && isDefaultSuperAdmin(candidateEmail)) {
    admin = await db.adminUser.create({
      data: {
        email: candidateEmail,
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        invitedBy: null,
      },
    });
  }

  if (
    admin &&
    admin.status !== "DISABLED" &&
    (roles.length === 0 || roles.includes(admin.role))
  ) {
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

export async function clearAuthorizationList(): Promise<{ deletedCount: number }> {
  return await clearAllAuthorizedExceptSuperAdmin();
}

export async function requireRole(
  roles: string[] = ["SUPER_ADMIN", "ADMIN"],
  queryAdminEmail?: string
): Promise<AdminSession> {
  const session = await resolveAdminSession(roles, queryAdminEmail);

  if (session) {
    return session;
  }

  redirect("/records?login=1");
}
