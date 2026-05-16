import { ObjectId } from "mongodb";

export interface TimehudleConnection {
  _id: ObjectId;
  userId: string; // TimeHarbor user ID
  timehudleUserId: string;
  timehudleEmail: string;
  timehudleName: string;
  /** OAuth 2.0 access token obtained via Authorization Code flow */
  accessToken: string;
  /** Refresh token (present when offline_access scope was granted) */
  refreshToken?: string;
  /** UTC timestamp when accessToken expires */
  tokenExpiresAt?: Date;
  connectedAt: Date;
  updatedAt: Date;
}

export interface OAuthState {
  _id: ObjectId;
  state: string;        // random opaque string
  userId: string;       // TimeHarbor user performing the connection
  codeVerifier: string; // PKCE code_verifier
  createdAt: Date;      // TTL index field — expires after 15 min
}

/** A TimeHuddle team the user has opted in to import into TimeHarbor. */
export interface TimehudleLinkedTeam {
  _id: ObjectId;
  userId: string;   // TimeHarbor user ID
  teamId: string;   // TimeHuddle team ID (hex ObjectId)
  teamName: string;
  linkedAt: Date;
}
