import { ObjectId } from "mongodb";

// ── User (managed by Better Auth — do NOT write to this collection directly) ──

export interface User {
  _id: ObjectId;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ── Session (managed by Better Auth) ──

export interface Session {
  _id: ObjectId;
  userId: string;
  token: string;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}
