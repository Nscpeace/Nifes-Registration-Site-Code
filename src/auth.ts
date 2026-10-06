import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { db } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  pages: { signIn: "/admin/login" },
  callbacks: {
    async signIn({ user, profile }) {
      const email = user.email?.trim().toLowerCase();
      if (!email || (profile as { email_verified?: boolean })?.email_verified !== true) return false;
      const admin = await db.adminUser.findUnique({ where: { email } });
      if (!admin || admin.status === "DISABLED") return false;
      if (admin.status === "INVITED") await db.adminUser.update({ where: { id: admin.id }, data: { status: "ACTIVE" } });
      await db.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
      return true;
    },
    async jwt({ token }) {
      if (token.email) {
        const admin = await db.adminUser.findUnique({ where: { email: token.email.toLowerCase() }, select: { id: true, role: true, status: true } });
        token.adminId = admin?.status === "ACTIVE" ? admin.id : null;
        token.role = admin?.status === "ACTIVE" ? admin.role : null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) Object.assign(session.user, { adminId: token.adminId, role: token.role });
      return session;
    },
  },
});
