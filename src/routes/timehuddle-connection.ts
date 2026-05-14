import { FastifyInstance } from "fastify";
import { requireAuth } from "../middleware/require-auth.js";
import { timehudleConnectionService } from "../services/timehuddle-connection.service.js";

export async function timehudleConnectionRoutes(app: FastifyInstance) {
  // GET /v1/timehuddle/status
  app.get(
    "/timehuddle/status",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["TimeHuddle"],
        summary: "Get TimeHuddle connection status",
        security: [{ cookieAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              connected: { type: "boolean" },
              timehudleEmail: { type: "string", nullable: true },
              timehudleName: { type: "string", nullable: true },
              connectedAt: { type: "string", format: "date-time", nullable: true },
            },
          },
        },
      },
    },
    async (req) => {
      return timehudleConnectionService.getStatus(req.user!.id);
    }
  );

  // POST /v1/timehuddle/connect
  app.post<{ Body: { token: string } }>(
    "/timehuddle/connect",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["TimeHuddle"],
        summary: "Connect a TimeHuddle account using a personal access token",
        security: [{ cookieAuth: [] }],
        body: {
          type: "object",
          required: ["token"],
          properties: { token: { type: "string", minLength: 1 } },
        },
        response: {
          200: {
            type: "object",
            properties: {
              connected: { type: "boolean" },
              timehudleEmail: { type: "string" },
              timehudleName: { type: "string" },
            },
          },
          400: {
            type: "object",
            properties: { error: { type: "string" } },
          },
        },
      },
    },
    async (req, reply) => {
      try {
        const { timehudleEmail, timehudleName } = await timehudleConnectionService.connect(
          req.user!.id,
          req.body.token
        );
        return { connected: true, timehudleEmail, timehudleName };
      } catch (err: unknown) {
        return reply
          .status(400)
          .send({ error: err instanceof Error ? err.message : "Connection failed" });
      }
    }
  );

  // DELETE /v1/timehuddle/disconnect
  app.delete(
    "/timehuddle/disconnect",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["TimeHuddle"],
        summary: "Disconnect TimeHuddle account",
        security: [{ cookieAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: { success: { type: "boolean" } },
          },
        },
      },
    },
    async (req) => {
      await timehudleConnectionService.disconnect(req.user!.id);
      return { success: true };
    }
  );
}
