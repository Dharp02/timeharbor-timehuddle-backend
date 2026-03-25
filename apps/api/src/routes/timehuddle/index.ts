import { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/require-auth.js";
import { userController } from "../../controllers/user.controller.js";
import { teamController } from "../../controllers/team.controller.js";
import { ticketController } from "../../controllers/ticket.controller.js";
import { notificationController } from "../../controllers/notification.controller.js";

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

export async function timehuddleRoutes(app: FastifyInstance) {
  // ─── Profile ──────────────────────────────────────────────────────────────────

  app.get("/me", {
    preHandler: [requireAuth],
    schema: {
      tags: ["TimeHuddle"],
      summary: "Get current user from session",
      security: [{ cookieAuth: [] }],
      response: { 200: { type: "object", properties: { user: { type: "object" } } }, ...unauthorizedResponse },
    },
  }, userController.getMe);

  app.get("/me/profile", {
    preHandler: [requireAuth],
    schema: {
      tags: ["TimeHuddle"],
      summary: "Get full user profile from DB",
      security: [{ cookieAuth: [] }],
      response: { 200: { type: "object", properties: { user: { type: "object" } } }, ...unauthorizedResponse },
    },
  }, userController.getMyProfile);

  // ─── Teams ────────────────────────────────────────────────────────────────────

  app.post("/teams", {
    preHandler: [requireAuth],
    schema: {
      tags: ["TimeHuddle"],
      summary: "Create a new team",
      security: [{ cookieAuth: [] }],
      body: {
        type: "object",
        required: ["name"],
        properties: { name: { type: "string", minLength: 1 } },
      },
      response: { 201: { type: "object", properties: { team: { type: "object" } } }, ...unauthorizedResponse },
    },
  }, teamController.create);

  app.get("/teams", {
    preHandler: [requireAuth],
    schema: {
      tags: ["TimeHuddle"],
      summary: "List teams the user belongs to",
      security: [{ cookieAuth: [] }],
      response: { 200: { type: "object", properties: { teams: { type: "array" } } }, ...unauthorizedResponse },
    },
  }, teamController.list);

  app.get("/teams/:id", {
    preHandler: [requireAuth],
    schema: {
      tags: ["TimeHuddle"],
      summary: "Get a team by ID",
      security: [{ cookieAuth: [] }],
      params: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
      response: { 200: { type: "object", properties: { team: { type: "object" } } }, ...unauthorizedResponse, ...forbiddenResponse },
    },
  }, teamController.getById);

  app.put("/teams/:id", {
    preHandler: [requireAuth],
    schema: {
      tags: ["TimeHuddle"],
      summary: "Update team name (leader only)",
      security: [{ cookieAuth: [] }],
      params: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
      body: { type: "object", required: ["name"], properties: { name: { type: "string", minLength: 1 } } },
      response: { 200: { type: "object", properties: { success: { type: "boolean" } } }, ...unauthorizedResponse, ...forbiddenResponse },
    },
  }, teamController.update);

  app.delete("/teams/:id", {
    preHandler: [requireAuth],
    schema: {
      tags: ["TimeHuddle"],
      summary: "Delete a team (leader only)",
      security: [{ cookieAuth: [] }],
      params: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
      response: { 200: { type: "object", properties: { success: { type: "boolean" } } }, ...unauthorizedResponse, ...forbiddenResponse },
    },
  }, teamController.delete);

  app.post("/teams/join", {
    preHandler: [requireAuth],
    schema: {
      tags: ["TimeHuddle"],
      summary: "Join a team by invite code",
      security: [{ cookieAuth: [] }],
      body: { type: "object", required: ["code"], properties: { code: { type: "string" } } },
      response: { 200: { type: "object", properties: { team: { type: "object" } } }, ...unauthorizedResponse },
    },
  }, teamController.join);

  // ─── Team Members ─────────────────────────────────────────────────────────────

  app.get("/teams/:id/members", {
    preHandler: [requireAuth],
    schema: {
      tags: ["TimeHuddle"],
      summary: "List team members with user info",
      security: [{ cookieAuth: [] }],
      params: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
      response: { 200: { type: "object", properties: { members: { type: "array" } } }, ...unauthorizedResponse, ...forbiddenResponse },
    },
  }, teamController.getMembers);

  app.post("/teams/:id/members", {
    preHandler: [requireAuth],
    schema: {
      tags: ["TimeHuddle"],
      summary: "Add a member to a team (leader only)",
      security: [{ cookieAuth: [] }],
      params: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
      body: {
        type: "object",
        required: ["userId"],
        properties: {
          userId: { type: "string" },
          role: { type: "string", enum: ["Leader", "Member"], default: "Member" },
        },
      },
      response: { 201: { type: "object", properties: { member: { type: "object" } } }, ...unauthorizedResponse, ...forbiddenResponse },
    },
  }, teamController.addMember);

  app.delete("/teams/:id/members/:userId", {
    preHandler: [requireAuth],
    schema: {
      tags: ["TimeHuddle"],
      summary: "Remove a member from a team (leader only)",
      security: [{ cookieAuth: [] }],
      params: {
        type: "object",
        properties: { id: { type: "string" }, userId: { type: "string" } },
        required: ["id", "userId"],
      },
      response: { 200: { type: "object", properties: { success: { type: "boolean" } } }, ...unauthorizedResponse, ...forbiddenResponse },
    },
  }, teamController.removeMember);

  app.put("/teams/:id/members/:userId/role", {
    preHandler: [requireAuth],
    schema: {
      tags: ["TimeHuddle"],
      summary: "Update a member's role (leader only)",
      security: [{ cookieAuth: [] }],
      params: {
        type: "object",
        properties: { id: { type: "string" }, userId: { type: "string" } },
        required: ["id", "userId"],
      },
      body: { type: "object", required: ["role"], properties: { role: { type: "string", enum: ["Leader", "Member"] } } },
      response: { 200: { type: "object", properties: { success: { type: "boolean" } } }, ...unauthorizedResponse, ...forbiddenResponse },
    },
  }, teamController.updateMemberRole);

  // ─── Team Tickets ─────────────────────────────────────────────────────────────

  app.post("/teams/:teamId/tickets", {
    preHandler: [requireAuth],
    schema: {
      tags: ["TimeHuddle"],
      summary: "Create a ticket in a team",
      security: [{ cookieAuth: [] }],
      params: { type: "object", properties: { teamId: { type: "string" } }, required: ["teamId"] },
      body: {
        type: "object",
        required: ["title"],
        properties: {
          title: { type: "string", minLength: 1 },
          description: { type: "string" },
          priority: { type: "string", enum: ["Low", "Medium", "High"] },
          link: { type: "string" },
          assignedTo: { type: "string" },
        },
      },
      response: { 201: { type: "object", properties: { ticket: { type: "object" } } }, ...unauthorizedResponse, ...forbiddenResponse },
    },
  }, ticketController.create);

  app.get("/teams/:teamId/tickets", {
    preHandler: [requireAuth],
    schema: {
      tags: ["TimeHuddle"],
      summary: "List all tickets in a team",
      security: [{ cookieAuth: [] }],
      params: { type: "object", properties: { teamId: { type: "string" } }, required: ["teamId"] },
      response: { 200: { type: "object", properties: { tickets: { type: "array" } } }, ...unauthorizedResponse, ...forbiddenResponse },
    },
  }, ticketController.list);

  app.put("/teams/:teamId/tickets/:ticketId", {
    preHandler: [requireAuth],
    schema: {
      tags: ["TimeHuddle"],
      summary: "Update a ticket",
      security: [{ cookieAuth: [] }],
      params: {
        type: "object",
        properties: { teamId: { type: "string" }, ticketId: { type: "string" } },
        required: ["teamId", "ticketId"],
      },
      response: { 200: { type: "object", properties: { success: { type: "boolean" } } }, ...unauthorizedResponse, ...forbiddenResponse },
    },
  }, ticketController.update);

  app.delete("/teams/:teamId/tickets/:ticketId", {
    preHandler: [requireAuth],
    schema: {
      tags: ["TimeHuddle"],
      summary: "Delete a ticket (leader only)",
      security: [{ cookieAuth: [] }],
      params: {
        type: "object",
        properties: { teamId: { type: "string" }, ticketId: { type: "string" } },
        required: ["teamId", "ticketId"],
      },
      response: { 200: { type: "object", properties: { success: { type: "boolean" } } }, ...unauthorizedResponse, ...forbiddenResponse },
    },
  }, ticketController.delete);

  app.post("/teams/:teamId/tickets/:ticketId/assign", {
    preHandler: [requireAuth],
    schema: {
      tags: ["TimeHuddle"],
      summary: "Assign a ticket to a team member (leader only)",
      security: [{ cookieAuth: [] }],
      params: {
        type: "object",
        properties: { teamId: { type: "string" }, ticketId: { type: "string" } },
        required: ["teamId", "ticketId"],
      },
      body: { type: "object", required: ["assignedTo"], properties: { assignedTo: { type: "string" } } },
      response: { 200: { type: "object", properties: { success: { type: "boolean" } } }, ...unauthorizedResponse, ...forbiddenResponse },
    },
  }, ticketController.assign);

  app.post("/teams/:teamId/tickets/batch-status", {
    preHandler: [requireAuth],
    schema: {
      tags: ["TimeHuddle"],
      summary: "Batch update ticket status (leader only)",
      security: [{ cookieAuth: [] }],
      params: { type: "object", properties: { teamId: { type: "string" } }, required: ["teamId"] },
      body: {
        type: "object",
        required: ["ids", "status"],
        properties: {
          ids: { type: "array", items: { type: "string" } },
          status: { type: "string", enum: ["Open", "In Progress", "Reviewed", "Closed"] },
        },
      },
      response: { 200: { type: "object", properties: { updated: { type: "number" } } }, ...unauthorizedResponse, ...forbiddenResponse },
    },
  }, ticketController.batchUpdateStatus);

  // ─── Notifications ────────────────────────────────────────────────────────────

  app.get("/notifications", {
    preHandler: [requireAuth],
    schema: {
      tags: ["TimeHuddle"],
      summary: "List notifications for current user",
      security: [{ cookieAuth: [] }],
      response: { 200: { type: "object", properties: { notifications: { type: "array" } } }, ...unauthorizedResponse },
    },
  }, notificationController.list);

  app.patch("/notifications/:id/read", {
    preHandler: [requireAuth],
    schema: {
      tags: ["TimeHuddle"],
      summary: "Mark a notification as read",
      security: [{ cookieAuth: [] }],
      params: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
      response: { 200: { type: "object", properties: { success: { type: "boolean" } } }, ...unauthorizedResponse },
    },
  }, notificationController.markAsRead);

  app.patch("/notifications/read-all", {
    preHandler: [requireAuth],
    schema: {
      tags: ["TimeHuddle"],
      summary: "Mark all notifications as read",
      security: [{ cookieAuth: [] }],
      response: { 200: { type: "object", properties: { updated: { type: "number" } } }, ...unauthorizedResponse },
    },
  }, notificationController.markAllAsRead);

  app.delete("/notifications/:id", {
    preHandler: [requireAuth],
    schema: {
      tags: ["TimeHuddle"],
      summary: "Delete a notification",
      security: [{ cookieAuth: [] }],
      params: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
      response: { 200: { type: "object", properties: { success: { type: "boolean" } } }, ...unauthorizedResponse },
    },
  }, notificationController.delete);

  app.delete("/notifications", {
    preHandler: [requireAuth],
    schema: {
      tags: ["TimeHuddle"],
      summary: "Batch delete notifications",
      security: [{ cookieAuth: [] }],
      body: { type: "object", required: ["ids"], properties: { ids: { type: "array", items: { type: "string" } } } },
      response: { 200: { type: "object", properties: { deleted: { type: "number" } } }, ...unauthorizedResponse },
    },
  }, notificationController.deleteMany);

  // ─── Notification Preferences ─────────────────────────────────────────────────

  app.get("/teams/:teamId/notification-preferences", {
    preHandler: [requireAuth],
    schema: {
      tags: ["TimeHuddle"],
      summary: "Get notification preferences for a team (leader only)",
      security: [{ cookieAuth: [] }],
      params: { type: "object", properties: { teamId: { type: "string" } }, required: ["teamId"] },
      response: { 200: { type: "object", properties: { preferences: { type: "array" } } }, ...unauthorizedResponse, ...forbiddenResponse },
    },
  }, notificationController.getPreferences);

  app.put("/teams/:teamId/notification-preferences", {
    preHandler: [requireAuth],
    schema: {
      tags: ["TimeHuddle"],
      summary: "Set notification preference for a team member (leader only)",
      security: [{ cookieAuth: [] }],
      params: { type: "object", properties: { teamId: { type: "string" } }, required: ["teamId"] },
      body: {
        type: "object",
        required: ["targetUserId", "notifyOnClockIn", "notifyOnClockOut", "notifyOnTicketStatus"],
        properties: {
          targetUserId: { type: "string" },
          notifyOnClockIn: { type: "boolean" },
          notifyOnClockOut: { type: "boolean" },
          notifyOnTicketStatus: { type: "boolean" },
        },
      },
      response: { 200: { type: "object", properties: { preference: { type: "object" } } }, ...unauthorizedResponse, ...forbiddenResponse },
    },
  }, notificationController.upsertPreference);
}
