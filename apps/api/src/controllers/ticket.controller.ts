import { FastifyRequest, FastifyReply } from "fastify";
import { ticketService } from "../services/ticket.service.js";
import { teamService } from "../services/team.service.js";

export class TicketController {
  async create(req: FastifyRequest, reply: FastifyReply) {
    const { teamId } = req.params as any;
    const body = req.body as any;
    const membership = await teamService.getMembership(req.user!.id, teamId);
    if (!membership) {
      return reply.status(403).send({ error: "Not a member of this team" });
    }
    const ticket = await ticketService.create({
      ...body,
      teamId,
      createdBy: req.user!.id,
    });
    return reply.status(201).send({ ticket });
  }

  async list(req: FastifyRequest, reply: FastifyReply) {
    const { teamId } = req.params as any;
    const membership = await teamService.getMembership(req.user!.id, teamId);
    if (!membership) {
      return reply.status(403).send({ error: "Not a member of this team" });
    }
    const tickets = await ticketService.findByTeam(teamId);
    return reply.send({ tickets });
  }

  async update(req: FastifyRequest, reply: FastifyReply) {
    const { teamId, ticketId } = req.params as any;
    const body = req.body as any;
    const membership = await teamService.getMembership(req.user!.id, teamId);
    if (!membership) {
      return reply.status(403).send({ error: "Not a member of this team" });
    }
    const updated = await ticketService.update(ticketId, body);
    if (!updated) return reply.status(404).send({ error: "Ticket not found" });
    return reply.send({ success: true });
  }

  async delete(req: FastifyRequest, reply: FastifyReply) {
    const { teamId, ticketId } = req.params as any;
    const isLeader = await teamService.isLeader(teamId, req.user!.id);
    if (!isLeader) {
      return reply.status(403).send({ error: "Only team leaders can delete tickets" });
    }
    await ticketService.delete(ticketId);
    return reply.send({ success: true });
  }

  async assign(req: FastifyRequest, reply: FastifyReply) {
    const { teamId, ticketId } = req.params as any;
    const { assignedTo } = req.body as any;
    const isLeader = await teamService.isLeader(teamId, req.user!.id);
    if (!isLeader) {
      return reply.status(403).send({ error: "Only team leaders can assign tickets" });
    }
    await ticketService.assign(ticketId, assignedTo);
    return reply.send({ success: true });
  }

  async batchUpdateStatus(req: FastifyRequest, reply: FastifyReply) {
    const { teamId } = req.params as any;
    const { ids, status } = req.body as any;
    const isLeader = await teamService.isLeader(teamId, req.user!.id);
    if (!isLeader) {
      return reply.status(403).send({ error: "Only team leaders can batch update" });
    }
    const count = await ticketService.batchUpdateStatus(ids, status);
    return reply.send({ updated: count });
  }
}

export const ticketController = new TicketController();
