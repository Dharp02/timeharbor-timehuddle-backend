import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth.js";
import { connectDB } from "./lib/db.js";
import { healthRoutes } from "./routes/health.js";
import { timeharborRoutes } from "./routes/timeharbor/index.js";
import { timehuddleRoutes } from "./routes/timehuddle/index.js";

const app = Fastify({ logger: true });

async function bootstrap() {
  await connectDB();

  // Swagger — must be registered before routes
  await app.register(swagger, {
    openapi: {
      info: {
        title: "TimeHarbor / TimeHuddle API",
        description: "Shared backend API for TimeHarbor and TimeHuddle applications",
        version: "1.0.0",
      },
      servers: [
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

  // Better Auth handles all /api/auth/* routes
  app.all("/api/auth/*", async (req, reply) => {
    const nodeHandler = toNodeHandler(auth);
    await nodeHandler(req.raw, reply.raw);
    reply.hijack();
  });

  // Health check
  await app.register(healthRoutes);

  // App-specific routes
  await app.register(timeharborRoutes, { prefix: "/api/timeharbor" });
  await app.register(timehuddleRoutes, { prefix: "/api/timehuddle" });

  const port = Number(process.env.PORT) || 3001;
  await app.listen({ port, host: "0.0.0.0" });
  console.log(`API running on http://localhost:${port}`);
  console.log(`Swagger UI at http://localhost:${port}/docs`);
}

bootstrap().catch(console.error);
