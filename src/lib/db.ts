import "server-only";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp, type DocumentData, type DocumentReference, type Firestore } from "firebase-admin/firestore";

type ModelName = "member" | "adminUser" | "recurringEvent" | "session" | "attendance" | "followUp" | "auditLog" | "rateLimit" | "memberSequence";
type Row = Record<string, any>;
type ModelApi = {
  findMany(args?: Row): Promise<Row[]>;
  findFirst(args?: Row): Promise<Row | null>;
  findUnique(args: Row): Promise<Row | null>;
  count(args?: Row): Promise<number>;
  create(args: Row): Promise<Row>;
  update(args: Row): Promise<Row>;
  updateMany(args: Row): Promise<{ count: number }>;
  delete(args: Row): Promise<Row>;
  deleteMany(args?: Row): Promise<{ count: number }>;
  upsert(args: Row): Promise<Row>;
  groupBy(args: Row): Promise<Row[]>;
};
type DatabaseApi = Record<ModelName, ModelApi> & {
  $disconnect(): Promise<void>;
  consumeRateLimit(key: string, now: Date, resetAt: Date, maximum: number): Promise<boolean>;
};

const collections: Record<ModelName, string> = {
  member: "members", adminUser: "admin_users", recurringEvent: "recurring_events", session: "sessions",
  attendance: "attendance", followUp: "follow_ups", auditLog: "audit_logs", rateLimit: "rate_limits", memberSequence: "member_sequences",
};

const firebaseCredentialsAvailable = Boolean(
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
  (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) ||
  (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_USE_APPLICATION_DEFAULT_CREDENTIALS === "true") ||
  process.env.GOOGLE_APPLICATION_CREDENTIALS,
);

const firebaseApp = firebaseCredentialsAvailable ? (getApps()[0] ?? initializeApp(firebaseOptions())) : null;
const firestore: Firestore = firebaseApp ? getFirestore(firebaseApp) : (null as any);

const globalForDb = globalThis as unknown as {
  nifesMemoryStore?: Map<ModelName, Map<string, Row>>;
  nifesMemoryInitialized?: boolean;
};

const memoryStore = globalForDb.nifesMemoryStore ?? new Map<ModelName, Map<string, Row>>();
globalForDb.nifesMemoryStore = memoryStore;

const DATA_FILE_PATH = path.join(process.cwd(), "data", "store.json");

