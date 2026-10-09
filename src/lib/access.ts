import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { db, PRIMARY_ADMIN_EMAIL, clearAllAuthorizedExceptSuperAdmin, ensureInitialAuthorizationPurge } from "@/lib/db";

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
  // Ensure the legacy list purge has executed
  await ensureInitialAuthorizationPurge();

  const normalized = email.trim().toLowerCase();
  if (normalized === PRIMARY_ADMIN_EMAIL) {
    return { authorized: true, role: "SUPER_ADMIN", status: "ACTIVE" };
  }

  // Any other email must have been explicitly authorized by nscpeace1@gmail.com in db.adminUser
  const admin = await db.adminUser.findUnique({ where: { email: normalized } });
  if (
    admin &&
    (admin.role === "SUPER_ADMIN" || admin.role === "ADMIN" || admin.role === "USHER") &&
    (admin.status === "ACTIVE" || admin.status === "INVITED")
  ) {
    return { authorized: true, role: admin.role, status: admin.status };
  }

  return { authorized: false };
}

export async function resolveAdminSession(
  roles: string[] = ["SUPER_ADMIN", "ADMIN"],
  queryAdminEmail?: string,
  req?: Request
): Promise<AdminSession | null> {
  await ensureInitialAuthorizationPurge();

  // 1. Check logged-out state first
  let cookieEmail: string | undefined;
  let isLoggedOut = false;

  try {
    const cookieStore = await cookies();
    cookieEmail = cookieStore.get("nifes_admin_email")?.value?.trim().toLowerCase();
    isLoggedOut = cookieStore.get("nifes_logged_out")?.value === "1";
  } catch {
    if (req) {
      const cookieHeader = req.headers.get("cookie") || "";
      const match = cookieHeader.match(/nifes_admin_email=([^;]+)/);
      if (match) cookieEmail = decodeURIComponent(match[1]).trim().toLowerCase();
      isLoggedOut = cookieHeader.includes("nifes_logged_out=1");
    }
  }

  // If user explicitly signed out, do not resolve session
  if (isLoggedOut) {
    return null;
  }

  // 2. Try NextAuth session (only if not logged out)
  try {
    const session = await auth();
    if (session?.user?.email) {
      const authEmail = session.user.email.trim().toLowerCase();
      const authInfo = await isEmailAuthorized(authEmail);
      if (authInfo.authorized && authInfo.role && roles.includes(authInfo.role)) {
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
  } catch {
    // Proceed to cookie verification
  }

  // Candidate email must come from verified cookie (or explicit authorized query in API calls)
  let candidateEmail = cookieEmail;
  if (!candidateEmail && queryAdminEmail) {
    candidateEmail = queryAdminEmail.trim().toLowerCase();
  }

  if (!candidateEmail) {
    return null;
  }

  // STRICT CHECK: candidate email must be authorized!
  const authInfo = await isEmailAuthorized(candidateEmail);
  if (!authInfo.authorized || !authInfo.role || !roles.includes(authInfo.role)) {
    return null;
  }

  let admin = await db.adminUser.findUnique({ where: { email: candidateEmail } });

  // Auto-provision primary admin if needed
  if (!admin && candidateEmail === PRIMARY_ADMIN_EMAIL) {
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
    (admin.status === "ACTIVE" || admin.status === "INVITED") &&
    roles.includes(admin.role)
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
