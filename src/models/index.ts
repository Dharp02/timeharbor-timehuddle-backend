import { getDB } from "../lib/db.js";
import type { User } from "./user.model.js";
import type { Team } from "./team.model.js";
import type { Ticket } from "./ticket.model.js";
import type { ClockEvent } from "./clock.model.js";
import type { Message } from "./message.model.js";
import type { Notification } from "./notification.model.js";
import type { PushToken } from "./push-token.model.js";
import type { Profile } from "./profile.model.js";
import type { EncryptedOpLogBatch } from "./encrypted-oplog.model.js";
import type { RecoveryKeyStatus } from "./recovery-key-status.model.js";
import type { TimehudleConnection, OAuthState } from "./timehuddle-connection.model.js";

// Collection accessor — better-auth's MongoDB adapter uses "user" (singular)
export function usersCollection() {
  return getDB().collection<User>("user");
}

// Teams — populated once Phase 3 timehuddle migration is complete
export function teamsCollection() {
  return getDB().collection<Team>("teams");
}

// Tickets
export function ticketsCollection() {
  return getDB().collection<Ticket>("tickets");
}

// Clock events
export function clockEventsCollection() {
  return getDB().collection<ClockEvent>("clockevents");
}

// Messages
export function messagesCollection() {
  return getDB().collection<Message>("messages");
}

// Notifications
export function notificationsCollection() {
  return getDB().collection<Notification>("notifications");
}

// Push subscription tokens (web push + native APNs/FCM)
export function pushTokensCollection() {
  return getDB().collection<PushToken>("push_tokens");
}

// Profiles
export function profilesCollection() {
  return getDB().collection<Profile>("profiles");
}

// Encrypted op-log batches
export function encryptedOpLogsCollection() {
  return getDB().collection<EncryptedOpLogBatch>("encryptedOpLogs");
}

// Recovery key status
export function recoveryKeyStatusCollection() {
  return getDB().collection<RecoveryKeyStatus>("recoveryKeyStatus");
}

// TimeHuddle connections
export function timehudleConnectionsCollection() {
  return getDB().collection<TimehudleConnection>("timehuddle_connections");
}

// OAuth states — short-lived PKCE state records for the TimeHuddle OAuth flow.
// A TTL index on createdAt should be created at server startup (15-minute expiry).
export function oauthStatesCollection() {
  return getDB().collection<OAuthState>("timehuddle_oauth_states");
}
