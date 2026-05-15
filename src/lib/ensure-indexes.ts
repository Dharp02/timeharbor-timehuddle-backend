import { getDB } from "./db.js";

export async function ensureIndexes() {
  const db = getDB();

  const profiles = db.collection("profiles");
  await profiles.createIndex({ userId: 1, app: 1 }, { unique: true });

  // Encrypted op-log relay (E2E encrypted sync)
  const encryptedOpLogs = db.collection("encryptedOpLogs");
  await encryptedOpLogs.createIndex({ userId: 1, hlc: 1 });
  await encryptedOpLogs.createIndex({ userId: 1, deviceId: 1, hlc: 1 });

  // TimeHuddle connections — one connection per TimeHarbor user
  const timehudleConnections = db.collection("timehuddle_connections");
  await timehudleConnections.createIndex({ userId: 1 }, { unique: true });

  // Push subscription tokens — looked up by userId when sending notifications
  const pushTokens = db.collection("push_tokens");
  await pushTokens.createIndex({ userId: 1 });
  // Prevent duplicate native token registrations
  await pushTokens.createIndex({ userId: 1, type: 1, token: 1 }, { sparse: true });

  // OAuth states — auto-expire after 15 minutes (TTL index on createdAt)
  const oauthStates = db.collection("timehuddle_oauth_states");
  await oauthStates.createIndex({ state: 1 }, { unique: true });
  await oauthStates.createIndex({ createdAt: 1 }, { expireAfterSeconds: 900 });

  console.log("MongoDB indexes ensured");
}
