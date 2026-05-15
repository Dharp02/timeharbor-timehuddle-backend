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
}
