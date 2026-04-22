import "dotenv/config";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { connectDB } from "./lib/db.js";
import { ensureIndexes } from "./lib/ensure-indexes.js";
import { appContext } from "./middleware/app-context.js";
import { healthRoutes } from "./routes/health.js";
import { userRoutes } from "./routes/users.js";
import { ticketRoutes } from "./routes/tickets.js";
import { teamRoutes } from "./routes/teams.js";
import { clockRoutes } from "./routes/clock.js";
import { messageRoutes } from "./routes/messages.js";
import { notificationRoutes } from "./routes/notifications.js";

export async function buildApp(opts: { logger?: boolean } = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: opts.logger ?? true });

  // Swagger — must be registered before routes
  await app.register(swagger, {
    openapi: {
      info: {
        title: "Timecore API",
        description: "Shared backend API",
        version: "1.0.0",
      },
      servers: [
        { url: "https://timehubbackend.os.mieweb.org", description: "Production" },
        { url: `http://localhost:${process.env.PORT || 3001}`, description: "Local dev" },
      ],
      tags: [
        { name: "Health", description: "Health check endpoints" },
        {
          name: "Auth",
          description: "Better Auth endpoints (sign-up, sign-in, sign-out, session)",
        },
        { name: "Users", description: "User session and profile endpoints" },
        { name: "Teams", description: "Team management endpoints" },
        { name: "Tickets", description: "Ticket CRUD, timer, and admin endpoints" },
        { name: "Clock", description: "Clock in/out, ticket timers, timesheet, and SSE live stream" },
        { name: "Messages", description: "Admin-member threaded messaging and SSE stream" },
        { name: "Notifications", description: "User notification inbox, mark-read, delete, and SSE stream" },
      ],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
  });

  await app.register(cors, {
    origin: process.env.TRUSTED_ORIGINS ? process.env.TRUSTED_ORIGINS.split(",") : [],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  });

  // Attach X-App-Id (timeharbor | timehuddle) to every request
  app.addHook("preHandler", appContext);

  // Health check
  await app.register(healthRoutes);

  // App routes
  await app.register(userRoutes, { prefix: "/v1" });
  await app.register(teamRoutes, { prefix: "/v1" });
  await app.register(ticketRoutes, { prefix: "/v1" });
  await app.register(clockRoutes, { prefix: "/v1" });
  await app.register(messageRoutes, { prefix: "/v1" });
  await app.register(notificationRoutes, { prefix: "/v1" });

  return app;
}

async function bootstrap() {
  await connectDB();
  const app = await buildApp();
  const port = Number(process.env.PORT) || 4000;
  await app.listen({ port, host: "0.0.0.0" });
  console.log(`API running on http://localhost:${port}`);
  console.log(`Swagger UI at http://localhost:${port}/docs`);
}

// Only start the server when this file is run directly (not imported by tests)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  bootstrap().catch(console.error);
}