function reviveDates(obj: any): any {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(reviveDates);
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(v)) {
      const parsed = new Date(v);
      out[k] = isNaN(parsed.getTime()) ? v : parsed;
    } else if (v && typeof v === "object") {
      out[k] = reviveDates(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function persistMemoryStore() {
  if (firebaseCredentialsAvailable) return;
  try {
    const dataDir = path.dirname(DATA_FILE_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const serialized: Record<string, Row[]> = {};
    for (const [model, map] of memoryStore.entries()) {
      serialized[model] = Array.from(map.values());
    }
    fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(serialized, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to persist data store to disk:", err);
  }
}

function initMemoryStore() {
  if (globalForDb.nifesMemoryInitialized) return;
  globalForDb.nifesMemoryInitialized = true;
  for (const model of Object.keys(collections) as ModelName[]) {
    if (!memoryStore.has(model)) memoryStore.set(model, new Map());
  }

  // Load from disk if available
  if (!firebaseCredentialsAvailable && fs.existsSync(DATA_FILE_PATH)) {
    try {
      const raw = fs.readFileSync(DATA_FILE_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      for (const [model, rows] of Object.entries(parsed)) {
        if (Array.isArray(rows) && memoryStore.has(model as ModelName)) {
          const map = memoryStore.get(model as ModelName)!;
          for (const row of rows) {
            const revived = reviveDates(row);
            if (revived) {
              if (model === "adminUser" && revived.email) {
                revived.email = String(revived.email).trim().toLowerCase();
                const canonicalId = `admin_${createHash("sha256").update(revived.email).digest("hex").slice(0, 32)}`;
                revived.id = canonicalId;
                map.set(canonicalId, revived);
              } else if (revived.id) {
                map.set(revived.id, revived);
              }
            }
          }
        }
      }
    } catch (e) {
      console.error("Error loading persisted store:", e);
    }
  }

  // Ensure default recurring events exist
  if (memoryStore.get("recurringEvent")!.size === 0) {
    const defaultEvents: Row[] = [
      { id: "foundation-class", name: "Foundation Class", recurrence: "WEEKLY", weekday: 0, startTime: "14:30", timeTBA: false, venue: "FAGCOOP Multipurpose Hall", active: true, checkInOpensMinutes: 60, checkInClosesMinutes: 120 },
      { id: "sunday-service", name: "Sunday Service", recurrence: "WEEKLY", weekday: 0, startTime: "15:30", timeTBA: false, venue: "FAGCOOP Multipurpose Hall", active: true, checkInOpensMinutes: 60, checkInClosesMinutes: 120 },
      { id: "prayer-meeting", name: "Prayer Meeting", recurrence: "WEEKLY", weekday: 2, startTime: "17:30", timeTBA: false, venue: "FAGCOOP Multipurpose Hall", active: true, checkInOpensMinutes: 60, checkInClosesMinutes: 120 },
      { id: "bible-study", name: "Bible Study", recurrence: "WEEKLY", weekday: 5, startTime: "17:00", timeTBA: false, venue: "FAGCOOP Multipurpose Hall", active: true, checkInOpensMinutes: 60, checkInClosesMinutes: 120 },
      { id: "mass-evangelism", name: "Mass Evangelism", recurrence: "LAST_SATURDAY", weekday: null, startTime: "12:00", timeTBA: true, venue: "FAGCOOP Multipurpose Hall", active: true, checkInOpensMinutes: 60, checkInClosesMinutes: 120 },
    ];
    for (const evt of defaultEvents) {
      memoryStore.get("recurringEvent")!.set(evt.id, evt);
    }
  }

  // Ensure primary super admin exists
  const primaryAdmin = PRIMARY_ADMIN_EMAIL;
  const adminId = `admin_${createHash("sha256").update(primaryAdmin).digest("hex").slice(0, 32)}`;
  const adminMap = memoryStore.get("adminUser")!;
  if (!adminMap.has(adminId)) {
    const adminUser: Row = {
      id: adminId,
      email: primaryAdmin,
      role: "SUPER_ADMIN",
      status: "ACTIVE",
      invitedBy: null,
      createdAt: new Date(),
      lastLoginAt: null,
    };
    adminMap.set(adminId, adminUser);
  } else {
    const existing = adminMap.get(adminId)!;
    existing.role = "SUPER_ADMIN";
    existing.status = "ACTIVE";
  }

  persistMemoryStore();
}

function firebaseOptions() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
  if (raw) {
    const serviceAccount = JSON.parse(raw) as { project_id?: string; client_email: string; private_key: string };
    return { credential: cert({ projectId: projectId || serviceAccount.project_id, clientEmail: serviceAccount.client_email, privateKey: serviceAccount.private_key.replace(/\\n/g, "\n") }), projectId: projectId || serviceAccount.project_id };
  }
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (projectId && clientEmail && privateKey) return { credential: cert({ projectId, clientEmail, privateKey: privateKey.replace(/\\n/g, "\n") }), projectId };
  return projectId ? { projectId } : {};
}

function error(code: string, message: string) { return Object.assign(new Error(message), { code }); }
function docId(model: ModelName, data: Row) {
  if (model === "memberSequence") return String(data.year);
  if (model === "rateLimit") return String(data.key);
  if (model === "followUp" && data.memberId) return String(data.memberId);
  if (model === "adminUser" && data.email) return `admin_${createHash("sha256").update(String(data.email).trim().toLowerCase()).digest("hex").slice(0, 32)}`;
  if (model === "attendance" && data.memberId && data.sessionId) return createHash("sha256").update(`${data.memberId}:${data.sessionId}`).digest("hex");
  return String(data.id || randomUUID());
}
function clean(value: any): any {
  if (value === undefined) return undefined;
  if (value instanceof Date) return Timestamp.fromDate(value);
  if (Array.isArray(value)) return value.map(clean).filter((item) => item !== undefined);
  if (value && typeof value === "object" && !(value instanceof Timestamp)) {
    if (Object.keys(value).length === 1 && "increment" in value) return value;
    return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).map(([key, item]) => [key, clean(item)]));
  }
  return value;
}
function hydrateValue(value: any): any {
  if (value instanceof Timestamp) return value.toDate();
  if (Array.isArray(value)) return value.map(hydrateValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, hydrateValue(item)]));
  return value;
}
function defaults(model: ModelName, data: Row): Row {
  const now = new Date();
  const base: Record<ModelName, Row> = {
    member: { guest: false, email: null, placeOfResidence: null, heardAbout: null, heardAboutOther: null, level: null, consentGivenAt: null, createdAt: now },
    adminUser: { role: "USHER", status: "INVITED", invitedBy: null, createdAt: now, lastLoginAt: null },
    recurringEvent: { timeTBA: false, venue: "FAGCOOP Multipurpose Hall", active: true, checkInOpensMinutes: 60, checkInClosesMinutes: 120 },
    session: { eventId: null, endsAt: null, venue: "FAGCOOP Multipurpose Hall", active: true },
    attendance: { checkedInAt: now }, followUp: { status: "NOT_CONTACTED", notes: null, updatedAt: now },
    auditLog: { details: null, createdAt: now }, rateLimit: { hits: 1 }, memberSequence: {},
  };
  const row = { ...base[model], ...data };
  if (!row.id && model !== "memberSequence" && model !== "rateLimit") {
    row.id = docId(model, row);
  }
  if (model === "followUp" && !data.updatedAt) row.updatedAt = now;
  return row;
}

