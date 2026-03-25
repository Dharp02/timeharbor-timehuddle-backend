import { FastifyRequest, FastifyReply } from "fastify";
import { bridgeService } from "../services/bridge.service.js";
import { teamService } from "../services/team.service.js";

export class BridgeController {
  async clockEvent(req: FastifyRequest, reply: FastifyReply) {
    const body = req.body as any;
    const userId = req.user!.id;
    const userName = req.user!.name || req.user!.email || "Unknown";

    const isMember = await teamService.isMember(body.teamId, userId);
    if (!isMember) {
      return reply.status(403).send({ error: "Not a member of this team" });
    }

    const notifications = await bridgeService.handleClockEvent({
      userId,
      userName,
      teamId: body.teamId,
      event: body.event,
      timestamp: body.timestamp || new Date().toISOString(),
      tickets: body.tickets,
      youtubeLink: body.youtubeLink,
      sessionDuration: body.sessionDuration,
      source: body.source || "timehuddle",
    });

    return reply.send({
      success: true,
      notificationsSent: notifications.length,
    });
  }

  async ticketStatus(req: FastifyRequest, reply: FastifyReply) {
    const body = req.body as any;
    const userId = req.user!.id;
    const userName = req.user!.name || req.user!.email || "Unknown";

    const isMember = await teamService.isMember(body.teamId, userId);
    if (!isMember) {
      return reply.status(403).send({ error: "Not a member of this team" });
    }

    const notifications = await bridgeService.handleTicketStatus({
      userId,
      userName,
      teamId: body.teamId,
      ticketId: body.ticketId,
      ticketTitle: body.ticketTitle,
      status: body.status,
      source: body.source || "timehuddle",
    });

    return reply.send({
      success: true,
      notificationsSent: notifications.length,
    });
  }
}

export const bridgeController = new BridgeController();
