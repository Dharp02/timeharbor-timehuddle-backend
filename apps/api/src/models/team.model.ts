import { ObjectId } from "mongodb";

export interface Team {
  _id: ObjectId;
  name: string;
  code: string;
  createdBy: string; // userId
  createdAt: Date;
  updatedAt: Date;
}

export interface Member {
  _id: ObjectId;
  userId: string;
  teamId: string;
  role: "Leader" | "Member";
  joinedAt: Date;
}

export interface NotificationPreference {
  _id: ObjectId;
  teamId: string;
  userId: string; // admin who set the preference
  targetUserId: string; // member being watched
  notifyOnClockIn: boolean;
  notifyOnClockOut: boolean;
  notifyOnTicketStatus: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Notification {
  _id: ObjectId;
  userId: string; // recipient
  teamId: string;
  type: "clock_in" | "clock_out" | "ticket_status" | "team_invite" | "team_join" | "general";
  title: string;
  body: string;
  data?: Record<string, unknown>;
  readAt: Date | null;
  createdAt: Date;
}
