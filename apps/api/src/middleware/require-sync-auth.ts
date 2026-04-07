import { FastifyRequest, FastifyReply } from "fastify";
import { auth } from "../lib/auth.js";
import { fromNodeHeaders } from "better-auth/node";

/**
 * UUID-based auth for the encrypted sync relay.
 *
 * Accepts either:
 *   1. A session cookie (existing better-auth flow → user.id as userId)
 *   2. An X-Identity-UUID header (new auth-free flow → UUID as userId)
 *
 * The server is a blind relay for encrypted data, so UUID-only auth is safe:
 * - The UUID is unguessable (128-bit random, UUID v4)
 * - Data is AES-256-GCM encrypted — useless without the key
 * - The server never decrypts anything
 */
export async function requireSyncAuth(
  req: FastifyRequest,
  reply: FastifyReply
) {
  // 1. Try session cookie first (backwards-compatible with existing auth)
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (session) {
      req.user = session.user;
      req.session = session.session;
      return; // Authenticated via session
    }
  } catch {
    // Session lookup failed — try UUID fallback
  }

  // 2. Try X-Identity-UUID header
  const uuid = req.headers["x-identity-uuid"] as string | undefined;
  if (uuid && isValidUUID(uuid)) {
    // Create a minimal user object with the UUID as the id.
    // This is compatible with the controller's `req.user!.id` pattern.
    req.user = {
      id: uuid,
      name: "Anonymous",
      email: "",
      emailVerified: false,
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as typeof req.user;
    return; // Authenticated via UUID
  }

  return reply.status(401).send({ error: "Unauthorized" });
}

/** Basic UUID v4 format validation. */
function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
}
