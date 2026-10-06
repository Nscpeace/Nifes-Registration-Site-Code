import { createHash } from "node:crypto";
import { db } from "@/lib/db";

// Firestore transaction keeps the fixed-window counter consistent across Vercel instances.
export async function limited(request: Request, bucket: string, maximum: number, windowMs: number) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const key = `${bucket}:${createHash("sha256").update(forwarded).digest("hex")}`;
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowMs);
  return db.consumeRateLimit(key, now, resetAt, maximum);
}
