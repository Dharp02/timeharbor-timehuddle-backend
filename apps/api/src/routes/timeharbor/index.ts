import { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/require-auth.js";
import { requireSyncAuth } from "../../middleware/require-sync-auth.js";
import { userController } from "../../controllers/user.controller.js";
import { profileController } from "../../controllers/profile.controller.js";
import { encryptedOpLogController } from "../../controllers/encrypted-oplog.controller.js";

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

  app.post("/me/avatar", {
    preHandler: [requireAuth],
    schema: {
      tags: ["TimeHarbor"],
      summary: "Upload profile avatar",
      security: [{ cookieAuth: [] }],
      consumes: ["multipart/form-data"],
      response: {
        200: { type: "object", properties: { avatarUrl: { type: "string" } } },
        400: { type: "object", properties: { error: { type: "string" } } },
        ...unauthorizedResponse,
      },
    },
  }, profileController.uploadAvatar);

  app.delete("/me/avatar", {
    preHandler: [requireAuth],
    schema: {
      tags: ["TimeHarbor"],
      summary: "Delete profile avatar",
      security: [{ cookieAuth: [] }],
      response: {
        200: { type: "object", properties: { ok: { type: "boolean" } } },
        ...unauthorizedResponse,
      },
    },
  }, profileController.deleteAvatar);

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

  // ── Encrypted Op-Log Relay (E2E encrypted sync) ──────────────────

  app.post("/sync/oplog", {
    preHandler: [requireSyncAuth],
    schema: {
      tags: ["TimeHarbor"],
      summary: "Push encrypted op-log batch (server cannot decrypt)",
      security: [{ cookieAuth: [] }],
      body: {
        type: "object",
        required: ["deviceId", "lastHLC", "count", "payload"],
        properties: {
          deviceId: { type: "string" },
          lastHLC: { type: "string" },
          count: { type: "number" },
          payload: {
            type: "object",
            required: ["iv", "ciphertext"],
            properties: {
              iv: { type: "string" },
              ciphertext: { type: "string" },
            },
          },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            accepted: { type: "number" },
          },
        },
        ...unauthorizedResponse,
      },
    },
  }, encryptedOpLogController.pushOpLog);

  app.get("/sync/oplog", {
    preHandler: [requireSyncAuth],
    schema: {
      tags: ["TimeHarbor"],
      summary: "Pull encrypted op-log batches from other devices",
      security: [{ cookieAuth: [] }],
      querystring: {
        type: "object",
        properties: {
          deviceId: { type: "string" },
          since: { type: "string" },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            batches: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  deviceId: { type: "string" },
                  lastHLC: { type: "string" },
                  count: { type: "number" },
                  payload: {
                    type: "object",
                    properties: {
                      iv: { type: "string" },
                      ciphertext: { type: "string" },
                    },
                  },
                },
              },
            },
            serverTime: { type: "string", format: "date-time" },
          },
        },
        ...unauthorizedResponse,
      },
    },
  }, encryptedOpLogController.pullOpLog);

  app.delete("/sync/oplog/compact", {
    preHandler: [requireSyncAuth],
    schema: {
      tags: ["TimeHarbor"],
      summary: "Remove old encrypted batches all devices have consumed",
      security: [{ cookieAuth: [] }],
      body: {
        type: "object",
        required: ["deviceId", "beforeHLC"],
        properties: {
          deviceId: { type: "string" },
          beforeHLC: { type: "string" },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            deleted: { type: "number" },
          },
        },
        ...unauthorizedResponse,
      },
    },
  }, encryptedOpLogController.compactOpLog);

  app.delete("/sync/oplog/purge", {
    preHandler: [requireSyncAuth],
    schema: {
      tags: ["TimeHarbor"],
      summary: "Delete ALL encrypted batches for this user (used on key regeneration)",
      security: [{ cookieAuth: [] }],
      body: {
        type: "object",
        properties: {
          legacyUserId: { type: "string", description: "Old auth user ID to also purge" },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            deleted: { type: "number" },
          },
        },
        ...unauthorizedResponse,
      },
    },
  }, encryptedOpLogController.purgeAll);

  app.get("/sync/oplog/status", {
    preHandler: [requireSyncAuth],
    schema: {
      tags: ["TimeHarbor"],
      summary: "Check whether the user has existing encrypted sync data",
      security: [{ cookieAuth: [] }],
      response: {
        200: {
          type: "object",
          properties: {
            hasData: { type: "boolean" },
          },
        },
        ...unauthorizedResponse,
      },
    },
  }, encryptedOpLogController.hasData);
}