function relation(model: ModelName, field: string) {
  const map: Partial<Record<ModelName, Record<string, { model: ModelName; foreignKey: string; localKey: string; many?: boolean }>>> = {
    member: { attendances: { model: "attendance", foreignKey: "memberId", localKey: "id", many: true }, followUps: { model: "followUp", foreignKey: "memberId", localKey: "id", many: true } },
    adminUser: { auditLogs: { model: "auditLog", foreignKey: "adminId", localKey: "id", many: true }, inviter: { model: "adminUser", foreignKey: "id", localKey: "invitedBy" }, invitees: { model: "adminUser", foreignKey: "invitedBy", localKey: "id", many: true } },
    recurringEvent: { sessions: { model: "session", foreignKey: "eventId", localKey: "id", many: true } },
    session: { event: { model: "recurringEvent", foreignKey: "id", localKey: "eventId" }, attendances: { model: "attendance", foreignKey: "sessionId", localKey: "id", many: true } },
    attendance: { member: { model: "member", foreignKey: "id", localKey: "memberId" }, session: { model: "session", foreignKey: "id", localKey: "sessionId" } },
    followUp: { member: { model: "member", foreignKey: "id", localKey: "memberId" } },
    auditLog: { admin: { model: "adminUser", foreignKey: "id", localKey: "adminId" } },
  };
  return map[model]?.[field];
}

function flattenWhere(where: Row = {}): Row {
  const result: Row = {};
  for (const [key, value] of Object.entries(where)) {
    if (key === "eventId_startsAt" && value && typeof value === "object") Object.assign(result, value);
    else result[key] = value;
  }
  return result;
}
function compareValue(actual: any, expected: any): boolean {
  actual = actual instanceof Date ? actual.getTime() : actual;
  if (expected instanceof Date) expected = expected.getTime();
  if (expected && typeof expected === "object" && !(expected instanceof Date) && !(expected instanceof Timestamp) && !Array.isArray(expected)) {
    for (const [op, value] of Object.entries(expected)) {
      const right = value instanceof Date ? value.getTime() : value;
      if (op === "equals" && !compareValue(actual, right)) return false;
      if (op === "in" && !(value as any[]).includes(actual)) return false;
      if (op === "notIn" && (value as any[]).includes(actual)) return false;
      if (op === "gt" && !(actual > (right as any))) return false;
      if (op === "gte" && !(actual >= (right as any))) return false;
      if (op === "lt" && !(actual < (right as any))) return false;
      if (op === "lte" && !(actual <= (right as any))) return false;
      if (op === "contains") {
        const a = String(actual ?? ""); const b = String(right ?? "");
        if (expected.mode === "insensitive" ? !a.toLowerCase().includes(b.toLowerCase()) : !a.includes(b)) return false;
      }
      if (op === "startsWith" && !String(actual ?? "").startsWith(String(right))) return false;
      if (op === "endsWith" && !String(actual ?? "").endsWith(String(right))) return false;
      if (op === "not" && compareValue(actual, value)) return false;
    }
    return true;
  }
  if (actual instanceof Date || expected instanceof Date) return new Date(actual).getTime() === new Date(expected).getTime();
  if (typeof actual === "string" && typeof expected === "string") {
    return actual.trim().toLowerCase() === expected.trim().toLowerCase();
  }
  return actual === expected;
}

