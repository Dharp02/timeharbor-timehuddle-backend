import { ObjectId } from "mongodb";
import { FastifyInstance } from "fastify";
import { requireAuth } from "../middleware/require-auth.js";
import { usersCollection } from "../models/index.js";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const unauthorizedResponse = {
  401: {
    type: "object",
    properties: { error: { type: "string", example: "Unauthorized" } },
  },
};

const userSessionSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    email: { type: "string", format: "email" },
    image: { type: "string", nullable: true },
  },
};

const userProfileSchema = {
  type: "object",
  properties: {
    _id: { type: "string" },
    name: { type: "string" },
    email: { type: "string", format: "email" },
    emailVerified: { type: "boolean" },
    image: { type: "string", nullable: true },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
};

// ─── Routes ───────────────────────────────────────────────────────────────────

export async function userRoutes(app: FastifyInstance) {
  app.get(
    "/me",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Users"],
        summary: "Get current user (from session)",
        security: [{ cookieAuth: [] }],
        response: {
          200: { type: "object", properties: { user: userSessionSchema } },
          ...unauthorizedResponse,
        },
      },
    },
    async (req, reply) => {
      return reply.send({ user: req.user });
    }
  );

  app.get(
    "/me/profile",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Users"],
        summary: "Get full user profile from DB",
        security: [{ cookieAuth: [] }],
        response: {
          200: { type: "object", properties: { user: userProfileSchema } },
          ...unauthorizedResponse,
          404: {
            type: "object",
            properties: { error: { type: "string", example: "User not found" } },
          },
        },
      },
    },
    async (req, reply) => {
      const user = await usersCollection().findOne({
        _id: new ObjectId(req.user!.id),
      });
      if (!user) return reply.status(404).send({ error: "User not found" });
      return reply.send({ user });
    }
  );
}
