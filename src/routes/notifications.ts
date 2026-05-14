import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ObjectId } from "mongodb";
import { auth } from "../lib/auth.js";
import { notificationService, subscribeSse } from "../services/notification.service.js";
import { pushTokensCollection } from "../models/index.js";

const deleteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
});

const inviteRespondSchema = z.object({
  action: z.enum(["join", "ignore"]),
});

// Web push subscription schema (VAPID)
const webPushSubscribeSchema = z.object({
  type: z.literal("webpush"),
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string(), auth: z.string() }),
  expirationTime: z.number().nullable().optional(),
});

// Native push token schema (APNs / FCM)
const nativePushSubscribeSchema = z.object({
  type: z.literal("native"),
  token: z.string().min(1),
  platform: z.enum(["ios", "android"]),
});

const pushSubscribeSchema = z.discriminatedUnion("type", [
  webPushSubscribeSchema,
  nativePushSubscribeSchema,
]);

export async function notificationRoutes(app: FastifyInstance) {
  // GET /v1/notifications — inbox
  app.get("/notifications", async (req, reply) => {
    const session = await auth.api.getSession({ headers: req.headers as any });
    if (!session?.user) return reply.status(401).send({ error: "Unauthorized" });

    const notifications = await notificationService.getInbox(session.user.id);
    return reply.send({ notifications });
  });

  // PATCH /v1/notifications/:id/read — mark one read
  app.patch("/notifications/:id/read", async (req, reply) => {
    const session = await auth.api.getSession({ headers: req.headers as any });
    if (!session?.user) return reply.status(401).send({ error: "Unauthorized" });

    const { id } = req.params as { id: string };
    const result = await notificationService.markOneRead(session.user.id, id);
    if (result === "not-found") return reply.status(404).send({ error: "Not found" });
    if (result === "forbidden") return reply.status(403).send({ error: "Forbidden" });
    return reply.send({ ok: true });
  });

  // POST /v1/notifications/read — mark all read
  app.post("/notifications/read", async (req, reply) => {
    const session = await auth.api.getSession({ headers: req.headers as any });
    if (!session?.user) return reply.status(401).send({ error: "Unauthorized" });

    await notificationService.markAllRead(session.user.id);
    return reply.send({ ok: true });
  });

  // DELETE /v1/notifications — bulk delete { ids: string[] }
  app.delete("/notifications", async (req, reply) => {
    const session = await auth.api.getSession({ headers: req.headers as any });
    if (!session?.user) return reply.status(401).send({ error: "Unauthorized" });

    const parsed = deleteSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid" });
    }

    const result = await notificationService.deleteMany(session.user.id, parsed.data.ids);
    return reply.send(result);
  });

  // GET /v1/notifications/:id/invite-preview — team invite preview
  app.get("/notifications/:id/invite-preview", async (req, reply) => {
    const session = await auth.api.getSession({ headers: req.headers as any });
    if (!session?.user) return reply.status(401).send({ error: "Unauthorized" });

    const { id } = req.params as { id: string };
    const result = await notificationService.getInvitePreview(session.user.id, id);
    if (result === "not-found") return reply.status(404).send({ error: "Not found" });
    if (result === "forbidden") return reply.status(403).send({ error: "Forbidden" });
    if (result === "bad-request") return reply.status(400).send({ error: "Not a team invite" });
    return reply.send(result);
  });

  // POST /v1/notifications/:id/invite-respond — accept or ignore invite
  app.post("/notifications/:id/invite-respond", async (req, reply) => {
    const session = await auth.api.getSession({ headers: req.headers as any });
    if (!session?.user) return reply.status(401).send({ error: "Unauthorized" });

    const { id } = req.params as { id: string };
    const parsed = inviteRespondSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid" });
    }

    const result = await notificationService.respondToInvite(
      session.user.id,
      id,
      parsed.data.action
    );
    if (result === "not-found") return reply.status(404).send({ error: "Not found" });
    if (result === "forbidden") return reply.status(403).send({ error: "Forbidden" });
    if (result === "bad-request") return reply.status(400).send({ error: "Not a team invite" });
    return reply.send({ ok: true });
  });

  // POST /v1/notifications/push-subscribe — store a push subscription token
  app.post("/notifications/push-subscribe", async (req, reply) => {
    const session = await auth.api.getSession({ headers: req.headers as any });
    if (!session?.user) return reply.status(401).send({ error: "Unauthorized" });

    const parsed = pushSubscribeSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid" });
    }

    const userId = session.user.id;
    const col = pushTokensCollection();

    if (parsed.data.type === "webpush") {
      // Replace any existing webpush subscription for this user+endpoint combo.
      await col.deleteMany({ userId, type: "webpush", endpoint: parsed.data.endpoint });
      await col.insertOne({
        _id: new ObjectId(),
        userId,
        type: "webpush",
        endpoint: parsed.data.endpoint,
        keys: parsed.data.keys,
        expirationTime: parsed.data.expirationTime ?? null,
        createdAt: new Date(),
      });
    } else {
      // Native: replace any existing token for this device.
      await col.deleteMany({ userId, type: "native", token: parsed.data.token });
      await col.insertOne({
        _id: new ObjectId(),
        userId,
        type: "native",
        token: parsed.data.token,
        platform: parsed.data.platform,
        createdAt: new Date(),
      });
    }

    return reply.status(201).send({ ok: true });
  });

  // POST /v1/notifications/push-unsubscribe — remove all push subscriptions for the user
  app.post("/notifications/push-unsubscribe", async (req, reply) => {
    const session = await auth.api.getSession({ headers: req.headers as any });
    if (!session?.user) return reply.status(401).send({ error: "Unauthorized" });

    await pushTokensCollection().deleteMany({ userId: session.user.id });
    return reply.send({ ok: true });
  });

  // GET /v1/notifications/stream — SSE (new notifications pushed in real-time)
  app.get("/notifications/stream", async (req, reply) => {
    const session = await auth.api.getSession({ headers: req.headers as any });
    if (!session?.user) return reply.status(401).send({ error: "Unauthorized" });

    const userId = session.user.id;

    reply.hijack();

    const trustedOrigins = process.env.TRUSTED_ORIGINS
      ? process.env.TRUSTED_ORIGINS.split(",").map((o) => o.trim())
      : [];
    const requestOrigin = req.headers.origin ?? "";
    const allowOrigin = trustedOrigins.includes(requestOrigin) ? requestOrigin : "";

    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      ...(allowOrigin && {
        "Access-Control-Allow-Origin": allowOrigin,
        "Access-Control-Allow-Credentials": "true",
      }),
    });
    reply.raw.flushHeaders();

    const unsub = subscribeSse(userId, (n) => {
      reply.raw.write(`data: ${JSON.stringify(n)}\n\n`);
    });
    const ping = setInterval(() => reply.raw.write(": ping\n\n"), 25_000);

    req.raw.on("close", () => {
      clearInterval(ping);
      unsub();
    });
  });
}
