import { FastifyInstance } from "fastify";
import { requireAuth } from "../middleware/require-auth.js";
import {
  timehudleConnectionService,
  createOAuthState,
  consumeOAuthState,
} from "../services/timehuddle-connection.service.js";

const TIMEHUDDLE_API_URL = process.env.TIMEHUDDLE_API_URL ?? "http://localhost:4000";
const TIMEHARBOR_FRONTEND_URL = process.env.TIMEHARBOR_FRONTEND_URL ?? "http://localhost:8080";
const CLIENT_ID = process.env.TIMEHUDDLE_CLIENT_ID ?? "timeharbor";
const REDIRECT_URI =
  process.env.TIMEHUDDLE_REDIRECT_URI ?? "http://localhost:3001/v1/timehuddle/oauth/callback";

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

  // GET /v1/timehuddle/oauth/start
  // Redirects the browser to TimeHuddle's authorize endpoint.
  // Must be navigated to directly (window.location.href) — not called via fetch.
  app.get(
    "/timehuddle/oauth/start",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["TimeHuddle"],
        summary: "Begin OAuth 2.0 Authorization Code flow to connect TimeHuddle",
        security: [{ cookieAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: { authorizeUrl: { type: "string" } },
          },
        },
      },
    },
    async (req) => {
      const { state, codeChallenge } = await createOAuthState(req.user!.id);

      const authorizeUrl = new URL(`${TIMEHUDDLE_API_URL}/api/auth/oauth2/authorize`);
      authorizeUrl.searchParams.set("response_type", "code");
      authorizeUrl.searchParams.set("client_id", CLIENT_ID);
      authorizeUrl.searchParams.set("redirect_uri", REDIRECT_URI);
      authorizeUrl.searchParams.set("scope", "openid profile email offline_access");
      authorizeUrl.searchParams.set("state", state);
      authorizeUrl.searchParams.set("code_challenge", codeChallenge);
      authorizeUrl.searchParams.set("code_challenge_method", "S256");

      return { authorizeUrl: authorizeUrl.toString() };
    }
  );

  // GET /v1/timehuddle/oauth/callback
  // TimeHuddle redirects here after the user authorises (or denies) the request.
  // No auth middleware — the userId is recovered from the stored state record.
  app.get<{ Querystring: { code?: string; state?: string; error?: string } }>(
    "/timehuddle/oauth/callback",
    {
      schema: {
        tags: ["TimeHuddle"],
        summary: "OAuth 2.0 callback — exchanges code for tokens",
        querystring: {
          type: "object",
          properties: {
            code: { type: "string" },
            state: { type: "string" },
            error: { type: "string" },
          },
        },
        response: {
          302: { type: "null", description: "Redirect to TimeHarbor settings page" },
        },
      },
    },
    async (req, reply) => {
      const frontendBase = TIMEHARBOR_FRONTEND_URL;
      const settingsPage = `${frontendBase}/dashboard/settings/timehuddle`;

      const { code, state, error } = req.query;

      if (error || !code || !state) {
        const reason = encodeURIComponent(error ?? "missing_code_or_state");
        return reply.redirect(`${settingsPage}?error=${reason}`, 302);
      }

      const stored = await consumeOAuthState(state);
      if (!stored) {
        return reply.redirect(`${settingsPage}?error=invalid_state`, 302);
      }

      try {
        await timehudleConnectionService.completeOAuthConnection(
          stored.userId,
          code,
          stored.codeVerifier
        );
        return reply.redirect(`${settingsPage}?connected=true`, 302);
      } catch (err) {
        app.log.error(err, "TimeHuddle OAuth callback failed");
        return reply.redirect(`${settingsPage}?error=token_exchange_failed`, 302);
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

  // ── Team linking ─────────────────────────────────────────────────────────────

  // GET /v1/timehuddle/teams — proxy all teams the user belongs to in TimeHuddle
  app.get(
    "/timehuddle/teams",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["TimeHuddle"],
        summary: "List teams the user belongs to in TimeHuddle",
        security: [{ cookieAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              teams: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    name: { type: "string" },
                    description: { type: "string", nullable: true },
                    memberCount: { type: "number" },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (req, reply) => {
      const data = await timehudleConnectionService.proxyGet<{ teams: any[] }>(
        req.user!.id,
        "/v1/teams"
      );
      const teams = (data.teams ?? []).map((t: any) => ({
        id: t.id,
        name: t.name,
        description: t.description ?? null,
        memberCount: (t.members?.length ?? 0) + (t.admins?.length ?? 0),
      }));
      return reply.send({ teams });
    }
  );

  // GET /v1/timehuddle/linked-teams — teams the user has opted in to sync
  app.get(
    "/timehuddle/linked-teams",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["TimeHuddle"],
        summary: "List TimeHuddle teams linked to this TimeHarbor account",
        security: [{ cookieAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              linkedTeams: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    teamId: { type: "string" },
                    teamName: { type: "string" },
                    linkedAt: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (req) => {
      const linkedTeams = await timehudleConnectionService.getLinkedTeams(req.user!.id);
      return { linkedTeams };
    }
  );

  // POST /v1/timehuddle/linked-teams — link a team
  app.post(
    "/timehuddle/linked-teams",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["TimeHuddle"],
        summary: "Link a TimeHuddle team to sync tickets from",
        security: [{ cookieAuth: [] }],
        body: {
          type: "object",
          required: ["teamId", "teamName"],
          additionalProperties: false,
          properties: {
            teamId: { type: "string" },
            teamName: { type: "string" },
          },
        },
        response: {
          200: { type: "object", properties: { success: { type: "boolean" } } },
        },
      },
    },
    async (req, reply) => {
      const { teamId, teamName } = req.body as { teamId: string; teamName: string };
      await timehudleConnectionService.linkTeam(req.user!.id, teamId, teamName);
      return reply.send({ success: true });
    }
  );

  // DELETE /v1/timehuddle/linked-teams/:teamId — unlink a team
  app.delete(
    "/timehuddle/linked-teams/:teamId",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["TimeHuddle"],
        summary: "Unlink a TimeHuddle team (stops ticket sync; marks existing tickets disconnected)",
        security: [{ cookieAuth: [] }],
        params: {
          type: "object",
          required: ["teamId"],
          properties: { teamId: { type: "string" } },
        },
        response: {
          200: { type: "object", properties: { success: { type: "boolean" } } },
        },
      },
    },
    async (req, reply) => {
      const { teamId } = req.params as { teamId: string };
      await timehudleConnectionService.unlinkTeam(req.user!.id, teamId);
      return reply.send({ success: true });
    }
  );

  // GET /v1/timehuddle/linked-teams/:teamId/tickets — proxy tickets for a linked team
  app.get(
    "/timehuddle/linked-teams/:teamId/tickets",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["TimeHuddle"],
        summary: "Fetch tickets for a linked TimeHuddle team",
        security: [{ cookieAuth: [] }],
        params: {
          type: "object",
          required: ["teamId"],
          properties: { teamId: { type: "string" } },
        },
        response: {
          200: {
            type: "object",
            properties: {
              tickets: { type: "array", items: { type: "object", additionalProperties: true } },
            },
          },
          403: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (req, reply) => {
      const { teamId } = req.params as { teamId: string };
      // Verify team is actually linked by this user
      const linked = await timehudleConnectionService.getLinkedTeams(req.user!.id);
      if (!linked.some((t) => t.teamId === teamId)) {
        return reply.status(403).send({ error: "Team not linked" });
      }
      const data = await timehudleConnectionService.proxyGet<{ tickets: any[] }>(
        req.user!.id,
        `/v1/tickets?teamId=${encodeURIComponent(teamId)}`
      );
      return reply.send({ tickets: data.tickets ?? [] });
    }
  );

  // GET /v1/timehuddle/shared-tickets — all tickets flagged sharedWithTimeharbor=true across all user's TimeHuddle teams
  // No team-linking required — works for any team the user belongs to in TimeHuddle.
  app.get(
    "/timehuddle/shared-tickets",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["TimeHuddle"],
        summary: "Fetch all TimeHuddle tickets flagged as shared with TimeHarbor (any team)",
        security: [{ cookieAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              tickets: { type: "array", items: { type: "object", additionalProperties: true } },
            },
          },
        },
      },
    },
    async (req, reply) => {
      const data = await timehudleConnectionService.proxyGet<{ tickets: any[] }>(
        req.user!.id,
        "/v1/tickets/shared-with-timeharbor"
      );
      return reply.send({ tickets: data.tickets ?? [] });
    }
  );

  // POST /v1/timehuddle/tickets/:id/push — push time/status/description/github back to TimeHuddle
  app.post(
    "/timehuddle/tickets/:id/push",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["TimeHuddle"],
        summary: "Push tracked time and status for a ticket back to TimeHuddle",
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", pattern: "^[0-9a-f]{24}$" } },
        },
        body: {
          type: "object",
          additionalProperties: false,
          properties: {
            addMs: { type: "number", minimum: 0 },
            status: { type: "string" },
            description: { type: "string" },
            github: { type: "string" },
          },
        },
        response: {
          200: { type: "object", properties: { ticket: { type: "object", additionalProperties: true } } },
          400: { type: "object", properties: { error: { type: "string" } } },
          403: { type: "object", properties: { error: { type: "string" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const body = req.body as {
        addMs?: number;
        status?: string;
        description?: string;
        github?: string;
      };
      const data = await timehudleConnectionService.proxyPatch<{ ticket: any }>(
        req.user!.id,
        `/v1/tickets/${id}/external-update`,
        body
      );
      return reply.send(data);
    }
  );
}
