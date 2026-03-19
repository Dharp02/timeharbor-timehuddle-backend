import { ObjectId } from "mongodb";
import { usersCollection } from "../models/index.js";

export class UserService {
  async findById(id: string) {
    return usersCollection().findOne({ _id: new ObjectId(id) });
  }

  async findByEmail(email: string) {
    return usersCollection().findOne({ email });
  }

  async list(limit = 50, skip = 0) {
    return usersCollection()
      .find()
      .skip(skip)
      .limit(limit)
      .toArray();
  }
}

export const userService = new UserService();
