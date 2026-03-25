import { ObjectId } from "mongodb";
import {
  notificationsCollection,
  notificationPreferencesCollection,
} from "../models/index.js";
import type { Notification, NotificationPreference } from "../models/team.model.js";

export class NotificationService {
  async create(data: Omit<Notification, "_id" | "readAt" | "createdAt">): Promise<Notification> {
    const notification: Notification = {
      _id: new ObjectId(),
      ...data,
      readAt: null,
      createdAt: new Date(),
    };
    await notificationsCollection().insertOne(notification);
    return notification;
  }

  async findByUser(userId: string, limit = 200): Promise<Notification[]> {
    return notificationsCollection()
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
  }

  async markAsRead(id: string): Promise<boolean> {
    const result = await notificationsCollection().updateOne(
      { _id: new ObjectId(id) },
      { $set: { readAt: new Date() } }
    );
    return result.modifiedCount > 0;
  }

  async markAllAsRead(userId: string): Promise<number> {
    const result = await notificationsCollection().updateMany(
      { userId, readAt: null },
      { $set: { readAt: new Date() } }
    );
    return result.modifiedCount;
  }

  async delete(id: string): Promise<boolean> {
    const result = await notificationsCollection().deleteOne({
      _id: new ObjectId(id),
    });
    return result.deletedCount > 0;
  }

  async deleteMany(ids: string[]): Promise<number> {
    const objectIds = ids.map((id) => new ObjectId(id));
    const result = await notificationsCollection().deleteMany({
      _id: { $in: objectIds },
    });
    return result.deletedCount;
  }

  // ── Notification Preferences ──

  async getPreferences(teamId: string, userId: string): Promise<NotificationPreference[]> {
    return notificationPreferencesCollection()
      .find({ teamId, userId })
      .toArray();
  }

  async upsertPreference(data: {
    teamId: string;
    userId: string;
    targetUserId: string;
    notifyOnClockIn: boolean;
    notifyOnClockOut: boolean;
    notifyOnTicketStatus: boolean;
  }): Promise<NotificationPreference> {
    const now = new Date();
    const result = await notificationPreferencesCollection().findOneAndUpdate(
      { teamId: data.teamId, userId: data.userId, targetUserId: data.targetUserId },
      {
        $set: {
          notifyOnClockIn: data.notifyOnClockIn,
          notifyOnClockOut: data.notifyOnClockOut,
          notifyOnTicketStatus: data.notifyOnTicketStatus,
          updatedAt: now,
        },
        $setOnInsert: {
          _id: new ObjectId(),
          teamId: data.teamId,
          userId: data.userId,
          targetUserId: data.targetUserId,
          createdAt: now,
        },
      },
      { upsert: true, returnDocument: "after" }
    );
    return result!;
  }

  async shouldNotify(
    teamId: string,
    targetUserId: string,
    event: "notifyOnClockIn" | "notifyOnClockOut" | "notifyOnTicketStatus"
  ): Promise<string[]> {
    const prefs = await notificationPreferencesCollection()
      .find({ teamId, targetUserId, [event]: true })
      .toArray();
    return prefs.map((p) => p.userId);
  }
}

export const notificationService = new NotificationService();
