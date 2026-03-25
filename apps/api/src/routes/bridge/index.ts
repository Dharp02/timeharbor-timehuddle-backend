import { FastifyInstance } from "fastify";
import { requireAuthOrInternal } from "../../middleware/internal-auth.js";
import { bridgeController } from "../../controllers/bridge.controller.js";

const unauthorizedResponse = {
  401: {
    type: "object",
    properties: { error: { type: "string", example: "Unauthorized" } },
  },
};

const forbiddenResponse = {
  403: {
    type: "object",
    properties: { error: { type: "string" } },
  },
};

export async function bridgeRoutes(app: FastifyInstance) {
  // ─── Clock Events ────────────────────────────────────────────────────────────
  // Called by either TimeJournal or TimeHuddle when a user clocks in/out.
  // Checks notification preferences and fans out notifications to admins/leaders.

  app.post("/clock-event", {
    preHandler: [requireAuthOrInternal],
    schema: {
      tags: ["Bridge"],
      summary: "Report a clock-in or clock-out event (cross-app)",
      description:
        "Either app (TimeJournal or TimeHuddle) calls this when a user clocks in or out. " +
        "The bridge checks notification preferences for the user's team and creates " +
        "notifications for admins/leaders who opted in.",
      security: [{ cookieAuth: [] }],
      body: {
        type: "object",
        required: ["teamId", "event"],
        properties: {
          teamId: { type: "string", description: "Team where the event occurred" },
          event: { type: "string", enum: ["clock_in", "clock_out"] },
          timestamp: { type: "string", format: "date-time" },
          tickets: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                title: { type: "string" },
                accumulatedTime: { type: "number", description: "Seconds spent on ticket" },
              },
            },
          },
          youtubeLink: { type: "string", description: "Pulse video link (on clock-out)" },
          sessionDuration: { type: "number", description: "Total session seconds (on clock-out)" },
          source: { type: "string", enum: ["timehuddle", "timejournal"], default: "timehuddle" },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            notificationsSent: { type: "number" },
          },
        },
        ...unauthorizedResponse,
        ...forbiddenResponse,
      },
    },
  }, bridgeController.clockEvent);

  // ─── Ticket Status ───────────────────────────────────────────────────────────
  // Called when a ticket status changes, triggers notifications for watchers.

  app.post("/ticket-status", {
    preHandler: [requireAuthOrInternal],
    schema: {
      tags: ["Bridge"],
      summary: "Report a ticket status change (cross-app)",
      description:
        "Either app calls this when a ticket status changes. The bridge checks " +
        "notification preferences and notifies leaders who opted in.",
      security: [{ cookieAuth: [] }],
      body: {
        type: "object",
        required: ["teamId", "ticketId", "ticketTitle", "status"],
        properties: {
          teamId: { type: "string" },
          ticketId: { type: "string" },
          ticketTitle: { type: "string" },
          status: { type: "string" },
          source: { type: "string", enum: ["timehuddle", "timejournal"], default: "timehuddle" },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            notificationsSent: { type: "number" },
          },
        },
        ...unauthorizedResponse,
        ...forbiddenResponse,
      },
    },
  }, bridgeController.ticketStatus);
}
