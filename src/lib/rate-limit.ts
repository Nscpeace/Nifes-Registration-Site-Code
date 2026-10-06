import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

// PostgreSQL-backed fixed-window limit, shared across serverless instances.
export async function limited(request: Request, bucket: string, maximum: number, windowMs: number) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const key = `${bucket}:${createHash("sha256").update(forwarded).digest("hex")}`;
  const now = new Date();
  const reset = new Date(now.getTime() + windowMs);
  if (Math.random() < 0.02) await db.rateLimit.deleteMany({ where: { resetAt: { lt: now } } });
  const rows = await db.$queryRaw<{ hits: number }[]>(Prisma.sql`
    INSERT INTO rate_limits (key, hits, reset_at) VALUES (${key}, 1, ${reset})
    ON CONFLICT (key) DO UPDATE SET
      hits = CASE WHEN rate_limits.reset_at <= ${now} THEN 1 ELSE rate_limits.hits + 1 END,
      reset_at = CASE WHEN rate_limits.reset_at <= ${now} THEN ${reset} ELSE rate_limits.reset_at END
    RETURNING hits
  `);
  return (rows[0]?.hits ?? maximum + 1) > maximum;
}
