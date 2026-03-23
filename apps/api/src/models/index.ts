import { getDB } from "../lib/db.js";
import type { User } from "./user.model.js";
import type { Profile } from "./profile.model.js";
import type { Ticket } from "./ticket.model.js";
import type { WorkSession } from "./work-session.model.js";
import type { UserDailyStat } from "./user-daily-stat.model.js";

// Collection accessor — use this everywhere instead of getDB().collection("users")
export function usersCollection() {
  return getDB().collection<User>("users");
}

export function profilesCollection() {
  return getDB().collection<Profile>("profiles");
}

export function ticketsCollection() {
  return getDB().collection<Ticket>("tickets");
}

export function workSessionsCollection() {
  return getDB().collection<WorkSession>("workSessions");
}

export function userDailyStatsCollection() {
  return getDB().collection<UserDailyStat>("userDailyStats");
}
