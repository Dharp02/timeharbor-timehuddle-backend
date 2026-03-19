import { FastifyRequest, FastifyReply } from "fastify";
import { userService } from "../services/user.service.js";

export class UserController {
  /** GET /me — return the authenticated user's profile */
  async getMe(req: FastifyRequest, reply: FastifyReply) {
    return reply.send({ user: req.user });
  }

  /** GET /me/profile — return full user document from DB */
  async getMyProfile(req: FastifyRequest, reply: FastifyReply) {
    const user = await userService.findById(req.user!.id);
    if (!user) {
      return reply.status(404).send({ error: "User not found" });
    }
    return reply.send({ user });
  }
}

export const userController = new UserController();
