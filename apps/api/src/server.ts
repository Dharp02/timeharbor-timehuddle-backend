import "dotenv/config";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { auth } from "./lib/auth.js";
import { connectDB } from "./lib/db.js";
import { ensureIndexes } from "./lib/ensure-indexes.js";
import { healthRoutes } from "./routes/health.js";
import { timeharborRoutes } from "./routes/timeharbor/index.js";
import { timehuddleRoutes } from "./routes/timehuddle/index.js";
import { appContext } from "./middleware/app-context.js";
import { autoCloseOrphanedSessions } from "./jobs/auto-close-sessions.js";

const app = Fastify({ logger: true, ignoreTrailingSlash: true });

async function bootstrap() {
  await connectDB();
  await ensureIndexes();

  // Ensure uploads directory exists
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const uploadsDir = path.resolve(__dirname, "..", "uploads", "avatars");
  fs.mkdirSync(uploadsDir, { recursive: true });

  // Multipart file uploads (5MB limit)
  await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024 } });

  // Serve uploaded files at /uploads/*
  await app.register(fastifyStatic, {
    root: path.resolve(__dirname, "..", "uploads"),
    prefix: "/uploads/",
    decorateReply: false,
  });

  // Swagger — must be registered before routes
  await app.register(swagger, {
    openapi: {
      info: {
        title: "TimeHarbor / TimeHuddle API",
        description: "Shared backend API for TimeHarbor and TimeHuddle applications",
        version: "1.0.0",
      },
      servers: [
        { url: "https://timehubbackend.os.mieweb.org", description: "Production" },
        { url: `http://localhost:${process.env.PORT || 3001}`, description: "Local dev" },
      ],
      tags: [
        { name: "Health", description: "Health check endpoints" },
        { name: "Auth", description: "Better Auth endpoints (sign-up, sign-in, sign-out, session)" },
        { name: "TimeHarbor", description: "TimeHarbor app endpoints" },
        { name: "TimeHuddle", description: "TimeHuddle app endpoints" },
      ],
      components: {
        securitySchemes: {
          cookieAuth: {
            type: "apiKey",
            in: "cookie",
            name: "better-auth.session_token",
          },
        },
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
  });

  await app.register(cors, {
    origin: process.env.TRUSTED_ORIGINS
      ? process.env.TRUSTED_ORIGINS.split(",")
      : [],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  });

  // Attach X-App-Id (timeharbor | timehuddle) to every request
  app.addHook("preHandler", appContext);

  // Better Auth handles all /api/auth/* routes.
  // We convert the Fastify request into a Web Request and pass it to
  // auth.handler directly, avoiding the body-stream issue that occurs
  // when using toNodeHandler (Fastify already consumes the body).
  async function betterAuthHandler(req: any, reply: any) {
    // Use the request URL as-is — better-auth's dynamic baseURL config
    // reads x-forwarded-host/proto headers to derive the correct origin.
    const url = `${process.env.BETTER_AUTH_URL || `http://localhost:${process.env.PORT || 3001}`}${req.url}`;
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers as Record<string, string | string[] | undefined>)) {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          value.forEach((v) => headers.append(key, v));
        } else {
          headers.set(key, value);
        }
      }
    }

    // Capacitor's native HTTP plugin may not send an Origin header.
    // Better Auth rejects requests with missing origin, so set a fallback.
    if (!headers.has("origin") || headers.get("origin") === "null") {
      headers.set("origin", "capacitor://localhost");
    }

    const hasBody = req.method !== "GET" && req.method !== "HEAD";
    const webRequest = new Request(url, {
      method: req.method,
      headers,
      body: hasBody ? JSON.stringify(req.body) : undefined,
    });

    const response = await auth.handler(webRequest);

    reply.status(response.status);
    response.headers.forEach((value: string, key: string) => {
      reply.header(key, value);
    });

    const text = await response.text();
    reply.send(text);
  }

  // Catch-all for any auth route not explicitly listed below (hidden from docs)
  app.all("/api/auth/*", { schema: { hide: true } }, betterAuthHandler);

  // ── Documented Better Auth endpoints ────────────────────────────────
  app.post("/api/auth/sign-up/email", {
    schema: {
      tags: ["Auth"],
      summary: "Sign up with email & password",
      body: {
        type: "object",
        required: ["email", "password", "name"],
        properties: {
          email: { type: "string", format: "email" },
          password: { type: "string", minLength: 8 },
          name: { type: "string" },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            token: { type: "string" },
            user: {
              type: "object",
              properties: {
                id: { type: "string" },
                email: { type: "string" },
                name: { type: "string" },
                emailVerified: { type: "boolean" },
                createdAt: { type: "string", format: "date-time" },
                updatedAt: { type: "string", format: "date-time" },
              },
            },
          },
        },
      },
    },
  }, betterAuthHandler);

  app.post("/api/auth/sign-in/email", {
    schema: {
      tags: ["Auth"],
      summary: "Sign in with email & password",
      body: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email" },
          password: { type: "string" },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            token: { type: "string" },
            user: {
              type: "object",
              properties: {
                id: { type: "string" },
                email: { type: "string" },
                name: { type: "string" },
                emailVerified: { type: "boolean" },
              },
            },
          },
        },
        401: {
          type: "object",
          properties: {
            message: { type: "string" },
          },
        },
      },
    },
  }, betterAuthHandler);

  app.post("/api/auth/sign-out", {
    schema: {
      tags: ["Auth"],
      summary: "Sign out (clear session cookie)",
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
          },
        },
      },
    },
  }, betterAuthHandler);

  app.get("/api/auth/get-session", {
    schema: {
      tags: ["Auth"],
      summary: "Get current session",
      description: "Returns the authenticated user and session. Requires a valid session cookie.",
      response: {
        200: {
          type: "object",
          properties: {
            session: {
              type: "object",
              properties: {
                id: { type: "string" },
                userId: { type: "string" },
                token: { type: "string" },
                expiresAt: { type: "string", format: "date-time" },
              },
            },
            user: {
              type: "object",
              properties: {
                id: { type: "string" },
                email: { type: "string" },
                name: { type: "string" },
                emailVerified: { type: "boolean" },
              },
            },
          },
        },
      },
    },
  }, betterAuthHandler);

  app.post("/api/auth/request-password-reset", {
    schema: {
      tags: ["Auth"],
      summary: "Request password reset email",
      body: {
        type: "object",
        required: ["email"],
        properties: {
          email: { type: "string", format: "email" },
          redirectTo: { type: "string", description: "URL to redirect to from the reset email link" },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            status: { type: "boolean" },
          },
        },
      },
    },
  }, betterAuthHandler);

  app.post("/api/auth/reset-password", {
    schema: {
      tags: ["Auth"],
      summary: "Reset password using token",
      body: {
        type: "object",
        required: ["token", "newPassword"],
        properties: {
          token: { type: "string" },
          newPassword: { type: "string", minLength: 8 },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            status: { type: "boolean" },
          },
        },
      },
    },
  }, betterAuthHandler);

  app.post("/api/auth/sign-in/social", {
    schema: {
      tags: ["Auth"],
      summary: "Initiate social OAuth sign-in",
      description: "Returns the OAuth provider URL to redirect to. The provider redirects back to /api/auth/callback/{provider}.",
      body: {
        type: "object",
        required: ["provider"],
        properties: {
          provider: { type: "string", enum: ["google", "github"] },
          callbackURL: { type: "string", description: "URL to redirect to after successful auth" },
        },
      },
      response: {
        200: { type: "object", properties: { url: { type: "string" }, redirect: { type: "boolean" } } },
      },
    },
  }, betterAuthHandler);

  app.get("/api/auth/callback/:provider", {
    schema: {
      tags: ["Auth"],
      summary: "OAuth callback",
      description: "Handles the redirect back from Google/GitHub after user authorises. Sets session cookie and redirects to callbackURL.",
      params: {
        type: "object",
        properties: {
          provider: { type: "string", enum: ["google", "github"] },
        },
      },
      response: {
        302: { type: "null", description: "Redirect to callbackURL with session cookie set" },
      },
    },
  }, betterAuthHandler);

  app.get("/api/auth/ok", {
    schema: {
      tags: ["Auth"],
      summary: "Health check for auth service",
      response: {
        200: {
          type: "object",
          properties: {
            ok: { type: "boolean" },
          },
        },
      },
    },
  }, betterAuthHandler);

  // Health check
  await app.register(healthRoutes);

  // App-specific routes
  await app.register(timeharborRoutes, { prefix: "/api/timeharbor" });
  await app.register(timehuddleRoutes, { prefix: "/api/timehuddle" });

  // Auto-close orphaned sessions every hour
  setInterval(autoCloseOrphanedSessions, 60 * 60 * 1000);

  const port = Number(process.env.PORT) || 3001;
  await app.listen({ port, host: "0.0.0.0" });
  console.log(`API running on http://localhost:${port}`);
  console.log(`Swagger UI at http://localhost:${port}/docs`);
}

bootstrap().catch(console.error);
