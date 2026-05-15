import { ObjectId } from "mongodb";
import { timehudleConnectionsCollection, oauthStatesCollection } from "../models/index.js";
import { randomBytes, createHash } from "crypto";

const TIMEHUDDLE_API_URL =
  process.env.TIMEHUDDLE_API_URL || "http://localhost:4000";
const TIMEHUDDLE_AUTH_BASE = `${TIMEHUDDLE_API_URL}/api/auth`;

const CLIENT_ID = process.env.TIMEHUDDLE_CLIENT_ID ?? "timeharbor";
const CLIENT_SECRET = process.env.TIMEHUDDLE_CLIENT_SECRET ?? "";
const REDIRECT_URI =
  process.env.TIMEHUDDLE_REDIRECT_URI ??
  "http://localhost:3001/v1/timehuddle/oauth/callback";

// ── PKCE helpers ────────────────────────────────────────────────────────────

export function generatePkce(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
  return { codeVerifier, codeChallenge };
}

// ── OAuth state management ───────────────────────────────────────────────────

export async function createOAuthState(userId: string): Promise<{
  state: string;
  codeVerifier: string;
  codeChallenge: string;
}> {
  const state = randomBytes(24).toString("base64url");
  const { codeVerifier, codeChallenge } = generatePkce();

  await oauthStatesCollection().insertOne({
    _id: new ObjectId(),
    state,
    userId,
    codeVerifier,
    createdAt: new Date(),
  });

  return { state, codeVerifier, codeChallenge };
}

export async function consumeOAuthState(
  state: string
): Promise<{ userId: string; codeVerifier: string } | null> {
  const record = await oauthStatesCollection().findOneAndDelete({ state });
  if (!record) return null;
  return { userId: record.userId, codeVerifier: record.codeVerifier };
}

// ── Token exchange ───────────────────────────────────────────────────────────

export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string
): Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number }> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code_verifier: codeVerifier,
  });

  const res = await fetch(`${TIMEHUDDLE_AUTH_BASE}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

async function fetchTimehudleProfile(accessToken: string): Promise<{
  id: string;
  email: string;
  name: string;
}> {
  // Use the OIDC userinfo endpoint — it validates the OIDC access token and
  // returns standard claims (sub, email, name). The /v1/me endpoint uses
  // Better Auth sessions and rejects OIDC access tokens.
  const res = await fetch(`${TIMEHUDDLE_AUTH_BASE}/oauth2/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Failed to fetch TimeHuddle profile: ${res.status}`);
  const data = (await res.json()) as { sub: string; email: string; name: string };
  return { id: data.sub, email: data.email, name: data.name };
}

// ── Connection service ───────────────────────────────────────────────────────

export const timehudleConnectionService = {
  async completeOAuthConnection(
    userId: string,
    code: string,
    codeVerifier: string
  ): Promise<{ timehudleEmail: string; timehudleName: string }> {
    const { accessToken, refreshToken, expiresIn } = await exchangeCodeForTokens(
      code,
      codeVerifier
    );

    const profile = await fetchTimehudleProfile(accessToken);

    const now = new Date();
    const tokenExpiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : undefined;

    await timehudleConnectionsCollection().updateOne(
      { userId },
      {
        $set: {
          userId,
          timehudleUserId: profile.id,
          timehudleEmail: profile.email,
          timehudleName: profile.name,
          accessToken,
          ...(refreshToken ? { refreshToken } : {}),
          ...(tokenExpiresAt ? { tokenExpiresAt } : {}),
          updatedAt: now,
        },
        $setOnInsert: { _id: new ObjectId(), connectedAt: now },
      },
      { upsert: true }
    );

    return { timehudleEmail: profile.email, timehudleName: profile.name };
  },

  /** Return a valid access token, refreshing if necessary. */
  async getAccessToken(userId: string): Promise<string> {
    const conn = await timehudleConnectionsCollection().findOne({ userId });
    if (!conn) throw new Error("No TimeHuddle connection found");

    // Refresh if expired (or expiring within 60 s)
    const needsRefresh =
      conn.tokenExpiresAt &&
      conn.tokenExpiresAt.getTime() - Date.now() < 60_000;

    if (needsRefresh && conn.refreshToken) {
      const body = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: conn.refreshToken,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      });

      const res = await fetch(`${TIMEHUDDLE_AUTH_BASE}/oauth2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });

      if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`);

      const data = (await res.json()) as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
      };

      const tokenExpiresAt = data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : undefined;

      await timehudleConnectionsCollection().updateOne(
        { userId },
        {
          $set: {
            accessToken: data.access_token,
            ...(data.refresh_token ? { refreshToken: data.refresh_token } : {}),
            ...(tokenExpiresAt ? { tokenExpiresAt } : {}),
            updatedAt: new Date(),
          },
        }
      );

      return data.access_token;
    }

    return conn.accessToken;
  },

  async getStatus(userId: string) {
    const conn = await timehudleConnectionsCollection().findOne(
      { userId },
      { projection: { accessToken: 0, refreshToken: 0 } }
    );
    if (!conn) {
      return { connected: false };
    }
    return {
      connected: true,
      timehudleEmail: conn.timehudleEmail,
      timehudleName: conn.timehudleName,
      connectedAt: conn.connectedAt,
    };
  },

  async disconnect(userId: string) {
    const result = await timehudleConnectionsCollection().deleteOne({ userId });
    return result.deletedCount === 1;
  },
};
