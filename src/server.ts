import "dotenv/config";
import { fileURLToPath } from "url";
<<<<<<< HEAD
import path from "path";
import fs from "fs";
import Fastify from "fastify";
=======
import Fastify, { FastifyInstance } from "fastify";
>>>>>>> 801a3e1 (refactor: rename project to timecore and update package.json scripts)
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { connectDB } from "./lib/db.js";
import { ensureIndexes } from "./lib/ensure-indexes.js";
import { healthRoutes } from "./routes/health.js";
import { timeharborRoutes } from "./routes/timeharbor/index.js";
import { timehuddleRoutes } from "./routes/timehuddle/index.js";
import { appContext } from "./middleware/app-context.js";

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
export async function buildApp(opts: { logger?: boolean } = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: opts.logger ?? true });

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
        { name: "TimeHarbor", description: "TimeHarbor app endpoints" },
        { name: "TimeHuddle", description: "TimeHuddle app endpoints" },
      ],
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

  // Health check
  await app.register(healthRoutes);

  // App-specific routes
  await app.register(timeharborRoutes, { prefix: "/v1/timeharbor" });
  await app.register(timehuddleRoutes, { prefix: "/v1/timehuddle" });

  return app;
}

async function bootstrap() {
  await connectDB();
  const app = await buildApp();
  const port = Number(process.env.PORT) || 3001;
  await app.listen({ port, host: "0.0.0.0" });
  console.log(`API running on http://localhost:${port}`);
  console.log(`Swagger UI at http://localhost:${port}/docs`);
}

// Only start the server when this file is run directly (not imported by tests)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  bootstrap().catch(console.error);
}
