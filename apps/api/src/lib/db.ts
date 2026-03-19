import { MongoClient } from "mongodb";

const client = new MongoClient(process.env.MONGODB_URI!);

export async function connectDB() {
  await client.connect();
  console.log("MongoDB connected");
}

export function getDB() {
  return client.db();
}

export { client };
