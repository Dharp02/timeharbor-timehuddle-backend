import { FastifyRequest, FastifyReply } from "fastify";
import { teamService } from "../services/team.service.js";
import { userService } from "../services/user.service.js";

export class TeamController {
  async create(req: FastifyRequest, reply: FastifyReply) {
    const { name } = req.body as any;
    if (!name || name.trim().length === 0) {
      return reply.status(400).send({ error: "Team name is required" });
    }
    const team = await teamService.create(name.trim(), req.user!.id);
    return reply.status(201).send({ team });
  }

  async list(req: FastifyRequest, reply: FastifyReply) {
    const teams = await teamService.findByUser(req.user!.id);
    return reply.send({ teams });
  }

  async getById(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as any;
    const membership = await teamService.getMembership(req.user!.id, id);
    if (!membership) {
      return reply.status(403).send({ error: "Not a member of this team" });
    }
    const team = await teamService.findById(id);
    if (!team) return reply.status(404).send({ error: "Team not found" });
    return reply.send({ team });
  }

  async update(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as any;
    const isLeader = await teamService.isLeader(id, req.user!.id);
    if (!isLeader) {
      return reply.status(403).send({ error: "Only team leaders can update the team" });
    }
    const { name } = req.body as any;
    if (!name || name.trim().length === 0) {
      return reply.status(400).send({ error: "Team name is required" });
    }
    await teamService.update(id, name.trim());
    return reply.send({ success: true });
  }

  async delete(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as any;
    const isLeader = await teamService.isLeader(id, req.user!.id);
    if (!isLeader) {
      return reply.status(403).send({ error: "Only team leaders can delete the team" });
    }
    await teamService.delete(id);
    return reply.send({ success: true });
  }

  async join(req: FastifyRequest, reply: FastifyReply) {
    const { code } = req.body as any;
    if (!code) return reply.status(400).send({ error: "Team code is required" });

    const team = await teamService.joinByCode(code.toUpperCase(), req.user!.id);
    if (!team) return reply.status(404).send({ error: "Invalid team code" });
    return reply.send({ team });
  }

  async getMembers(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as any;
    const membership = await teamService.getMembership(req.user!.id, id);
    if (!membership) {
      return reply.status(403).send({ error: "Not a member of this team" });
    }

    const members = await teamService.getMembers(id);

    const userIds = members.map((m) => m.userId);
    const users = await Promise.all(userIds.map((id) => userService.findById(id)));

    const enriched = members.map((m) => {
      const user = users.find((u) => u && u._id.toHexString() === m.userId);
      return {
        ...m,
        name: user?.name || "Unknown",
        email: user?.email || "",
        image: user?.image || null,
      };
    });

    return reply.send({ members: enriched });
  }

  async addMember(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as any;
    const { userId, role } = req.body as any;
    const isLeader = await teamService.isLeader(id, req.user!.id);
    if (!isLeader) {
      return reply.status(403).send({ error: "Only team leaders can add members" });
    }
    const member = await teamService.addMember(id, userId, role);
    return reply.status(201).send({ member });
  }

  async removeMember(req: FastifyRequest, reply: FastifyReply) {
    const { id, userId } = req.params as any;
    const isLeader = await teamService.isLeader(id, req.user!.id);
    if (!isLeader) {
      return reply.status(403).send({ error: "Only team leaders can remove members" });
    }
    if (userId === req.user!.id) {
      return reply.status(400).send({ error: "Cannot remove yourself" });
    }
    await teamService.removeMember(id, userId);
    return reply.send({ success: true });
  }

  async updateMemberRole(req: FastifyRequest, reply: FastifyReply) {
    const { id, userId } = req.params as any;
    const { role } = req.body as any;
    const isLeader = await teamService.isLeader(id, req.user!.id);
    if (!isLeader) {
      return reply.status(403).send({ error: "Only team leaders can change roles" });
    }
    await teamService.updateMemberRole(id, userId, role);
    return reply.send({ success: true });
  }
}

export const teamController = new TeamController();
