import { getDB } from "../lib/db.js";
import type { User } from "./user.model.js";

// Collection accessor — use this everywhere instead of getDB().collection("users")
export function usersCollection() {
  return getDB().collection<User>("users");
}
