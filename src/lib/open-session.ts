import { db } from "@/lib/db";
import { ensureUpcomingSessions } from "@/lib/session-generator";

export async function findOpenSession(now = new Date()) {
  try {
    await ensureUpcomingSessions(now);
  } catch {
    // Continue even if generator encounters an error
  }

  // 1. Check for sessions occurring around now
  const sessions = await db.session.findMany({
    where: {
      active: true,
      startsAt: {
        gte: new Date(now.getTime() - 48 * 60 * 60_000),
        lte: new Date(now.getTime() + 48 * 60 * 60_000),
      },
      OR: [{ event: null }, { event: { is: { active: true } } }],
    },
    include: { event: true },
  });

  // Check if any session is in its designated window
  const inWindow = sessions.filter((s) => {
    const opens = (s.event?.checkInOpensMinutes ?? 180) * 60_000;
    const closes = (s.event?.checkInClosesMinutes ?? 240) * 60_000;
    const startTime = new Date(s.startsAt).getTime();
    return now.getTime() >= startTime - opens && now.getTime() <= startTime + closes;
  }).sort((a, b) => {
    return Math.abs(new Date(a.startsAt).getTime() - now.getTime()) - Math.abs(new Date(b.startsAt).getTime() - now.getTime());
  })[0];

  if (inWindow) return inWindow;

  // 2. If no session is strictly in window, find any active session created today or closest to now
  if (sessions.length > 0) {
    const closest = sessions.sort((a, b) => {
      return Math.abs(new Date(a.startsAt).getTime() - now.getTime()) - Math.abs(new Date(b.startsAt).getTime() - now.getTime());
    })[0];
    if (closest) return closest;
  }

  // 3. Fallback: Automatically create / open an active fellowship session for today
  // so check-in is never closed or broken for members
  try {
    const defaultEvent = await db.recurringEvent.findFirst({ where: { active: true } });
    const sessionName = defaultEvent?.name || "NIFES Weekly Fellowship Gathering";
    const venue = defaultEvent?.venue || "FAGCOOP Multipurpose Hall";

    const newSession = await db.session.create({
      data: {
        name: sessionName,
        venue,
        startsAt: new Date(now.getTime() - 15 * 60_000), // Started 15 minutes ago
        active: true,
        eventId: defaultEvent?.id ?? null,
      },
    });
    return newSession;
  } catch (err) {
    // If concurrent insert occurred or failed, grab the first active session
    const fallback = await db.session.findFirst({ where: { active: true }, orderBy: { startsAt: "desc" } });
    return fallback ?? null;
  }
}
