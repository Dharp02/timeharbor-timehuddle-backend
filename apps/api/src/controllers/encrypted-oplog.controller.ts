import { FastifyRequest, FastifyReply } from "fastify";
import { encryptedOpLogsCollection } from "../models/index.js";
import type { EncryptedOpLogBatch } from "../models/encrypted-oplog.model.js";

/**
 * Encrypted op-log relay controller.
 *
 * The server is a dumb relay — it stores encrypted blobs and forwards
 * them to the user's other devices.  It never decrypts anything.
 */

/** Default TTL for encrypted batches: 90 days. */
const BATCH_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export const encryptedOpLogController = {
  // ── Push: client sends encrypted batch ────────────────────

  async pushOpLog(req: FastifyRequest, reply: FastifyReply) {
    const userId = req.user!.id;
    const body = req.body as {
      deviceId: string;
      lastHLC: string;
      count: number;
      payload: { iv: string; ciphertext: string };
    };

    const now = new Date();
    const doc: Omit<EncryptedOpLogBatch, "_id"> = {
      userId,
      deviceId: body.deviceId,
      hlc: body.lastHLC,
      count: body.count,
      encryptedPayload: body.payload,
      createdAt: now,
      expiresAt: new Date(now.getTime() + BATCH_TTL_MS),
    };

    await encryptedOpLogsCollection().insertOne(doc as EncryptedOpLogBatch);

    reply.send({ accepted: body.count });
  },

  // ── Pull: client fetches batches from other devices ───────

  async pullOpLog(req: FastifyRequest, reply: FastifyReply) {
    const userId = req.user!.id;
    const query = req.query as { deviceId?: string; since?: string };

    const filter: Record<string, unknown> = {
      userId,
    };

    // Exclude the requesting device's own batches
    if (query.deviceId) {
      filter.deviceId = { $ne: query.deviceId };
    }

    // Only return batches newer than the cursor
    if (query.since) {
      filter.hlc = { $gt: query.since };
    }

    const batches = await encryptedOpLogsCollection()
      .find(filter)
      .sort({ hlc: 1 })
      .limit(100) // cap per request
      .toArray();

    // Project to the shape the client expects (strip Mongo internals)
    const result = batches.map((b) => ({
      deviceId: b.deviceId,
      lastHLC: b.hlc,
      count: b.count,
      payload: b.encryptedPayload,
    }));

    reply.send({ batches: result, serverTime: new Date().toISOString() });
  },

  // ── Compact: remove old batches all devices have consumed ─

  async compactOpLog(req: FastifyRequest, reply: FastifyReply) {
    const userId = req.user!.id;
    const body = req.body as { deviceId: string; beforeHLC: string };

    const result = await encryptedOpLogsCollection().deleteMany({
      userId,
      hlc: { $lte: body.beforeHLC },
    });

    reply.send({ deleted: result.deletedCount });
  },
};
