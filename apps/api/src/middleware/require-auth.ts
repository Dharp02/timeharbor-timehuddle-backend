import { FastifyReply, FastifyRequest } from "fastify";
import { randomUUID } from "crypto";

export type AppUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
};

function buildAppUser(req: FastifyRequest): AppUser {
  const identityUUID =
    (req.headers["x-identity-uuid"] as string | undefined)?.trim() ||
    (req.headers["x-user-id"] as string | undefined)?.trim() ||
    randomUUID();

  return {
    id: identityUUID,
    name: "TimeHarbor User",
    email: `${identityUUID}@timeharbor.local`,
    image: null,
  };
}

export async function requireAuth(
  req: FastifyRequest,
  reply: FastifyReply
) {
  req.user = buildAppUser(req);
}

// Extend Fastify types globally
declare module "fastify" {
  interface FastifyRequest {
    user?: AppUser;
  }
}
