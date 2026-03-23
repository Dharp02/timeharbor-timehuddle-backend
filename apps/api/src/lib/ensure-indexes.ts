import { getDB } from "./db.js";

export async function ensureIndexes() {
  const db = getDB();

  const profiles = db.collection("profiles");
  await profiles.createIndex({ userId: 1, app: 1 }, { unique: true });

  const tickets = db.collection("tickets");
  await tickets.createIndex({ createdBy: 1, _deleted: 1 });
  await tickets.createIndex({ status: 1 });
  await tickets.createIndex({ createdBy: 1, status: 1 });

  const workSessions = db.collection("workSessions");
  await workSessions.createIndex({ clientSessionId: 1 }, { unique: true });
  await workSessions.createIndex({ userId: 1, date: 1 });
  await workSessions.createIndex({ userId: 1, clockIn: -1 });
  await workSessions.createIndex({ userId: 1, clockOut: 1 }, { sparse: true });

  const userDailyStats = db.collection("userDailyStats");
  await userDailyStats.createIndex({ userId: 1, date: 1 }, { unique: true });

  console.log("MongoDB indexes ensured");
}
