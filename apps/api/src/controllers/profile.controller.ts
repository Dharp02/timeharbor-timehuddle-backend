import { FastifyRequest, FastifyReply } from "fastify";
import { profilesCollection } from "../models/index.js";

export const profileController = {
  async getProfile(req: FastifyRequest, reply: FastifyReply) {
    const userId = req.user!.id;
    const now = new Date();

    const result = await profilesCollection().findOneAndUpdate(
      { userId, app: "timeharbor" as const },
      {
        $setOnInsert: {
          userId,
          app: "timeharbor" as const,
          displayName: req.user!.name,
          status: "online" as const,
          createdAt: now,
        },
        $set: { updatedAt: now },
      },
      { upsert: true, returnDocument: "after" }
    );

    reply.send({ profile: result });
  },

  async updateProfile(req: FastifyRequest, reply: FastifyReply) {
    const userId = req.user!.id;
    const body = req.body as {
      displayName?: string;
      githubUrl?: string;
      linkedinUrl?: string;
      redmineUrl?: string;
    };

    const $set: Record<string, unknown> = { updatedAt: new Date() };
    if (body.displayName !== undefined) $set.displayName = body.displayName;
    if (body.githubUrl !== undefined) $set.githubUrl = body.githubUrl;
    if (body.linkedinUrl !== undefined) $set.linkedinUrl = body.linkedinUrl;
    if (body.redmineUrl !== undefined) $set.redmineUrl = body.redmineUrl;

    const result = await profilesCollection().findOneAndUpdate(
      { userId, app: "timeharbor" as const },
      { $set },
      { returnDocument: "after" }
    );

    if (!result) {
      return reply.status(404).send({ error: "Profile not found" });
    }

    reply.send({ profile: result });
  },

  async registerDevice(req: FastifyRequest, reply: FastifyReply) {
    const userId = req.user!.id;
    const { fcmToken, fcmPlatform } = req.body as {
      fcmToken: string;
      fcmPlatform: "ios" | "android";
    };

    await profilesCollection().updateOne(
      { userId, app: "timeharbor" as const },
      {
        $set: {
          fcmToken,
          fcmPlatform,
          fcmUpdatedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    reply.send({ ok: true });
  },
};
