import { ObjectId } from "mongodb";

export interface Ticket {
  _id: ObjectId;
  title: string;
  description?: string;
  status: "Open" | "In Progress" | "Reviewed" | "Closed";
  priority: "Low" | "Medium" | "High";
  link?: string;
  teamId: string;
  createdBy: string; // userId
  assignedTo?: string; // userId
  totalTime: number; // ms accumulated
  createdAt: Date;
  updatedAt: Date;
}
