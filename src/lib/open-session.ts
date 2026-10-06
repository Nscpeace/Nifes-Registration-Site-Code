import { db } from "@/lib/db";
import { ensureUpcomingSessions } from "@/lib/session-generator";
export async function findOpenSession(now = new Date()) {
  await ensureUpcomingSessions(now);
  const sessions = await db.session.findMany({ where: { active: true, startsAt: { gte: new Date(now.getTime() - 24 * 60 * 60_000), lte: new Date(now.getTime() + 24 * 60 * 60_000) }, OR: [{ event: null }, { event: { is: { active: true } } }] }, include: { event: true } });
  return sessions.filter(s => now >= new Date(s.startsAt.getTime() - (s.event?.checkInOpensMinutes ?? 60) * 60_000) && now <= new Date(s.startsAt.getTime() + (s.event?.checkInClosesMinutes ?? 120) * 60_000)).sort((a,b)=>{const aStarted=a.startsAt<=now,bStarted=b.startsAt<=now;if(aStarted!==bStarted)return aStarted?-1:1;return aStarted?b.startsAt.getTime()-a.startsAt.getTime():a.startsAt.getTime()-b.startsAt.getTime()})[0] ?? null;
}
