import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET || "development-fallback-secret-for-nifes-uniben-32char",
  cookies: {
    sessionToken: {
      name: "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "none",
        path: "/",
        secure: true,
      },
    },
    callbackUrl: {
      name: "authjs.callback-url",
      options: {
        sameSite: "none",
        path: "/",
        secure: true,
      },
    },
    csrfToken: {
      name: "authjs.csrf-token",
      options: {
        httpOnly: true,
        sameSite: "none",
        path: "/",
        secure: true,
      },
    },
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
    Credentials({
      id: "credentials",
      name: "Authorised Admin",
      credentials: {
        email: { label: "Email", type: "email" },
      },
      async authorize(credentials) {
        const rawEmail = credentials?.email;
        if (!rawEmail || typeof rawEmail !== "string") return null;
        const email = rawEmail.trim().toLowerCase();
        let admin = await db.adminUser.findUnique({ where: { email } });
        if (!admin && (email === "nscpeace1@gmail.com" || email === (process.env.SUPER_ADMIN_EMAIL || "").toLowerCase())) {
          admin = await db.adminUser.create({
            data: {
              email,
              role: "SUPER_ADMIN",
              status: "ACTIVE",
              invitedBy: null,
            },
          });
        }
        if (!admin || admin.status === "DISABLED") return null;
        if (admin.status === "INVITED") await db.adminUser.update({ where: { id: admin.id }, data: { status: "ACTIVE" } });
        await db.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
        return {
          id: admin.id,
          email: admin.email,
          name: admin.email.split("@")[0],
          adminId: admin.id,
          role: admin.role,
        };
      },
    }),
  ],
  pages: { signIn: "/admin/login" },
  callbacks: {
    async signIn({ user, account, profile }) {
      const email = user.email?.trim().toLowerCase();
      if (!email) return false;
      if (account?.provider === "google") {
        if ((profile as { email_verified?: boolean })?.email_verified !== true) return false;
      }
      let admin = await db.adminUser.findUnique({ where: { email } });
      if (!admin && (email === "nscpeace1@gmail.com" || email === (process.env.SUPER_ADMIN_EMAIL || "").toLowerCase())) {
        admin = await db.adminUser.create({
          data: {
            email,
            role: "SUPER_ADMIN",
            status: "ACTIVE",
            invitedBy: null,
          },
        });
      }
      if (!admin || admin.status === "DISABLED") return false;
      if (admin.status === "INVITED") await db.adminUser.update({ where: { id: admin.id }, data: { status: "ACTIVE" } });
      await db.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.adminId = (user as any).adminId;
        token.role = (user as any).role;
      }
      if (token.email) {
        const admin = await db.adminUser.findUnique({ where: { email: token.email.toLowerCase() }, select: { id: true, role: true, status: true } });
        if (admin && admin.status === "ACTIVE") {
          token.adminId = admin.id;
          token.role = admin.role;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        Object.assign(session.user, { adminId: token.adminId, role: token.role });
      }
      return session;
    },
  },
});
