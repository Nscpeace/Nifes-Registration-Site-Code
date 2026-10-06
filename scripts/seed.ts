import { createHash } from "node:crypto";
import { applicationDefault, cert, deleteApp, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
const serviceAccount = serviceAccountJson ? JSON.parse(serviceAccountJson) as { project_id?: string; client_email: string; private_key: string } : null;
const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || serviceAccount?.project_id;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || serviceAccount?.client_email;
const privateKey = process.env.FIREBASE_PRIVATE_KEY || serviceAccount?.private_key;
const useApplicationDefault = process.env.FIREBASE_USE_APPLICATION_DEFAULT_CREDENTIALS === "true";
if (!projectId || (!(clientEmail && privateKey) && !useApplicationDefault)) throw new Error("Set Firebase service-account values or enable FIREBASE_USE_APPLICATION_DEFAULT_CREDENTIALS for local ADC.");
const credential = clientEmail && privateKey ? cert({ projectId, clientEmail, privateKey: privateKey.replace(/\\n/g, "\n") }) : applicationDefault();
const app = getApps()[0] ?? initializeApp({ projectId, credential });
const firestore = getFirestore(app);

async function main() {
  const email = (process.env.SUPER_ADMIN_EMAIL || "nscpeace1@gmail.com").trim().toLowerCase();
  const adminId = `admin_${createHash("sha256").update(email).digest("hex").slice(0, 32)}`;
  await firestore.collection("admin_users").doc(adminId).set({ id: adminId, email, role: "SUPER_ADMIN", status: "ACTIVE", invitedBy: null, createdAt: new Date(), lastLoginAt: null }, { merge: true });

  const events = [
    ["Foundation Class", "WEEKLY", 0, "14:30", false], ["Sunday Service", "WEEKLY", 0, "15:30", false],
    ["Prayer Meeting", "WEEKLY", 2, "17:30", false], ["Bible Study", "WEEKLY", 5, "17:00", false],
    ["Mass Evangelism", "LAST_SATURDAY", null, "12:00", true],
  ] as const;
  for (const [name, recurrence, weekday, startTime, timeTBA] of events) {
    const id = name.toLowerCase().replaceAll(" ", "-");
    await firestore.collection("recurring_events").doc(id).set({ id, name, recurrence, weekday, startTime, timeTBA, venue: "FAGCOOP Multipurpose Hall", active: true, checkInOpensMinutes: 60, checkInClosesMinutes: 120 }, { merge: true });
  }
}

main().then(() => console.log("Firestore seeded with the initial programme and Super Admin.")).finally(() => deleteApp(app));
