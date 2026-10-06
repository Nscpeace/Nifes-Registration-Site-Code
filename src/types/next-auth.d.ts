import "next-auth";
import { DefaultSession } from "next-auth";
declare module "next-auth" { interface Session { user: { adminId?: string | null; role?: "SUPER_ADMIN" | "ADMIN" | "USHER" | null } & DefaultSession["user"] } }
declare module "next-auth/jwt" { interface JWT { adminId?: string | null; role?: "SUPER_ADMIN" | "ADMIN" | "USHER" | null } }
