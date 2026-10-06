import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const email = (process.env.SUPER_ADMIN_EMAIL || "nscpeace1@gmail.com").trim().toLowerCase();
  await db.adminUser.upsert({ where: { email }, update: { role: "SUPER_ADMIN", status: "ACTIVE" }, create: { email, role: "SUPER_ADMIN", status: "ACTIVE" } });
  const events = [
    ["Foundation Class", "WEEKLY", 0, "14:30"], ["Sunday Service", "WEEKLY", 0, "15:30"],
    ["Prayer Meeting", "WEEKLY", 2, "17:30"], ["Bible Study", "WEEKLY", 5, "17:00"],
    ["Mass Evangelism", "LAST_SATURDAY", null, "12:00"],
  ] as const;
  for (const [name, recurrence, weekday, startTime] of events) await db.recurringEvent.upsert({ where: { id: `${name.toLowerCase().replaceAll(" ", "-")}-seed` }, update: {}, create: { id: `${name.toLowerCase().replaceAll(" ", "-")}-seed`, name, recurrence, weekday, startTime, timeTBA: recurrence === "LAST_SATURDAY", venue: "FAGCOOP Multipurpose Hall" } });
}
main().finally(() => db.$disconnect());
