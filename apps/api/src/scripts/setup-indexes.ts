import "dotenv/config";
import { connectDB, getDB } from "../lib/db.js";

async function setupIndexes() {
  await connectDB();
  const db = getDB();

  console.log("Creating indexes...");

  await db.collection("teams").createIndexes([
    { key: { code: 1 }, unique: true },
    { key: { createdBy: 1 } },
  ]);

  await db.collection("members").createIndexes([
    { key: { userId: 1, teamId: 1 }, unique: true },
    { key: { teamId: 1 } },
  ]);

  await db.collection("tickets").createIndexes([
    { key: { teamId: 1, status: 1 } },
    { key: { createdBy: 1 } },
    { key: { assignedTo: 1 } },
  ]);

  await db.collection("notifications").createIndexes([
    { key: { userId: 1, createdAt: -1 } },
    { key: { userId: 1, readAt: 1 } },
  ]);

  await db.collection("notificationPreferences").createIndexes([
    { key: { teamId: 1, userId: 1, targetUserId: 1 }, unique: true },
    { key: { teamId: 1, targetUserId: 1 } },
  ]);

  console.log("All indexes created successfully.");
  process.exit(0);
}

setupIndexes().catch((err) => {
  console.error("Failed to create indexes:", err);
  process.exit(1);
});
