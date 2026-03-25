import { ObjectId } from "mongodb";
import { ticketsCollection } from "../models/index.js";
import type { Ticket } from "../models/ticket.model.js";

export class TicketService {
  async create(data: {
    title: string;
    description?: string;
    priority?: "Low" | "Medium" | "High";
    link?: string;
    teamId: string;
    createdBy: string;
    assignedTo?: string;
  }): Promise<Ticket> {
    const now = new Date();
    const ticket: Ticket = {
      _id: new ObjectId(),
      title: data.title,
      description: data.description,
      status: "Open",
      priority: data.priority || "Medium",
      link: data.link,
      teamId: data.teamId,
      createdBy: data.createdBy,
      assignedTo: data.assignedTo,
      totalTime: 0,
      createdAt: now,
      updatedAt: now,
    };
    await ticketsCollection().insertOne(ticket);
    return ticket;
  }

  async findByTeam(teamId: string): Promise<Ticket[]> {
    return ticketsCollection()
      .find({ teamId })
      .sort({ createdAt: -1 })
      .toArray();
  }

  async findById(id: string): Promise<Ticket | null> {
    return ticketsCollection().findOne({ _id: new ObjectId(id) });
  }

  async update(
    id: string,
    data: Partial<Pick<Ticket, "title" | "description" | "status" | "priority" | "link" | "assignedTo" | "totalTime">>
  ): Promise<boolean> {
    const result = await ticketsCollection().updateOne(
      { _id: new ObjectId(id) },
      { $set: { ...data, updatedAt: new Date() } }
    );
    return result.modifiedCount > 0;
  }

  async delete(id: string): Promise<boolean> {
    const result = await ticketsCollection().deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount > 0;
  }

  async batchUpdateStatus(ids: string[], status: Ticket["status"]): Promise<number> {
    const objectIds = ids.map((id) => new ObjectId(id));
    const result = await ticketsCollection().updateMany(
      { _id: { $in: objectIds } },
      { $set: { status, updatedAt: new Date() } }
    );
    return result.modifiedCount;
  }

  async assign(id: string, assignedTo: string): Promise<boolean> {
    return this.update(id, { assignedTo });
  }
}

export const ticketService = new TicketService();
