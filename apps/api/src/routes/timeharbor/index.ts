import { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/require-auth.js";
import { userController } from "../../controllers/user.controller.js";
import { profileController } from "../../controllers/profile.controller.js";
import { ticketController } from "../../controllers/ticket.controller.js";
import { timeController } from "../../controllers/time.controller.js";

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

  // ── Profile ────────────────────────────────────────────────────────

  app.get("/me/th-profile", {
    preHandler: [requireAuth],
    schema: {
      tags: ["TimeHarbor"],
      summary: "Get Timeharbor profile (auto-creates on first visit)",
      security: [{ cookieAuth: [] }],
      response: {
        200: {
          type: "object",
          properties: {
            profile: { type: "object", additionalProperties: true },
          },
        },
        ...unauthorizedResponse,
      },
    },
  }, profileController.getProfile);

  app.put("/me/th-profile", {
    preHandler: [requireAuth],
    schema: {
      tags: ["TimeHarbor"],
      summary: "Update Timeharbor profile",
      security: [{ cookieAuth: [] }],
      body: {
        type: "object",
        properties: {
          displayName: { type: "string" },
          githubUrl: { type: "string" },
          linkedinUrl: { type: "string" },
          redmineUrl: { type: "string" },
        },
      },
      response: {
        200: { type: "object", properties: { profile: { type: "object", additionalProperties: true } } },
        ...unauthorizedResponse,
      },
    },
  }, profileController.updateProfile);

  app.post("/me/register-device", {
    preHandler: [requireAuth],
    schema: {
      tags: ["TimeHarbor"],
      summary: "Register FCM push token",
      security: [{ cookieAuth: [] }],
      body: {
        type: "object",
        required: ["fcmToken", "fcmPlatform"],
        properties: {
          fcmToken: { type: "string" },
          fcmPlatform: { type: "string", enum: ["ios", "android"] },
        },
      },
      response: {
        200: { type: "object", properties: { ok: { type: "boolean" } } },
        ...unauthorizedResponse,
      },
    },
  }, profileController.registerDevice);

  // ── Tickets ────────────────────────────────────────────────────────

  app.post("/me/tickets", {
    preHandler: [requireAuth],
    schema: {
      tags: ["TimeHarbor"],
      summary: "Create personal ticket",
      security: [{ cookieAuth: [] }],
      body: {
        type: "object",
        required: ["title"],
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          status: { type: "string", enum: ["Open", "In Progress", "Closed"] },
          priority: { type: "string", enum: ["Low", "Medium", "High"] },
          link: { type: "string" },
          projectId: { type: "string" },
        },
      },
      response: {
        201: { type: "object", properties: { ticket: { type: "object", additionalProperties: true } } },
        ...unauthorizedResponse,
      },
    },
  }, ticketController.createTicket);

  app.get("/me/tickets", {
    preHandler: [requireAuth],
    schema: {
      tags: ["TimeHarbor"],
      summary: "List personal tickets",
      security: [{ cookieAuth: [] }],
      querystring: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["Open", "In Progress", "Closed"] },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            tickets: { type: "array", items: { type: "object", additionalProperties: true } },
          },
        },
        ...unauthorizedResponse,
      },
    },
  }, ticketController.listTickets);

  app.put("/me/tickets/:ticketId", {
    preHandler: [requireAuth],
    schema: {
      tags: ["TimeHarbor"],
      summary: "Update personal ticket",
      security: [{ cookieAuth: [] }],
      params: {
        type: "object",
        required: ["ticketId"],
        properties: { ticketId: { type: "string" } },
      },
      body: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          status: { type: "string", enum: ["Open", "In Progress", "Closed"] },
          priority: { type: "string", enum: ["Low", "Medium", "High"] },
          link: { type: "string" },
          projectId: { type: "string" },
          fieldTimestamps: { type: "object" },
        },
      },
      response: {
        200: { type: "object", properties: { ticket: { type: "object", additionalProperties: true } } },
        ...unauthorizedResponse,
      },
    },
  }, ticketController.updateTicket);

  app.delete("/me/tickets/:ticketId", {
    preHandler: [requireAuth],
    schema: {
      tags: ["TimeHarbor"],
      summary: "Soft-delete personal ticket",
      security: [{ cookieAuth: [] }],
      params: {
        type: "object",
        required: ["ticketId"],
        properties: { ticketId: { type: "string" } },
      },
      response: {
        200: { type: "object", properties: { ok: { type: "boolean" } } },
        ...unauthorizedResponse,
      },
    },
  }, ticketController.deleteTicket);

  // ── Ticket Sync ────────────────────────────────────────────────────

  app.post("/sync/push", {
    preHandler: [requireAuth],
    schema: {
      tags: ["TimeHarbor"],
      summary: "Push dirty tickets from client",
      security: [{ cookieAuth: [] }],
      body: {
        type: "object",
        required: ["tickets"],
        properties: {
          tickets: { type: "array", items: { type: "object" } },
        },
      },
      response: {
        200: { type: "object", properties: { accepted: { type: "number" } } },
        ...unauthorizedResponse,
      },
    },
  }, ticketController.pushTickets);

  app.post("/sync/pull", {
    preHandler: [requireAuth],
    schema: {
      tags: ["TimeHarbor"],
      summary: "Pull tickets updated since lastPulledAt",
      security: [{ cookieAuth: [] }],
      body: {
        type: "object",
        properties: {
          lastPulledAt: { type: ["string", "null"], format: "date-time" },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            tickets: { type: "array", items: { type: "object", additionalProperties: true } },
            serverTime: { type: "string", format: "date-time" },
          },
        },
        ...unauthorizedResponse,
      },
    },
  }, ticketController.pullTickets);

  // ── Time / Work Sessions ───────────────────────────────────────────

  app.post("/time/sync-sessions", {
    preHandler: [requireAuth],
    schema: {
      tags: ["TimeHarbor"],
      summary: "Push work sessions (dedup by clientSessionId)",
      security: [{ cookieAuth: [] }],
      body: {
        type: "object",
        required: ["sessions"],
        properties: {
          sessions: { type: "array", items: { type: "object" } },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            accepted: { type: "number" },
            affectedDates: { type: "array", items: { type: "string" } },
          },
        },
        ...unauthorizedResponse,
      },
    },
  }, timeController.syncSessions);

  app.get("/time/sessions", {
    preHandler: [requireAuth],
    schema: {
      tags: ["TimeHarbor"],
      summary: "Pull work sessions updated since timestamp",
      security: [{ cookieAuth: [] }],
      querystring: {
        type: "object",
        properties: {
          since: { type: "string", format: "date-time" },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            sessions: { type: "array", items: { type: "object", additionalProperties: true } },
            serverTime: { type: "string", format: "date-time" },
          },
        },
        ...unauthorizedResponse,
      },
    },
  }, timeController.pullSessions);
}