async function all(model: ModelName): Promise<Row[]> {
  if (!firebaseCredentialsAvailable) {
    initMemoryStore();
    return Array.from(memoryStore.get(model)?.values() ?? []).map((row) => ({ ...row }));
  }
  const snapshot = await firestore.collection(collections[model]).get();
  return snapshot.docs.map((document: any) => ({ id: document.id, ...hydrateValue(document.data()) }));
}
async function candidateRows(model: ModelName, where?: Row): Promise<Row[]> {
  if (!firebaseCredentialsAvailable || !where) return all(model);
  const fields = flattenWhere(where);
  const relationFields = Object.keys(fields).filter((field) => relation(model, field));
  if ("OR" in fields || "AND" in fields || "NOT" in fields || relationFields.length) return all(model);
  const operatorMap: Record<string, FirebaseFirestore.WhereFilterOp> = { equals: "==", in: "in", gt: ">", gte: ">=", lt: "<", lte: "<=" };
  const entry = Object.entries(fields).find(([, value]) => {
    if (value instanceof Date || value === null || ["string", "number", "boolean"].includes(typeof value)) return true;
    if (value && typeof value === "object" && Object.keys(value).length === 1) return Object.keys(value).some((operator) => operator in operatorMap);
    return false;
  });
  if (!entry) return all(model);
  const [field, value] = entry;
  const operator = value && typeof value === "object" && !(value instanceof Date) ? Object.keys(value)[0] : "equals";
  const expected = value instanceof Date ? Timestamp.fromDate(value) : value && typeof value === "object" && !(value instanceof Date) ? value[operator] : value;
  const firestoreValue = expected instanceof Date ? Timestamp.fromDate(expected) : expected;
  const snapshot = await firestore.collection(collections[model]).where(field, operatorMap[operator], firestoreValue).get();
  return snapshot.docs.map((document: any) => ({ id: document.id, ...hydrateValue(document.data()) }));
}
async function matches(model: ModelName, row: Row, rawWhere: Row = {}): Promise<boolean> {
  const where = flattenWhere(rawWhere);
  for (const [field, expected] of Object.entries(where)) {
    if (field === "OR") { if (!(await Promise.all((expected as Row[]).map((part) => matches(model, row, part)))).some(Boolean)) return false; continue; }
    if (field === "AND") { if (!(await Promise.all((expected as Row[]).map((part) => matches(model, row, part)))).every(Boolean)) return false; continue; }
    if (field === "NOT") { if (await matches(model, row, expected as Row)) return false; continue; }
    const rel = relation(model, field);
    if (rel) {
      const relationWhere = expected && typeof expected === "object" && "is" in expected ? (expected as Row).is : expected;
      const id = row[rel.localKey];
      if (relationWhere === null) { if (id !== null && id !== undefined) return false; continue; }
      if (relationWhere === undefined || id === null || id === undefined) return false;
      const matchesRelation = (await candidateRows(rel.model, { [rel.foreignKey]: id })).filter((candidate) => candidate[rel.foreignKey] === id);
      if (rel.many ? !(await Promise.all(matchesRelation.map((candidate) => matches(rel.model, candidate, relationWhere)))).some(Boolean) : !matchesRelation[0] || !(await matches(rel.model, matchesRelation[0], relationWhere))) return false;
      continue;
    }
    if (!compareValue(row[field], expected)) return false;
  }
  return true;
}

