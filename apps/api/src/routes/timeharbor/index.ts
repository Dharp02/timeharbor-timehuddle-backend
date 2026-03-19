import { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/require-auth.js";
import { userController } from "../../controllers/user.controller.js";

const unauthorizedResponse = {
  401: {
    type: "object",
    properties: { error: { type: "string", example: "Unauthorized" } },
  },
};

export async function timeharborRoutes(app: FastifyInstance) {
  // All routes here are prefixed with /api/timeharbor

  app.get("/me", {
    preHandler: [requireAuth],
    schema: {
      tags: ["TimeHarbor"],
      summary: "Get current user (from session)",
      security: [{ cookieAuth: [] }],
      response: {
        200: {
          type: "object",
          properties: {
            user: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                email: { type: "string", format: "email" },
                image: { type: "string", nullable: true },
              },
            },
          },
        },
        ...unauthorizedResponse,
      },
    },
  }, userController.getMe);

  app.get("/me/profile", {
    preHandler: [requireAuth],
    schema: {
      tags: ["TimeHarbor"],
      summary: "Get full user profile from DB",
      security: [{ cookieAuth: [] }],
      response: {
        200: {
          type: "object",
          properties: {
            user: {
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
            },
          },
        },
        ...unauthorizedResponse,
        404: {
          type: "object",
          properties: { error: { type: "string", example: "User not found" } },
        },
      },
    },
  }, userController.getMyProfile);
}
