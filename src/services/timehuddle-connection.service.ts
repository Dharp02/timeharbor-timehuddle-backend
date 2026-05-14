import { ObjectId } from "mongodb";
import { timehudleConnectionsCollection } from "../models/index.js";

const TIMEHUDDLE_API_URL =
  process.env.TIMEHUDDLE_API_URL || "http://localhost:4000";

export const timehudleConnectionService = {
  async connect(userId: string, pat: string) {
    // Validate PAT against TimeHuddle's /v1/me endpoint
    const response = await fetch(`${TIMEHUDDLE_API_URL}/v1/me`, {
      headers: { Authorization: `Bearer ${pat}` },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Invalid or expired TimeHuddle token");
      }
      throw new Error(`TimeHuddle responded with status ${response.status}`);
    }

    const data = (await response.json()) as {
      user: { id: string; email: string; name: string };
    };
    const { id: timehudleUserId, email: timehudleEmail, name: timehudleName } = data.user;

    const now = new Date();
    await timehudleConnectionsCollection().updateOne(
      { userId },
      {
        $set: {
          userId,
          timehudleUserId,
          timehudleEmail,
          timehudleName,
          patToken: pat,
          updatedAt: now,
        },
        $setOnInsert: { _id: new ObjectId(), connectedAt: now },
      },
      { upsert: true }
    );

    return { timehudleEmail, timehudleName };
  },

  async getStatus(userId: string) {
    const conn = await timehudleConnectionsCollection().findOne(
      { userId },
      { projection: { patToken: 0 } }
    );
    if (!conn) {
      return { connected: false };
    }
    return {
      connected: true,
      timehudleEmail: conn.timehudleEmail,
      timehudleName: conn.timehudleName,
      connectedAt: conn.connectedAt,
    };
  },

  async disconnect(userId: string) {
    const result = await timehudleConnectionsCollection().deleteOne({ userId });
    return result.deletedCount === 1;
  },
};
