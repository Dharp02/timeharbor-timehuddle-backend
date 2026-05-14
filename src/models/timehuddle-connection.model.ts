import { ObjectId } from "mongodb";

export interface TimehudleConnection {
  _id: ObjectId;
  userId: string; // TimeHarbor user ID
  timehudleUserId: string;
  timehudleEmail: string;
  timehudleName: string;
  patToken: string; // Raw PAT — never returned to frontend
  connectedAt: Date;
  updatedAt: Date;
}
