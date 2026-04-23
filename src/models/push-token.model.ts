import type { ObjectId } from "mongodb";

/** Web Push (VAPID) subscription stored for browser-based push delivery. */
export interface WebPushToken {
  _id: ObjectId;
  userId: string;
  type: "webpush";
  endpoint: string;
  keys: { p256dh: string; auth: string };
  expirationTime: number | null;
  createdAt: Date;
}

/** Native device token stored for APNs (iOS) or FCM (Android) delivery. */
export interface NativePushToken {
  _id: ObjectId;
  userId: string;
  type: "native";
  token: string;
  platform: "ios" | "android";
  createdAt: Date;
}

export type PushToken = WebPushToken | NativePushToken;
