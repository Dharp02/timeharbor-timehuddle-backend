import { ObjectId } from "mongodb";
import { notificationService } from "./notification.service.js";
import { teamsCollection, membersCollection } from "../models/index.js";
import type { Notification } from "../models/team.model.js";

export interface ClockEventPayload {
  userId: string;
  userName: string;
  teamId: string;
  event: "clock_in" | "clock_out";
  timestamp: string;
  tickets?: { id: string; title: string; accumulatedTime?: number }[];
  youtubeLink?: string;
  sessionDuration?: number;
  source: "timehuddle" | "timejournal";
}

export interface TicketStatusPayload {
  userId: string;
  userName: string;
  teamId: string;
  ticketId: string;
  ticketTitle: string;
  status: string;
  source: "timehuddle" | "timejournal";
}

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export class BridgeService {
  async handleClockEvent(payload: ClockEventPayload): Promise<Notification[]> {
    const { userId, userName, teamId, event, tickets, youtubeLink, sessionDuration, source } = payload;

    const prefEvent = event === "clock_in" ? "notifyOnClockIn" : "notifyOnClockOut";
    const recipientIds = await notificationService.shouldNotify(teamId, userId, prefEvent);

    if (recipientIds.length === 0) return [];

    const team = await teamsCollection().findOne({ _id: new ObjectId(teamId) });
    const teamName = team?.name || "Unknown Team";

    let body: string;
    const sourceLabel = source === "timejournal" ? " (via TimeJournal)" : "";

    if (event === "clock_in") {
      body = `${userName} clocked in to "${teamName}"${sourceLabel}`;
    } else {
      const parts = [`${userName} clocked out of "${teamName}"${sourceLabel}`];
      if (sessionDuration) {
        parts[0] += ` after ${formatDuration(sessionDuration)}`;
      }
      if (tickets && tickets.length > 0) {
        const ticketSummary = tickets
          .map((t) => {
            const time = t.accumulatedTime ? ` (${formatDuration(t.accumulatedTime)})` : "";
            return `${t.title}${time}`;
          })
          .join(", ");
        parts.push(`Tickets: ${ticketSummary}`);
      }
      if (youtubeLink) {
        parts.push(`Pulse: ${youtubeLink}`);
      }
      body = parts.join(". ");
    }

    const notifications: Notification[] = [];
    for (const recipientId of recipientIds) {
      const notification = await notificationService.create({
        userId: recipientId,
        teamId,
        type: event,
        title: event === "clock_in" ? "Member Clocked In" : "Member Clocked Out",
        body,
        data: {
          sourceUserId: userId,
          source,
          tickets: tickets || [],
          youtubeLink: youtubeLink || null,
          sessionDuration: sessionDuration || null,
        },
      });
      notifications.push(notification);
    }

    return notifications;
  }

  async handleTicketStatus(payload: TicketStatusPayload): Promise<Notification[]> {
    const { userId, userName, teamId, ticketId, ticketTitle, status, source } = payload;

    const recipientIds = await notificationService.shouldNotify(
      teamId,
      userId,
      "notifyOnTicketStatus"
    );

    if (recipientIds.length === 0) return [];

    const sourceLabel = source === "timejournal" ? " (via TimeJournal)" : "";
    const body = `${userName} updated ticket "${ticketTitle}" to ${status}${sourceLabel}`;

    const notifications: Notification[] = [];
    for (const recipientId of recipientIds) {
      const notification = await notificationService.create({
        userId: recipientId,
        teamId,
        type: "ticket_status",
        title: "Ticket Status Update",
        body,
        data: {
          sourceUserId: userId,
          ticketId,
          ticketTitle,
          status,
          source,
        },
      });
      notifications.push(notification);
    }

    return notifications;
  }

  async getUserTeamIds(userId: string): Promise<string[]> {
    const memberships = await membersCollection()
      .find({ userId })
      .toArray();
    return memberships.map((m) => m.teamId);
  }
}

export const bridgeService = new BridgeService();
