import { getDB } from "../lib/db.js";
import type { User } from "./user.model.js";
import type { Profile } from "./profile.model.js";
import type { EncryptedOpLogBatch } from "./encrypted-oplog.model.js";
import type { RecoveryKeyStatus } from "./recovery-key-status.model.js";

// Collection accessor — better-auth's MongoDB adapter uses "user" (singular)
export function usersCollection() {
  return getDB().collection<User>("user");
}

export function profilesCollection() {
  return getDB().collection<Profile>("profiles");
}

export function encryptedOpLogsCollection() {
  return getDB().collection<EncryptedOpLogBatch>("encryptedOpLogs");
}

export function recoveryKeyStatusCollection() {
  return getDB().collection<RecoveryKeyStatus>("recoveryKeyStatus");
}