async function nestedRows(model: ModelName, row: Row, field: string, option: any): Promise<any> {
  const rel = relation(model, field);
  if (!rel) return undefined;
  const value = row[rel.localKey];
  if (value === null || value === undefined) return rel.many ? [] : null;
  let related = (await candidateRows(rel.model, { [rel.foreignKey]: value })).filter((candidate) => candidate[rel.foreignKey] === value);
  if (option?.where) related = await filterRows(rel.model, related, option.where);
  related = sortRows(related, option?.orderBy);
  if (typeof option?.take === "number") related = related.slice(0, option.take);
  const hydrated = await Promise.all(related.map((candidate) => project(rel.model, candidate, option?.select ? { select: option.select } : { include: option?.include })));
  return rel.many ? hydrated : hydrated[0] ?? null;
}
async function project(model: ModelName, row: Row, args: Row = {}): Promise<Row> {
  const output: Row = args.select ? Object.fromEntries(Object.keys(args.select).filter((key) => args.select[key] === true && key in row).map((key) => [key, row[key]])) : { ...row };
  const options = args.select || args.include || {};
  for (const [field, option] of Object.entries(options)) {
    if (option === false) continue;
    if (field === "_count" && model === "session") {
      const countOptions = option as Row; const result: Row = {};
      if (countOptions.select?.attendances) result.attendances = (await all("attendance")).filter((attendance) => attendance.sessionId === row.id).length;
      output._count = result;
      continue;
    }
    if (relation(model, field)) output[field] = await nestedRows(model, row, field, option === true ? {} : option);
  }
  return output;
}
async function filterRows(model: ModelName, rows: Row[], where?: Row): Promise<Row[]> {
  if (!where) return rows;
  const result: Row[] = [];
  for (const row of rows) if (await matches(model, row, where)) result.push(row);
  return result;
}
function sortRows(rows: Row[], orderBy?: Row | Row[]): Row[] {
  const orders = Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : [];
  if (!orders.length) return rows;
  return [...rows].sort((left, right) => {
    for (const order of orders) for (const [field, direction] of Object.entries(order)) {
      const a = left[field] instanceof Date ? left[field].getTime() : left[field];
      const b = right[field] instanceof Date ? right[field].getTime() : right[field];
      if (a === b) continue;
      const result = a === undefined || a === null ? -1 : b === undefined || b === null ? 1 : a < b ? -1 : 1;
      return direction === "desc" ? -result : result;
    }
    return 0;
  });
}
async function findRows(model: ModelName, args: Row = {}): Promise<Row[]> {
  let rows = await filterRows(model, await candidateRows(model, args.where), args.where);
  rows = sortRows(rows, args.orderBy);
  if (args.skip) rows = rows.slice(args.skip);
  if (typeof args.take === "number") rows = rows.slice(0, args.take);
  return Promise.all(rows.map((row) => project(model, row, args)));
}
function uniqueFields(model: ModelName): string[][] {
  if (model === "member") return [["memberId"], ["email"], ["phone"]];
  if (model === "adminUser") return [["email"]];
  if (model === "attendance") return [["memberId", "sessionId"]];
  if (model === "followUp") return [["memberId"]];
  return [];
}
function assertUniqueError() { throw error("P2002", "A record with these unique values already exists."); }
function memberUniqueRef(field: "email" | "phone", value: string) {
  const digest = createHash("sha256").update(value).digest("hex");
  return firestore.collection("member_unique_keys").doc(`${field}_${digest}`);
}
async function createRow(model: ModelName, source: Row): Promise<Row> {
  const normalizedSource = { ...source };
  if (normalizedSource.email && typeof normalizedSource.email === "string") {
    normalizedSource.email = normalizedSource.email.trim().toLowerCase();
  }
  const row = defaults(model, normalizedSource);
  const id = docId(model, row);
  row.id = id;
  if (!firebaseCredentialsAvailable) {
    initMemoryStore();
    const store = memoryStore.get(model)!;
    if (model === "member") {
      const email = row.email?.toLowerCase();
      const phone = row.phone;
      const allMembers = Array.from(store.values());
      if (allMembers.some((m) => (email && m.email?.toLowerCase() === email) || (phone && m.phone === phone))) {
        assertUniqueError();
      }
    } else if (uniqueFields(model).length) {
      const allRows = Array.from(store.values());
      const matchesExisting = uniqueFields(model).some((fields) => {
        if (fields.some((field) => row[field] === null || row[field] === undefined)) return false;
        return allRows.some((candidate) => fields.every((field) => candidate[field] === row[field]));
      });
      if (matchesExisting) assertUniqueError();
    }
    if (store.has(id)) {
      // If record exists with same id, update it rather than erroring out
      store.set(id, { ...store.get(id), ...row });
      persistMemoryStore();
      return store.get(id)!;
    }
    store.set(id, { ...row });
    persistMemoryStore();
    return row;
  }
  const ref = firestore.collection(collections[model]).doc(id);
  if (model === "member") {
    const email = row.email?.toLowerCase();
    const phone = row.phone;
    await firestore.runTransaction(async (transaction) => {
      const emailRef = email ? memberUniqueRef("email", email) : null;
      const phoneRef = phone ? memberUniqueRef("phone", phone) : null;
      const refs = [emailRef, phoneRef].filter(Boolean) as DocumentReference[];
      const snapshots = await Promise.all(refs.map((uniqueRef) => transaction.get(uniqueRef)));
      if (snapshots.some((snapshot) => snapshot.exists)) assertUniqueError();
      transaction.create(ref, clean(row));
      if (emailRef) transaction.create(emailRef, { memberId: id });
      if (phoneRef) transaction.create(phoneRef, { memberId: id });
    });
    return row;
  }
  if (uniqueFields(model).length) {
    const matchesExisting = await Promise.all(uniqueFields(model).map(async (fields) => {
      if (fields.some((field) => row[field] === null || row[field] === undefined)) return false;
      return (await all(model)).some((candidate) => fields.every((field) => candidate[field] === row[field]));
    }));
    if (matchesExisting.some(Boolean)) assertUniqueError();
  }
  try { await ref.create(clean(row) as DocumentData); } catch (cause: any) { if (cause?.code === 6 || cause?.code === "already-exists") assertUniqueError(); throw cause; }
  return row;
}
function updateValue(old: any, value: any): any {
  if (value && typeof value === "object" && !Array.isArray(value) && "increment" in value) return Number(old || 0) + Number(value.increment);
  return value;
}
async function updateRow(model: ModelName, where: Row, data: Row): Promise<Row> {
  const found = (await all(model)).find((row) => Object.entries(flattenWhere(where)).every(([key, value]) => compareValue(row[key], value)));
  if (!found) throw error("P2025", "Record not found.");
  const next = Object.fromEntries(Object.entries(data).map(([key, value]) => [key, updateValue(found[key], value)]));
  if (model === "followUp" && !("updatedAt" in next)) next.updatedAt = new Date();
  if (!firebaseCredentialsAvailable) {
    initMemoryStore();
    const store = memoryStore.get(model)!;
    const updated = { ...found, ...next };
    store.set(found.id, updated);
    persistMemoryStore();
    return updated;
  }
  const ref = firestore.collection(collections[model]).doc(found.id);
  if (model === "member") {
    await firestore.runTransaction(async (transaction) => {
      const currentSnap = await transaction.get(ref);
      if (!currentSnap.exists) throw error("P2025", "Record not found.");
      const current = hydrateValue(currentSnap.data());
      const uniqueChanges: { field: "email" | "phone"; previous: string | undefined; updated: string | undefined; ref: DocumentReference }[] = [];
      for (const field of ["email", "phone"] as const) {
        const previous = current[field]?.toLowerCase?.() ?? current[field];
        const updated = next[field]?.toLowerCase?.() ?? next[field];
        if (updated && updated !== previous) {
          const newRef = memberUniqueRef(field, updated);
          uniqueChanges.push({ field, previous, updated, ref: newRef });
        }
        else if (previous && updated !== previous) uniqueChanges.push({ field, previous, updated, ref: memberUniqueRef(field, previous) });
      }
      const uniqueSnapshots = await Promise.all(uniqueChanges.filter((change) => change.updated).map((change) => transaction.get(change.ref)));
      if (uniqueSnapshots.some((snapshot) => snapshot.exists)) assertUniqueError();
      for (const change of uniqueChanges) {
        if (change.updated) transaction.create(change.ref, { memberId: found.id });
        else transaction.delete(change.ref);
      }
      transaction.update(ref, clean(next));
    });
  } else await ref.update(clean(next));
  return { ...found, ...next };
}
async function deleteRow(model: ModelName, where: Row): Promise<Row> {
  const found = (await all(model)).find((row) => Object.entries(flattenWhere(where)).every(([key, value]) => compareValue(row[key], value)));
  if (!found) throw error("P2025", "Record not found.");
  if (!firebaseCredentialsAvailable) {
    initMemoryStore();
    const store = memoryStore.get(model)!;
    store.delete(found.id);
    if (model === "adminUser") {
      if (found.email) {
        const canonicalId = `admin_${createHash("sha256").update(String(found.email).trim().toLowerCase()).digest("hex").slice(0, 32)}`;
        store.delete(canonicalId);
        for (const [k, v] of Array.from(store.entries())) {
          if (v.email && String(v.email).trim().toLowerCase() === String(found.email).trim().toLowerCase()) {
            store.delete(k);
          }
        }
      }
    }
    if (model === "member") {
      const attendances = memoryStore.get("attendance")!;
      for (const [k, v] of attendances) if (v.memberId === found.id) attendances.delete(k);
      const followUps = memoryStore.get("followUp")!;
      for (const [k, v] of followUps) if (v.memberId === found.id) followUps.delete(k);
    }
    if (model === "session") {
      const attendances = memoryStore.get("attendance")!;
      for (const [k, v] of attendances) if (v.sessionId === found.id) attendances.delete(k);
    }
    persistMemoryStore();
    return found;
  }
  if (model === "member") {
    const related = await Promise.all(["attendance", "followUp"].map(async (child) => {
      const childModel = child as ModelName;
      return (await all(childModel)).filter((row) => row.memberId === found.id);
    }));
    await Promise.all(related.flat().map((row, index) => {
      const childModel: ModelName = index < related[0].length ? "attendance" : "followUp";
      return firestore.collection(collections[childModel]).doc(row.id).delete();
    }));
    if (found.email) await memberUniqueRef("email", found.email.toLowerCase()).delete();
    if (found.phone) await memberUniqueRef("phone", found.phone).delete();
  }
  if (model === "session") await Promise.all((await all("attendance")).filter((row) => row.sessionId === found.id).map((row) => firestore.collection(collections.attendance).doc(row.id).delete()));
  await firestore.collection(collections[model]).doc(found.id).delete();
  return found;
}

