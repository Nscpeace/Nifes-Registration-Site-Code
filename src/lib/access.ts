import { auth } from "@/auth";
import { redirect } from "next/navigation";
export async function requireRole(roles: string[]) {
  const session = await auth();
  if (!session?.user?.adminId) redirect("/admin/login");
  if (!session.user.role || !roles.includes(session.user.role)) redirect("/admin/forbidden");
  return session;
}
