import { FastifyRequest, FastifyReply } from "fastify";
import { notificationService } from "../services/notification.service.js";
import { teamService } from "../services/team.service.js";

export class NotificationController {
  async list(req: FastifyRequest, reply: FastifyReply) {
    const notifications = await notificationService.findByUser(req.user!.id);
    return reply.send({ notifications });
  }

  async markAsRead(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as any;
    await notificationService.markAsRead(id);
    return reply.send({ success: true });
  }

  async markAllAsRead(req: FastifyRequest, reply: FastifyReply) {
    const count = await notificationService.markAllAsRead(req.user!.id);
    return reply.send({ updated: count });
  }

  async delete(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as any;
    await notificationService.delete(id);
    return reply.send({ success: true });
  }

  async deleteMany(req: FastifyRequest, reply: FastifyReply) {
    const { ids } = req.body as any;
    const count = await notificationService.deleteMany(ids);
    return reply.send({ deleted: count });
  }

  // ── Notification Preferences ──

  async getPreferences(req: FastifyRequest, reply: FastifyReply) {
    const { teamId } = req.params as any;
    const isLeader = await teamService.isLeader(teamId, req.user!.id);
    if (!isLeader) {
      return reply.status(403).send({ error: "Only team leaders can manage preferences" });
    }
    const prefs = await notificationService.getPreferences(teamId, req.user!.id);
    return reply.send({ preferences: prefs });
  }

  async upsertPreference(req: FastifyRequest, reply: FastifyReply) {
    const { teamId } = req.params as any;
    const body = req.body as any;
    const isLeader = await teamService.isLeader(teamId, req.user!.id);
    if (!isLeader) {
      return reply.status(403).send({ error: "Only team leaders can set preferences" });
    }
    const pref = await notificationService.upsertPreference({
      teamId,
      userId: req.user!.id,
      ...body,
    });
    return reply.send({ preference: pref });
  }
}

export const notificationController = new NotificationController();
