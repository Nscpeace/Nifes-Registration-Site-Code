import { db } from "@/lib/db";
// UNIBEN uses Africa/Lagos (UTC+1). Generate a rolling three-week window on demand.
export async function ensureUpcomingSessions(now = new Date()) {
  const events = await db.recurringEvent.findMany({ where: { active: true, timeTBA: false } });
  const local = new Date(now.getTime() + 60 * 60_000);
  const writes: Promise<unknown>[] = [];
  for (const event of events) {
    const [hour, minute] = event.startTime.split(":").map(Number);
    for (let offset = -1; offset <= 7; offset++) {
      const day = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + offset));
      const weekday = day.getUTCDay();
      const lastSaturday = weekday === 6 && day.getUTCDate() + 7 > new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + 1, 0)).getUTCDate();
      const matches = event.recurrence === "LAST_SATURDAY" ? lastSaturday : event.recurrence === "WEEKLY" && event.weekday === weekday;
      if (!matches) continue;
      const startsAt = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hour - 1, minute));
      writes.push(db.session.upsert({ where: { eventId_startsAt: { eventId: event.id, startsAt } }, update: { name: event.name, venue: event.venue, active: event.active }, create: { eventId: event.id, name: event.name, startsAt, venue: event.venue } }));
    }
  }
  await Promise.all(writes);
}
