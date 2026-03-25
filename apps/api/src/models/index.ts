import { getDB } from "../lib/db.js";
import type { User } from "./user.model.js";
import type { Team, Member, NotificationPreference, Notification } from "./team.model.js";
import type { Ticket } from "./ticket.model.js";

export function usersCollection() {
  return getDB().collection<User>("users");
}

export function teamsCollection() {
  return getDB().collection<Team>("teams");
}

export function membersCollection() {
  return getDB().collection<Member>("members");
}

export function ticketsCollection() {
  return getDB().collection<Ticket>("tickets");
}

export function notificationsCollection() {
  return getDB().collection<Notification>("notifications");
}

export function notificationPreferencesCollection() {
  return getDB().collection<NotificationPreference>("notificationPreferences");
}
