import { db } from "@/lib/db";
import { ensureUpcomingSessions } from "@/lib/session-generator";

export type ProgramLap = {
  id: string;
  name: string;
  dayOfService: "Sunday" | "Tuesday" | "Friday" | "Last Saturday" | "Saturday";
  weekday: number; // 0 for Sunday, 2 for Tuesday, 5 for Friday, 6 for Saturday
  startTime: string; // "15:30", etc.
  displayTime: string; // "3:30 PM", etc.
  venue: string;
  color: "blue" | "amber" | "coral" | "indigo";
  recurrence: "WEEKLY" | "LAST_SATURDAY";
  description: string;
};

export const PROGRAM_SCHEDULE_LAPS: ProgramLap[] = [
  {
    id: "sunday-service",
    name: "Sunday Service",
    dayOfService: "Sunday",
    weekday: 0,
    startTime: "15:30",
    displayTime: "3:30 PM",
    venue: "FAGCOOP Multipurpose Hall",
    color: "blue",
    recurrence: "WEEKLY",
    description: "Main weekly worship, word and fellowship celebration",
  },
  {
    id: "foundation-class",
    name: "Foundation Class",
    dayOfService: "Sunday",
    weekday: 0,
    startTime: "14:30",
    displayTime: "2:30 PM",
    venue: "FAGCOOP Multipurpose Hall",
    color: "blue",
    recurrence: "WEEKLY",
    description: "New believers & discipleship spiritual foundation class",
  },
  {
    id: "prayer-meeting",
    name: "Prayer Meeting",
    dayOfService: "Tuesday",
    weekday: 2,
    startTime: "17:30",
    displayTime: "5:30 PM",
    venue: "FAGCOOP Multipurpose Hall",
    color: "amber",
    recurrence: "WEEKLY",
    description: "Midweek intercessory and revival prayer gathering",
  },
  {
    id: "bible-study",
    name: "Bible Study",
    dayOfService: "Friday",
    weekday: 5,
    startTime: "17:00",
    displayTime: "5:00 PM",
    venue: "FAGCOOP Multipurpose Hall",
    color: "coral",
    recurrence: "WEEKLY",
    description: "Deep verse-by-verse scripture study and interactive breakout groups",
  },
  {
    id: "mass-evangelism",
    name: "Mass Evangelism",
    dayOfService: "Last Saturday",
    weekday: 6,
    startTime: "12:00",
    displayTime: "Time TBA / 12:00 PM",
    venue: "FAGCOOP Multipurpose Hall & Campus",
    color: "indigo",
    recurrence: "LAST_SATURDAY",
    description: "Campus-wide gospel outreach and student evangelism",
  },
];

export function getLapForToday(now = new Date()): ProgramLap {
  const weekday = now.getDay(); // 0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat
  const hour = now.getHours();

  if (weekday === 0) {
    // If before 3:15 PM on Sunday, default to Foundation Class; otherwise Sunday Service
    return hour < 15 ? PROGRAM_SCHEDULE_LAPS[1] : PROGRAM_SCHEDULE_LAPS[0];
  }
  if (weekday === 2) {
    return PROGRAM_SCHEDULE_LAPS[2]; // Tuesday Prayer Meeting
  }
  if (weekday === 5) {
    return PROGRAM_SCHEDULE_LAPS[3]; // Friday Bible Study
  }
  if (weekday === 6) {
    return PROGRAM_SCHEDULE_LAPS[4]; // Mass Evangelism
  }
  if (weekday === 1) {
    return PROGRAM_SCHEDULE_LAPS[2]; // Next is Tuesday
  }
  // Wednesday (3) or Thursday (4) -> next is Friday Bible Study
  return PROGRAM_SCHEDULE_LAPS[3];
}

export async function findOpenSession(now = new Date(), preferredLapId?: string) {
  try {
    await ensureUpcomingSessions(now);
  } catch {
    // Graceful fallback
  }

  // 1. Determine target lap from program schedule
  let targetLap = preferredLapId
    ? PROGRAM_SCHEDULE_LAPS.find((l) => l.id === preferredLapId)
    : null;

  if (!targetLap) {
    targetLap = getLapForToday(now);
  }

  // 2. Try to find existing active session matching this event
  try {
    const existingSessions = await db.session.findMany({
      where: {
        active: true,
        OR: [
          { eventId: targetLap.id },
          { name: { contains: targetLap.name, mode: "insensitive" } },
        ],
      },
      include: { event: true },
      orderBy: { startsAt: "desc" },
    });

    if (existingSessions && existingSessions.length > 0) {
      const session = existingSessions[0];
      return {
        ...session,
        dayOfService: targetLap.dayOfService,
        serviceLapName: `${targetLap.name} (${targetLap.dayOfService})`,
        displayTime: targetLap.displayTime,
      };
    }
  } catch {
    // Proceed to create
  }

  // 3. Create active session for this scheduled lap
  try {
    const newSession = await db.session.create({
      data: {
        name: targetLap.name,
        venue: targetLap.venue,
        startsAt: new Date(now.getTime() - 15 * 60_000), // Active now
        active: true,
        eventId: targetLap.id,
      },
    });

    return {
      ...newSession,
      dayOfService: targetLap.dayOfService,
      serviceLapName: `${targetLap.name} (${targetLap.dayOfService})`,
      displayTime: targetLap.displayTime,
    };
  } catch {
    const fallback = await db.session.findFirst({
      where: { active: true },
      orderBy: { startsAt: "desc" },
    });
    return (
      fallback ?? {
        id: `session_${targetLap.id}_today`,
        name: targetLap.name,
        venue: targetLap.venue,
        startsAt: now,
        active: true,
        dayOfService: targetLap.dayOfService,
        serviceLapName: `${targetLap.name} (${targetLap.dayOfService})`,
        displayTime: targetLap.displayTime,
      }
    );
  }
}

export async function getAllProgramLapsWithStatus(now = new Date()) {
  const currentWeekday = now.getDay();
  const todayLap = getLapForToday(now);

  const lapsWithStats = await Promise.all(
    PROGRAM_SCHEDULE_LAPS.map(async (lap) => {
      const isToday =
        lap.weekday === currentWeekday ||
        (lap.recurrence === "LAST_SATURDAY" && currentWeekday === 6);

      let attendeeCount = 0;
      let activeSessionId: string | null = null;

      try {
        const session = await db.session.findFirst({
          where: {
            active: true,
            OR: [
              { eventId: lap.id },
              { name: { contains: lap.name, mode: "insensitive" } },
            ],
          },
          orderBy: { startsAt: "desc" },
        });

        if (session) {
          activeSessionId = session.id;
          attendeeCount = await db.attendance.count({
            where: { sessionId: session.id },
          });
        }
      } catch {
        // graceful
      }

      return {
        ...lap,
        isToday,
        isDefaultToday: lap.id === todayLap.id,
        sessionId: activeSessionId,
        attendeeCount,
      };
    })
  );

  return lapsWithStats;
}