function createModel(model: ModelName): any {
  return {
    findMany: (args?: Row) => findRows(model, args),
    findFirst: async (args?: Row) => (await findRows(model, { ...args, take: 1 }))[0] ?? null,
    findUnique: async (args: Row) => (await findRows(model, { ...args, take: 1 }))[0] ?? null,
    count: async ({ where }: Row = {}) => (await filterRows(model, await candidateRows(model, where), where)).length,
    create: async ({ data, select, include }: Row) => project(model, await createRow(model, data), { select, include }),
    update: async ({ where, data, select, include }: Row) => project(model, await updateRow(model, where, data), { select, include }),
    updateMany: async ({ where, data }: Row) => {
      const rows = await filterRows(model, await candidateRows(model, where), where);
      await Promise.all(rows.map((row) => updateRow(model, { id: row.id }, data)));
      return { count: rows.length };
    },
    delete: ({ where }: Row) => deleteRow(model, where),
    deleteMany: async ({ where }: Row = {}) => {
      const rows = await filterRows(model, await candidateRows(model, where), where);
      await Promise.all(rows.map((row) => deleteRow(model, { id: row.id })));
      return { count: rows.length };
    },
    upsert: async ({ where, create, update, select, include }: Row) => {
      if (!firebaseCredentialsAvailable) {
        initMemoryStore();
        if (model === "memberSequence") {
          const year = String(create.year ?? where.year);
          const store = memoryStore.get(model)!;
          const current = store.get(year);
          const row = current ? { ...current, nextValue: current.nextValue + Number(update.nextValue?.increment ?? 0) } : defaults(model, create);
          store.set(year, row);
          persistMemoryStore();
          return project(model, row, { select, include });
        }
        const current = (await findRows(model, { where, take: 1 }))[0];
        const res = project(model, current ? await updateRow(model, where, update) : await createRow(model, create), { select, include });
        persistMemoryStore();
        return res;
      }
      if (model === "memberSequence") {
        const year = String(create.year ?? where.year);
        const ref = firestore.collection(collections.memberSequence).doc(year);
        const sequence = await firestore.runTransaction(async (transaction) => {
          const snapshot = await transaction.get(ref);
          const current = snapshot.exists ? hydrateValue(snapshot.data()) : null;
          const row = current ? { ...current, nextValue: current.nextValue + Number(update.nextValue?.increment ?? 0) } : defaults(model, create);
          transaction.set(ref, clean(row));
          return row;
        });
        return project(model, sequence, { select, include });
      }
      const current = (await findRows(model, { where, take: 1 }))[0];
      return project(model, current ? await updateRow(model, where, update) : await createRow(model, create), { select, include });
    },
    groupBy: async ({ by, where }: Row) => {
      const rows = await filterRows(model, await candidateRows(model, where), where);
      const fields = Array.isArray(by) ? by : [by];
      const groups = new Map<string, Row>();
      for (const row of rows) {
        const key = JSON.stringify(fields.map((field: string) => row[field] ?? null));
        const group = groups.get(key) ?? { ...Object.fromEntries(fields.map((field: string) => [field, row[field] ?? null])), _count: { _all: 0 } };
        group._count._all += 1; groups.set(key, group);
      }
      return [...groups.values()];
    },
  };
}

