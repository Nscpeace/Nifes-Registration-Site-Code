import "server-only";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  Timestamp,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  collection,
} from "firebase/firestore";
import { db as firestoreDb } from "@/lib/firebase";

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

const globalForDb = globalThis as unknown as {
  nifesMemoryStore?: Map<ModelName, Map<string, Row>>;
  nifesMemoryInitialized?: boolean;
  nifesFirestoreSyncAttempted?: boolean;
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
  if (fs.existsSync(DATA_FILE_PATH)) {
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

  // Ensure default recurring events exist in memory store
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

async function syncInitialDataToFirestore() {
  if (globalForDb.nifesFirestoreSyncAttempted) return;
  globalForDb.nifesFirestoreSyncAttempted = true;
  initMemoryStore();
  try {
    // 1. Ensure Super Admin exists in Firestore
    const primaryAdmin = PRIMARY_ADMIN_EMAIL;
    const adminId = `admin_${createHash("sha256").update(primaryAdmin).digest("hex").slice(0, 32)}`;
    const adminRef = doc(firestoreDb, collections.adminUser, adminId);
    void setDoc(
      adminRef,
      {
        id: adminId,
        email: primaryAdmin,
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        invitedBy: null,
        createdAt: Timestamp.now(),
        lastLoginAt: null,
      },
      { merge: true }
    ).catch(() => {});

    // 2. Sync all collections from local store to Firestore so former records are never lost
    for (const [model, colName] of Object.entries(collections) as [ModelName, string][]) {
      const rows = memoryStore.get(model);
      if (rows && rows.size > 0) {
        for (const [id, row] of rows.entries()) {
          void setDoc(doc(firestoreDb, colName, id), clean(row), { merge: true }).catch(() => {});
        }
      }
    }
  } catch (err) {
    console.warn("[Firestore] Initial seeding check:", err);
  }
}
syncInitialDataToFirestore().catch(() => {});

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
    member: { guest: false, email: null, dateOfBirth: null, placeOfResidence: null, heardAbout: null, heardAboutOther: null, level: null, consentGivenAt: null, createdAt: now },
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
    if ((key === "eventId_startsAt" || key === "memberId_sessionId") && value && typeof value === "object") {
      Object.assign(result, value);
    } else {
      result[key] = value;
    }
  }
  return result;
}
function compareValue(actual: any, expected: any): boolean {
  if (actual === undefined && expected !== undefined) return false;
  actual = actual instanceof Date ? actual.getTime() : actual;
  if (expected instanceof Date) expected = expected.getTime();
  if (expected && typeof expected === "object" && !(expected instanceof Date) && !(expected instanceof Timestamp) && !Array.isArray(expected)) {
    const knownOps = new Set(["equals", "in", "notIn", "gt", "gte", "lt", "lte", "contains", "startsWith", "endsWith", "not", "mode"]);
    const hasKnownOp = Object.keys(expected).some((k) => knownOps.has(k));
    if (hasKnownOp) {
      for (const [op, value] of Object.entries(expected)) {
        if (op === "mode") continue;
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
    return JSON.stringify(actual) === JSON.stringify(expected);
  }
  if (actual instanceof Date || expected instanceof Date) return new Date(actual).getTime() === new Date(expected).getTime();
  if (typeof actual === "string" && typeof expected === "string") {
    return actual.trim().toLowerCase() === expected.trim().toLowerCase();
  }
  return actual === expected;
}

const cacheStore = new Map<ModelName, { rows: Row[]; timestamp: number }>();
const CACHE_TTL_MS = 10_000;

export function invalidateCache(model?: ModelName) {
  if (model) cacheStore.delete(model);
  else cacheStore.clear();
}

async function all(model: ModelName, forceFresh = false): Promise<Row[]> {
  initMemoryStore();
  const now = Date.now();
  const cached = cacheStore.get(model);
  if (!forceFresh && cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.rows;
  }

  // 1. Start with all local persistent records
  const map = new Map<string, Row>();
  const localRows = memoryStore.get(model);
  if (localRows) {
    for (const [id, row] of localRows.entries()) {
      map.set(id, { ...row });
    }
  }

  // 2. Fetch from Firestore with fallback, merging remote updates without losing local records
  try {
    const colRef = collection(firestoreDb, collections[model]);
    const fetchPromise = getDocs(colRef);
    const timeoutPromise = new Promise<null>((res) => setTimeout(() => res(null), 1500));
    const snapshot = await Promise.race([fetchPromise, timeoutPromise]);

    if (snapshot && !snapshot.empty) {
      for (const document of snapshot.docs) {
        const remoteData = { id: document.id, ...hydrateValue(document.data()) };
        if (model === "member") {
          // Find matching local member by memberId, email, or phone
          const existingKey = Array.from(map.keys()).find((k) => {
            const item = map.get(k);
            if (!item) return false;
            if (remoteData.memberId && item.memberId && item.memberId.toUpperCase() === remoteData.memberId.toUpperCase()) return true;
            if (remoteData.email && item.email && item.email.toLowerCase() === remoteData.email.toLowerCase()) return true;
            if (remoteData.phone && item.phone && item.phone === remoteData.phone) return true;
            return false;
          });
          if (existingKey) {
            const merged = { ...map.get(existingKey), ...remoteData, id: existingKey };
            map.set(existingKey, merged);
            memoryStore.get(model)?.set(existingKey, merged);
          } else {
            map.set(document.id, remoteData);
            memoryStore.get(model)?.set(document.id, remoteData);
          }
        } else {
          map.set(document.id, remoteData);
          memoryStore.get(model)?.set(document.id, remoteData);
        }
      }
      persistMemoryStore();
    }
  } catch (err) {
    console.warn(`[Firestore] all(${model}) read fallback:`, err);
  }

  // 3. Ensure any local rows missing in Firestore are pushed in background
  if (localRows && localRows.size > 0) {
    void Promise.resolve().then(async () => {
      for (const [id, row] of localRows.entries()) {
        try {
          await setDoc(doc(firestoreDb, collections[model], id), clean(row), { merge: true });
        } catch {}
      }
    });
  }

  const result = Array.from(map.values());
  cacheStore.set(model, { rows: result, timestamp: now });
  return result;
}

async function candidateRows(model: ModelName, where?: Row): Promise<Row[]> {
  return all(model);
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

async function createRow(model: ModelName, source: Row): Promise<Row> {
  const normalizedSource = { ...source };
  if (normalizedSource.email && typeof normalizedSource.email === "string") {
    normalizedSource.email = normalizedSource.email.trim().toLowerCase();
  }
  const row = defaults(model, normalizedSource);
  const id = docId(model, row);
  row.id = id;

  const allRows = await all(model);
  if (model === "member") {
    const email = row.email?.toLowerCase();
    const phone = row.phone;
    if (allRows.some((m) => (email && m.email?.toLowerCase() === email) || (phone && m.phone === phone))) {
      assertUniqueError();
    }
  } else if (uniqueFields(model).length) {
    const matchesExisting = uniqueFields(model).some((fields) => {
      if (fields.some((field) => row[field] === null || row[field] === undefined)) return false;
      return allRows.some((candidate) => fields.every((field) => candidate[field] === row[field]));
    });
    if (matchesExisting) assertUniqueError();
  }

  // 1. Store in memory and disk immediately
  initMemoryStore();
  const store = memoryStore.get(model)!;
  store.set(id, row);
  persistMemoryStore();
  invalidateCache(model);

  // 2. Persist to Firestore in background without blocking response
  void setDoc(doc(firestoreDb, collections[model], id), clean(row)).catch((err) => {
    console.warn(`[Firestore] setDoc failed for ${model}/${id}:`, err);
  });

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
  const updated = { ...found, ...next };

  initMemoryStore();
  const store = memoryStore.get(model)!;
  store.set(found.id, updated);
  persistMemoryStore();
  invalidateCache(model);

  // Persist to Firestore in background
  void setDoc(doc(firestoreDb, collections[model], found.id), clean(updated), { merge: true }).catch((err) => {
    console.warn(`[Firestore] updateDoc failed for ${model}/${found.id}:`, err);
  });

  return updated;
}

async function deleteRow(model: ModelName, where: Row): Promise<Row> {
  const found = (await all(model)).find((row) => Object.entries(flattenWhere(where)).every(([key, value]) => compareValue(row[key], value)));
  if (!found) throw error("P2025", "Record not found.");

  initMemoryStore();
  const store = memoryStore.get(model)!;
  store.delete(found.id);
  if (model === "adminUser" && found.email) {
    const canonicalId = `admin_${createHash("sha256").update(String(found.email).trim().toLowerCase()).digest("hex").slice(0, 32)}`;
    store.delete(canonicalId);
    for (const [k, v] of Array.from(store.entries())) {
      if (v.email && String(v.email).trim().toLowerCase() === String(found.email).trim().toLowerCase()) {
        store.delete(k);
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
  invalidateCache(model);

  // Delete from Firestore
  try {
    const docRef = doc(firestoreDb, collections[model], found.id);
    void deleteDoc(docRef).catch(() => {});
  } catch (err) {
    console.warn(`[Firestore] deleteDoc failed for ${model}/${found.id}:`, err);
  }

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
      if (model === "memberSequence") {
        const year = String(create.year ?? where.year ?? new Date().getFullYear());
        initMemoryStore();

        // Calculate highest sequence number from existing members in memoryStore
        let highest = 0;
        const members = memoryStore.get("member");
        if (members) {
          for (const m of members.values()) {
            if (m.memberId && typeof m.memberId === "string") {
              const match = m.memberId.match(new RegExp(`NIFES-${year}-(\\d+)`));
              if (match) {
                const num = parseInt(match[1], 10);
                if (num > highest) highest = num;
              }
            }
          }
        }

        const seqStore = memoryStore.get("memberSequence")!;
        const existingSeq = seqStore.get(year);
        const currentVal = Math.max(highest + 1, Number(existingSeq?.nextValue || 1));
        const nextVal = currentVal + Number(update.nextValue?.increment ?? 1);
        const row = { year: Number(year), nextValue: nextVal };

        seqStore.set(year, row);
        persistMemoryStore();

        // Sync to Firestore in background without blocking the user
        void setDoc(doc(firestoreDb, collections.memberSequence, year), row).catch(() => {});
        return project(model, row, { select, include });
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
  initMemoryStore();
  const store = memoryStore.get("rateLimit")!;
  const row = store.get(key);
  const hits = row && row.resetAt instanceof Date && row.resetAt > now ? row.hits + 1 : 1;
  const updatedRow = { id: key, key, hits, resetAt: row?.resetAt instanceof Date && row.resetAt > now ? row.resetAt : resetAt };
  store.set(key, updatedRow);
  void setDoc(doc(firestoreDb, collections.rateLimit, key), clean(updatedRow)).catch(() => {});
  return hits > maximum;
};

export const DEFAULT_SUPER_ADMIN_EMAILS: string[] = ["nscpeace1@gmail.com"];

export const PRIMARY_ADMIN_EMAIL = "nscpeace1@gmail.com";

export function isDefaultSuperAdmin(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return normalized === PRIMARY_ADMIN_EMAIL;
}

export async function clearAllAuthorizedExceptSuperAdmin(): Promise<{ deletedCount: number }> {
  return { deletedCount: 0 };
}

export async function ensureInitialAuthorizationPurge(): Promise<void> {
  return;
}


