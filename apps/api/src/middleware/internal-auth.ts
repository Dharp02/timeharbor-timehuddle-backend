import { FastifyRequest, FastifyReply } from "fastify";

/**
 * Middleware that accepts either:
 * 1. A Better Auth session cookie (standard user auth)
 * 2. An X-Internal-Key header with userId for server-to-server calls
 *
 * For internal calls, the request must include:
 *   - X-Internal-Key: <INTERNAL_API_KEY from env>
 *   - X-User-Id: <Better Auth userId>
 *   - X-User-Name: <display name>
 *   - X-User-Email: <email>
 */
export async function requireAuthOrInternal(
  req: FastifyRequest,
  reply: FastifyReply
) {
  const internalKey = req.headers["x-internal-key"] as string | undefined;
  const expectedKey = process.env.INTERNAL_API_KEY;

  if (internalKey && expectedKey && internalKey === expectedKey) {
    const userId = req.headers["x-user-id"] as string;
    const userName = (req.headers["x-user-name"] as string) || "";
    const userEmail = (req.headers["x-user-email"] as string) || "";

    if (!userId) {
      return reply.status(400).send({ error: "X-User-Id header required for internal calls" });
    }

    req.user = {
      id: userId,
      name: userName,
      email: userEmail,
    } as any;
    return;
  }

  // Fall back to standard Better Auth session
  const { requireAuth } = await import("./require-auth.js");
  return requireAuth(req, reply);
}