export const db = Object.fromEntries((Object.keys(collections) as ModelName[]).map((model) => [model, createModel(model)])) as DatabaseApi;
db.$disconnect = async () => {};
db.consumeRateLimit = async (key: string, now: Date, resetAt: Date, maximum: number) => {
  if (!firebaseCredentialsAvailable) {
    initMemoryStore();
    const store = memoryStore.get("rateLimit")!;
    const row = store.get(key);
    const hits = row && row.resetAt instanceof Date && row.resetAt > now ? row.hits + 1 : 1;
    store.set(key, { id: key, key, hits, resetAt: row?.resetAt instanceof Date && row.resetAt > now ? row.resetAt : resetAt });
    return hits > maximum;
  }
  const ref = firestore.collection(collections.rateLimit).doc(key);
  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const row = snapshot.exists ? hydrateValue(snapshot.data()) : null;
    const hits = row && row.resetAt instanceof Date && row.resetAt > now ? row.hits + 1 : 1;
    transaction.set(ref, clean({ id: key, key, hits, resetAt: row?.resetAt instanceof Date && row.resetAt > now ? row.resetAt : resetAt }));
    return hits > maximum;
  });
};

export const DEFAULT_SUPER_ADMIN_EMAILS: string[] = ["nscpeace1@gmail.com"];

export const PRIMARY_ADMIN_EMAIL = "nscpeace1@gmail.com";

export function isDefaultSuperAdmin(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return normalized === PRIMARY_ADMIN_EMAIL;
}

export async function clearAllAuthorizedExceptSuperAdmin(): Promise<{ deletedCount: number }> {
  // Retain authorized emails permanently; do not purge.
  return { deletedCount: 0 };
}

export async function ensureInitialAuthorizationPurge(): Promise<void> {
  // Retain authorized emails permanently; do not purge.
  return;
}

